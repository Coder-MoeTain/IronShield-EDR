using System.Text.Json;
using System.Text.Json.Serialization;

namespace EDR.Agent.Core.Models;

/// <summary>
/// Response action from server.
/// </summary>
public class ResponseAction
{
    [JsonPropertyName("id")]
    public long Id { get; set; }

    [JsonPropertyName("action_type")]
    public string ActionType { get; set; } = "";

    [JsonPropertyName("parameters")]
    public JsonElement? Parameters { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public int? ProcessId
    {
        get
        {
            if (!Parameters.HasValue || !Parameters.Value.TryGetProperty("process_id", out var p))
                return null;
            if (p.TryGetInt32(out var pid))
                return pid;
            if (p.ValueKind == JsonValueKind.String && int.TryParse(p.GetString(), out pid))
                return pid;
            return null;
        }
    }
}
