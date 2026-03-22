using System.Net.Http;
using System.Text.Json;

namespace EDR.Agent.Core.Services;

/// <summary>
/// Checks server for agent updates (Phase 6 — Falcon-style sensor update visibility).
/// </summary>
public class UpdateCheckService
{
    private readonly string _serverUrl;
    private readonly string _currentVersion;
    private static readonly HttpClient HttpClient = new();
    private readonly object _telemetryLock = new();

    public UpdateCheckService(string serverUrl, string currentVersion = "1.0.0")
    {
        _serverUrl = serverUrl.TrimEnd('/');
        _currentVersion = currentVersion;
    }

    /// <summary>UTC time of the last successful check against the management server.</summary>
    public DateTimeOffset? LastCheckUtc { get; private set; }

    /// <summary>True when the server reported a newer agent release than the running sensor.</summary>
    public bool LastUpdateAvailable { get; private set; }

    /// <summary>Version string from the server when an update is available.</summary>
    public string? LastTargetVersion { get; private set; }

    private void RecordTelemetry(bool updateAvailable, string? targetVersion)
    {
        lock (_telemetryLock)
        {
            LastCheckUtc = DateTimeOffset.UtcNow;
            LastUpdateAvailable = updateAvailable;
            LastTargetVersion = targetVersion;
        }
    }

    public async Task<UpdateInfo?> CheckAsync(CancellationToken ct = default)
    {
        try
        {
            var url = $"{_serverUrl}/api/agent/update/check?version={Uri.EscapeDataString(_currentVersion)}";
            using var req = new HttpRequestMessage(HttpMethod.Get, url);
            req.Headers.TryAddWithoutValidation("X-Agent-Version", _currentVersion);
            var res = await HttpClient.SendAsync(req, ct);
            res.EnsureSuccessStatusCode();
            var json = await res.Content.ReadAsStringAsync(ct);
            var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (!root.TryGetProperty("update_available", out var avail) || !avail.GetBoolean())
            {
                RecordTelemetry(false, null);
                return null;
            }

            var version = root.TryGetProperty("version", out var v) ? v.GetString() : null;
            RecordTelemetry(true, version);
            return new UpdateInfo
            {
                Version = version,
                DownloadUrl = root.TryGetProperty("download_url", out var u) ? u.GetString() : null,
                ChecksumSha256 = root.TryGetProperty("checksum_sha256", out var c) ? c.GetString() : null,
                ReleaseNotes = root.TryGetProperty("release_notes", out var n) ? n.GetString() : null,
            };
        }
        catch
        {
            return null;
        }
    }
}

public class UpdateInfo
{
    public string? Version { get; set; }
    public string? DownloadUrl { get; set; }
    public string? ChecksumSha256 { get; set; }
    public string? ReleaseNotes { get; set; }
}
