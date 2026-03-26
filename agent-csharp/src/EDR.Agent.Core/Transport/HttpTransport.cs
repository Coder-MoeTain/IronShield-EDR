using System.Net.Http.Headers;
using System.Net.Security;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json;
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
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false,
    };

    public HttpTransport(AgentConfig config, string? agentKey = null)
    {
        _baseUrl = (config.ServerUrl ?? "").Trim().TrimEnd('/');
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

    public void SetAgentKey(string agentKey)
    {
        _client.DefaultRequestHeaders.Remove("X-Agent-Key");
        _client.DefaultRequestHeaders.Add("X-Agent-Key", agentKey);
    }

    /// <summary>
    /// Register agent and return agent key.
    /// </summary>
    public async Task<RegistrationResult> RegisterAsync(object payload, string registrationToken, CancellationToken ct = default)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl}/api/agent/register");
        req.Headers.Add("X-Registration-Token", registrationToken);
        req.Content = new StringContent(JsonSerializer.Serialize(payload, JsonOptions), Encoding.UTF8, "application/json");

        var res = await _client.SendAsync(req, ct);
        var body = await res.Content.ReadAsStringAsync(ct);

        if (!res.IsSuccessStatusCode)
            throw new HttpRequestException($"Registration failed: {res.StatusCode} - {body}");

        var result = JsonSerializer.Deserialize<RegistrationResult>(body, JsonOptions);
        return result ?? throw new InvalidOperationException("Invalid registration response");
    }

    /// <summary>
    /// Send heartbeat.
    /// </summary>
    public async Task<HeartbeatResult> HeartbeatAsync(HeartbeatPayload payload, CancellationToken ct = default)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl}/api/agent/heartbeat");
        req.Content = new StringContent(JsonSerializer.Serialize(payload, JsonOptions), Encoding.UTF8, "application/json");

        var res = await _client.SendAsync(req, ct);
        var body = await res.Content.ReadAsStringAsync(ct);

        if (!res.IsSuccessStatusCode)
            throw new HttpRequestException($"Heartbeat failed: {res.StatusCode} - {body}");

        return JsonSerializer.Deserialize<HeartbeatResult>(body, JsonOptions) ?? new HeartbeatResult();
    }

    /// <summary>
    /// Send batch of events.
    /// </summary>
    public async Task<EventsBatchResult> SendEventsBatchAsync(IEnumerable<object> events, string? batchId = null, CancellationToken ct = default)
    {
        var list = events.ToList();
        var payload = new { batch_id = batchId, events = list };
        var req = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl}/api/agent/events/batch");
        req.Content = new StringContent(JsonSerializer.Serialize(payload, JsonOptions), Encoding.UTF8, "application/json");

        var res = await _client.SendAsync(req, ct);
        var body = await res.Content.ReadAsStringAsync(ct);

        if (!res.IsSuccessStatusCode)
            throw new HttpRequestException($"Events upload failed: {res.StatusCode} - {body}");

        return JsonSerializer.Deserialize<EventsBatchResult>(body, JsonOptions) ?? new EventsBatchResult { Inserted = list.Count };
    }

    /// <summary>
    /// Rotate agent key (server issues a new key, invalidating the old one).
    /// </summary>
    public async Task<string> RotateAgentKeyAsync(CancellationToken ct = default)
    {
        var res = await _client.PostAsync($"{_baseUrl}/api/agent/key/rotate", new StringContent("{}", Encoding.UTF8, "application/json"), ct);
        var body = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode) throw new HttpRequestException($"Key rotation failed: {res.StatusCode} - {body}");
        using var doc = JsonDocument.Parse(body);
        if (!doc.RootElement.TryGetProperty("agent_key", out var k)) throw new InvalidOperationException("Invalid rotate response");
        return k.GetString() ?? throw new InvalidOperationException("Invalid agent_key");
    }

    /// <summary>
    /// Fetch endpoint policy (Phase 3).
    /// </summary>
    public async Task<EndpointPolicy?> GetPolicyAsync(CancellationToken ct = default)
    {
        var res = await _client.GetAsync($"{_baseUrl}/api/agent/policy", ct);
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
        var req = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl}/api/agent/network/connections");
        req.Content = new StringContent(JsonSerializer.Serialize(payload, JsonOptions), Encoding.UTF8, "application/json");
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
        var req = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl}/api/agent/triage/result");
        req.Content = new StringContent(JsonSerializer.Serialize(payload, JsonOptions), Encoding.UTF8, "application/json");
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
        var res = await _client.GetAsync($"{_baseUrl}/api/agent/av/policy", ct);
        if (!res.IsSuccessStatusCode) return null;
        var body = await res.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<AvPolicy>(body, AvJsonOptions);
    }

    public async Task<AvSignaturesVersion?> GetAvSignaturesVersionAsync(CancellationToken ct = default)
    {
        var res = await _client.GetAsync($"{_baseUrl}/api/agent/av/signatures/version", ct);
        if (!res.IsSuccessStatusCode) return null;
        var body = await res.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<AvSignaturesVersion>(body, AvJsonOptions);
    }

    public async Task<AvSignaturesDownload?> DownloadAvSignaturesAsync(string? version = null, CancellationToken ct = default)
    {
        var url = $"{_baseUrl}/api/agent/av/signatures/download";
        if (!string.IsNullOrEmpty(version)) url += $"?version={Uri.EscapeDataString(version)}";
        var res = await _client.GetAsync(url, ct);
        if (!res.IsSuccessStatusCode) return null;
        var body = await res.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<AvSignaturesDownload>(body, AvJsonOptions);
    }

    public async Task SubmitAvScanResultAsync(long? taskId, IEnumerable<object> results, CancellationToken ct = default)
    {
        var payload = new { task_id = taskId, results = results.ToList() };
        var req = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl}/api/agent/av/scan-result");
        req.Content = new StringContent(JsonSerializer.Serialize(payload, AvJsonOptions), Encoding.UTF8, "application/json");
        var res = await _client.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();
    }

    public async Task SubmitAvQuarantineResultAsync(string originalPath, string quarantinePath, string? sha256, string? detectionName, CancellationToken ct = default)
    {
        var payload = new { original_path = originalPath, quarantine_path = quarantinePath, sha256, detection_name = detectionName, quarantined_by = "agent" };
        var req = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl}/api/agent/av/quarantine-result");
        req.Content = new StringContent(JsonSerializer.Serialize(payload, AvJsonOptions), Encoding.UTF8, "application/json");
        var res = await _client.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();
    }

    public async Task SubmitAvUpdateStatusAsync(string bundleVersion, string status, string? errorMessage = null, CancellationToken ct = default)
    {
        var payload = new { bundle_version = bundleVersion, status, error_message = errorMessage };
        var req = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl}/api/agent/av/update-status");
        req.Content = new StringContent(JsonSerializer.Serialize(payload, AvJsonOptions), Encoding.UTF8, "application/json");
        var res = await _client.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();
    }
}

public record AvSignaturesVersion(string Version, string? UpdatedAt);
public record AvSignaturesDownload(string Version, List<AvSignature> Signatures);

public record RegistrationResult(string AgentKey, int EndpointId);
public record HeartbeatResult(int EndpointId = 0);
public record EventsBatchResult(int Inserted = 0);
