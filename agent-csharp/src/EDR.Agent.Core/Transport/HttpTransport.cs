using System.Net;
using System.Net.Http.Headers;
using System.Net.Security;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using EDR.Agent.Core.Antivirus.Models;
using EDR.Agent.Core.Models;

namespace EDR.Agent.Core.Transport;

/// <summary>
/// HTTP transport for agent-to-server communication.
/// </summary>
public class HttpTransport
{
    private readonly HttpClient _client;
    private readonly string _baseUrl;
    private string? _agentKey;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false,
    };

    private static readonly JsonSerializerOptions DetectionRulesJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true,
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
    };

    public HttpTransport(AgentConfig config, string? agentKey = null)
    {
        _baseUrl = (config.ServerUrl ?? "").Trim().TrimEnd('/');
        _agentKey = agentKey;
        if (string.IsNullOrWhiteSpace(_baseUrl))
            throw new InvalidOperationException("ServerUrl is required");

        if (config.RequireHttps && _baseUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("HTTPS is required (RequireHttps=true)");

        var pins = (config.PinnedServerCertThumbprints ?? new List<string>())
            .Select(NormalizeThumbprint)
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var handler = new HttpClientHandler();

        // Optional mTLS client certificate
        if (!string.IsNullOrWhiteSpace(config.ClientCertificatePfxPath))
        {
            try
            {
                var pfxPath = config.ClientCertificatePfxPath.Trim();
                var pfxPwd = config.ClientCertificatePfxPassword;
                var cert = pfxPwd == null
                    ? new X509Certificate2(pfxPath)
                    : new X509Certificate2(pfxPath, pfxPwd);
                handler.ClientCertificates.Add(cert);
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException($"Failed to load client certificate PFX: {ex.Message}");
            }
        }
        if (pins.Count > 0)
        {
            handler.ServerCertificateCustomValidationCallback = (_, cert, _, sslErrors) =>
            {
                // We intentionally do NOT allow invalid chains; pinning is additive, not a replacement.
                if (sslErrors != SslPolicyErrors.None) return false;
                if (cert == null) return false;
                var x509 = cert as X509Certificate2 ?? new X509Certificate2(cert);
                var tp = NormalizeThumbprint(x509.Thumbprint);
                return tp != null && pins.Contains(tp);
            };
        }

        _client = new HttpClient(handler)
        {
            Timeout = TimeSpan.FromSeconds(30),
        };
        _client.DefaultRequestHeaders.Add("User-Agent", "EDR-Agent/1.0");
        if (!string.IsNullOrEmpty(agentKey))
            _client.DefaultRequestHeaders.Add("X-Agent-Key", agentKey);
    }

    private static string? NormalizeThumbprint(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        return new string(s.Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
    }

    /// <summary>Transient network failures and HTTP 408 / 429 / 5xx — recreates request each attempt.</summary>
    private async Task<HttpResponseMessage> SendWithRetryAsync(
        Func<HttpRequestMessage> requestFactory,
        CancellationToken ct)
    {
        Exception? last = null;
        for (var attempt = 1; attempt <= 3; attempt++)
        {
            using var req = requestFactory();
            HttpResponseMessage res;
            try
            {
                res = await _client.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);
            }
            catch (HttpRequestException ex) when (attempt < 3)
            {
                last = ex;
                await Task.Delay(BackoffMs(attempt), ct);
                continue;
            }
            catch (TaskCanceledException ex)
            {
                if (ct.IsCancellationRequested) throw;
                if (attempt < 3)
                {
                    last = ex;
                    await Task.Delay(BackoffMs(attempt), ct);
                    continue;
                }
                throw;
            }

            if (res.IsSuccessStatusCode)
                return res;

            var code = (int)res.StatusCode;
            var retryable = code == 408 || code == 429 || code is >= 500 and <= 504;
            var errBody = await res.Content.ReadAsStringAsync(ct);
            res.Dispose();
            var snippet = errBody.Length <= 512 ? errBody : errBody[..512];

            if (retryable && attempt < 3)
            {
                await Task.Delay(BackoffMs(attempt), ct);
                continue;
            }

            throw new HttpRequestException($"HTTP {(HttpStatusCode)code} - {snippet}");
        }

        throw last ?? new HttpRequestException("Request failed after retries");
    }

    private static int BackoffMs(int attempt) => attempt switch { 1 => 400, 2 => 1200, _ => 0 };

    public void SetAgentKey(string agentKey)
    {
        _agentKey = agentKey;
        _client.DefaultRequestHeaders.Remove("X-Agent-Key");
        _client.DefaultRequestHeaders.Add("X-Agent-Key", agentKey);
    }

    private HttpRequestMessage CreateSignedRequest(HttpMethod method, string url, string? jsonBody = null)
    {
        var req = new HttpRequestMessage(method, url);
        if (jsonBody != null)
            req.Content = new StringContent(jsonBody, Encoding.UTF8, "application/json");
        if (!string.IsNullOrWhiteSpace(_agentKey))
            AgentRequestSigner.SignRequest(req, _agentKey, jsonBody);
        return req;
    }

    /// <summary>Lightweight connectivity check (same base URL as other agent APIs).</summary>
    public async Task<bool> PingAsync(CancellationToken ct = default)
    {
        try
        {
            using var res = await _client.GetAsync($"{_baseUrl}/api/agent/ping", ct);
            return res.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// Register agent and return agent key.
    /// </summary>
    public async Task<RegistrationResult> RegisterAsync(object payload, string registrationToken, CancellationToken ct = default)
    {
        var json = JsonSerializer.Serialize(payload, JsonOptions);
        using var res = await SendWithRetryAsync(
            () =>
            {
                var r = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl}/api/agent/register");
                r.Headers.Add("X-Registration-Token", registrationToken);
                r.Content = new StringContent(json, Encoding.UTF8, "application/json");
                return r;
            },
            ct);
        var body = await res.Content.ReadAsStringAsync(ct);

        var result = JsonSerializer.Deserialize<RegistrationResult>(body, JsonOptions);
        return result ?? throw new InvalidOperationException("Invalid registration response");
    }

    /// <summary>
    /// Send heartbeat.
    /// </summary>
    public async Task<HeartbeatResult> HeartbeatAsync(HeartbeatPayload payload, CancellationToken ct = default)
    {
        var json = JsonSerializer.Serialize(payload, JsonOptions);
        using var res = await SendWithRetryAsync(
            () => CreateSignedRequest(HttpMethod.Post, $"{_baseUrl}/api/agent/heartbeat", json),
            ct);
        var body = await res.Content.ReadAsStringAsync(ct);

        return JsonSerializer.Deserialize<HeartbeatResult>(body, JsonOptions) ?? new HeartbeatResult();
    }

    /// <summary>
    /// Send batch of events.
    /// </summary>
    public async Task<EventsBatchResult> SendEventsBatchAsync(IEnumerable<object> events, string? batchId = null, CancellationToken ct = default)
    {
        var list = events.ToList();
        var payloadJson = JsonSerializer.Serialize(new { batch_id = batchId, events = list }, JsonOptions);
        using var res = await SendWithRetryAsync(
            () => CreateSignedRequest(HttpMethod.Post, $"{_baseUrl}/api/agent/events/batch", payloadJson),
            ct);
        var body = await res.Content.ReadAsStringAsync(ct);

        return JsonSerializer.Deserialize<EventsBatchResult>(body, JsonOptions) ?? new EventsBatchResult { Inserted = list.Count };
    }

    /// <summary>
    /// Rotate agent key (server issues a new key, invalidating the old one).
    /// </summary>
    public async Task<string> RotateAgentKeyAsync(CancellationToken ct = default)
    {
        using var req = CreateSignedRequest(HttpMethod.Post, $"{_baseUrl}/api/agent/key/rotate", "{}");
        var res = await _client.SendAsync(req, ct);
        var body = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode) throw new HttpRequestException($"Key rotation failed: {res.StatusCode} - {body}");
        using var doc = JsonDocument.Parse(body);
        if (!doc.RootElement.TryGetProperty("agent_key", out var k)) throw new InvalidOperationException("Invalid rotate response");
        return k.GetString() ?? throw new InvalidOperationException("Invalid agent_key");
    }

    /// <summary>
    /// Fetch enabled IOA detection rules for local evaluation (same semantics as server engine).
    /// </summary>
    public async Task<DetectionRulesSyncResponse?> GetDetectionRulesAsync(CancellationToken ct = default)
    {
        using var req = CreateSignedRequest(HttpMethod.Get, $"{_baseUrl}/api/agent/detection-rules");
        var res = await _client.SendAsync(req, ct);
        if (res.StatusCode == HttpStatusCode.NotFound) return null;
        if (!res.IsSuccessStatusCode) return null;
        var body = await res.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<DetectionRulesSyncResponse>(body, DetectionRulesJsonOptions);
    }

    /// <summary>
    /// Fetch endpoint policy (Phase 3).
    /// </summary>
    public async Task<EndpointPolicy?> GetPolicyAsync(CancellationToken ct = default)
    {
        using var req = CreateSignedRequest(HttpMethod.Get, $"{_baseUrl}/api/agent/policy");
        var res = await _client.SendAsync(req, ct);
        if (res.StatusCode == System.Net.HttpStatusCode.NotFound) return null;
        res.EnsureSuccessStatusCode();
        var body = await res.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<EndpointPolicy>(body, JsonOptions);
    }

    /// <summary>
    /// Push network connections directly for immediate display.
    /// </summary>
    public async Task PushNetworkConnectionsAsync(IEnumerable<object> connections, CancellationToken ct = default)
    {
        var list = connections.ToList();
        if (list.Count == 0) return;
        var payload = new { connections = list };
        var json = JsonSerializer.Serialize(payload, JsonOptions);
        var req = CreateSignedRequest(HttpMethod.Post, $"{_baseUrl}/api/agent/network/connections", json);
        var res = await _client.SendAsync(req, ct);
        if (!res.IsSuccessStatusCode)
            System.Diagnostics.Debug.WriteLine($"[Agent] Network push failed: {res.StatusCode}");
    }

    /// <summary>
    /// Submit triage result (Phase 3).
    /// </summary>
    public async Task SubmitTriageResultAsync(long requestId, object result, bool success = true, string? message = null, CancellationToken ct = default)
    {
        var payload = new { request_id = requestId, result, success, message };
        var json = JsonSerializer.Serialize(payload, JsonOptions);
        var req = CreateSignedRequest(HttpMethod.Post, $"{_baseUrl}/api/agent/triage/result", json);
        var res = await _client.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();
    }

    // ============ Antivirus APIs ============

    private static readonly JsonSerializerOptions AvJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true,
    };

    public async Task<AvPolicy?> GetAvPolicyAsync(CancellationToken ct = default)
    {
        using var req = CreateSignedRequest(HttpMethod.Get, $"{_baseUrl}/api/agent/av/policy");
        var res = await _client.SendAsync(req, ct);
        if (!res.IsSuccessStatusCode) return null;
        var body = await res.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<AvPolicy>(body, AvJsonOptions);
    }

    public async Task<AvSignaturesVersion?> GetAvSignaturesVersionAsync(CancellationToken ct = default)
    {
        using var req = CreateSignedRequest(HttpMethod.Get, $"{_baseUrl}/api/agent/av/signatures/version");
        var res = await _client.SendAsync(req, ct);
        if (!res.IsSuccessStatusCode) return null;
        var body = await res.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<AvSignaturesVersion>(body, AvJsonOptions);
    }

    public async Task<AvSignaturesDownload?> DownloadAvSignaturesAsync(string? version = null, CancellationToken ct = default)
    {
        var url = $"{_baseUrl}/api/agent/av/signatures/download";
        if (!string.IsNullOrEmpty(version)) url += $"?version={Uri.EscapeDataString(version)}";
        using var req = CreateSignedRequest(HttpMethod.Get, url);
        var res = await _client.SendAsync(req, ct);
        if (!res.IsSuccessStatusCode) return null;
        var body = await res.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<AvSignaturesDownload>(body, AvJsonOptions);
    }

    public async Task SubmitAvScanResultAsync(long? taskId, IEnumerable<object> results, CancellationToken ct = default)
    {
        var payload = new { task_id = taskId, results = results.ToList() };
        var json = JsonSerializer.Serialize(payload, AvJsonOptions);
        var req = CreateSignedRequest(HttpMethod.Post, $"{_baseUrl}/api/agent/av/scan-result", json);
        var res = await _client.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();
    }

    public async Task SubmitAvQuarantineResultAsync(string originalPath, string quarantinePath, string? sha256, string? detectionName, CancellationToken ct = default)
    {
        var payload = new { original_path = originalPath, quarantine_path = quarantinePath, sha256, detection_name = detectionName, quarantined_by = "agent" };
        var json = JsonSerializer.Serialize(payload, AvJsonOptions);
        var req = CreateSignedRequest(HttpMethod.Post, $"{_baseUrl}/api/agent/av/quarantine-result", json);
        var res = await _client.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();
    }

    public async Task SubmitAvUpdateStatusAsync(string bundleVersion, string status, string? errorMessage = null, CancellationToken ct = default)
    {
        var payload = new { bundle_version = bundleVersion, status, error_message = errorMessage };
        var json = JsonSerializer.Serialize(payload, AvJsonOptions);
        var req = CreateSignedRequest(HttpMethod.Post, $"{_baseUrl}/api/agent/av/update-status", json);
        var res = await _client.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();
    }

    /// <summary>IOC-derived domain blocklist for Web & URL protection (hosts sinkhole).</summary>
    public async Task<WebUrlBlocklistResponse?> GetWebBlocklistAsync(CancellationToken ct = default)
    {
        using var req = CreateSignedRequest(HttpMethod.Get, $"{_baseUrl}/api/agent/web/blocklist");
        var res = await _client.SendAsync(req, ct);
        if (!res.IsSuccessStatusCode) return null;
        var body = await res.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<WebUrlBlocklistResponse>(body, JsonOptions);
    }
}

public record AvSignaturesVersion(string Version, string? UpdatedAt);
public record AvSignaturesDownload(string Version, List<AvSignature> Signatures);

public record WebUrlBlocklistResponse(bool Enabled, string Version, List<string> Domains);

public record RegistrationResult(string AgentKey, int EndpointId);
public record HeartbeatResult(int EndpointId = 0);
public record EventsBatchResult(int Inserted = 0);
