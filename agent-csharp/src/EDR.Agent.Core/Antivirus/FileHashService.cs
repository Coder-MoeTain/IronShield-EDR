using System.Security.Cryptography;

namespace EDR.Agent.Core.Antivirus;

/// <summary>
/// Computes file hashes (SHA256) for scanning.
/// </summary>
public static class FileHashService
{
    public static async Task<string?> ComputeSha256Async(string filePath, CancellationToken ct = default)
    {
        try
        {
            await using var stream = File.OpenRead(filePath);
            var hash = await SHA256.HashDataAsync(stream, ct);
            return BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
        }
        catch
        {
            return null;
        }
    }

    public static string? ComputeSha256(string filePath)
    {
        try
        {
            using var stream = File.OpenRead(filePath);
            var hash = SHA256.HashData(stream);
            return BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
        }
        catch
        {
            return null;
        }
    }
}
