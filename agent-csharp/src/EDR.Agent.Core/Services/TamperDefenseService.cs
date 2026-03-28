using System.Diagnostics;
using System.Diagnostics.Eventing.Reader;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.ServiceProcess;
using EDR.Agent.Core.Models;

namespace EDR.Agent.Core.Services;

/// <summary>
/// User-mode tamper / integrity signals (not kernel self-defense). Surfaces service health,
/// binary path, and recent SCM stop events for the EDR Windows service to the management server.
/// </summary>
public static class TamperDefenseService
{
    private const string DefaultServiceName = "EDR.Agent";

    /// <summary>Collect snapshot for heartbeat <c>tamper_signals</c> JSON.</summary>
    public static TamperSignalsSnapshot Collect(string? serviceName = null)
    {
        var name = string.IsNullOrWhiteSpace(serviceName) ? DefaultServiceName : serviceName.Trim();
        var snap = new TamperSignalsSnapshot
        {
            SensorMode = "user_mode",
            KernelDriverPresent = false,
        };

        try
        {
            snap.AgentBinaryPath = Environment.ProcessPath;
        }
        catch
        {
            try
            {
                using var p = Process.GetCurrentProcess();
                snap.AgentBinaryPath = p.MainModule?.FileName;
            }
            catch { /* best-effort */ }
        }

        try
        {
            if (!string.IsNullOrEmpty(snap.AgentBinaryPath) && File.Exists(snap.AgentBinaryPath))
            {
                var fi = new FileInfo(snap.AgentBinaryPath);
                if (fi.Length > 0 && fi.Length <= 48 * 1024 * 1024)
                    snap.AgentBinarySha256 = ComputeSha256Hex(snap.AgentBinaryPath);
            }
        }
        catch { /* best-effort */ }

        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            return snap;

        try
        {
            using var sc = new ServiceController(name);
            snap.WindowsServiceName = name;
            snap.WindowsServiceStatus = sc.Status.ToString();
            snap.WindowsServiceCanStop = sc.CanStop;
        }
        catch
        {
            snap.WindowsServiceName = name;
            snap.WindowsServiceStatus = "not_installed_or_no_access";
        }

        try
        {
            snap.ServiceStopEvents24h = CountServiceControlStopEvents24h(name);
        }
        catch
        {
            snap.ServiceStopEvents24h = null;
        }

        snap.TamperRisk = ComputeRisk(snap);
        return snap;
    }

    private static string ComputeRisk(TamperSignalsSnapshot s)
    {
        var stops = s.ServiceStopEvents24h ?? 0;
        if (stops >= 3) return "high";
        if (stops >= 1) return "medium";
        return "low";
    }

    /// <summary>Event ID 7036 (Service Control Manager): service entered stopped state.</summary>
    private static int CountServiceControlStopEvents24h(string serviceName)
    {
        var cutoff = DateTime.UtcNow.AddHours(-24).ToString("yyyy-MM-ddTHH:mm:ss.fffZ");
        var xpath = $"*[System[Provider[@Name='Service Control Manager'] and (EventID=7036) and TimeCreated[@SystemTime>='{cutoff}']]]";
        var query = new EventLogQuery("System", PathType.LogName, xpath);
        using var reader = new EventLogReader(query);
        var count = 0;
        var needle = serviceName.Trim();
        for (var rec = reader.ReadEvent(); rec != null; rec = reader.ReadEvent())
        {
            using (rec)
            {
                try
                {
                    var xml = rec.ToXml();
                    if (xml.Contains(needle, StringComparison.OrdinalIgnoreCase) &&
                        (xml.Contains("stopped", StringComparison.OrdinalIgnoreCase) ||
                         rec.FormatDescription()?.Contains("stopped", StringComparison.OrdinalIgnoreCase) == true))
                        count++;
                    if (count >= 500) break;
                }
                catch
                {
                    // ignore
                }
            }
        }

        return count;
    }

    private static string ComputeSha256Hex(string path)
    {
        using var fs = File.OpenRead(path);
        var hash = SHA256.HashData(fs);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}
