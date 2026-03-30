using System.Text.Json.Serialization;

namespace EDR.Agent.Core.Models;

/// <summary>
/// Endpoint policy from server - controls telemetry and response behavior.
/// </summary>
public class EndpointPolicy
{
    [JsonPropertyName("policy_id")]
    public int PolicyId { get; set; }

    /// <summary>Human-readable policy name (Phase 8 — Falcon sensor policy).</summary>
    [JsonPropertyName("policy_name")]
    public string? PolicyName { get; set; }

    [JsonPropertyName("mode")]
    public string Mode { get; set; } = "monitor_and_alert";

    [JsonPropertyName("telemetry_interval_seconds")]
    public int TelemetryIntervalSeconds { get; set; } = 30;

    [JsonPropertyName("batch_upload_size")]
    public int BatchUploadSize { get; set; } = 100;

    [JsonPropertyName("heartbeat_interval_minutes")]
    public int HeartbeatIntervalMinutes { get; set; } = 5;

    [JsonPropertyName("poll_interval_seconds")]
    public int PollIntervalSeconds { get; set; } = 60;

    [JsonPropertyName("allowed_response_actions")]
    public List<string> AllowedResponseActions { get; set; } = new();

    [JsonPropertyName("allowed_triage_modules")]
    public List<string> AllowedTriageModules { get; set; } = new();

    /// <summary>
    /// Optional RTR command first-token allowlist override.
    /// When empty, agent keeps built-in safe allowlist.
    /// </summary>
    [JsonPropertyName("allowed_rtr_commands")]
    public List<string> AllowedRtrCommands { get; set; } = new();

    /// <summary>
    /// Optional script hash denylist for hard prevention at execution time.
    /// Values are lowercase hex SHA-256.
    /// </summary>
    [JsonPropertyName("blocked_script_sha256")]
    public List<string> BlockedScriptSha256 { get; set; } = new();
}
