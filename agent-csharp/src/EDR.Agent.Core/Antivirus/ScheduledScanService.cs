using EDR.Agent.Core.Antivirus.Models;

namespace EDR.Agent.Core.Antivirus;

/// <summary>
/// Runs scheduled full scans at configured intervals.
/// Defensive only - scans directories for malware.
/// </summary>
public class ScheduledScanService
{
    private readonly FileScanService _scanner;
    private readonly AvPolicy _policy;
    private readonly Func<IReadOnlyList<ScanResult>, CancellationToken, Task> _onDetections;
    private CancellationTokenSource? _cts;
    private Task? _runTask;

    public ScheduledScanService(
        FileScanService scanner,
        AvPolicy policy,
        Func<IReadOnlyList<ScanResult>, CancellationToken, Task> onDetections)
    {
        _scanner = scanner;
        _policy = policy;
        _onDetections = onDetections;
    }

    public void Start()
    {
        if (!_policy.ScheduledEnabled) return;

        _cts = new CancellationTokenSource();
        _runTask = RunLoopAsync(_cts.Token);
    }

    public void Stop()
    {
        _cts?.Cancel();
        try { _runTask?.GetAwaiter().GetResult(); } catch { }
    }

    private async Task RunLoopAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                if (!_policy.ScheduledEnabled) { await Task.Delay(TimeSpan.FromMinutes(5), ct); continue; }

                var dirs = GetScanDirectories();
                var allResults = new List<ScanResult>();

                foreach (var dir in dirs)
                {
                    if (!Directory.Exists(dir)) continue;
                    try
                    {
                        var results = await _scanner.ScanDirectoryAsync(dir, ct);
                        allResults.AddRange(results);
                    }
                    catch (Exception ex)
                    {
                        System.Diagnostics.Debug.WriteLine($"[ScheduledScan] Error scanning {dir}: {ex.Message}");
                    }
                }

                if (allResults.Count > 0)
                    await _onDetections(allResults, ct);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[ScheduledScan] Error: {ex.Message}");
            }

            await Task.Delay(TimeSpan.FromHours(24), ct);
        }
    }

    private List<string> GetScanDirectories()
    {
        var dirs = new List<string>();
        var includePaths = _policy.IncludePaths ?? [];

        if (includePaths.Count > 0)
        {
            foreach (var p in includePaths)
            {
                var expanded = ExpandPath(p);
                if (Directory.Exists(expanded))
                    dirs.Add(expanded);
            }
        }

        if (dirs.Count == 0)
        {
            var profile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            var temp = Path.GetTempPath();
            var downloads = Path.Combine(profile, "Downloads");
            var startup = Environment.GetFolderPath(Environment.SpecialFolder.Startup);
            var commonStartup = Environment.GetFolderPath(Environment.SpecialFolder.CommonStartup);

            foreach (var d in new[] { temp, downloads, startup, commonStartup, Path.Combine(localAppData, "Temp") })
            {
                if (Directory.Exists(d)) dirs.Add(d);
            }
        }

        return dirs.Distinct().ToList();
    }

    private static string ExpandPath(string path)
    {
        path = path.Replace("%USERPROFILE%", Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), StringComparison.OrdinalIgnoreCase);
        path = path.Replace("%TEMP%", Path.GetTempPath(), StringComparison.OrdinalIgnoreCase);
        path = path.Replace("%LOCALAPPDATA%", Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), StringComparison.OrdinalIgnoreCase);
        path = path.Replace("%APPDATA%", Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), StringComparison.OrdinalIgnoreCase);
        path = path.Replace("*", "%USERNAME%");
        if (path.Contains("%USERNAME%", StringComparison.OrdinalIgnoreCase))
            path = path.Replace("%USERNAME%", Environment.UserName, StringComparison.OrdinalIgnoreCase);
        return path;
    }
}
