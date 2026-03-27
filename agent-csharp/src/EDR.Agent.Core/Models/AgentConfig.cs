namespace EDR.Agent.Core.Models;

/// <summary>
/// Agent configuration loaded from config file or environment.
/// </summary>
public class AgentConfig
{
    /// <summary>Server base URL (e.g., https://edr.example.com)</summary>
    public string ServerUrl { get; set; } = "";

    /// <summary>
    /// Enterprise: require HTTPS for ServerUrl. If false, http:// is allowed (not recommended).
    /// </summary>
    public bool RequireHttps { get; set; } = true;

    /// <summary>
    /// Enterprise: optional server TLS certificate pinning by thumbprint (SHA-1, hex).
    /// If non-empty, the server certificate thumbprint MUST match one entry (case-insensitive, spaces ignored).
    /// Example: "‎‎a1b2c3...".
    /// </summary>
    public List<string> PinnedServerCertThumbprints { get; set; } = new();

    /// <summary>
    /// Enterprise mTLS: optional client certificate (PFX/PKCS#12) used for agent->server authentication.
    /// </summary>
    public string? ClientCertificatePfxPath { get; set; }

    /// <summary>Optional password for ClientCertificatePfxPath.</summary>
    public string? ClientCertificatePfxPassword { get; set; }

    /// <summary>Bootstrap token for initial registration</summary>
    public string RegistrationToken { get; set; } = "";

    /// <summary>
    /// Optional tenant slug (Falcon-style customer / CID enrollment). Must match a tenant on the server; sent at registration only.
    /// </summary>
    public string? TenantSlug { get; set; }

    /// <summary>Agent key received after registration (persisted)</summary>
    public string? AgentKey { get; set; }

    /// <summary>Heartbeat interval in minutes</summary>
    public int HeartbeatIntervalMinutes { get; set; } = 5;

    /// <summary>Event batch upload interval in seconds</summary>
    public int EventBatchIntervalSeconds { get; set; } = 30;

    /// <summary>Command polling interval in seconds (Phase 2). Lower = faster kill/response actions.</summary>
    public int CommandPollIntervalSeconds { get; set; } = 15;

    /// <summary>Max events per batch</summary>
    public int MaxEventsPerBatch { get; set; } = 100;

    /// <summary>Retry count for failed uploads</summary>
    public int MaxRetries { get; set; } = 5;

    /// <summary>Local queue path (JSON file or directory)</summary>
    public string LocalQueuePath { get; set; } = "queue";

    /// <summary>Max events read per poll from Windows channels (Security, System, Application) combined budget.</summary>
    public int MaxWindowsEventLogEventsPerPoll { get; set; } = 500;

    /// <summary>Max Sysmon Operational events per poll.</summary>
    public int MaxSysmonEventsPerPoll { get; set; } = 500;

    /// <summary>Optional path prefixes allowed for run_script response (e.g. C:\\IronShield\\Scripts\\)</summary>
    public List<string> ScriptAllowlistPrefixes { get; set; } = new();

    /// <summary>Optional SHA-256 hex hashes; when non-empty, script file must match one of these (in addition to path prefix).</summary>
    public List<string> ScriptAllowlistSha256 { get; set; } = new();

    /// <summary>
    /// Enterprise: enable update download verification (downloads update artifact and verifies checksum/signature; does not install).
    /// </summary>
    public bool VerifyAgentUpdates { get; set; } = false;

    /// <summary>
    /// Optional PEM-encoded RSA public key for verifying agent release signatures (signature over sha256 hex).
    /// </summary>
    public string? AgentUpdatePublicKeyPem { get; set; }

    /// <summary>
    /// If true, invoke updater helper to install staged update artifact (with rollback manifest).
    /// </summary>
    public bool AutoInstallUpdates { get; set; } = false;

    /// <summary>
    /// Optional full path to EDR.Agent.Updater executable.
    /// </summary>
    public string? UpdaterExecutablePath { get; set; }

    /// <summary>
    /// Optional target binary path that updater will replace. Defaults to current service executable.
    /// </summary>
    public string? UpdateTargetPath { get; set; }
}
