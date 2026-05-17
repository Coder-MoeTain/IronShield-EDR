using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Win32;
using EDR.Agent.Core.Models;

namespace EDR.Agent.Core.Software;

/// <summary>
/// Collects installed software from Windows registry uninstall keys (safe; no Win32_Product).
/// </summary>
public class SoftwareInventoryCollector
{
    private static readonly string[] UninstallPaths =
    {
        @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
        @"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
    };

    public List<SoftwareInventoryItemDto> Collect(bool includeUserApps = true, bool includeExecutablePaths = true)
    {
        var list = new List<SoftwareInventoryItemDto>();
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows)) return list;

        foreach (var path in UninstallPaths)
            CollectFromHive(Registry.LocalMachine, path, "HKLM", list, includeExecutablePaths);

        if (includeUserApps)
            CollectFromHive(Registry.CurrentUser, UninstallPaths[0], "HKCU", list, includeExecutablePaths);

        return list;
    }

    private static void CollectFromHive(RegistryKey root, string subPath, string hive, List<SoftwareInventoryItemDto> list, bool includeExePaths)
    {
        try
        {
            using var key = root.OpenSubKey(subPath);
            if (key == null) return;
            foreach (var subKeyName in key.GetSubKeyNames())
            {
                try
                {
                    using var sub = key.OpenSubKey(subKeyName);
                    if (sub == null) continue;
                    var displayName = sub.GetValue("DisplayName")?.ToString();
                    if (string.IsNullOrWhiteSpace(displayName)) continue;
                    var version = sub.GetValue("DisplayVersion")?.ToString();
                    var publisher = sub.GetValue("Publisher")?.ToString();
                    var installLocation = sub.GetValue("InstallLocation")?.ToString();
                    var uninstall = sub.GetValue("UninstallString")?.ToString();
                    var quietUninstall = sub.GetValue("QuietUninstallString")?.ToString();
                    var installDate = FormatInstallDate(sub.GetValue("InstallDate")?.ToString());
                    var arch = Environment.Is64BitOperatingSystem && subPath.Contains("WOW6432") ? "x86" : "x64";

                    var exePaths = new List<string>();
                    if (includeExePaths && !string.IsNullOrWhiteSpace(installLocation) && Directory.Exists(installLocation))
                    {
                        try
                        {
                            foreach (var exe in Directory.EnumerateFiles(installLocation, "*.exe", SearchOption.TopDirectoryOnly).Take(5))
                                exePaths.Add(exe);
                        }
                        catch { /* ignore */ }
                    }

                    var item = new SoftwareInventoryItemDto
                    {
                        Name = displayName.Trim(),
                        Vendor = publisher,
                        Version = version,
                        InstallLocation = installLocation,
                        ExecutablePaths = exePaths,
                        UninstallString = uninstall,
                        QuietUninstallString = quietUninstall,
                        InstallDate = installDate,
                        Architecture = arch,
                        Source = $"registry:{hive}",
                        Status = "installed",
                    };
                    item.Fingerprint = ComputeFingerprint(item, null);
                    list.Add(item);
                }
                catch { /* skip bad key */ }
            }
        }
        catch { /* ignore hive errors */ }
    }

    public static string ComputeFingerprint(SoftwareInventoryItemDto item, long? endpointId)
    {
        var payload = string.Join("|", new[]
        {
            Normalize(item.Name),
            Normalize(item.Vendor ?? ""),
            (item.Version ?? "").Trim(),
            (item.InstallLocation ?? "").ToLowerInvariant().Trim(),
            endpointId?.ToString() ?? "",
        });
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(payload));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private static string Normalize(string s) =>
        string.Join(" ", s.ToLowerInvariant().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));

    private static string? FormatInstallDate(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw) || raw.Length < 8) return null;
        if (raw.Length >= 8 && DateTime.TryParseExact(raw[..8], "yyyyMMdd", null, System.Globalization.DateTimeStyles.None, out var dt))
            return dt.ToString("yyyy-MM-dd");
        return raw;
    }

    public (List<SoftwareInventoryItemDto> added, List<SoftwareInventoryItemDto> updated, List<string> removed) Diff(
        List<SoftwareInventoryItemDto> current,
        Dictionary<string, SoftwareInventoryItemDto> previous)
    {
        var added = new List<SoftwareInventoryItemDto>();
        var updated = new List<SoftwareInventoryItemDto>();
        var seen = new HashSet<string>();

        foreach (var item in current)
        {
            seen.Add(item.Fingerprint);
            if (!previous.TryGetValue(item.Fingerprint, out var prev))
                added.Add(item);
            else if (!string.Equals(prev.Version, item.Version, StringComparison.OrdinalIgnoreCase))
                updated.Add(item);
        }

        var removed = previous.Keys.Where(k => !seen.Contains(k)).ToList();
        return (added, updated, removed);
    }
}
