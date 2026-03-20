using EDR.Agent.Core.Antivirus.Models;

namespace EDR.Agent.Core.Antivirus;

/// <summary>
/// Executes AV scan tasks from the backend.
/// </summary>
public class ScanTaskExecutor
{
    private readonly FileScanService _scanner;
    private readonly QuarantineService _quarantine;
    private readonly AvPolicy _policy;

    public ScanTaskExecutor(FileScanService scanner, QuarantineService quarantine, AvPolicy policy)
    {
        _scanner = scanner;
        _quarantine = quarantine;
        _policy = policy;
    }

    public async Task<ScanTaskResult> ExecuteAsync(AvScanTask task, CancellationToken ct = default)
    {
        var result = new ScanTaskResult { TaskId = task.Id };
        var dirs = ResolveTargetPaths(task);
        var allResults = new List<ScanResult>();
        var quarantined = 0;

        foreach (var dir in dirs)
        {
            if (!Directory.Exists(dir)) continue;
            var scanResults = await _scanner.ScanDirectoryAsync(dir, ct);
            allResults.AddRange(scanResults);

            foreach (var r in scanResults.Where(r => r.Score >= _policy.QuarantineThreshold))
            {
                if (File.Exists(r.FilePath))
                {
                    var qr = await _quarantine.QuarantineAsync(r.FilePath!, r.DetectionName, ct);
                    if (qr != null)
                    {
                        quarantined++;
                        result.Quarantined.Add(qr);
                    }
                }
            }
        }

        result.FilesScanned = allResults.Count;
        result.DetectionsFound = allResults.Count;
        result.Results = allResults;
        result.QuarantinedCount = quarantined;
        return result;
    }

    private static List<string> ResolveTargetPaths(AvScanTask task)
    {
        var paths = new List<string>();
        var target = (task.TargetPath ?? "").Trim();

        if (!string.IsNullOrEmpty(target))
        {
            paths.Add(target);
            return paths;
        }

        var profile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        var temp = Path.GetTempPath();
        var downloads = Path.Combine(profile, "Downloads");
        var startup = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Startup));
        var commonStartup = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonStartup));

        paths.Add(temp);
        if (Directory.Exists(downloads)) paths.Add(downloads);
        if (Directory.Exists(startup)) paths.Add(startup);
        if (Directory.Exists(commonStartup)) paths.Add(commonStartup);
        paths.Add(Path.Combine(localAppData, "Temp"));

        return paths.Where(Directory.Exists).Distinct().ToList();
    }
}

public class AvScanTask
{
    public long Id { get; set; }
    public string TaskType { get; set; } = "full_scan";
    public string? TargetPath { get; set; }
}

public class ScanTaskResult
{
    public long TaskId { get; set; }
    public int FilesScanned { get; set; }
    public int DetectionsFound { get; set; }
    public int QuarantinedCount { get; set; }
    public List<ScanResult> Results { get; set; } = new();
    public List<QuarantineResult> Quarantined { get; set; } = new();
}
