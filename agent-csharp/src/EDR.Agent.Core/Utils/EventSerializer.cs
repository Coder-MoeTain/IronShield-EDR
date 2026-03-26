using System.Text.Json;
using System.Text.Json.Serialization;
using EDR.Agent.Core.Models;

namespace EDR.Agent.Core.Utils;

/// <summary>
/// Serializes TelemetryEvent to a flat dictionary for API (backend stores as raw JSON).
/// </summary>
public static class EventSerializer
{
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = false,
    };

    public static object ToApiObject(TelemetryEvent evt)
    {
        var dict = new Dictionary<string, object?>();
        if (evt.EventId != null) dict["event_id"] = evt.EventId;
        if (evt.Hostname != null) dict["hostname"] = evt.Hostname;
        dict["timestamp"] = evt.Timestamp;
        if (evt.EventSource != null) dict["event_source"] = evt.EventSource;
        if (evt.EventType != null) dict["event_type"] = evt.EventType;
        if (evt.Username != null) dict["username"] = evt.Username;
        if (evt.ProcessName != null) dict["process_name"] = evt.ProcessName;
        if (evt.ProcessPath != null) dict["process_path"] = evt.ProcessPath;
        if (evt.ProcessId.HasValue) dict["process_id"] = evt.ProcessId.Value;
        if (evt.ParentProcessName != null) dict["parent_process_name"] = evt.ParentProcessName;
        if (evt.ParentProcessId.HasValue) dict["parent_process_id"] = evt.ParentProcessId.Value;
        if (evt.CommandLine != null) dict["command_line"] = evt.CommandLine;
        if (evt.FileHashSha256 != null) dict["file_hash_sha256"] = evt.FileHashSha256;
        if (evt.SourceIp != null) dict["source_ip"] = evt.SourceIp;
        if (evt.DestinationIp != null) dict["destination_ip"] = evt.DestinationIp;
        if (evt.DestinationPort.HasValue) dict["destination_port"] = evt.DestinationPort.Value;
        if (evt.Protocol != null) dict["protocol"] = evt.Protocol;
        if (evt.ServiceName != null) dict["service_name"] = evt.ServiceName;
        if (evt.LogonType != null) dict["logon_type"] = evt.LogonType;
        if (evt.PowerShellCommand != null) dict["powershell_command"] = evt.PowerShellCommand;
        if (evt.CommandLineEntropy.HasValue) dict["command_line_entropy"] = evt.CommandLineEntropy.Value;
        if (evt.SuspiciousIndicatorCount.HasValue) dict["suspicious_indicator_count"] = evt.SuspiciousIndicatorCount.Value;
        if (evt.CollectorConfidence.HasValue) dict["collector_confidence"] = evt.CollectorConfidence.Value;
        if (evt.RawData != null)
        {
            foreach (var kv in evt.RawData)
                dict[kv.Key] = kv.Value;
        }
        return dict;
    }

    public static string ToJson(TelemetryEvent evt) => JsonSerializer.Serialize(ToApiObject(evt), Options);
}
