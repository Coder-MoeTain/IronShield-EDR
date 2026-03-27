using System.Diagnostics;
using System.Diagnostics.Eventing.Reader;
using System.Runtime.InteropServices;
using EDR.Agent.Core.Models;

namespace EDR.Agent.Core.Collectors;

/// <summary>
/// Collects security-relevant events via <see cref="EventLogReader"/> (XPath queries), aligned with common
/// audit and Sysmon-adjacent Windows telemetry — not a kernel sensor.
/// </summary>
public class WindowsEventCollector : EventCollectorBase
{
    public override string SourceName => "WindowsEventLog";

    private DateTime _lastCollectTime = DateTime.UtcNow.AddMinutes(-5);

    private readonly int _maxPerPoll;

    /// <summary>Security log — logon, process, tasks, account changes, audit cleared, etc.</summary>
    private static readonly int[] SecurityEventIds =
    [
        4624, 4625, 4634, 4647, 4648, 4672, 4688, 4689, 4697, 4698, 4699, 4700, 4701, 4702,
        4720, 4722, 4723, 4724, 4725, 4726, 4732, 4735, 4756, 4776, 4778, 4779, 1102,
    ];

    /// <summary>System log — service control, startup/shutdown, bugchecks.</summary>
    private static readonly int[] SystemEventIds =
    [
        7045, 7036, 1074, 1076, 6005, 6006, 6008, 6009, 41,
    ];

    public WindowsEventCollector(AgentConfig? config = null)
    {
        var n = config?.MaxWindowsEventLogEventsPerPoll ?? 500;
        _maxPerPoll = n < 1 ? 500 : Math.Min(n, 50_000);
    }

    public override async IAsyncEnumerable<TelemetryEvent> CollectAsync(
        [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken ct = default)
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            yield break;

        var events = new List<TelemetryEvent>();
        await Task.Run(() =>
        {
            var cutoff = _lastCollectTime.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ");
            var remaining = _maxPerPoll;

            try
            {
                remaining = CollectChannel("Security", BuildIdXPath(SecurityEventIds, cutoff), events, remaining);
            }
            catch (UnauthorizedAccessException)
            {
                Debug.WriteLine(
                    "[WindowsEventCollector] Security log: access denied — run the agent with rights to read the Security log.");
            }
            catch (EventLogNotFoundException ex)
            {
                Debug.WriteLine($"[WindowsEventCollector] Security log: {ex.Message}");
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[WindowsEventCollector] Security: {ex.Message}");
            }

            try
            {
                if (remaining > 0)
                    remaining = CollectChannel("System", BuildIdXPath(SystemEventIds, cutoff), events, remaining);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[WindowsEventCollector] System: {ex.Message}");
            }

            try
            {
                if (remaining > 0)
                {
                    var appXPath = $"*[System[((Level=1) or (Level=2) or (Level=3)) and TimeCreated[@SystemTime>='{cutoff}']]]";
                    CollectChannel("Application", appXPath, events, remaining);
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[WindowsEventCollector] Application: {ex.Message}");
            }

            _lastCollectTime = DateTime.UtcNow;
        }, ct);

        foreach (var evt in events)
            yield return evt;
    }

    /// <returns>Remaining event budget for this poll (other channels).</returns>
    private static int CollectChannel(string logName, string xpath, List<TelemetryEvent> sink, int budget)
    {
        if (budget <= 0) return 0;
        var query = new EventLogQuery(logName, PathType.LogName, xpath);
        using var reader = new EventLogReader(query);
        var added = 0;
        for (var rec = reader.ReadEvent(); rec != null; rec = reader.ReadEvent())
        {
            using (rec)
            {
                var evt = MapToTelemetry(rec, logName);
                if (evt == null) continue;
                sink.Add(evt);
                added++;
                if (added >= budget) return 0;
            }
        }

        return budget - added;
    }

    private static string BuildIdXPath(int[] ids, string cutoffUtc)
    {
        var filter = string.Join(" or ", ids.Select(id => $"EventID={id}"));
        return $"*[System[({filter}) and TimeCreated[@SystemTime>='{cutoffUtc}']]]";
    }

    private static string? FirstNonEmpty(IReadOnlyDictionary<string, string> d, params string[] keys)
    {
        foreach (var k in keys)
        {
            if (d.TryGetValue(k, out var v) && !string.IsNullOrEmpty(v)) return v;
        }

        return null;
    }

    private static TelemetryEvent? MapToTelemetry(EventRecord rec, string logName)
    {
        var xml = rec.ToXml();
        var d = EventXmlParser.ParseEventData(xml);
        var ts = rec.TimeCreated ?? DateTime.UtcNow;
        var rid = rec.RecordId ?? 0;

        return logName switch
        {
            "Security" => MapSecurityEvent(rec, d, ts, rid),
            "System" => MapSystemEvent(rec, d, ts, rid),
            "Application" => MapApplicationEvent(rec, d, ts, rid),
            _ => null,
        };
    }

    private static TelemetryEvent MapSecurityEvent(EventRecord rec, IReadOnlyDictionary<string, string> d,
        DateTime ts, long rid)
    {
        var id = rec.Id;
        var baseRaw = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
        {
            ["message"] = rec.FormatDescription(),
            ["channel"] = "Security",
            ["instance_id"] = id,
            ["record_id"] = rid,
        };
        foreach (var kv in d)
            baseRaw[$"security_{kv.Key}"] = kv.Value;

        return id switch
        {
            4624 => new TelemetryEvent
            {
                EventId = $"sec_4624_{rid}_{ts:O}",
                Hostname = Environment.MachineName,
                Timestamp = ts,
                EventSource = "Security",
                EventType = "logon_success",
                Username = d.GetValueOrDefault("TargetUserName"),
                LogonType = d.GetValueOrDefault("LogonType"),
                RawData = baseRaw,
            },
            4625 => new TelemetryEvent
            {
                EventId = $"sec_4625_{rid}_{ts:O}",
                Hostname = Environment.MachineName,
                Timestamp = ts,
                EventSource = "Security",
                EventType = "logon_failed",
                Username = d.GetValueOrDefault("TargetUserName"),
                LogonType = d.GetValueOrDefault("LogonType"),
                RawData = baseRaw,
            },
            4634 or 4647 => new TelemetryEvent
            {
                EventId = $"sec_{id}_{rid}_{ts:O}",
                Hostname = Environment.MachineName,
                Timestamp = ts,
                EventSource = "Security",
                EventType = "logoff",
                Username = d.GetValueOrDefault("TargetUserName"),
                RawData = baseRaw,
            },
            4688 => new TelemetryEvent
            {
                EventId = $"sec_4688_{rid}_{ts:O}",
                Hostname = Environment.MachineName,
                Timestamp = ts,
                EventSource = "Security",
                EventType = "process_create",
                ProcessId = EventXmlParser.ParseProcessId(d.GetValueOrDefault("NewProcessId")),
                ProcessName = EventXmlParser.GetFileName(d.GetValueOrDefault("NewProcessName")),
                ProcessPath = d.GetValueOrDefault("NewProcessName"),
                ParentProcessId = EventXmlParser.ParseProcessId(FirstNonEmpty(d, "Creator Process ID", "ProcessId")),
                ParentProcessName = EventXmlParser.GetFileName(
                    FirstNonEmpty(d, "Creator Process Name", "ParentProcessName")),
                CommandLine = d.GetValueOrDefault("CommandLine"),
                Username = d.GetValueOrDefault("SubjectUserName"),
                RawData = baseRaw,
            },
            4689 => new TelemetryEvent
            {
                EventId = $"sec_4689_{rid}_{ts:O}",
                Hostname = Environment.MachineName,
                Timestamp = ts,
                EventSource = "Security",
                EventType = "process_terminate",
                ProcessId = EventXmlParser.ParseProcessId(FirstNonEmpty(d, "ProcessId", "NewProcessId")),
                ProcessName = EventXmlParser.GetFileName(FirstNonEmpty(d, "Process Name", "NewProcessName")),
                Username = d.GetValueOrDefault("SubjectUserName"),
                RawData = baseRaw,
            },
            1102 => new TelemetryEvent
            {
                EventId = $"sec_1102_{rid}_{ts:O}",
                Hostname = Environment.MachineName,
                Timestamp = ts,
                EventSource = "Security",
                EventType = "audit_log_cleared",
                Username = d.GetValueOrDefault("SubjectUserName"),
                RawData = baseRaw,
            },
            4697 or 4698 or 4699 or 4700 or 4701 or 4702 => new TelemetryEvent
            {
                EventId = $"sec_{id}_{rid}_{ts:O}",
                Hostname = Environment.MachineName,
                Timestamp = ts,
                EventSource = "Security",
                EventType = "scheduled_task",
                Username = d.GetValueOrDefault("SubjectUserName"),
                RawData = baseRaw,
            },
            _ => new TelemetryEvent
            {
                EventId = $"sec_{id}_{rid}_{ts:O}",
                Hostname = Environment.MachineName,
                Timestamp = ts,
                EventSource = "Security",
                EventType = $"security_{id}",
                Username = d.GetValueOrDefault("TargetUserName") ?? d.GetValueOrDefault("SubjectUserName"),
                RawData = baseRaw,
            },
        };
    }

    private static TelemetryEvent MapSystemEvent(EventRecord rec, IReadOnlyDictionary<string, string> d,
        DateTime ts, long rid)
    {
        var id = rec.Id;
        var raw = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
        {
            ["message"] = rec.FormatDescription(),
            ["channel"] = "System",
            ["instance_id"] = id,
            ["record_id"] = rid,
        };
        foreach (var kv in d)
            raw[$"system_{kv.Key}"] = kv.Value;

        var eventType = id switch
        {
            7045 => "service_install",
            7036 => "service_state_change",
            1074 or 1076 => "system_shutdown_restart",
            6005 or 6006 => "eventlog_service",
            6008 => "unexpected_shutdown",
            6009 => "os_startup",
            41 => "kernel_bugcheck",
            _ => $"system_{id}",
        };

        return new TelemetryEvent
        {
            EventId = $"sys_{id}_{rid}_{ts:O}",
            Hostname = Environment.MachineName,
            Timestamp = ts,
            EventSource = "System",
            EventType = eventType,
            ServiceName = d.GetValueOrDefault("ServiceName") ?? d.GetValueOrDefault("param1"),
            RawData = raw,
        };
    }

    private static TelemetryEvent MapApplicationEvent(EventRecord rec, IReadOnlyDictionary<string, string> d,
        DateTime ts, long rid)
    {
        var id = rec.Id;
        var raw = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
        {
            ["message"] = rec.FormatDescription(),
            ["channel"] = "Application",
            ["instance_id"] = id,
            ["record_id"] = rid,
        };
        foreach (var kv in d)
            raw[$"application_{kv.Key}"] = kv.Value;

        return new TelemetryEvent
        {
            EventId = $"app_{id}_{rid}_{ts:O}",
            Hostname = Environment.MachineName,
            Timestamp = ts,
            EventSource = "Application",
            EventType = $"application_{id}",
            RawData = raw,
        };
    }
}
