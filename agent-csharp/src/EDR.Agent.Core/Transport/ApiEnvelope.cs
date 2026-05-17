using System.Text.Json;

namespace EDR.Agent.Core.Transport;

/// <summary>
/// Unwraps IronShield API envelope { success, data } for agent JSON deserialization.
/// </summary>
public static class ApiEnvelope
{
    public static string UnwrapPayload(string body)
    {
        if (string.IsNullOrWhiteSpace(body)) return body;
        try
        {
            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return body;
            if (!root.TryGetProperty("success", out var successEl) || successEl.ValueKind != JsonValueKind.True)
                return body;
            if (!root.TryGetProperty("data", out var dataEl)) return body;
            return dataEl.GetRawText();
        }
        catch
        {
            return body;
        }
    }

    public static T? DeserializeData<T>(string body, JsonSerializerOptions options)
    {
        var payload = UnwrapPayload(body);
        return JsonSerializer.Deserialize<T>(payload, options);
    }
}
