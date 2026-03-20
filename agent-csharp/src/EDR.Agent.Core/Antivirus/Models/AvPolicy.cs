using System.Text.Json.Serialization;

namespace EDR.Agent.Core.Antivirus.Models;

public class AvPolicy
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("realtime_enabled")]
    public bool RealtimeEnabled { get; set; }

    [JsonPropertyName("scheduled_enabled")]
    public bool ScheduledEnabled { get; set; }

    [JsonPropertyName("execute_scan_enabled")]
    public bool ExecuteScanEnabled { get; set; }

    [JsonPropertyName("quarantine_threshold")]
    public int QuarantineThreshold { get; set; } = 70;

    [JsonPropertyName("alert_threshold")]
    public int AlertThreshold { get; set; } = 50;

    [JsonPropertyName("max_file_size_mb")]
    public int MaxFileSizeMb { get; set; } = 100;

    [JsonPropertyName("process_kill_allowed")]
    public bool ProcessKillAllowed { get; set; }

    [JsonPropertyName("rescan_on_detection")]
    public bool RescanOnDetection { get; set; } = true;

    [JsonPropertyName("include_paths")]
    public List<string>? IncludePaths { get; set; }

    [JsonPropertyName("exclude_paths")]
    public List<string>? ExcludePaths { get; set; }

    [JsonPropertyName("exclude_extensions")]
    public List<string>? ExcludeExtensions { get; set; }

    [JsonPropertyName("exclude_hashes")]
    public List<string>? ExcludeHashes { get; set; }
}
