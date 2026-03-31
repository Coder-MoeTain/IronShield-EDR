using System.Text.Json;
using System.Text.Json.Serialization;

namespace EDR.Agent.Core.Models;

/// <summary>Enabled IOA rule from GET /api/agent/detection-rules (mirrors server detection_rules row).</summary>
public sealed class AgentDetectionRuleDto
{
    [JsonPropertyName("id")]
    public long Id { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("title")]
    public string? Title { get; set; }

    [JsonPropertyName("severity")]
    public string? Severity { get; set; }

    /// <summary>JSON object; keys ANDed (same semantics as server DetectionEngineService).</summary>
    [JsonPropertyName("conditions")]
    public JsonElement Conditions { get; set; }
}

/// <summary>Response body for GET /api/agent/detection-rules.</summary>
public sealed class DetectionRulesSyncResponse
{
    [JsonPropertyName("version")]
    public string Version { get; set; } = "";

    [JsonPropertyName("rules")]
    public List<AgentDetectionRuleDto> Rules { get; set; } = new();
}
