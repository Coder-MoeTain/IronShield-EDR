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

    /// <summary>Minimum seconds between realtime scans of the same path (1–60). 0 or missing defaults to 2.</summary>
    [JsonPropertyName("realtime_debounce_seconds")]
    public int RealtimeDebounceSeconds { get; set; }

    [JsonPropertyName("include_paths")]
    public List<string>? IncludePaths { get; set; }

    [JsonPropertyName("exclude_paths")]
    public List<string>? ExcludePaths { get; set; }

    [JsonPropertyName("exclude_extensions")]
    public List<string>? ExcludeExtensions { get; set; }

    [JsonPropertyName("exclude_hashes")]
    public List<string>? ExcludeHashes { get; set; }

    /// <summary>Enable WMI-based removable volume monitoring (Windows agent).</summary>
    [JsonPropertyName("device_control_enabled")]
    public bool DeviceControlEnabled { get; set; }

    /// <summary>audit = log only; block = eject removable volumes after mount; allow = no telemetry (noise reduction).</summary>
    [JsonPropertyName("removable_storage_action")]
    public string? RemovableStorageAction { get; set; }

    /// <summary>When not false, known-ransomware signatures and behavioral rules use detection_type ransomware. Null/missing from API defaults to enabled.</summary>
    [JsonPropertyName("ransomware_protection_enabled")]
    public bool? RansomwareProtectionEnabled { get; set; }

    /// <summary>IOC domain/url blocklist applied via Windows hosts sinkhole (requires elevation).</summary>
    [JsonPropertyName("web_url_protection_enabled")]
    public bool WebUrlProtectionEnabled { get; set; } = true;

    /// <summary>Normalized action: audit | block | allow.</summary>
    public string EffectiveRemovableStorageAction
    {
        get
        {
            var a = (RemovableStorageAction ?? "audit").Trim().ToLowerInvariant();
            return a is "block" or "allow" or "audit" ? a : "audit";
        }
    }
}
