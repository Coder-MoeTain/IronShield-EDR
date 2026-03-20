namespace EDR.Agent.Core.Antivirus;

/// <summary>
/// Safely quarantines suspicious files - defensive only.
/// </summary>
public class QuarantineService
{
    private readonly string _quarantineRoot;
    private const string QuarantineSubdir = "EDR_Quarantine";

    public QuarantineService()
    {
        _quarantineRoot = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
            "EDR",
            QuarantineSubdir
        );
    }

    public string QuarantineRoot => _quarantineRoot;

    public async Task<QuarantineResult?> QuarantineAsync(string sourcePath, string? detectionName, CancellationToken ct = default)
    {
        if (!File.Exists(sourcePath)) return null;
        try
        {
            Directory.CreateDirectory(_quarantineRoot);
            var id = Guid.NewGuid().ToString("N")[..16];
            var ext = Path.GetExtension(sourcePath);
            var quarantinePath = Path.Combine(_quarantineRoot, $"{id}{ext}.quarantine");

            await Task.Run(() =>
            {
                File.Move(sourcePath, quarantinePath);
            }, ct);

            var sha256 = FileHashService.ComputeSha256(quarantinePath);
            return new QuarantineResult
            {
                OriginalPath = sourcePath,
                QuarantinePath = quarantinePath,
                QuarantineId = id,
                Sha256 = sha256,
                DetectionName = detectionName,
            };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[Quarantine] Failed: {ex.Message}");
            return null;
        }
    }

    public bool Restore(string quarantinePath, string destinationPath)
    {
        try
        {
            if (!File.Exists(quarantinePath)) return false;
            Directory.CreateDirectory(Path.GetDirectoryName(destinationPath)!);
            File.Move(quarantinePath, destinationPath);
            return true;
        }
        catch
        {
            return false;
        }
    }

    public bool Delete(string quarantinePath)
    {
        try
        {
            if (File.Exists(quarantinePath))
            {
                File.Delete(quarantinePath);
                return true;
            }
        }
        catch { }
        return false;
    }
}

public class QuarantineResult
{
    public string OriginalPath { get; set; } = "";
    public string QuarantinePath { get; set; } = "";
    public string QuarantineId { get; set; } = "";
    public string? Sha256 { get; set; }
    public string? DetectionName { get; set; }
}
