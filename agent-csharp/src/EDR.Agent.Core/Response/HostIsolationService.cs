using System.Diagnostics;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;

namespace EDR.Agent.Core.Response;

/// <summary>
/// Applies real host network containment using Windows Defender Firewall (outbound rules).
/// Allows connectivity to the EDR server (C2) and DNS; blocks other outbound TCP traffic.
/// Requires the agent to run elevated (Administrator or LocalSystem).
/// </summary>
public sealed class HostIsolationService
{
    private const string RuleAllowC2Tcp = "IronShieldEDR-Isolate-AllowC2-TCP";
    private const string RuleAllowDnsUdp = "IronShieldEDR-Isolate-AllowDNS-UDP";
    private const string RuleBlockOtherTcp = "IronShieldEDR-Isolate-BlockOutbound-TCP";

    public async Task<(bool Success, string Message)> ApplyIsolationAsync(string serverUrl, CancellationToken ct = default)
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            return (false, "Host isolation is only supported on Windows");

        if (!IsRunningElevated())
            return (false, "Host isolation requires the agent service to run as Administrator or LocalSystem");

        if (!Uri.TryCreate(serverUrl.Trim(), UriKind.Absolute, out var uri))
            return (false, "Invalid ServerUrl in agent configuration");

        var host = uri.IdnHost;
        if (string.IsNullOrEmpty(host))
            return (false, "Could not parse server host from ServerUrl");

        // Dev / loopback: do not lock out local testing — acknowledge without firewall changes
        if (IsLoopbackHost(host))
        {
            return (true, "Loopback server URL: firewall isolation skipped (development mode)");
        }

        IPAddress? targetIp = null;
        if (IPAddress.TryParse(host, out var parsed))
        {
            targetIp = parsed;
        }
        else
        {
            try
            {
                var addrs = await Dns.GetHostAddressesAsync(host, ct).ConfigureAwait(false);
                targetIp = addrs.FirstOrDefault(a => a.AddressFamily == AddressFamily.InterNetwork)
                    ?? addrs.FirstOrDefault(a => a.AddressFamily == AddressFamily.InterNetworkV6);
            }
            catch (Exception ex)
            {
                return (false, $"DNS resolution failed for '{host}': {ex.Message}");
            }

            if (targetIp == null)
                return (false, $"No IP address resolved for '{host}'");
        }

        var port = uri.IsDefaultPort
            ? (uri.Scheme.Equals("https", StringComparison.OrdinalIgnoreCase) ? 443 : 80)
            : uri.Port;

        await RemoveIsolationRulesAsync(ct).ConfigureAwait(false);

        var ipStr = targetIp.ToString();
        var zoneIdx = ipStr.IndexOf('%');
        if (zoneIdx >= 0) ipStr = ipStr[..zoneIdx];

        // Allow TCP to management server (C2)
        var allowC2 = await RunNetshAsync(
            $"advfirewall firewall add rule name=\"{RuleAllowC2Tcp}\" dir=out action=allow protocol=TCP remoteip={ipStr} remoteport={port}",
            ct).ConfigureAwait(false);
        if (allowC2.ExitCode != 0)
            return (false, $"Firewall allow C2 failed: {allowC2.StdErr ?? allowC2.StdOut}");

        // DNS so the host can still resolve names if policies change
        var allowDns = await RunNetshAsync(
            $"advfirewall firewall add rule name=\"{RuleAllowDnsUdp}\" dir=out action=allow protocol=UDP remoteport=53",
            ct).ConfigureAwait(false);
        if (allowDns.ExitCode != 0)
        {
            await RemoveIsolationRulesAsync(ct).ConfigureAwait(false);
            return (false, $"Firewall allow DNS failed: {allowDns.StdErr ?? allowDns.StdOut}");
        }

        // Block remaining outbound TCP (C2 allow rule matches first for server traffic)
        var blockRest = await RunNetshAsync(
            $"advfirewall firewall add rule name=\"{RuleBlockOtherTcp}\" dir=out action=block protocol=TCP",
            ct).ConfigureAwait(false);
        if (blockRest.ExitCode != 0)
        {
            await RemoveIsolationRulesAsync(ct).ConfigureAwait(false);
            return (false, $"Firewall block rule failed: {blockRest.StdErr ?? blockRest.StdOut}");
        }

        return (true, $"Network isolation active: TCP allowed to {ipStr}:{port} + DNS (UDP/53); other outbound TCP blocked");
    }

    public async Task<(bool Success, string Message)> RemoveIsolationAsync(CancellationToken ct = default)
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            return (false, "Host isolation is only supported on Windows");

        if (!IsRunningElevated())
            return (false, "Removing isolation requires the agent service to run as Administrator or LocalSystem");

        await RemoveIsolationRulesAsync(ct).ConfigureAwait(false);
        return (true, "Isolation rules removed from Windows Firewall");
    }

    /// <summary>
    /// Returns true if IronShield isolation firewall rules are present (network containment active).
    /// Used for heartbeat telemetry (CrowdStrike-style host status).
    /// </summary>
    public static bool IsIsolationActive()
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows)) return false;
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = "netsh",
                Arguments = "advfirewall firewall show rule name=\"IronShieldEDR-Isolate-BlockOutbound-TCP\"",
                CreateNoWindow = true,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                WorkingDirectory = Environment.SystemDirectory,
            };
            using var p = new Process { StartInfo = psi };
            p.Start();
            var stdout = p.StandardOutput.ReadToEnd();
            p.WaitForExit(8000);
            if (p.ExitCode != 0) return false;
            return stdout.Contains("Enabled", StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return false;
        }
    }

    private static bool IsLoopbackHost(string host)
    {
        if (host.Equals("localhost", StringComparison.OrdinalIgnoreCase)) return true;
        if (IPAddress.TryParse(host, out var ip))
            return IPAddress.IsLoopback(ip);
        return false;
    }

    private static async Task RemoveIsolationRulesAsync(CancellationToken ct)
    {
        foreach (var name in new[] { RuleBlockOtherTcp, RuleAllowDnsUdp, RuleAllowC2Tcp })
        {
            await RunNetshAsync($"advfirewall firewall delete rule name=\"{name}\"", ct).ConfigureAwait(false);
        }
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
