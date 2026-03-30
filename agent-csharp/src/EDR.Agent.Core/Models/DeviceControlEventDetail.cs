using System.Text.Json.Serialization;

namespace EDR.Agent.Core.Models;

/// <summary>USB / removable volume telemetry from device control.</summary>
public class DeviceControlEventDetail
{
    [JsonPropertyName("action")]
    public string? Action { get; set; }

    [JsonPropertyName("drive_letter")]
    public string? DriveLetter { get; set; }

    [JsonPropertyName("volume_label")]
    public string? VolumeLabel { get; set; }

    [JsonPropertyName("drive_type")]
    public string? DriveType { get; set; }

    [JsonPropertyName("eject_attempted")]
    public bool? EjectAttempted { get; set; }

    [JsonPropertyName("eject_success")]
    public bool? EjectSuccess { get; set; }

    [JsonPropertyName("note")]
    public string? Note { get; set; }
}
