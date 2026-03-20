using System.Net.Http;
using System.Text.Json;

namespace EDR.Agent.Core.Services;

/// <summary>
/// Checks server for agent updates.
/// </summary>
public class UpdateCheckService
{
    private readonly string _serverUrl;
    private readonly string _currentVersion;
    private static readonly HttpClient HttpClient = new();

    public UpdateCheckService(string serverUrl, string currentVersion = "1.0.0")
    {
        _serverUrl = serverUrl.TrimEnd('/');
        _currentVersion = currentVersion;
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
                return null;
            return new UpdateInfo
            {
                Version = root.TryGetProperty("version", out var v) ? v.GetString() : null,
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
