using System.Management;
using System.Runtime.InteropServices;

namespace EDR.Agent.Core.DeviceControl;

/// <summary>
/// Detects removable volumes and attempts safe eject (user-mode, best-effort — not a kernel filter driver).
/// </summary>
public static class RemovableVolumeHelper
{
    public static bool IsWindows() => RuntimeInformation.IsOSPlatform(OSPlatform.Windows);

    /// <summary>Returns true if drive letter is a ready removable drive (typically USB mass storage).</summary>
    public static bool IsRemovableDriveLetter(string driveLetter)
    {
        if (!IsWindows() || string.IsNullOrWhiteSpace(driveLetter)) return false;
        var root = NormalizeRoot(driveLetter);
        try
        {
            var di = new DriveInfo(root);
            return di.IsReady && di.DriveType == DriveType.Removable;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// Attempt WMI <c>Win32_Volume.Eject</c>. Returns false if not supported or failed.
    /// </summary>
    public static bool TryEjectVolume(string driveLetter, out string? error)
    {
        error = null;
        if (!IsWindows())
        {
            error = "not_windows";
            return false;
        }

        var dl = NormalizeDriveLetter(driveLetter);
        if (string.IsNullOrEmpty(dl))
        {
            error = "bad_letter";
            return false;
        }

        try
        {
            using var searcher = new ManagementObjectSearcher(
                $"SELECT * FROM Win32_Volume WHERE DriveLetter = '{dl.Replace("'", "''")}'");
            var any = false;
            foreach (ManagementObject vol in searcher.Get())
            {
                using (vol)
                {
                    any = true;
                    try
                    {
                        vol.InvokeMethod("Eject", null);
                        return true;
                    }
                    catch (Exception ex)
                    {
                        error = ex.Message;
                    }
                }
            }

            if (!any) error = "volume_not_found";
        }
        catch (Exception ex)
        {
            error = ex.Message;
        }

        return false;
    }

    private static string NormalizeDriveLetter(string driveLetter)
    {
        var s = driveLetter.Trim();
        if (s.Length == 0) return "";
        if (s.Length == 1) return char.ToUpperInvariant(s[0]) + ":";
        if (s.Length >= 2 && s[1] == ':')
            return char.ToUpperInvariant(s[0]) + ":";
        return "";
    }

    private static string NormalizeRoot(string driveLetter)
    {
        var dl = NormalizeDriveLetter(driveLetter);
        return string.IsNullOrEmpty(dl) ? driveLetter : dl + "\\";
    }
}
