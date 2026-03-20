using System.Runtime.InteropServices;

namespace EDR.Agent.Core.Antivirus;

/// <summary>
/// Safe heuristic scoring for suspicious file indicators.
/// Defensive only - no offensive logic.
/// </summary>
public static class HeuristicEngine
{
    private static readonly string[] SuspiciousDirs = [
        "temp", "tmp", "downloads", "appdata\\local\\temp", "appdata\\roaming",
        "startup", "programdata\\microsoft\\windows\\start menu"
    ];

    private static readonly string[] DoubleExtensions = [
        ".exe.txt", ".pdf.exe", ".doc.exe", ".jpg.exe", ".scr.exe", ".bat.exe"
    ];

    /// <summary>Rule name and score contribution for transparency.</summary>
    public record HeuristicRule(string Name, int Score);

    /// <summary>Score file and return per-rule breakdown for detailed reporting.</summary>
    public static (int TotalScore, List<HeuristicRule> Rules) ScoreFileWithDetails(string? filePath, string? fileName, long? fileSize, bool isSigned, double? entropy, bool hasSuspiciousPeImports = false)
    {
        var rules = new List<HeuristicRule>();
        if (string.IsNullOrEmpty(filePath)) return (0, rules);
        var path = filePath.ToLowerInvariant().Replace('/', '\\');
        var name = (fileName ?? Path.GetFileName(path)).ToLowerInvariant();

        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows)) return (0, rules);

        // Unsigned executable in suspicious path
        if (!isSigned && IsExecutableExtension(name))
        {
            if (IsInSuspiciousPath(path)) { rules.Add(new HeuristicRule("unsigned_in_suspicious_path", 30)); }
            if (path.Contains("downloads")) { rules.Add(new HeuristicRule("unsigned_in_downloads", 20)); }
            if (path.Contains("temp") || path.Contains("tmp")) { rules.Add(new HeuristicRule("unsigned_in_temp", 25)); }
        }

        // Double extension
        foreach (var ext in DoubleExtensions)
        {
            if (name.EndsWith(ext)) { rules.Add(new HeuristicRule("double_extension", 40)); break; }
        }

        // Script in startup
        if ((name.EndsWith(".ps1") || name.EndsWith(".vbs") || name.EndsWith(".bat")) &&
            (path.Contains("startup") || path.Contains("start menu")))
            rules.Add(new HeuristicRule("script_in_startup", 35));

        // High entropy in suspicious dir
        if (entropy.HasValue && entropy > 7.0 && IsInSuspiciousPath(path))
            rules.Add(new HeuristicRule("high_entropy_suspicious_path", 20));

        // Misleading name (e.g. "document.pdf.exe")
        if (name.Contains(".pdf.") || name.Contains(".doc.") || name.Contains(".jpg."))
            rules.Add(new HeuristicRule("misleading_extension", 25));

        // PE with suspicious import patterns (VirtualAlloc, CreateRemoteThread, etc.)
        if (hasSuspiciousPeImports)
            rules.Add(new HeuristicRule("suspicious_pe_imports", 25));

        var total = Math.Min(rules.Sum(r => r.Score), 100);
        return (total, rules);
    }

    public static int ScoreFile(string? filePath, string? fileName, long? fileSize, bool isSigned, double? entropy, bool hasSuspiciousPeImports = false)
    {
        var (score, _) = ScoreFileWithDetails(filePath, fileName, fileSize, isSigned, entropy, hasSuspiciousPeImports);
        return score;
    }

    private static bool IsExecutableExtension(string name)
    {
        var ext = Path.GetExtension(name);
        return ext is ".exe" or ".dll" or ".scr" or ".bat" or ".cmd" or ".ps1" or ".vbs" or ".js" or ".msi";
    }

    private static bool IsInSuspiciousPath(string path)
    {
        foreach (var d in SuspiciousDirs)
        {
            if (path.Contains(d)) return true;
        }
        return false;
    }

    public static double? EstimateEntropy(string filePath)
    {
        try
        {
            var bytes = new byte[8192];
            using var fs = File.OpenRead(filePath);
            var read = fs.Read(bytes, 0, bytes.Length);
            if (read < 256) return null;

            var freq = new int[256];
            for (var i = 0; i < read; i++) freq[bytes[i]]++;

            double entropy = 0;
            for (var i = 0; i < 256; i++)
            {
                if (freq[i] == 0) continue;
                var p = (double)freq[i] / read;
                entropy -= p * Math.Log2(p);
            }
            return entropy;
        }
        catch
        {
            return null;
        }
    }
}
