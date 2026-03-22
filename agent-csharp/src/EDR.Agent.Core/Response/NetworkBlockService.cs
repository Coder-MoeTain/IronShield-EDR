using System.Diagnostics;
using System.Runtime.InteropServices;

namespace EDR.Agent.Core.Response;

/// <summary>
/// Adds Windows Firewall outbound block for a specific remote IP (response action).
/// </summary>
public sealed class NetworkBlockService
{
    private const string RulePrefix = "IronShieldEDR-BlockIP-";

    public async Task<(bool Success, string Message)> BlockOutboundIpAsync(string ip, CancellationToken ct = default)
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            return (false, "Network block is only supported on Windows");

        if (string.IsNullOrWhiteSpace(ip))
            return (false, "ip parameter required");

        ip = ip.Trim();
        if (!IsRunningElevated())
            return (false, "Administrator / LocalSystem required for firewall rules");

        var safeName = ip.Replace(':', '-').Replace('%', '-');
        var ruleName = $"{RulePrefix}{safeName}";

        await DeleteRuleByNameAsync(ruleName, ct);

        var args = $"advfirewall firewall add rule name=\"{ruleName}\" dir=out action=block remoteip={ip} protocol=ANY";
        var (code, _, err) = await RunNetshAsync(args, ct);
        if (code != 0)
            return (false, $"netsh failed ({code}): {err}");

        return (true, $"Outbound block rule added for {ip}");
    }

    private static async Task DeleteRuleByNameAsync(string name, CancellationToken ct)
    {
        await RunNetshAsync($"advfirewall firewall delete rule name=\"{name}\"", ct);
    }

    private static async Task<(int ExitCode, string? StdOut, string? StdErr)> RunNetshAsync(string arguments, CancellationToken ct)
    {
        var psi = new ProcessStartInfo
        {
            FileName = "netsh",
            Arguments = arguments,
            CreateNoWindow = true,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            WorkingDirectory = Environment.SystemDirectory,
        };
        using var p = new Process { StartInfo = psi };
        p.Start();
        var outTask = p.StandardOutput.ReadToEndAsync(ct);
        var errTask = p.StandardError.ReadToEndAsync(ct);
        await p.WaitForExitAsync(ct).ConfigureAwait(false);
        var stdout = await outTask.ConfigureAwait(false);
        var stderr = await errTask.ConfigureAwait(false);
        return (p.ExitCode, stdout, stderr);
    }

    private static bool IsRunningElevated()
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows)) return false;
        try
        {
            using var identity = System.Security.Principal.WindowsIdentity.GetCurrent();
            var principal = new System.Security.Principal.WindowsPrincipal(identity);
            return principal.IsInRole(System.Security.Principal.WindowsBuiltInRole.Administrator);
        }
        catch
        {
            return false;
        }
    }
}
