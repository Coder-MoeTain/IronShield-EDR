using System.Text.Json.Serialization;

namespace EDR.Agent.Core.Models;

/// <summary>Serialized as heartbeat <c>tamper_signals</c>.</summary>
public sealed class TamperSignalsSnapshot
{
    [JsonPropertyName("sensor_mode")]
    public string SensorMode { get; set; } = "user_mode";

    [JsonPropertyName("kernel_driver_present")]
    public bool KernelDriverPresent { get; set; }

    [JsonPropertyName("agent_binary_path")]
    public string? AgentBinaryPath { get; set; }

    /// <summary>SHA-256 hex of the running agent executable (for integrity baselines).</summary>
    [JsonPropertyName("agent_binary_sha256")]
    public string? AgentBinarySha256 { get; set; }

    [JsonPropertyName("windows_service_name")]
    public string? WindowsServiceName { get; set; }

    [JsonPropertyName("windows_service_status")]
    public string? WindowsServiceStatus { get; set; }

    [JsonPropertyName("windows_service_can_stop")]
    public bool? WindowsServiceCanStop { get; set; }

    /// <summary>Count of SCM 7036 stop transitions for this service name in the last 24h.</summary>
    [JsonPropertyName("service_stop_events_24h")]
    public int? ServiceStopEvents24h { get; set; }

    [JsonPropertyName("tamper_risk")]
    public string? TamperRisk { get; set; }
}
