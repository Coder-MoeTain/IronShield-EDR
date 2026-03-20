using System.Text.Json;
using EDR.Agent.Core.Antivirus.Models;
using EDR.Agent.Core.Transport;

namespace EDR.Agent.Core.Antivirus;

/// <summary>
/// Fetches and caches AV signatures from the backend.
/// </summary>
public class SignatureUpdateService
{
    private readonly HttpTransport _transport;
    private readonly string _cachePath;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true,
    };

    public SignatureUpdateService(HttpTransport transport)
    {
        _transport = transport;
        _cachePath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
            "EDR",
            "AvSignatures",
            "signatures.json"
        );
    }

    public string CachePath => _cachePath;

    public async Task<List<AvSignature>> LoadOrFetchAsync(CancellationToken ct = default)
    {
        var version = await _transport.GetAvSignaturesVersionAsync(ct);
        var localVersion = ReadLocalVersion();
        if (version != null && version.Version == localVersion && File.Exists(_cachePath))
        {
            return LoadFromCache();
        }

        var download = await _transport.DownloadAvSignaturesAsync(null, ct);
        if (download?.Signatures == null) return LoadFromCache();

        SaveToCache(download.Version, download.Signatures);
        return download.Signatures;
    }

    private string? ReadLocalVersion()
    {
        try
        {
            var metaPath = Path.Combine(Path.GetDirectoryName(_cachePath)!, "version.txt");
            return File.Exists(metaPath) ? File.ReadAllText(metaPath).Trim() : null;
        }
        catch { return null; }
    }

    private List<AvSignature> LoadFromCache()
    {
        try
        {
            if (!File.Exists(_cachePath)) return [];
            var json = File.ReadAllText(_cachePath);
            var data = JsonSerializer.Deserialize<SignaturesCache>(json, JsonOptions);
            return data?.Signatures ?? [];
        }
        catch
        {
            return [];
        }
    }

    private void SaveToCache(string version, List<AvSignature> signatures)
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(_cachePath)!);
            var data = new SignaturesCache { Version = version, Signatures = signatures };
            File.WriteAllText(_cachePath, JsonSerializer.Serialize(data, JsonOptions));
            File.WriteAllText(Path.Combine(Path.GetDirectoryName(_cachePath)!, "version.txt"), version);
        }
        catch { }
    }

    private class SignaturesCache
    {
        public string Version { get; set; } = "";
        public List<AvSignature> Signatures { get; set; } = new();
    }
}
