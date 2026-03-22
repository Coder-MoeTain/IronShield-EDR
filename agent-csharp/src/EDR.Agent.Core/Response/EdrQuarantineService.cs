using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.Cryptography;

namespace EDR.Agent.Core.Response;

/// <summary>
/// Moves a file into a protected quarantine folder (EDR response — not AV module).
/// </summary>
public sealed class EdrQuarantineService
{
    public async Task<(bool Success, string Message, string? Sha256)> QuarantineFileAsync(string fullPath, CancellationToken ct = default)
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            return (false, "Quarantine is only supported on Windows", null);

        if (string.IsNullOrWhiteSpace(fullPath))
            return (false, "file_path parameter required", null);

        var expanded = Environment.ExpandEnvironmentVariables(fullPath.Trim());
        if (!File.Exists(expanded))
            return (false, $"File not found: {expanded}", null);

        string? sha = null;
        try
        {
            await using var fs = File.OpenRead(expanded);
            using var sha256 = SHA256.Create();
            var hash = await sha256.ComputeHashAsync(fs, ct).ConfigureAwait(false);
            sha = Convert.ToHexString(hash).ToLowerInvariant();
        }
        catch (Exception ex)
        {
            return (false, $"Hash failed: {ex.Message}", null);
        }

        var baseDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "IronShield", "EDR-Quarantine");
        Directory.CreateDirectory(baseDir);
        var destName = $"{DateTime.UtcNow:yyyyMMddHHmmss}_{Path.GetFileName(expanded)}";
        var dest = Path.Combine(baseDir, destName);

        try
        {
            File.Move(expanded, dest);
            return (true, $"Quarantined to {dest}", sha);
        }
        catch (Exception ex)
        {
            return (false, ex.Message, sha);
        }
    }
}
