namespace EDR.Agent.Core.Models;

public class SoftwarePoliciesResponse
{
    public long PolicyVersion { get; set; }
    public bool InventoryEnabled { get; set; } = true;
    public int InventoryIntervalHours { get; set; } = 24;
    public List<SoftwareBlockPolicyDto> BlockPolicies { get; set; } = new();
    public List<SoftwareNotificationDto> PendingNotifications { get; set; } = new();
}

public class SoftwareBlockPolicyDto
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string SoftwareName { get; set; } = "";
    public string? Vendor { get; set; }
    public string? VersionExpression { get; set; }
    public string? ExecutablePathPattern { get; set; }
    public string? FileHash { get; set; }
    public string Action { get; set; } = "block";
    public string? MessageTitle { get; set; }
    public string? MessageBody { get; set; }
    public DateTime? ExpiresAt { get; set; }
}

public class SoftwareNotificationDto
{
    public long Id { get; set; }
    public string Title { get; set; } = "";
    public string Message { get; set; } = "";
    public string Severity { get; set; } = "info";
}

public class SoftwareInventoryItemDto
{
    public string Fingerprint { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Vendor { get; set; }
    public string? Version { get; set; }
    public string? InstallLocation { get; set; }
    public List<string> ExecutablePaths { get; set; } = new();
    public string? UninstallString { get; set; }
    public string? QuietUninstallString { get; set; }
    public string? InstallDate { get; set; }
    public string? Architecture { get; set; }
    public string Source { get; set; } = "registry";
    public string Status { get; set; } = "installed";
}
