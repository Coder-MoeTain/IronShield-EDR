using System.Text.Json.Serialization;

namespace EDR.Agent.Core.Antivirus.Models;

public class ScanResult
{
    [JsonPropertyName("file_path")]
    public string? FilePath { get; set; }

    [JsonPropertyName("file_name")]
    public string? FileName { get; set; }

    [JsonPropertyName("sha256")]
    public string? Sha256 { get; set; }

    [JsonPropertyName("file_size")]
    public long? FileSize { get; set; }

    [JsonPropertyName("detection_name")]
    public string? DetectionName { get; set; }

    [JsonPropertyName("detection_type")]
    public string DetectionType { get; set; } = "heuristic";

    [JsonPropertyName("family")]
    public string? Family { get; set; }

    [JsonPropertyName("severity")]
    public string Severity { get; set; } = "medium";

    [JsonPropertyName("score")]
    public int Score { get; set; }

    [JsonPropertyName("disposition")]
    public string Disposition { get; set; } = "suspicious";

    [JsonPropertyName("signer_status")]
    public string? SignerStatus { get; set; }

    [JsonPropertyName("raw_details")]
    public Dictionary<string, object?>? RawDetails { get; set; }
}
