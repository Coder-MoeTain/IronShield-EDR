using System.Diagnostics;
using System.Diagnostics.Eventing.Reader;
using System.Runtime.InteropServices;
using EDR.Agent.Core.Models;

namespace EDR.Agent.Core.Collectors;

/// <summary>
/// Collects events from Sysmon (<c>Microsoft-Windows-Sysmon/Operational</c>).
/// Requires Sysmon to be installed and configured; maps Event IDs 1–29 to normalized telemetry.
/// </summary>
public class SysmonCollector : EventCollectorBase
{
    public override string SourceName => "Sysmon";

    private DateTime _lastCollectTime = DateTime.UtcNow.AddMinutes(-5);
    private const string LogPath = "Microsoft-Windows-Sysmon/Operational";

    private static readonly int[] SysmonEventIds =
    [
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
    ];

    private readonly int _maxPerPoll;

    public SysmonCollector(AgentConfig? config = null)
    {
        var n = config?.MaxSysmonEventsPerPoll ?? 500;
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
            try
            {
                var cutoff = _lastCollectTime.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ");
                var idFilter = string.Join(" or ", SysmonEventIds.Select(id => $"EventID={id}"));
                var xpath = $"*[System[({idFilter}) and TimeCreated[@SystemTime>='{cutoff}']]]";
                var query = new EventLogQuery(LogPath, PathType.LogName, xpath);
                using var reader = new EventLogReader(query);
                var count = 0;
                for (var rec = reader.ReadEvent(); rec != null; rec = reader.ReadEvent())
                {
                    using (rec)
                    {
                        var evt = MapSysmonToTelemetry(rec);
                        if (evt != null)
                        {
                            events.Add(evt);
                            if (++count >= _maxPerPoll)
                                break;
                        }
                    }
                }

                _lastCollectTime = DateTime.UtcNow;
            }
            catch (EventLogNotFoundException)
            {
                Debug.WriteLine("[SysmonCollector] Sysmon log not found — install Sysmon and enable Operational logging.");
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
        var xml = rec.ToXml();
        var data = EventXmlParser.ParseEventData(xml);
        var ts = rec.TimeCreated ?? DateTime.UtcNow;
        var recordId = rec.RecordId ?? 0;
        var baseRaw = BuildSysmonRaw(rec, data, recordId);

        return id switch
        {
            1 => MapProcessCreate(rec, data, ts, recordId, baseRaw),
            2 => MapGeneric(rec, data, ts, recordId, "sysmon_file_creation_time_changed", baseRaw, imageField: "Image"),
            3 => MapNetwork(rec, data, ts, recordId, baseRaw),
            4 => MapGeneric(rec, data, ts, recordId, "sysmon_service_state_changed", baseRaw),
            5 => MapProcessTerminate(rec, data, ts, recordId, baseRaw),
            6 => MapGeneric(rec, data, ts, recordId, "sysmon_driver_loaded", baseRaw, imageField: "ImageLoaded"),
            7 => MapGeneric(rec, data, ts, recordId, "sysmon_image_loaded", baseRaw, imageField: "ImageLoaded"),
            8 => MapGeneric(rec, data, ts, recordId, "sysmon_create_remote_thread", baseRaw, imageField: "SourceImage",
                secondaryImage: "TargetImage"),
            9 => MapGeneric(rec, data, ts, recordId, "sysmon_raw_access_read", baseRaw, imageField: "Image"),
            10 => MapGeneric(rec, data, ts, recordId, "sysmon_process_access", baseRaw, imageField: "SourceImage",
                secondaryImage: "TargetImage"),
            11 => MapGeneric(rec, data, ts, recordId, "sysmon_file_create", baseRaw, imageField: "Image"),
            12 => MapGeneric(rec, data, ts, recordId, "sysmon_registry_key", baseRaw, imageField: "Image"),
            13 => MapGeneric(rec, data, ts, recordId, "sysmon_registry_value_set", baseRaw, imageField: "Image"),
            14 => MapGeneric(rec, data, ts, recordId, "sysmon_registry_rename", baseRaw, imageField: "Image"),
            15 => MapGeneric(rec, data, ts, recordId, "sysmon_file_create_stream_hash", baseRaw, imageField: "Image"),
            16 => MapGeneric(rec, data, ts, recordId, "sysmon_configuration_changed", baseRaw),
            17 => MapGeneric(rec, data, ts, recordId, "sysmon_pipe_created", baseRaw, imageField: "Image"),
            18 => MapGeneric(rec, data, ts, recordId, "sysmon_pipe_connected", baseRaw, imageField: "Image"),
            19 => MapGeneric(rec, data, ts, recordId, "sysmon_wmi_filter", baseRaw),
            20 => MapGeneric(rec, data, ts, recordId, "sysmon_wmi_consumer", baseRaw),
            21 => MapGeneric(rec, data, ts, recordId, "sysmon_wmi_binding", baseRaw),
            22 => MapDns(rec, data, ts, recordId, baseRaw),
            23 => MapGeneric(rec, data, ts, recordId, "sysmon_file_delete_archived", baseRaw, imageField: "Image"),
            24 => MapGeneric(rec, data, ts, recordId, "sysmon_clipboard_change", baseRaw, imageField: "Image"),
            25 => MapGeneric(rec, data, ts, recordId, "sysmon_process_tampering", baseRaw, imageField: "Image"),
            26 => MapGeneric(rec, data, ts, recordId, "sysmon_file_delete_detected", baseRaw, imageField: "Image"),
            27 => MapGeneric(rec, data, ts, recordId, "sysmon_file_block_executable", baseRaw, imageField: "Image"),
            28 => MapGeneric(rec, data, ts, recordId, "sysmon_file_block_shredding", baseRaw, imageField: "Image"),
            29 => MapGeneric(rec, data, ts, recordId, "sysmon_file_executable_detected", baseRaw, imageField: "Image"),
            _ => MapGeneric(rec, data, ts, recordId, $"sysmon_event_{id}", baseRaw),
        };
    }

    private static Dictionary<string, object?> BuildSysmonRaw(EventRecord rec,
        IReadOnlyDictionary<string, string> data, long recordId)
    {
        var raw = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
        {
            ["message"] = rec.FormatDescription(),
            ["sysmon_event_id"] = rec.Id,
            ["sysmon_record_id"] = recordId,
        };
        foreach (var kv in data)
            raw[$"sysmon_{kv.Key}"] = kv.Value;
        return raw;
    }

    private static TelemetryEvent MapProcessCreate(EventRecord rec, IReadOnlyDictionary<string, string> data,
        DateTime ts, long recordId, Dictionary<string, object?> raw)
    {
        return new TelemetryEvent
        {
            EventId = $"sysmon_1_{recordId}_{ts:O}",
            Hostname = Environment.MachineName,
            Timestamp = ts,
            EventSource = "Sysmon",
            EventType = "process_create",
            ProcessId = EventXmlParser.ParseInt(data.GetValueOrDefault("ProcessId")),
            ProcessName = EventXmlParser.GetFileName(data.GetValueOrDefault("Image")),
            ProcessPath = data.GetValueOrDefault("Image"),
            ParentProcessId = EventXmlParser.ParseInt(data.GetValueOrDefault("ParentProcessId")),
            ParentProcessName = EventXmlParser.GetFileName(data.GetValueOrDefault("ParentImage")),
            CommandLine = data.GetValueOrDefault("CommandLine"),
            FileHashSha256 = EventXmlParser.ParseSha256FromHashes(data.GetValueOrDefault("Hashes")),
            Username = data.GetValueOrDefault("User"),
            RawData = raw,
        };
    }

    private static TelemetryEvent MapProcessTerminate(EventRecord rec, IReadOnlyDictionary<string, string> data,
        DateTime ts, long recordId, Dictionary<string, object?> raw)
    {
        return new TelemetryEvent
        {
            EventId = $"sysmon_5_{recordId}_{ts:O}",
            Hostname = Environment.MachineName,
            Timestamp = ts,
            EventSource = "Sysmon",
            EventType = "process_terminate",
            ProcessId = EventXmlParser.ParseInt(data.GetValueOrDefault("ProcessId")),
            Username = data.GetValueOrDefault("User"),
            RawData = raw,
        };
    }

    private static TelemetryEvent MapNetwork(EventRecord rec, IReadOnlyDictionary<string, string> data,
        DateTime ts, long recordId, Dictionary<string, object?> raw)
    {
        var destPort = EventXmlParser.ParseInt(data.GetValueOrDefault("DestinationPort"));
        return new TelemetryEvent
        {
            EventId = $"sysmon_3_{recordId}_{ts:O}",
            Hostname = Environment.MachineName,
            Timestamp = ts,
            EventSource = "Sysmon",
            EventType = "sysmon_network_connection",
            ProcessId = EventXmlParser.ParseInt(data.GetValueOrDefault("ProcessId")),
            ProcessName = EventXmlParser.GetFileName(data.GetValueOrDefault("Image")),
            ProcessPath = data.GetValueOrDefault("Image"),
            SourceIp = data.GetValueOrDefault("SourceIp"),
            DestinationIp = data.GetValueOrDefault("DestinationIp"),
            DestinationPort = destPort,
            Protocol = data.GetValueOrDefault("Protocol"),
            Username = data.GetValueOrDefault("User"),
            RawData = raw,
        };
    }

    private static TelemetryEvent MapDns(EventRecord rec, IReadOnlyDictionary<string, string> data,
        DateTime ts, long recordId, Dictionary<string, object?> raw)
    {
        return new TelemetryEvent
        {
            EventId = $"sysmon_22_{recordId}_{ts:O}",
            Hostname = Environment.MachineName,
            Timestamp = ts,
            EventSource = "Sysmon",
            EventType = "sysmon_dns_query",
            ProcessId = EventXmlParser.ParseInt(data.GetValueOrDefault("ProcessId")),
            ProcessName = EventXmlParser.GetFileName(data.GetValueOrDefault("Image")),
            ProcessPath = data.GetValueOrDefault("Image"),
            Username = data.GetValueOrDefault("User"),
            RawData = raw,
        };
    }

    private static TelemetryEvent MapGeneric(EventRecord rec, IReadOnlyDictionary<string, string> data,
        DateTime ts, long recordId, string eventType, Dictionary<string, object?> raw,
        string? imageField = null, string? secondaryImage = null)
    {
        string? path = imageField != null ? data.GetValueOrDefault(imageField) : null;
        if (secondaryImage != null)
        {
            var t = data.GetValueOrDefault(secondaryImage);
            raw["sysmon_target_image"] = t;
        }

        return new TelemetryEvent
        {
            EventId = $"sysmon_{rec.Id}_{recordId}_{ts:O}",
            Hostname = Environment.MachineName,
            Timestamp = ts,
            EventSource = "Sysmon",
            EventType = eventType,
            ProcessId = EventXmlParser.ParseInt(data.GetValueOrDefault("ProcessId")),
            ProcessName = EventXmlParser.GetFileName(path),
            ProcessPath = path,
            Username = data.GetValueOrDefault("User"),
            CommandLine = data.GetValueOrDefault("CommandLine"),
            FileHashSha256 = EventXmlParser.ParseSha256FromHashes(data.GetValueOrDefault("Hashes")),
            RawData = raw,
        };
    }
}
