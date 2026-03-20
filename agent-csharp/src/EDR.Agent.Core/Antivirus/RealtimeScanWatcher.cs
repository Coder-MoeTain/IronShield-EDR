using System.Collections.Concurrent;
using EDR.Agent.Core.Antivirus.Models;

namespace EDR.Agent.Core.Antivirus;

/// <summary>
/// Watches configured directories for file create/modify/execute events and triggers scans.
/// Defensive only - uses FileSystemWatcher for real-time monitoring.
/// </summary>
public class RealtimeScanWatcher : IDisposable
{
    private readonly FileScanService _scanner;
    private readonly AvPolicy _policy;
    private readonly Func<ScanResult, CancellationToken, Task> _onDetection;
    private readonly List<FileSystemWatcher> _watchers = [];
    private readonly ConcurrentDictionary<string, DateTime> _recentScan = new();
    private readonly TimeSpan _debounce = TimeSpan.FromSeconds(2);
    private CancellationTokenSource? _cts;
    private bool _disposed;

    public RealtimeScanWatcher(
        FileScanService scanner,
        AvPolicy policy,
        Func<ScanResult, CancellationToken, Task> onDetection)
    {
        _scanner = scanner;
        _policy = policy;
        _onDetection = onDetection;
    }

    public void Start()
    {
        if (!_policy.RealtimeEnabled) return;

        _cts = new CancellationTokenSource();
        var dirs = GetWatchDirectories();

        foreach (var dir in dirs)
        {
            if (!Directory.Exists(dir)) continue;

            try
            {
                var watcher = new FileSystemWatcher(dir)
                {
                    IncludeSubdirectories = true,
                    NotifyFilter = NotifyFilters.FileName | NotifyFilters.LastWrite | NotifyFilters.CreationTime,
                };

                watcher.Created += (_, e) => QueueScan(e.FullPath!);
                watcher.Changed += (_, e) => QueueScan(e.FullPath!);
                watcher.Renamed += (_, e) => { QueueScan(e.FullPath!); QueueScan(e.OldFullPath!); };
                watcher.EnableRaisingEvents = true;

                _watchers.Add(watcher);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[RealtimeScan] Failed to watch {dir}: {ex.Message}");
            }
        }
    }

    public void Stop()
    {
        _cts?.Cancel();
        foreach (var w in _watchers)
        {
            try { w.EnableRaisingEvents = false; w.Dispose(); } catch { }
        }
        _watchers.Clear();
    }

    private void QueueScan(string path)
    {
        if (string.IsNullOrEmpty(path) || Directory.Exists(path)) return;

        var key = path.ToLowerInvariant();
        if (_recentScan.TryGetValue(key, out var last) && DateTime.UtcNow - last < _debounce)
            return;

        _recentScan[key] = DateTime.UtcNow;

        _ = Task.Run(async () =>
        {
            try
            {
                await Task.Delay(500, _cts?.Token ?? default);
                if (File.Exists(path))
                {
                    var result = await _scanner.ScanFileAsync(path, ct: _cts?.Token ?? default);
                    if (result != null)
                        await _onDetection(result, _cts?.Token ?? default);
                }
            }
            catch (OperationCanceledException) { }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[RealtimeScan] Scan error for {path}: {ex.Message}");
            }
        }, _cts?.Token ?? default);
    }

    private List<string> GetWatchDirectories()
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
        foreach (var kv in new Dictionary<string, string>
        {
            ["%USERPROFILE%"] = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
            ["%TEMP%"] = Path.GetTempPath(),
            ["%LOCALAPPDATA%"] = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            ["%APPDATA%"] = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        })
        {
            path = path.Replace(kv.Key, kv.Value, StringComparison.OrdinalIgnoreCase);
        }
        path = path.Replace("*", "%USERNAME%");
        if (path.Contains("%USERNAME%", StringComparison.OrdinalIgnoreCase))
        {
            var user = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            var parent = Path.GetDirectoryName(user);
            if (Directory.Exists(parent))
            {
                foreach (var userDir in Directory.GetDirectories(parent))
                {
                    var expanded = path.Replace("%USERNAME%", Path.GetFileName(userDir), StringComparison.OrdinalIgnoreCase);
                    if (Directory.Exists(expanded))
                        return expanded;
                }
            }
            return path.Replace("%USERNAME%", Environment.UserName, StringComparison.OrdinalIgnoreCase);
        }
        return path;
    }

    public void Dispose() => Dispose(true);
    protected virtual void Dispose(bool disposing)
    {
        if (_disposed) return;
        Stop();
        _disposed = true;
        GC.SuppressFinalize(this);
    }
}
