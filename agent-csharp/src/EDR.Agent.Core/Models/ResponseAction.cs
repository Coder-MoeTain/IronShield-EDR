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

    [JsonIgnore]
    public int? ProcessId
    {
        get
        {
            if (!Parameters.HasValue) return null;
            var p = Parameters.Value;

            // Server/DB may send parameters as a JSON string (double-encoded)
            if (p.ValueKind == JsonValueKind.String)
            {
                var s = p.GetString();
                if (string.IsNullOrWhiteSpace(s)) return null;
                try
                {
                    using var doc = JsonDocument.Parse(s);
                    return TryParseProcessIdFromObject(doc.RootElement);
                }
                catch
                {
                    return null;
                }
            }

            return TryParseProcessIdFromObject(p);
        }
    }

    private static int? TryParseProcessIdFromObject(JsonElement p)
    {
        if (!p.TryGetProperty("process_id", out var prop) && !p.TryGetProperty("processId", out prop))
            return null;

        if (prop.TryGetInt32(out var pid32))
            return pid32;
        if (prop.TryGetInt64(out var pid64) && pid64 >= int.MinValue && pid64 <= int.MaxValue)
            return (int)pid64;
        if (prop.ValueKind == JsonValueKind.String && int.TryParse(prop.GetString(), out pid32))
            return pid32;
        if (prop.ValueKind == JsonValueKind.Number && prop.TryGetDouble(out var d))
        {
            var rounded = (int)Math.Round(d);
            if (Math.Abs(d - rounded) < 0.001) return rounded;
        }
        return null;
    }
}
