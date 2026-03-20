using System.Text.Json.Serialization;

namespace EDR.Agent.Core.Antivirus.Models;

public class AvSignature
{
    [JsonPropertyName("signature_uuid")]
    public string? SignatureUuid { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("signature_type")]
    public string? SignatureType { get; set; }

    [JsonPropertyName("hash_value")]
    public string? HashValue { get; set; }

    [JsonPropertyName("hash_type")]
    public string? HashType { get; set; }

    [JsonPropertyName("family")]
    public string? Family { get; set; }

    [JsonPropertyName("severity")]
    public string? Severity { get; set; }

    [JsonPropertyName("pattern")]
    public string? Pattern { get; set; }
}
