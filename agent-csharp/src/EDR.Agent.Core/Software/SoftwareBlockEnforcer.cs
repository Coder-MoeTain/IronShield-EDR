using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using EDR.Agent.Core.Models;
using EDR.Agent.Core.Response;

namespace EDR.Agent.Core.Software;

/// <summary>
/// Policy-based software execution control (block / warn / audit). Never blocks protected system processes.
/// </summary>
public class SoftwareBlockEnforcer
{
    private static readonly HashSet<string> ProtectedProcesses = new(StringComparer.OrdinalIgnoreCase)
    {
        "System", "Idle", "wininit", "services", "lsass", "csrss", "smss", "winlogon", "explorer",
        "svchost", "dwm", "fontdrvhost", "sihost", "taskhostw", "runtimebroker", "searchindexer",
        "IronShield.Agent.Service", "EDR.Agent.Service", "MsMpEng", "SecurityHealthService",
        "SecurityHealthSystray", "WmiPrvSE", "dllhost",
    };

    private readonly ProcessResponseExecutor _killer = new();

    public async Task<SoftwareBlockResult?> EvaluateProcessAsync(
        int pid,
        string processName,
        string? processPath,
        IReadOnlyList<SoftwareBlockPolicyDto> policies,
        Func<SoftwareBlockResult, Task>? onEvent = null,
        CancellationToken ct = default)
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows)) return null;
        if (ProtectedProcesses.Contains(processName)) return null;
        if (processPath != null && processPath.Contains("IronShield", StringComparison.OrdinalIgnoreCase))
            return null;

        foreach (var policy in policies)
        {
            if (!MatchesPolicy(policy, processName, processPath)) continue;

            var result = new SoftwareBlockResult
            {
                PolicyId = policy.Id,
                ProcessName = processName,
                ProcessPath = processPath,
                Action = policy.Action,
                MessageTitle = policy.MessageTitle,
                MessageBody = policy.MessageBody,
            };

            if (policy.Action.Equals("block", StringComparison.OrdinalIgnoreCase))
            {
                var (ok, msg) = await _killer.ExecuteKillProcessAsync(pid, ct);
                result.ActionTaken = ok ? "terminated" : msg;
                result.EventType = "software_execution_blocked";
            }
            else if (policy.Action.Equals("warn", StringComparison.OrdinalIgnoreCase))
            {
                result.ActionTaken = "warned";
                result.EventType = "software_execution_warned";
                TryShowToast(policy.MessageTitle ?? "Security Warning", policy.MessageBody ?? "This application is restricted.");
            }
            else
            {
                result.ActionTaken = "audited";
                result.EventType = "software_execution_audit";
            }

            if (onEvent != null) await onEvent(result);
            return result;
        }

        return null;
    }

    private static bool MatchesPolicy(SoftwareBlockPolicyDto policy, string processName, string? processPath)
    {
        if (!string.IsNullOrWhiteSpace(policy.SoftwareName) &&
            !processName.Contains(policy.SoftwareName, StringComparison.OrdinalIgnoreCase) &&
            !(processPath?.Contains(policy.SoftwareName, StringComparison.OrdinalIgnoreCase) ?? false))
            return false;

        if (!string.IsNullOrWhiteSpace(policy.ExecutablePathPattern) && processPath != null)
        {
            var pattern = "^" + Regex.Escape(policy.ExecutablePathPattern).Replace("\\*", ".*") + "$";
            if (!Regex.IsMatch(processPath, pattern, RegexOptions.IgnoreCase)) return false;
        }

        return true;
    }

    private static void TryShowToast(string title, string body)
    {
        try
        {
            Console.WriteLine($"[SoftwareBlock] WARN: {title} — {body}");
        }
        catch { /* fallback log only */ }
    }
}

public class SoftwareBlockResult
{
    public string PolicyId { get; set; } = "";
    public string ProcessName { get; set; } = "";
    public string? ProcessPath { get; set; }
    public string Action { get; set; } = "";
    public string? ActionTaken { get; set; }
    public string EventType { get; set; } = "";
    public string? MessageTitle { get; set; }
    public string? MessageBody { get; set; }
}
