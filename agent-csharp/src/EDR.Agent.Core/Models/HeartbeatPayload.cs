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
