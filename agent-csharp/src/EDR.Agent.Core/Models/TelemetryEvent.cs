using System.Text.Json.Serialization;

namespace EDR.Agent.Core.Models;

/// <summary>
/// Normalized telemetry event model for EDR.
/// </summary>
public class TelemetryEvent
{
    [JsonPropertyName("event_id")]
    public string? EventId { get; set; }

    [JsonPropertyName("hostname")]
    public string? Hostname { get; set; }

    [JsonPropertyName("timestamp")]
    public DateTime Timestamp { get; set; }

    [JsonPropertyName("event_source")]
    public string? EventSource { get; set; }

    [JsonPropertyName("event_type")]
    public string? EventType { get; set; }

    [JsonPropertyName("username")]
    public string? Username { get; set; }

    [JsonPropertyName("process_name")]
    public string? ProcessName { get; set; }

    [JsonPropertyName("process_path")]
    public string? ProcessPath { get; set; }

    [JsonPropertyName("process_id")]
    public int? ProcessId { get; set; }

    [JsonPropertyName("parent_process_name")]
    public string? ParentProcessName { get; set; }

    [JsonPropertyName("parent_process_id")]
    public int? ParentProcessId { get; set; }

    [JsonPropertyName("command_line")]
    public string? CommandLine { get; set; }

    [JsonPropertyName("file_hash_sha256")]
    public string? FileHashSha256 { get; set; }

    [JsonPropertyName("source_ip")]
    public string? SourceIp { get; set; }

    [JsonPropertyName("destination_ip")]
    public string? DestinationIp { get; set; }

    [JsonPropertyName("destination_port")]
    public int? DestinationPort { get; set; }

    [JsonPropertyName("protocol")]
    public string? Protocol { get; set; }

    [JsonPropertyName("service_name")]
    public string? ServiceName { get; set; }

    [JsonPropertyName("logon_type")]
    public string? LogonType { get; set; }

    [JsonPropertyName("powershell_command")]
    public string? PowerShellCommand { get; set; }

    [JsonPropertyName("command_line_entropy")]
    public double? CommandLineEntropy { get; set; }

    [JsonPropertyName("suspicious_indicator_count")]
    public int? SuspiciousIndicatorCount { get; set; }

    [JsonPropertyName("collector_confidence")]
    public double? CollectorConfidence { get; set; }

    /// <summary>Approximate CPU % for this process (Windows perf counter, snapshot).</summary>
    [JsonPropertyName("process_cpu_percent")]
    public double? ProcessCpuPercent { get; set; }

    /// <summary>Working set (resident) memory for this process in MiB.</summary>
    [JsonPropertyName("process_working_set_mb")]
    public double? ProcessWorkingSetMb { get; set; }

    /// <summary>Optional device control (USB / removable) context.</summary>
    [JsonPropertyName("device_control")]
    public DeviceControlEventDetail? DeviceControl { get; set; }

    /// <summary>Web & URL protection (IOC domain/url → hosts sinkhole).</summary>
    [JsonPropertyName("web_url_protection")]
    public WebUrlProtectionEventDetail? WebUrlProtection { get; set; }

    /// <summary>Additional properties stored as raw JSON</summary>
    [JsonExtensionData]
    public Dictionary<string, object?>? RawData { get; set; }
}
