using System.Text.Json.Serialization;

namespace EDR.Agent.Core.Models;

/// <summary>
/// Payload sent with heartbeat.
/// </summary>
public class HeartbeatPayload
{
    [JsonPropertyName("hostname")]
    public string? Hostname { get; set; }

    [JsonPropertyName("os_version")]
    public string? OsVersion { get; set; }

    [JsonPropertyName("logged_in_user")]
    public string? LoggedInUser { get; set; }

    [JsonPropertyName("ip_address")]
    public string? IpAddress { get; set; }

    [JsonPropertyName("mac_address")]
    public string? MacAddress { get; set; }

    [JsonPropertyName("agent_version")]
    public string? AgentVersion { get; set; }

    [JsonPropertyName("connections")]
    public List<NetworkConnectionPayload>? Connections { get; set; }

    [JsonPropertyName("cpu_percent")]
    public decimal? CpuPercent { get; set; }

    [JsonPropertyName("ram_percent")]
    public decimal? RamPercent { get; set; }

    [JsonPropertyName("ram_total_mb")]
    public int? RamTotalMb { get; set; }

    [JsonPropertyName("ram_used_mb")]
    public int? RamUsedMb { get; set; }

    [JsonPropertyName("disk_percent")]
    public decimal? DiskPercent { get; set; }

    [JsonPropertyName("disk_total_gb")]
    public decimal? DiskTotalGb { get; set; }

    [JsonPropertyName("disk_used_gb")]
    public decimal? DiskUsedGb { get; set; }

    [JsonPropertyName("network_rx_mbps")]
    public decimal? NetworkRxMbps { get; set; }

    [JsonPropertyName("network_tx_mbps")]
    public decimal? NetworkTxMbps { get; set; }

    /// <summary>Events waiting in the local offline queue (Falcon-style sensor backlog).</summary>
    [JsonPropertyName("queue_depth")]
    public int? QueueDepth { get; set; }

    /// <summary>Agent process uptime in seconds.</summary>
    [JsonPropertyName("process_uptime_seconds")]
    public int? ProcessUptimeSeconds { get; set; }

    /// <summary>True when Windows Firewall containment rules from this agent are active.</summary>
    [JsonPropertyName("host_isolation_active")]
    public bool? HostIsolationActive { get; set; }

    /// <summary>ok | degraded — degraded when backlog is high (console can highlight).</summary>
    [JsonPropertyName("sensor_operational_status")]
    public string? SensorOperationalStatus { get; set; }

    /// <summary>up_to_date | update_available | unknown — from last /api/agent/update/check (Phase 6).</summary>
    [JsonPropertyName("agent_update_status")]
    public string? AgentUpdateStatus { get; set; }

    /// <summary>When update_available, the version offered by the server.</summary>
    [JsonPropertyName("available_agent_version")]
    public string? AvailableAgentVersion { get; set; }

    /// <summary>ISO 8601 UTC timestamp of last successful update check.</summary>
    [JsonPropertyName("last_agent_update_check_utc")]
    public string? LastAgentUpdateCheckUtc { get; set; }

    /// <summary>Active AV signature bundle version (NGAV / Phase 7).</summary>
    [JsonPropertyName("av_signature_bundle")]
    public string? AvSignatureBundle { get; set; }

    /// <summary>Whether realtime malware prevention is enabled per policy.</summary>
    [JsonPropertyName("av_realtime_enabled")]
    public bool? AvRealtimeEnabled { get; set; }

    /// <summary>active | monitor_only | degraded | unknown — Falcon-style prevention health.</summary>
    [JsonPropertyName("av_prevention_status")]
    public string? AvPreventionStatus { get; set; }

    /// <summary>Number of loaded AV signatures on host (NGAV / Phase 7; 0 ⇒ degraded).</summary>
    [JsonPropertyName("av_signature_count")]
    public int? AvSignatureCount { get; set; }

    /// <summary>Assigned EDR policy id from /api/agent/policy (Phase 8 — Falcon sensor policy).</summary>
    [JsonPropertyName("edr_policy_id")]
    public int? EdrPolicyId { get; set; }

    /// <summary>ISO 8601 UTC when EDR policy was last fetched successfully.</summary>
    [JsonPropertyName("last_edr_policy_sync_utc")]
    public string? LastEdrPolicySyncUtc { get; set; }

    /// <summary>TCP/UDP listening sockets on the host (Windows).</summary>
    [JsonPropertyName("listening_ports")]
    public List<ListeningPortPayload>? ListeningPorts { get; set; }

    /// <summary>SMB / Win32 shares exposed by the host (Windows WMI).</summary>
    [JsonPropertyName("shared_folders")]
    public List<SharedFolderPayload>? SharedFolders { get; set; }
}

public class ListeningPortPayload
{
    [JsonPropertyName("local_address")]
    public string? LocalAddress { get; set; }

    [JsonPropertyName("local_port")]
    public int LocalPort { get; set; }

    [JsonPropertyName("protocol")]
    public string Protocol { get; set; } = "TCP";
}

public class SharedFolderPayload
{
    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("path")]
    public string? Path { get; set; }

    /// <summary>Win32_Share Type: 0=disk, 1=print, 3=IPC, etc.</summary>
    [JsonPropertyName("share_type")]
    public int? ShareType { get; set; }

    [JsonPropertyName("caption")]
    public string? Caption { get; set; }
}

public class NetworkConnectionPayload
{
    [JsonPropertyName("local_address")]
    public string? LocalAddress { get; set; }

    [JsonPropertyName("local_port")]
    public int? LocalPort { get; set; }

    [JsonPropertyName("remote_address")]
    public string? RemoteAddress { get; set; }

    [JsonPropertyName("remote_port")]
    public int? RemotePort { get; set; }

    [JsonPropertyName("protocol")]
    public string? Protocol { get; set; }

    [JsonPropertyName("state")]
    public string? State { get; set; }
}
