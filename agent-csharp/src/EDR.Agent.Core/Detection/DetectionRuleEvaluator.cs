using System.Text.Json;
using System.Text.RegularExpressions;
using EDR.Agent.Core.Models;

namespace EDR.Agent.Core.Detection;

/// <summary>
/// Evaluates the same condition keys as server-node DetectionEngineService (conditions ANDed).
/// </summary>
public static class DetectionRuleEvaluator
{
    private static readonly HashSet<string> ExecNames = new(StringComparer.OrdinalIgnoreCase)
    {
        "powershell", "pwsh", "cmd", "wscript", "cscript", "rundll32", "regsvr32", "mshta",
        "winword", "excel", "powerpnt", "outlook", "chrome", "msedge", "firefox",
    };

    private static readonly Regex EncBase64Line = new(@"^[A-Za-z0-9+/=]{20,}$", RegexOptions.Compiled);
    private static readonly Regex EncPowershell = new(@"-enc\b|-encodedcommand\b|FromBase64String", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static bool Matches(AgentDetectionRuleDto rule, TelemetryEvent evt)
    {
        if (rule.Conditions.ValueKind != JsonValueKind.Object)
            return false;
        var any = false;
        foreach (var prop in rule.Conditions.EnumerateObject())
        {
            any = true;
            if (!EvalCondition(prop.Name, prop.Value, evt))
                return false;
        }
        return any;
    }

    private static string Str(string? s) => s ?? "";

    /// <summary>Mirrors server EventNormalizationService.normalizeProcessName for detection parity.</summary>
    private static string NormalizeProcessName(string? name)
    {
        if (string.IsNullOrWhiteSpace(name)) return "";
        var s = name.Trim();
        if (string.IsNullOrEmpty(s)) return s;
        var baseName = Regex.Replace(s, @"\.(exe|com|bat|cmd)$", "", RegexOptions.IgnoreCase);
        var lower = baseName.ToLowerInvariant();
        if (ExecNames.Contains(lower) && !Regex.IsMatch(s, @"\.(exe|com|bat|cmd|ps1|vbs|js|msi)$", RegexOptions.IgnoreCase))
            return baseName + ".exe";
        return s;
    }

    private static string Cmd(TelemetryEvent e) => Str(e.CommandLine) + Str(e.PowerShellCommand);

    private static string PathCombined(TelemetryEvent e) => Str(e.ProcessPath) + Str(e.CommandLine);

    private static string ProcLower(TelemetryEvent e) => NormalizeProcessName(e.ProcessName).ToLowerInvariant();

    private static string ParentUpper(TelemetryEvent e) => NormalizeProcessName(e.ParentProcessName).ToUpperInvariant();

    private static string TryRaw(TelemetryEvent e, params string[] keys)
    {
        if (e.RawData == null) return "";
        foreach (var k in keys)
        {
            if (e.RawData.TryGetValue(k, out var v) && v != null)
                return v.ToString() ?? "";
        }
        return "";
    }

    private static string DnsQuery(TelemetryEvent e) =>
        TryRaw(e, "dns_query", "QueryName", "query_name", "sysmon_QueryName");

    private static string RegistryKey(TelemetryEvent e) =>
        TryRaw(e, "registry_key", "TargetObject", "target_object", "sysmon_TargetObject");

    private static string ImageLoaded(TelemetryEvent e) =>
        TryRaw(e, "image_loaded_path", "ImageLoaded", "image_loaded", "sysmon_ImageLoaded");

    private static bool EvalCondition(string key, JsonElement value, TelemetryEvent norm)
    {
        var proc = ProcLower(norm);
        var parent = ParentUpper(norm);
        var cmd = Cmd(norm);
        var path = PathCombined(norm);

        switch (key)
        {
            case "event_type":
                {
                    var et = Str(norm.EventType).ToLowerInvariant();
                    if (value.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var el in value.EnumerateArray())
                        {
                            var v = el.GetString() ?? "";
                            if (et.Contains(v, StringComparison.OrdinalIgnoreCase))
                                return true;
                        }
                        return false;
                    }
                    var single = (value.GetString() ?? "").ToLowerInvariant();
                    if (single == "service_create")
                        return et.Contains("service", StringComparison.OrdinalIgnoreCase);
                    return et.Contains(single, StringComparison.OrdinalIgnoreCase);
                }
            case "process_name":
                if (value.ValueKind == JsonValueKind.Array)
                {
                    foreach (var el in value.EnumerateArray())
                    {
                        var v = (el.GetString() ?? "").ToLowerInvariant();
                        if (proc.Contains(v, StringComparison.Ordinal))
                            return true;
                    }
                    return false;
                }
                return proc.Contains((value.GetString() ?? "").ToLowerInvariant(), StringComparison.Ordinal);
            case "parent_process":
                if (value.ValueKind != JsonValueKind.Array) return false;
                foreach (var el in value.EnumerateArray())
                {
                    var v = (el.GetString() ?? "").ToUpperInvariant();
                    if (parent.Contains(v, StringComparison.Ordinal))
                        return true;
                }
                return false;
            case "child_process":
                if (value.ValueKind != JsonValueKind.Array) return false;
                foreach (var el in value.EnumerateArray())
                {
                    var v = (el.GetString() ?? "").ToLowerInvariant();
                    if (proc.Contains(v, StringComparison.Ordinal))
                        return true;
                }
                return false;
            case "encoded_command":
                if (value.ValueKind != JsonValueKind.True) return false;
                if (!Regex.IsMatch(proc, @"powershell\.exe", RegexOptions.IgnoreCase)) return false;
                if (EncPowershell.IsMatch(cmd)) return true;
                return EncBase64Line.IsMatch(cmd);
            case "suspicious_params":
                if (value.ValueKind != JsonValueKind.True) return false;
                if (proc.Contains("rundll32", StringComparison.OrdinalIgnoreCase)) return cmd.Length > 100;
                if (proc.Contains("wscript", StringComparison.OrdinalIgnoreCase) ||
                    proc.Contains("cscript", StringComparison.OrdinalIgnoreCase)) return cmd.Length > 80;
                if (proc.Contains("regsvr32", StringComparison.OrdinalIgnoreCase)) return cmd.Length > 60;
                if (proc.Contains("mshta", StringComparison.OrdinalIgnoreCase)) return cmd.Length > 50;
                return false;
            case "path_contains":
                if (value.ValueKind != JsonValueKind.Array) return false;
                var pathUpper = path.ToUpperInvariant();
                foreach (var el in value.EnumerateArray())
                {
                    var fragment = (el.GetString() ?? "").ToUpperInvariant();
                    if (pathUpper.Contains(fragment, StringComparison.Ordinal))
                        return true;
                }
                return false;
            case "unusual_parent":
                if (value.ValueKind != JsonValueKind.True) return false;
                var etUn = Str(norm.EventType);
                if (!etUn.Contains("service", StringComparison.OrdinalIgnoreCase)) return false;
                var pp = Str(norm.ParentProcessName);
                if (Regex.IsMatch(pp, @"services\.exe|svchost\.exe", RegexOptions.IgnoreCase))
                    return false;
                return true;
            case "signed":
                if (value.ValueKind != JsonValueKind.False) return false;
                if (!path.ToLowerInvariant().Contains("\\users\\", StringComparison.Ordinal)) return false;
                return string.IsNullOrEmpty(norm.FileHashSha256);
            case "dns_query_contains":
                {
                    var dq = DnsQuery(norm);
                    if (value.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var el in value.EnumerateArray())
                        {
                            var needle = el.GetString() ?? "";
                            if (dq.Contains(needle, StringComparison.OrdinalIgnoreCase))
                                return true;
                        }
                        return false;
                    }
                    return dq.Contains(value.GetString() ?? "", StringComparison.OrdinalIgnoreCase);
                }
            case "dns_query_length_gt":
                {
                    var dq = DnsQuery(norm);
                    var min = value.ValueKind == JsonValueKind.Number ? value.GetDouble() : 0;
                    return dq.Length > min;
                }
            case "registry_key_contains":
                {
                    var rk = RegistryKey(norm);
                    if (value.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var el in value.EnumerateArray())
                        {
                            var fragment = (el.GetString() ?? "").ToUpperInvariant();
                            if (rk.ToUpperInvariant().Contains(fragment, StringComparison.Ordinal))
                                return true;
                        }
                        return false;
                    }
                    return rk.ToUpperInvariant().Contains((value.GetString() ?? "").ToUpperInvariant(), StringComparison.Ordinal);
                }
            case "image_loaded_contains":
                {
                    var im = ImageLoaded(norm);
                    if (value.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var el in value.EnumerateArray())
                        {
                            var needle = (el.GetString() ?? "").ToLowerInvariant();
                            if (im.Contains(needle, StringComparison.OrdinalIgnoreCase))
                                return true;
                        }
                        return false;
                    }
                    return im.Contains(value.GetString() ?? "", StringComparison.OrdinalIgnoreCase);
                }
            case "command_line_entropy_gt":
                {
                    double? entropy = norm.CommandLineEntropy;
                    if (entropy == null && norm.RawData != null &&
                        norm.RawData.TryGetValue("command_line_entropy", out var rawE) &&
                        rawE != null && double.TryParse(rawE.ToString(), out var parsed))
                        entropy = parsed;
                    var min = value.ValueKind == JsonValueKind.Number ? value.GetDouble() : 0;
                    if (entropy == null || double.IsNaN(entropy.Value)) return false;
                    return entropy.Value > min;
                }
            case "suspicious_indicator_count_gte":
                {
                    int? count = norm.SuspiciousIndicatorCount;
                    if (count == null && norm.RawData != null &&
                        norm.RawData.TryGetValue("suspicious_indicator_count", out var rawC) &&
                        rawC != null && int.TryParse(rawC.ToString(), out var parsed))
                        count = parsed;
                    var min = value.ValueKind == JsonValueKind.Number ? value.GetInt32() : 0;
                    if (count == null) return false;
                    return count.Value >= min;
                }
            case "collector_confidence_lt":
                {
                    double? conf = norm.CollectorConfidence;
                    if (conf == null && norm.RawData != null &&
                        norm.RawData.TryGetValue("collector_confidence", out var rawF) &&
                        rawF != null && double.TryParse(rawF.ToString(), out var parsed))
                        conf = parsed;
                    var max = value.ValueKind == JsonValueKind.Number ? value.GetDouble() : double.NaN;
                    if (conf == null || double.IsNaN(max)) return false;
                    return conf.Value < max;
                }
            default:
                return false;
        }
    }
}
