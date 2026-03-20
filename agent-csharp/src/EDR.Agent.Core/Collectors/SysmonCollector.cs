using System.Diagnostics;
using System.Diagnostics.Eventing.Reader;
using System.Runtime.InteropServices;
using System.Xml.Linq;
using EDR.Agent.Core.Models;

namespace EDR.Agent.Core.Collectors;

/// <summary>
/// Collects events from Sysmon (Microsoft-Windows-Sysmon/Operational).
/// Requires Sysmon to be installed. Event IDs: 1=ProcessCreate, 5=ProcessTerminate.
/// </summary>
public class SysmonCollector : EventCollectorBase
{
    public override string SourceName => "Sysmon";

    private DateTime _lastCollectTime = DateTime.UtcNow.AddMinutes(-5);
    private const string LogPath = "Microsoft-Windows-Sysmon/Operational";

    public override async IAsyncEnumerable<TelemetryEvent> CollectAsync([System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken ct = default)
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            yield break;

        var events = new List<TelemetryEvent>();
        await Task.Run(() =>
        {
            try
            {
                var cutoff = _lastCollectTime.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.000Z");
                var xpath = $"*[System[(EventID=1 or EventID=5) and TimeCreated[@SystemTime>='{cutoff}']]]";
                var query = new EventLogQuery(LogPath, PathType.LogName, xpath);
                using var reader = new EventLogReader(query);
                for (var rec = reader.ReadEvent(); rec != null; rec = reader.ReadEvent())
                {
                    using (rec)
                    {
                        var evt = MapSysmonToTelemetry(rec);
                        if (evt != null) events.Add(evt);
                    }
                }
                _lastCollectTime = DateTime.UtcNow;
            }
            catch (EventLogNotFoundException)
            {
                Debug.WriteLine("[SysmonCollector] Sysmon log not found - is Sysmon installed?");
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[SysmonCollector] {ex.Message}");
            }
        }, ct);

        foreach (var evt in events)
            yield return evt;
    }

    private static TelemetryEvent? MapSysmonToTelemetry(EventRecord rec)
    {
        var id = rec.Id;
        if (id != 1 && id != 5) return null;

        var xml = rec.ToXml();
        var data = ParseEventData(xml);

        if (id == 1) // ProcessCreate
        {
            return new TelemetryEvent
            {
                EventId = $"sysmon_1_{data.GetValueOrDefault("ProcessGuid", "")}_{rec.TimeCreated:O}",
                Hostname = Environment.MachineName,
                Timestamp = rec.TimeCreated ?? DateTime.UtcNow,
                EventSource = "Sysmon",
                EventType = "process_create",
                ProcessId = ParseInt(data.GetValueOrDefault("ProcessId")),
                ProcessName = GetFileName(data.GetValueOrDefault("Image")),
                ProcessPath = data.GetValueOrDefault("Image"),
                ParentProcessId = ParseInt(data.GetValueOrDefault("ParentProcessId")),
                ParentProcessName = GetFileName(data.GetValueOrDefault("ParentImage")),
                CommandLine = data.GetValueOrDefault("CommandLine"),
                FileHashSha256 = ParseSha256FromHashes(data.GetValueOrDefault("Hashes")),
                Username = data.GetValueOrDefault("User"),
                RawData = new Dictionary<string, object?>
                {
                    ["message"] = rec.FormatDescription(),
                    ["process_guid"] = data.GetValueOrDefault("ProcessGuid"),
                },
            };
        }

        // id == 5: ProcessTerminate
        return new TelemetryEvent
        {
            EventId = $"sysmon_5_{data.GetValueOrDefault("ProcessGuid", "")}_{rec.TimeCreated:O}",
            Hostname = Environment.MachineName,
            Timestamp = rec.TimeCreated ?? DateTime.UtcNow,
            EventSource = "Sysmon",
            EventType = "process_terminate",
            ProcessId = ParseInt(data.GetValueOrDefault("ProcessId")),
            Username = Environment.UserName,
            RawData = new Dictionary<string, object?>
            {
                ["process_guid"] = data.GetValueOrDefault("ProcessGuid"),
            },
        };
    }

    private static Dictionary<string, string> ParseEventData(string xml)
    {
        var dict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        try
        {
            var doc = XDocument.Parse(xml);
            foreach (var elem in doc.Descendants().Where(e => e.Name.LocalName == "Data"))
            {
                var name = elem.Attribute("Name")?.Value;
                if (name != null)
                    dict[name] = elem.Value;
            }
        }
        catch { /* ignore */ }
        return dict;
    }

    private static int? ParseInt(string? s)
    {
        if (string.IsNullOrEmpty(s)) return null;
        return int.TryParse(s, out var n) ? n : null;
    }

    private static string? GetFileName(string? path)
    {
        if (string.IsNullOrEmpty(path)) return null;
        return Path.GetFileName(path);
    }

    /// <summary>Extract SHA256 from Sysmon Hashes field, e.g. "SHA256=abc123..."</summary>
    private static string? ParseSha256FromHashes(string? hashes)
    {
        if (string.IsNullOrEmpty(hashes)) return null;
        const string prefix = "SHA256=";
        var idx = hashes.IndexOf(prefix, StringComparison.OrdinalIgnoreCase);
        if (idx < 0) return null;
        var start = idx + prefix.Length;
        var end = hashes.IndexOf(',', start);
        var hash = end >= 0 ? hashes[start..end].Trim() : hashes[start..].Trim();
        return hash.Length == 64 ? hash : null;
    }
}
