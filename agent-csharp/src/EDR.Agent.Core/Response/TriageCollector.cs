using System.Diagnostics;
using System.Net.NetworkInformation;
using System.ServiceProcess;
using Microsoft.Win32;

namespace EDR.Agent.Core.Response;

/// <summary>
/// Collects triage metadata: running processes, services, startup entries, network, users, etc.
/// Defensive triage for incident response. Phase 3 expanded.
/// </summary>
public class TriageCollector
{
    /// <summary>
    /// Collect based on request_type: full, processes, services, startup, network, software, users, scheduled_tasks
    /// </summary>
    public async Task<object> CollectAsync(string requestType = "full", CancellationToken ct = default)
    {
        var result = new Dictionary<string, object>();

        await Task.Run(() =>
        {
            var includeAll = requestType.Equals("full", StringComparison.OrdinalIgnoreCase);

            if (includeAll || requestType.Equals("processes", StringComparison.OrdinalIgnoreCase))
                result["processes"] = GetProcesses();

            if (includeAll || requestType.Equals("services", StringComparison.OrdinalIgnoreCase))
                result["services"] = GetServices();

            if (includeAll || requestType.Equals("startup", StringComparison.OrdinalIgnoreCase))
                result["startup"] = GetStartupEntries();

            if (includeAll || requestType.Equals("network", StringComparison.OrdinalIgnoreCase))
                result["network"] = GetNetworkConnections();

            if (includeAll || requestType.Equals("software", StringComparison.OrdinalIgnoreCase))
                result["software"] = GetInstalledSoftware();

            if (includeAll || requestType.Equals("users", StringComparison.OrdinalIgnoreCase))
                result["users"] = GetLoggedInUsers();

            if (includeAll || requestType.Equals("scheduled_tasks", StringComparison.OrdinalIgnoreCase))
                result["scheduled_tasks"] = GetScheduledTasks();

            result["collected_at"] = DateTime.UtcNow;
        }, ct);

        return result;
    }

    private static List<object> GetProcesses()
    {
        var list = new List<object>();
        try
        {
            foreach (var p in Process.GetProcesses().Take(200))
            {
                try
                {
                    list.Add(new
                    {
                        id = p.Id,
                        name = p.ProcessName,
                        path = p.MainModule?.FileName,
                    });
                }
                catch { }
                finally { p.Dispose(); }
            }
        }
        catch { }
        return list;
    }

    private static List<object> GetServices()
    {
        var list = new List<object>();
        try
        {
            foreach (var svc in ServiceController.GetServices().Take(100))
            {
                try
                {
                    list.Add(new
                    {
                        name = svc.ServiceName,
                        display = svc.DisplayName,
                        status = svc.Status.ToString(),
                    });
                }
                catch { }
                finally { svc.Dispose(); }
            }
        }
        catch { }
        return list;
    }

    private static List<object> GetStartupEntries()
    {
        var list = new List<object>();
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run");
            if (key != null)
            {
                foreach (var name in key.GetValueNames())
                {
                    list.Add(new { name, value = key.GetValue(name)?.ToString() });
                }
            }
            using var hklm = Registry.LocalMachine.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run");
            if (hklm != null)
            {
                foreach (var name in hklm.GetValueNames())
                {
                    list.Add(new { name, value = hklm.GetValue(name)?.ToString(), hive = "HKLM" });
                }
            }
        }
        catch { }
        return list;
    }

    private static List<object> GetNetworkConnections()
    {
        var list = new List<object>();
        try
        {
            var props = IPGlobalProperties.GetIPGlobalProperties();
            foreach (var conn in props.GetActiveTcpConnections().Take(100))
            {
                list.Add(new
                {
                    local = $"{conn.LocalEndPoint.Address}:{conn.LocalEndPoint.Port}",
                    remote = $"{conn.RemoteEndPoint.Address}:{conn.RemoteEndPoint.Port}",
                    state = conn.State.ToString()
                });
            }
        }
        catch { }
        return list;
    }

    private static List<object> GetInstalledSoftware()
    {
        var list = new List<object>();
        try
        {
            using var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall");
            if (key == null) return list;
            foreach (var subKeyName in key.GetSubKeyNames().Take(100))
            {
                try
                {
                    using var sub = key.OpenSubKey(subKeyName);
                    if (sub == null) continue;
                    var displayName = sub.GetValue("DisplayName")?.ToString();
                    if (string.IsNullOrEmpty(displayName)) continue;
                    list.Add(new { name = displayName, version = sub.GetValue("DisplayVersion")?.ToString() });
                }
                catch { }
            }
        }
        catch { }
        return list;
    }

    private static List<object> GetLoggedInUsers()
    {
        var list = new List<object>();
        try
        {
            foreach (var p in Process.GetProcessesByName("explorer").Take(5))
            {
                try
                {
                    list.Add(new { session = p.SessionId });
                }
                catch { }
                finally { p.Dispose(); }
            }
        }
        catch { }
        return list;
    }

    private static List<object> GetScheduledTasks()
    {
        var list = new List<object>();
        try
        {
            var tasksPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "Tasks");
            if (!Directory.Exists(tasksPath)) return list;
            foreach (var f in Directory.GetFiles(tasksPath, "*.xml").Take(50))
            {
                list.Add(new { name = Path.GetFileNameWithoutExtension(f), path = f });
            }
        }
        catch { }
        return list;
    }
}
