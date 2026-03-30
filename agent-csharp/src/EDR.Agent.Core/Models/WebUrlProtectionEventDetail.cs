using System.Text.Json.Serialization;

namespace EDR.Agent.Core.Models;

/// <summary>Web & URL protection (hosts-file sinkhole) telemetry.</summary>
public class WebUrlProtectionEventDetail
{
    [JsonPropertyName("action")]
    public string? Action { get; set; }

    [JsonPropertyName("blocklist_version")]
    public string? BlocklistVersion { get; set; }

    [JsonPropertyName("domain_count")]
    public int? DomainCount { get; set; }

    [JsonPropertyName("message")]
    public string? Message { get; set; }
}
