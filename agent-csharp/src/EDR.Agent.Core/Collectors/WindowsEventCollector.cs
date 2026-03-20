using System.Diagnostics;
using System.Runtime.InteropServices;
using EDR.Agent.Core.Models;

namespace EDR.Agent.Core.Collectors;

/// <summary>
/// Collects security-relevant events from Windows Event Log.
/// Works with Security, System, and Application logs.
/// </summary>
public class WindowsEventCollector : EventCollectorBase
{
    public override string SourceName => "WindowsEventLog";

    private DateTime _lastCollectTime = DateTime.UtcNow.AddMinutes(-5);

    public override async IAsyncEnumerable<TelemetryEvent> CollectAsync([System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken ct = default)
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            yield break;

        var events = new List<TelemetryEvent>();
        var logNames = new[] { "Security", "System", "Application" };

        await Task.Run(() =>
        {
            foreach (var logName in logNames)
            {
                try
                {
                    using var log = new EventLog(logName);
                    var entries = log.Entries.Cast<EventLogEntry>()
                        .Where(e => e.TimeGenerated >= _lastCollectTime)
                        .OrderBy(e => e.TimeGenerated)
                        .Take(200)
                        .ToList();

                    foreach (var entry in entries)
                    {
                        var evt = MapToTelemetry(entry, logName);
                        if (evt != null)
                            events.Add(evt);
                    }
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[EventCollector] {logName}: {ex.Message}");
                }
            }

            _lastCollectTime = DateTime.UtcNow;
        }, ct);

        foreach (var evt in events)
            yield return evt;
    }

    private static TelemetryEvent? MapToTelemetry(EventLogEntry entry, string logName)
    {
        var eventType = InferEventType(entry, logName);
        if (eventType == null) return null;

        return new TelemetryEvent
        {
            EventId = $"{logName}_{entry.InstanceId}_{entry.TimeGenerated:O}",
            Hostname = Environment.MachineName,
            Timestamp = entry.TimeGenerated,
            EventSource = logName,
            EventType = eventType,
            Username = entry.UserName,
            RawData = new Dictionary<string, object?>
            {
                ["message"] = entry.Message,
                ["instance_id"] = entry.InstanceId,
                ["source"] = entry.Source,
            },
        };
    }

    private static string? InferEventType(EventLogEntry entry, string logName)
    {
        // Security log event IDs: 4624=logon, 4625=failed logon, 4634=logoff, 4647=logoff
        // 4688=process create, 4689=process exit
        // 7045=service install, 7036=service state change
        var id = entry.InstanceId;
        return logName switch
        {
            "Security" => id switch
            {
                4624 => "logon_success",
                4625 => "logon_failed",
                4634 or 4647 => "logoff",
                4688 => "process_create",
                4689 => "process_terminate",
                7045 => "service_install",
                7036 => "service_state_change",
                _ => $"security_{id}",
            },
            "System" => $"system_{id}",
            "Application" => $"application_{id}",
            _ => $"event_{id}",
        };
    }
}
