using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using EDR.Agent.Core.Models;

namespace EDR.Agent.Core.Collectors;

/// <summary>
/// Collects process creation/termination via WMI or polling.
/// Simplified: polls running processes and infers new/terminated by diff.
/// Phase B: Adds SHA256 file hashing for executables.
/// </summary>
public class ProcessCollector : EventCollectorBase
{
    public override string SourceName => "ProcessMonitor";

    private HashSet<int> _knownPids = new();
    private readonly object _lock = new();

    public override async IAsyncEnumerable<TelemetryEvent> CollectAsync([System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken ct = default)
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            yield break;

        var events = new List<TelemetryEvent>();
        await Task.Run(() =>
        {
            try
            {
                var current = Process.GetProcesses()
                    .Select(p => (p.Id, p.ProcessName, GetProcessPath(p)))
                    .ToDictionary(x => x.Id, x => (x.ProcessName, x.Item3));

                lock (_lock)
                {
                    var known = _knownPids;
                    var newPids = current.Keys.Except(known).ToList();
                    var gonePids = known.Except(current.Keys).ToList();

                    foreach (var pid in newPids)
                    {
                        var (name, path) = current[pid];
                        var hash = !string.IsNullOrEmpty(path) ? ComputeFileSha256(path) : null;
                        var indicatorCount = BuildSuspiciousIndicatorCount(name, path);
                        var entropy = ComputeTextEntropy(path);
                        events.Add(new TelemetryEvent
                        {
                            EventId = $"proc_create_{pid}_{DateTime.UtcNow:O}",
                            Hostname = Environment.MachineName,
                            Timestamp = DateTime.UtcNow,
                            EventSource = SourceName,
                            EventType = "process_create",
                            ProcessId = pid,
                            ProcessName = name,
                            ProcessPath = path,
                            FileHashSha256 = hash,
                            Username = Environment.UserName,
                            CommandLineEntropy = entropy,
                            SuspiciousIndicatorCount = indicatorCount,
                            CollectorConfidence = 0.92,
                            RawData = new Dictionary<string, object?>
                            {
                                ["collector_version"] = "process-v2",
                                ["path_depth"] = CountPathDepth(path),
                            },
                        });
                    }

                    foreach (var pid in gonePids)
                    {
                        events.Add(new TelemetryEvent
                        {
                            EventId = $"proc_exit_{pid}_{DateTime.UtcNow:O}",
                            Hostname = Environment.MachineName,
                            Timestamp = DateTime.UtcNow,
                            EventSource = SourceName,
                            EventType = "process_terminate",
                            ProcessId = pid,
                            Username = Environment.UserName,
                        });
                    }

                    _knownPids = current.Keys.ToHashSet();
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[ProcessCollector] {ex.Message}");
            }
        }, ct);

        foreach (var evt in events)
            yield return evt;
    }

    private static string? GetProcessPath(Process p)
    {
        try
        {
            return p.MainModule?.FileName;
        }
        catch
        {
            return null;
        }
    }

    /// <summary>Compute SHA256 hash of file. Returns null if file is locked or inaccessible.</summary>
    private static string? ComputeFileSha256(string filePath)
    {
        try
        {
            if (string.IsNullOrEmpty(filePath) || !File.Exists(filePath))
                return null;
            using var fs = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read);
            var hash = SHA256.HashData(fs);
            return Convert.ToHexString(hash).ToLowerInvariant();
        }
        catch
        {
            return null;
        }
    }

    private static int BuildSuspiciousIndicatorCount(string? processName, string? processPath)
    {
        var score = 0;
        var name = (processName ?? string.Empty).ToLowerInvariant();
        var path = (processPath ?? string.Empty).ToLowerInvariant();

        if (name is "powershell" or "powershell.exe" or "pwsh" or "pwsh.exe" or "cmd" or "cmd.exe") score++;
        if (path.Contains("\\appdata\\") || path.Contains("\\temp\\") || path.Contains("\\programdata\\")) score++;
        if (path.EndsWith(".tmp") || path.EndsWith(".dat")) score++;
        if (path.Contains("rundll32") || path.Contains("regsvr32") || path.Contains("mshta")) score++;

        return score;
    }

    private static double? ComputeTextEntropy(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        var input = text.Trim();
        if (input.Length < 8) return 0;
        var counts = new Dictionary<char, int>();
        foreach (var c in input)
        {
            counts[c] = counts.TryGetValue(c, out var n) ? n + 1 : 1;
        }
        var len = input.Length;
        double entropy = 0;
        foreach (var kv in counts)
        {
            var p = (double)kv.Value / len;
            entropy -= p * Math.Log2(p);
        }
        return Math.Round(entropy, 4);
    }

    private static int CountPathDepth(string? path)
    {
        if (string.IsNullOrWhiteSpace(path)) return 0;
        return path.Split(new[] { '\\', '/' }, StringSplitOptions.RemoveEmptyEntries).Length;
    }
}
