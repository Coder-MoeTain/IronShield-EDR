using System.Text.Json.Serialization;

namespace EDR.Agent.Core.Models;

/// <summary>
/// Triage request from server.
/// </summary>
public class TriageTask
{
    [JsonPropertyName("id")]
    public long Id { get; set; }

    [JsonPropertyName("endpoint_id")]
    public int EndpointId { get; set; }

    [JsonPropertyName("request_type")]
    public string RequestType { get; set; } = "full";

    [JsonPropertyName("status")]
    public string Status { get; set; } = "pending";
}
