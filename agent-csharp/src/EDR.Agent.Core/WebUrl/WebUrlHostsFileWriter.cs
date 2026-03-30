using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Text;

namespace EDR.Agent.Core.WebUrl;

/// <summary>
/// Applies IOC domain blocks via a marked section in <c>%SystemRoot%\System32\drivers\etc\hosts</c> (127.0.0.1 sinkhole).
/// Does not intercept DNS-over-HTTPS or raw IP connections. Requires an elevated agent (Administrator / LocalSystem).
/// </summary>
public static class WebUrlHostsFileWriter
{
    public const string BeginMarker = "# BEGIN IRONSHIELD-WEB-BLOCK";
    public const string EndMarker = "# END IRONSHIELD-WEB-BLOCK";

    /// <summary>Strip IronShield block section and optionally write a new one.</summary>
    public static (bool Success, string Message) Apply(
        IReadOnlyList<string> domains,
        IReadOnlySet<string> excludeHostsLower)
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            return (false, "Web URL hosts sinkhole is only supported on Windows");

        if (!IsElevated())
            return (false, "Administrator / LocalSystem required to modify hosts file");

        var path = GetHostsPath();
        string before;
        try
        {
            before = File.ReadAllText(path, Encoding.UTF8);
        }
        catch (Exception ex)
        {
            return (false, $"Cannot read hosts: {ex.Message}");
        }

        var stripped = RemoveIronShieldSection(before);
        var sb = new StringBuilder(stripped.TrimEnd());
        if (domains.Count > 0)
        {
            if (sb.Length > 0 && !sb.ToString().EndsWith('\n')) sb.AppendLine();
            sb.AppendLine();
            sb.AppendLine(BeginMarker);
            sb.AppendLine("# IronShield EDR — malicious/phishing domains from IOC watchlist (sinkhole)");
            foreach (var d in domains.OrderBy(x => x, StringComparer.OrdinalIgnoreCase))
            {
                if (string.IsNullOrWhiteSpace(d)) continue;
                var host = d.Trim().ToLowerInvariant();
                if (excludeHostsLower.Contains(host)) continue;
                if (!IsSafeHostLabel(host)) continue;
                sb.AppendLine($"127.0.0.1 {host}");
            }

            sb.AppendLine(EndMarker);
        }

        try
        {
            File.WriteAllText(path, sb.ToString(), new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
        }
        catch (Exception ex)
        {
            return (false, $"Cannot write hosts: {ex.Message}");
        }

        _ = TryFlushDns();
        return (true, domains.Count == 0 ? "Block section cleared" : $"Applied {domains.Count} host entries");
    }

    private static bool TryFlushDns()
    {
        try
        {
            using var p = new Process();
            p.StartInfo = new ProcessStartInfo
            {
                FileName = Path.Combine(Environment.SystemDirectory, "ipconfig.exe"),
                Arguments = "/flushdns",
                CreateNoWindow = true,
                UseShellExecute = false,
            };
            p.Start();
            p.WaitForExit(15_000);
            return true;
        }
        catch
        {
            return false;
        }
    }

    public static string RemoveIronShieldSection(string content)
    {
        var start = content.IndexOf(BeginMarker, StringComparison.Ordinal);
        if (start < 0) return content;
        var end = content.IndexOf(EndMarker, StringComparison.Ordinal);
        if (end < 0) return content[..start].TrimEnd() + Environment.NewLine;
        end += EndMarker.Length;
        while (end < content.Length && (content[end] == '\r' || content[end] == '\n')) end++;
        return (content[..start] + content[end..]).TrimEnd() + Environment.NewLine;
    }

    private static string GetHostsPath() =>
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "drivers", "etc", "hosts");

    private static bool IsElevated()
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows)) return false;
        try
        {
            using var id = WindowsIdentity.GetCurrent();
            return new WindowsPrincipal(id).IsInRole(WindowsBuiltInRole.Administrator);
        }
        catch
        {
            return false;
        }
    }

    /// <summary>Basic validation — IOCs should already be normalized server-side.</summary>
    private static bool IsSafeHostLabel(string host)
    {
        if (host.Length is < 3 or > 253) return false;
        if (host is "localhost" or "127.0.0.1" or "::1") return false;
        var labels = host.Split('.');
        if (labels.Length < 2) return false;
        foreach (var lab in labels)
        {
            if (lab.Length is 0 or > 63) return false;
            foreach (var c in lab)
            {
                if (char.IsAsciiLetterOrDigit(c) || c == '-') continue;
                return false;
            }
        }

        return true;
    }
}
