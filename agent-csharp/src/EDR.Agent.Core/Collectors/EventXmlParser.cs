using System.Xml.Linq;

namespace EDR.Agent.Core.Collectors;

/// <summary>Parses Windows Event Log XML EventData into name/value pairs (Sysmon, Security audit, etc.).</summary>
internal static class EventXmlParser
{
    public static Dictionary<string, string> ParseEventData(string xml)
    {
        var dict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        try
        {
            var doc = XDocument.Parse(xml);
            foreach (var elem in doc.Descendants().Where(e => e.Name.LocalName == "Data"))
            {
                var name = elem.Attribute("Name")?.Value;
                if (name != null)
                    dict[name] = elem.Value;
            }
        }
        catch
        {
            /* ignore malformed XML */
        }

        return dict;
    }

    public static string? GetFileName(string? path)
    {
        if (string.IsNullOrEmpty(path)) return null;
        return Path.GetFileName(path);
    }

    public static int? ParseInt(string? s)
    {
        if (string.IsNullOrEmpty(s)) return null;
        return int.TryParse(s, out var n) ? n : null;
    }

    /// <summary>Parses Sysmon-style decimal PID or Security 0x-prefixed PID strings.</summary>
    public static int? ParseProcessId(string? s)
    {
        if (string.IsNullOrEmpty(s)) return null;
        s = s.Trim();
        if (s.StartsWith("0x", StringComparison.OrdinalIgnoreCase))
        {
            if (int.TryParse(s.AsSpan(2), System.Globalization.NumberStyles.HexNumber, null, out var hex))
                return hex;
            return null;
        }

        return int.TryParse(s, out var dec) ? dec : null;
    }

    /// <summary>Extract SHA256 from Sysmon Hashes field, e.g. "SHA256=abc...,MD5=..."</summary>
    public static string? ParseSha256FromHashes(string? hashes)
    {
        if (string.IsNullOrEmpty(hashes)) return null;
        const string prefix = "SHA256=";
        var idx = hashes.IndexOf(prefix, StringComparison.OrdinalIgnoreCase);
        if (idx < 0) return null;
        var start = idx + prefix.Length;
        var end = hashes.IndexOf(',', start);
        var hash = end >= 0 ? hashes[start..end].Trim() : hashes[start..].Trim();
        return hash.Length == 64 ? hash : null;
    }
}
