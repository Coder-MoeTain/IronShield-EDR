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
            if (!Parameters.HasValue) return null;
            var p = Parameters.Value;
            // Support both snake_case (process_id) and camelCase (processId)
            if (!p.TryGetProperty("process_id", out var prop) && !p.TryGetProperty("processId", out prop))
                return null;
            if (prop.TryGetInt32(out var pid))
                return pid;
            if (prop.ValueKind == JsonValueKind.String && int.TryParse(prop.GetString(), out pid))
                return pid;
            return null;
        }
    }
}
