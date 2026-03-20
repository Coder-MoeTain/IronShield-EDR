namespace EDR.Agent.Core.Models;

/// <summary>
/// Agent configuration loaded from config file or environment.
/// </summary>
public class AgentConfig
{
    /// <summary>Server base URL (e.g., https://edr.example.com)</summary>
    public string ServerUrl { get; set; } = "http://localhost:3000";

    /// <summary>Bootstrap token for initial registration</summary>
    public string RegistrationToken { get; set; } = "";

    /// <summary>Agent key received after registration (persisted)</summary>
    public string? AgentKey { get; set; }

    /// <summary>Heartbeat interval in minutes</summary>
    public int HeartbeatIntervalMinutes { get; set; } = 5;

    /// <summary>Event batch upload interval in seconds</summary>
    public int EventBatchIntervalSeconds { get; set; } = 30;

    /// <summary>Command polling interval in seconds (Phase 2)</summary>
    public int CommandPollIntervalSeconds { get; set; } = 60;

    /// <summary>Max events per batch</summary>
    public int MaxEventsPerBatch { get; set; } = 100;

    /// <summary>Retry count for failed uploads</summary>
    public int MaxRetries { get; set; } = 5;

    /// <summary>Local queue path (JSON file or directory)</summary>
    public string LocalQueuePath { get; set; } = "queue";
}
