using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.NetworkInformation;
using System.Runtime.InteropServices;
using System.Management;
using EDR.Agent.Core.Models;

namespace EDR.Agent.Core.Services;

/// <summary>
/// Collects system and network information for registration and heartbeat.
/// </summary>
public class SystemInfoService
{
    private static (long Rx, long Tx, DateTime At)? _lastNetworkSample;

    /// <summary>Throttle expensive C:\ hidden enumeration (heartbeat runs often).</summary>
    private static DateTimeOffset _hiddenCScanUtc = DateTimeOffset.MinValue;
    private static List<HiddenPathPayload>? _hiddenCCache;
    private static readonly TimeSpan HiddenCScanCooldown = TimeSpan.FromHours(6);

    public string GetHostname() => Environment.MachineName;

    public string GetOsVersion()
    {
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            try
            {
                var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(
                    @"SOFTWARE\Microsoft\Windows NT\CurrentVersion");
                if (key != null)
                {
                    var productName = key.GetValue("ProductName")?.ToString() ?? "";
                    var version = key.GetValue("CurrentVersion")?.ToString() ?? "";
                    var build = key.GetValue("CurrentBuild")?.ToString() ?? "";
                    return $"{productName} {version} (Build {build})";
                }
            }
            catch { /* fallback */ }
        }
        return Environment.OSVersion.ToString();
    }

    public string? GetLoggedInUser() => Environment.UserName;

    public string? GetPrimaryIpAddress()
    {
        try
        {
            foreach (var ni in NetworkInterface.GetAllNetworkInterfaces())
            {
                if (ni.OperationalStatus != OperationalStatus.Up ||
                    ni.NetworkInterfaceType is NetworkInterfaceType.Loopback or NetworkInterfaceType.Tunnel)
                    continue;

                var props = ni.GetIPProperties();
                var unicast = props.UnicastAddresses
                    .FirstOrDefault(a => a.Address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork);
                if (unicast?.Address != null)
                    return unicast.Address.ToString();
            }
        }
        catch { }
        return null;
    }

    public string? GetMacAddress()
    {
        try
        {
            var ni = NetworkInterface.GetAllNetworkInterfaces()
                .FirstOrDefault(n => n.OperationalStatus == OperationalStatus.Up &&
                                    n.NetworkInterfaceType != NetworkInterfaceType.Loopback);
            return ni?.GetPhysicalAddress().ToString();
        }
        catch { }
        return null;
    }

    public HeartbeatPayload GetHeartbeatPayload(string? agentVersion = null)
    {
        var (cpu, ramPct, ramTotalMb, ramUsedMb, diskPct, diskTotalGb, diskUsedGb, rxMbps, txMbps) = GetResourceMetrics();
        return new HeartbeatPayload
        {
            Hostname = GetHostname(),
            OsVersion = GetOsVersion(),
            LoggedInUser = GetLoggedInUser(),
            IpAddress = GetPrimaryIpAddress(),
            MacAddress = GetMacAddress(),
            AgentVersion = agentVersion ?? "1.0.0",
            Connections = GetNetworkConnections(),
            ListeningPorts = GetListeningPorts(),
            SharedFolders = GetSharedFolders(),
            HiddenCItems = GetHiddenPathsOnDriveC(),
            CpuPercent = cpu,
            RamPercent = ramPct,
            RamTotalMb = ramTotalMb,
            RamUsedMb = ramUsedMb,
            DiskPercent = diskPct,
            DiskTotalGb = diskTotalGb,
            DiskUsedGb = diskUsedGb,
            NetworkRxMbps = rxMbps,
            NetworkTxMbps = txMbps,
        };
    }

    /// <summary>
    /// Collect CPU, RAM, disk, and network metrics.
    /// </summary>
    private (decimal? cpu, decimal? ramPct, int? ramTotalMb, int? ramUsedMb, decimal? diskPct, decimal? diskTotalGb, decimal? diskUsedGb, decimal? rxMbps, decimal? txMbps) GetResourceMetrics()
    {
        decimal? cpu = null;
        decimal? ramPct = null;
        int? ramTotalMb = null;
        int? ramUsedMb = null;
        decimal? diskPct = null;
        decimal? diskTotalGb = null;
        decimal? diskUsedGb = null;
        decimal? rxMbps = null;
        decimal? txMbps = null;

        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            try { (cpu, _, _) = GetCpuUsage(); } catch { }
            try { (ramPct, ramTotalMb, ramUsedMb) = GetRamUsage(); } catch { }
        }
        try { (diskPct, diskTotalGb, diskUsedGb) = GetDiskUsage(); } catch { }
        try { (rxMbps, txMbps) = GetNetworkBandwidth(); } catch { }

        return (cpu, ramPct, ramTotalMb, ramUsedMb, diskPct, diskTotalGb, diskUsedGb, rxMbps, txMbps);
    }

    private (decimal? percent, decimal?, decimal?) GetCpuUsage()
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows)) return (null, null, null);
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT LoadPercentage FROM Win32_Processor");
            foreach (var obj in searcher.Get().Cast<ManagementObject>())
            {
                var load = obj["LoadPercentage"];
                if (load != null && uint.TryParse(load.ToString(), out var pct))
                    return ((decimal)pct, null, null);
            }
        }
        catch { }
        return (null, null, null);
    }

    private (decimal? percent, int? totalMb, int? usedMb) GetRamUsage()
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows)) return (null, null, null);
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT TotalVisibleMemorySize, FreePhysicalMemory FROM Win32_OperatingSystem");
            foreach (var obj in searcher.Get().Cast<ManagementObject>())
            {
                var totalKb = obj["TotalVisibleMemorySize"]?.ToString();
                var freeKb = obj["FreePhysicalMemory"]?.ToString();
                if (ulong.TryParse(totalKb, out var t) && ulong.TryParse(freeKb, out var f))
                {
                    var totalMb = (int)(t / 1024);
                    var usedMb = (int)((t - f) / 1024);
                    var pct = t > 0 ? Math.Round((decimal)(t - f) / t * 100, 2) : (decimal?)null;
                    return (pct, totalMb, usedMb);
                }
            }
        }
        catch { }
        return (null, null, null);
    }

    private (decimal? percent, decimal? totalGb, decimal? usedGb) GetDiskUsage()
    {
        try
        {
            var drive = DriveInfo.GetDrives().FirstOrDefault(d => d.IsReady && d.Name.StartsWith("C", StringComparison.OrdinalIgnoreCase));
            if (drive == null)
                drive = DriveInfo.GetDrives().FirstOrDefault(d => d.IsReady);
            if (drive == null) return (null, null, null);

            var total = drive.TotalSize;
            var free = drive.AvailableFreeSpace;
            var used = total - free;
            var totalGb = Math.Round((decimal)total / (1024 * 1024 * 1024), 2);
            var usedGb = Math.Round((decimal)used / (1024 * 1024 * 1024), 2);
            var pct = total > 0 ? Math.Round((decimal)used / total * 100, 2) : (decimal?)null;
            return (pct, totalGb, usedGb);
        }
        catch { }
        return (null, null, null);
    }

    private (decimal? rxMbps, decimal? txMbps) GetNetworkBandwidth()
    {
        try
        {
            long totalRx = 0, totalTx = 0;
            foreach (var ni in NetworkInterface.GetAllNetworkInterfaces())
            {
                if (ni.OperationalStatus != OperationalStatus.Up || ni.NetworkInterfaceType == NetworkInterfaceType.Loopback)
                    continue;
                try
                {
                    var stats = ni.GetIPStatistics();
                    totalRx += stats.BytesReceived;
                    totalTx += stats.BytesSent;
                }
                catch { }
            }

            var now = DateTime.UtcNow;
            if (_lastNetworkSample is { } last)
            {
                var elapsed = (now - last.At).TotalSeconds;
                if (elapsed >= 1)
                {
                    var rxMbps = (decimal)((totalRx - last.Rx) * 8) / (1024 * 1024) / (decimal)elapsed;
                    var txMbps = (decimal)((totalTx - last.Tx) * 8) / (1024 * 1024) / (decimal)elapsed;
                    _lastNetworkSample = (totalRx, totalTx, now);
                    return (Math.Round(rxMbps, 2), Math.Round(txMbps, 2));
                }
            }
            _lastNetworkSample = (totalRx, totalTx, now);
        }
        catch { }
        return (null, null);
    }

    /// <summary>
    /// Get active TCP connections for heartbeat (Windows only).
    /// </summary>
    public List<NetworkConnectionPayload>? GetNetworkConnections()
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            return null;

        try
        {
            var list = new List<NetworkConnectionPayload>();
            var props = IPGlobalProperties.GetIPGlobalProperties();
            foreach (var conn in props.GetActiveTcpConnections().Take(150))
            {
                if (conn.State == TcpState.Listen) continue;
                var remoteAddr = conn.RemoteEndPoint.Address?.ToString();
                if (string.IsNullOrEmpty(remoteAddr) || remoteAddr == "0.0.0.0") continue;

                list.Add(new NetworkConnectionPayload
                {
                    LocalAddress = conn.LocalEndPoint.Address?.ToString(),
                    LocalPort = conn.LocalEndPoint.Port,
                    RemoteAddress = remoteAddr,
                    RemotePort = conn.RemoteEndPoint.Port,
                    Protocol = "TCP",
                    State = conn.State.ToString(),
                });
            }
            return list.Count > 0 ? list : null;
        }
        catch
        {
            return null;
        }
    }

    /// <summary>
    /// TCP/UDP listening sockets (Windows only). Bounded for heartbeat size.
    /// </summary>
    public List<ListeningPortPayload>? GetListeningPorts()
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            return null;

        try
        {
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var list = new List<ListeningPortPayload>();
            var props = IPGlobalProperties.GetIPGlobalProperties();
            foreach (var ep in props.GetActiveTcpListeners())
            {
                if (list.Count >= 300) break;
                var key = $"tcp|{ep.Address}|{ep.Port}";
                if (!seen.Add(key)) continue;
                list.Add(new ListeningPortPayload
                {
                    LocalAddress = ep.Address?.ToString(),
                    LocalPort = ep.Port,
                    Protocol = "TCP",
                });
            }
            foreach (var ep in props.GetActiveUdpListeners())
            {
                if (list.Count >= 300) break;
                var key = $"udp|{ep.Address}|{ep.Port}";
                if (!seen.Add(key)) continue;
                list.Add(new ListeningPortPayload
                {
                    LocalAddress = ep.Address?.ToString(),
                    LocalPort = ep.Port,
                    Protocol = "UDP",
                });
            }
            list.Sort((a, b) => a.LocalPort.CompareTo(b.LocalPort));
            return list.Count > 0 ? list : null;
        }
        catch
        {
            return null;
        }
    }

    /// <summary>
    /// Files and directories on C:\ with the Hidden attribute (Windows only).
    /// Bounded depth/count; skips heavy subtrees. Re-scans at most every <see cref="HiddenCScanCooldown"/>.
    /// </summary>
    public List<HiddenPathPayload>? GetHiddenPathsOnDriveC()
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            return null;

        var now = DateTimeOffset.UtcNow;
        if (now - _hiddenCScanUtc < HiddenCScanCooldown && _hiddenCCache != null)
            return _hiddenCCache.Count > 0 ? _hiddenCCache : null;

        const int maxEntries = 400;
        const int maxDepth = 4;
        var root = Path.GetPathRoot(Environment.SystemDirectory);
        if (string.IsNullOrEmpty(root) || !root.StartsWith("C:", StringComparison.OrdinalIgnoreCase))
            root = @"C:\";

        var list = new List<HiddenPathPayload>();
        try
        {
            EnumerateHiddenUnder(root, 0, maxDepth, maxEntries, list);
        }
        catch
        {
            _hiddenCScanUtc = DateTimeOffset.UtcNow;
            _hiddenCCache = null;
            return null;
        }

        _hiddenCCache = list;
        _hiddenCScanUtc = now;
        return list.Count > 0 ? list : null;
    }

    private static readonly HashSet<string> HiddenCSkipDirNames = new(StringComparer.OrdinalIgnoreCase)
    {
        "System Volume Information",
    };

    private static bool ShouldSkipHiddenSubtree(string dir)
    {
        var p = dir.Replace('/', '\\');
        if (p.Contains(@"\Windows\WinSxS", StringComparison.OrdinalIgnoreCase)) return true;
        if (p.Contains(@"\Windows\SoftwareDistribution\Download", StringComparison.OrdinalIgnoreCase)) return true;
        return false;
    }

    private static void EnumerateHiddenUnder(string dir, int depth, int maxDepth, int maxEntries, List<HiddenPathPayload> list)
    {
        if (list.Count >= maxEntries || depth > maxDepth) return;
        if (ShouldSkipHiddenSubtree(dir)) return;

        string? leaf = null;
        try
        {
            leaf = Path.GetFileName(dir.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar));
        }
        catch
        {
            return;
        }
        if (!string.IsNullOrEmpty(leaf) && HiddenCSkipDirNames.Contains(leaf)) return;

        IEnumerable<string> entries;
        try
        {
            entries = Directory.EnumerateFileSystemEntries(dir);
        }
        catch
        {
            return;
        }

        foreach (var entry in entries)
        {
            if (list.Count >= maxEntries) break;
            try
            {
                var attr = File.GetAttributes(entry);
                var isDir = (attr & FileAttributes.Directory) != 0;
                var hidden = (attr & FileAttributes.Hidden) != 0;
                if (hidden)
                {
                    list.Add(new HiddenPathPayload { Path = entry, IsDirectory = isDir });
                }
                if (isDir && depth < maxDepth)
                    EnumerateHiddenUnder(entry, depth + 1, maxDepth, maxEntries, list);
            }
            catch
            {
                /* access denied / reparse */
            }
        }
    }

    /// <summary>
    /// SMB shares from Win32_Share (Windows only).
    /// </summary>
    public List<SharedFolderPayload>? GetSharedFolders()
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            return null;

        try
        {
            var list = new List<SharedFolderPayload>();
            using var searcher = new ManagementObjectSearcher("SELECT Name, Path, Type, Caption FROM Win32_Share");
            foreach (ManagementObject obj in searcher.Get())
            {
                if (list.Count >= 150) break;
                var name = obj["Name"]?.ToString();
                if (string.IsNullOrEmpty(name)) continue;
                int? st = null;
                if (obj["Type"] != null)
                {
                    try { st = Convert.ToInt32(obj["Type"]); } catch { }
                }
                list.Add(new SharedFolderPayload
                {
                    Name = name,
                    Path = obj["Path"]?.ToString(),
                    ShareType = st,
                    Caption = obj["Caption"]?.ToString(),
                });
            }
            return list.Count > 0 ? list : null;
        }
        catch
        {
            return null;
        }
    }

    /// <summary>
    /// Get registration payload (same as heartbeat for initial registration).
    /// </summary>
    public object GetRegistrationPayload(string? agentVersion = null, string? tenantSlug = null)
    {
        var payload = GetHeartbeatPayload(agentVersion);
        var dict = new Dictionary<string, object?>
        {
            ["hostname"] = payload.Hostname,
            ["os_version"] = payload.OsVersion,
            ["logged_in_user"] = payload.LoggedInUser,
            ["ip_address"] = payload.IpAddress,
            ["mac_address"] = payload.MacAddress,
            ["agent_version"] = payload.AgentVersion ?? "1.0.0",
        };
        if (!string.IsNullOrWhiteSpace(tenantSlug))
            dict["tenant_slug"] = tenantSlug.Trim();
        return dict;
    }
}
