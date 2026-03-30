using System.Collections.Concurrent;
using System.Runtime.InteropServices;
using EDR.Agent.Core.Antivirus.Models;

namespace EDR.Agent.Core.Antivirus;

/// <summary>
/// Scans files for malware indicators - signature, hash, heuristic.
/// Defensive only.
/// </summary>
public class FileScanService
{
    /// <summary>Max depth for directory enumeration (policy-driven depth is a later roadmap item).</summary>
    private const int MaxDirectoryRecursionDepth = 4;

    private static readonly string[] ScanExtensions = [
        ".exe", ".dll", ".scr", ".bat", ".cmd", ".ps1", ".vbs", ".js", ".msi", ".com"
    ];

    private readonly SignatureMatcher _signatureMatcher;
    private readonly AvPolicy _policy;
    private readonly ExclusionEvaluator? _exclusionEvaluator;

    public FileScanService(SignatureMatcher matcher, AvPolicy policy, ExclusionEvaluator? exclusionEvaluator = null)
    {
        _signatureMatcher = matcher;
        _policy = policy;
        _exclusionEvaluator = exclusionEvaluator ?? new ExclusionEvaluator(policy);
    }

    public async Task<List<ScanResult>> ScanDirectoryAsync(string directory, CancellationToken ct = default)
    {
        var results = new ConcurrentBag<ScanResult>();
        var excludePaths = _policy.ExcludePaths ?? [];
        var excludeExts = new HashSet<string>((_policy.ExcludeExtensions ?? []).Select(e => e.ToLowerInvariant()));
        var excludeHashes = new HashSet<string>((_policy.ExcludeHashes ?? []).Select(h => h.ToLowerInvariant().Trim()));
        var maxBytes = Math.Max(1, _policy.MaxFileSizeMb) * 1024L * 1024L;

        if (!Directory.Exists(directory)) return [];

        await Parallel.ForEachAsync(
            EnumerateFiles(directory, excludePaths),
            new ParallelOptions { MaxDegreeOfParallelism = 4, CancellationToken = ct },
            async (filePath, token) =>
            {
                var result = await ScanFileAsync(filePath, excludeExts, excludeHashes, maxBytes, token);
                if (result != null) results.Add(result);
            });

        return results.ToList();
    }

    private static IEnumerable<string> EnumerateFiles(string root, List<string> excludePaths)
    {
        List<string> files;
        try
        {
            files = Directory.EnumerateFiles(root, "*", new EnumerationOptions { RecurseSubdirectories = true, MaxRecursionDepth = MaxDirectoryRecursionDepth }).ToList();
        }
        catch
        {
            return [];
        }
        return files.Where(file => !excludePaths.Any(p => file.Contains(p.Replace("*", ""), StringComparison.OrdinalIgnoreCase)));
    }

    public async Task<ScanResult?> ScanFileAsync(string filePath, HashSet<string>? excludeExts = null, HashSet<string>? excludeHashes = null, long? maxSize = null, CancellationToken ct = default)
    {
        if (!File.Exists(filePath)) return null;
        excludeExts ??= [];
        excludeHashes ??= [];
        maxSize ??= (long)_policy.MaxFileSizeMb * 1024 * 1024;

        var ext = Path.GetExtension(filePath).ToLowerInvariant();
        if (excludeExts.Contains(ext)) return null;
        if (!ScanExtensions.Contains(ext) && ext is not ".ps1" and not ".vbs" and not ".js") return null;

        var fi = new FileInfo(filePath);
        if (fi.Length > maxSize || fi.Length == 0) return null;

        var sha256 = await FileHashService.ComputeSha256Async(filePath, ct);
        var isSigned = CheckSigner(filePath);
        if (_exclusionEvaluator.IsExcluded(filePath, fi.Name, sha256, isSigned ? "signed" : null)) return null;
        if (sha256 != null && excludeHashes.Contains(sha256)) return null;

        var sig = _signatureMatcher.MatchHash(sha256);
        if (sig != null)
        {
            var raw = new Dictionary<string, object?> { ["signature_uuid"] = sig.SignatureUuid, ["match_type"] = "hash" };
            var pe = PeMetadataReader.TryRead(filePath);
            if (pe != null) { raw["pe_machine"] = pe.MachineType; raw["pe_sections"] = pe.SectionNames; }
            return ApplyRansomwareClassification(new ScanResult
            {
                FilePath = filePath,
                FileName = fi.Name,
                Sha256 = sha256,
                FileSize = fi.Length,
                DetectionName = sig.Name,
                DetectionType = "signature",
                Family = sig.Family,
                Severity = sig.Severity ?? "high",
                Score = 95,
                Disposition = "malicious",
                RawDetails = raw,
            }, null, null, 0);
        }

        sig = _signatureMatcher.MatchPath(filePath, fi.Name);
        if (sig != null)
        {
            var raw = new Dictionary<string, object?> { ["pattern_matched"] = sig.Pattern, ["signature_uuid"] = sig.SignatureUuid, ["match_type"] = "path" };
            var pe = PeMetadataReader.TryRead(filePath);
            if (pe != null) { raw["pe_machine"] = pe.MachineType; raw["pe_sections"] = pe.SectionNames; }
            return ApplyRansomwareClassification(new ScanResult
            {
                FilePath = filePath,
                FileName = fi.Name,
                Sha256 = sha256,
                FileSize = fi.Length,
                DetectionName = sig.Name,
                DetectionType = "signature",
                Family = sig.Family,
                Severity = sig.Severity ?? "medium",
                Score = 85,
                Disposition = "malicious",
                RawDetails = raw,
            }, null, null, 0);
        }

        sig = _signatureMatcher.MatchBinaryPattern(filePath);
        if (sig != null)
        {
            var raw = new Dictionary<string, object?> { ["pattern_matched"] = sig.Pattern, ["signature_uuid"] = sig.SignatureUuid, ["match_type"] = "binary" };
            var pe = PeMetadataReader.TryRead(filePath);
            if (pe != null) { raw["pe_machine"] = pe.MachineType; raw["pe_sections"] = pe.SectionNames; }
            return ApplyRansomwareClassification(new ScanResult
            {
                FilePath = filePath,
                FileName = fi.Name,
                Sha256 = sha256,
                FileSize = fi.Length,
                DetectionName = sig.Name,
                DetectionType = "signature",
                Family = sig.Family,
                Severity = sig.Severity ?? "high",
                Score = 90,
                Disposition = "malicious",
                RawDetails = raw,
            }, null, null, 0);
        }

        var entropy = HeuristicEngine.EstimateEntropy(filePath);
        var peInfo = PeMetadataReader.TryRead(filePath);
        var (score, rules) = HeuristicEngine.ScoreFileWithDetails(filePath, fi.Name, fi.Length, isSigned, entropy, peInfo?.HasSuspiciousImports ?? false);

        if (score >= _policy.AlertThreshold)
        {
            var raw = new Dictionary<string, object?>
            {
                ["entropy"] = entropy,
                ["heuristic_score"] = score,
                ["heuristic_rules"] = rules.Select(r => new Dictionary<string, object?> { ["name"] = r.Name, ["score"] = r.Score }).ToList(),
                ["signer_status"] = isSigned ? "signed" : "unsigned",
            };
            if (peInfo != null)
            {
                raw["pe_machine"] = peInfo.MachineType;
                raw["pe_sections"] = peInfo.SectionNames;
                raw["pe_timestamp"] = peInfo.Timestamp;
                if (peInfo.ImportedDlls.Count > 0) raw["pe_imports"] = peInfo.ImportedDlls;
                raw["pe_has_suspicious_imports"] = peInfo.HasSuspiciousImports;
            }
            return ApplyRansomwareClassification(new ScanResult
            {
                FilePath = filePath,
                FileName = fi.Name,
                Sha256 = sha256,
                FileSize = fi.Length,
                DetectionName = "Heuristic.Suspicious",
                DetectionType = "heuristic",
                Severity = score >= _policy.QuarantineThreshold ? "high" : "medium",
                Score = score,
                Disposition = "suspicious",
                SignerStatus = isSigned ? "signed" : "unsigned",
                RawDetails = raw,
            }, entropy, rules, score);
        }

        return null;
    }

    private ScanResult ApplyRansomwareClassification(
        ScanResult r,
        double? entropy,
        IReadOnlyList<HeuristicEngine.HeuristicRule>? rules,
        int heuristicScore)
    {
        if (_policy.RansomwareProtectionEnabled == false) return r;

        if (r.DetectionType == "signature")
        {
            if (RansomwarePatterns.IsKnownRansomwareSignature(r.Family, r.DetectionName))
            {
                r.DetectionType = "ransomware";
                r.RawDetails ??= new Dictionary<string, object?>();
                r.RawDetails["ransomware_kind"] = "known_signature";
                if (!string.Equals(r.Severity, "critical", StringComparison.OrdinalIgnoreCase))
                    r.Severity = "high";
            }
        }
        else if (r.DetectionType == "heuristic" && rules != null && entropy.HasValue
                 && RansomwarePatterns.LooksLikeRansomwareBehavior(heuristicScore, rules, entropy))
        {
            r.DetectionType = "ransomware";
            r.DetectionName = "Ransomware.Behavioral";
            r.Severity = "high";
            r.RawDetails ??= new Dictionary<string, object?>();
            r.RawDetails["ransomware_kind"] = "behavioral";
        }

        return r;
    }

    private static bool CheckSigner(string path)
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows)) return false;
        try
        {
            using var fs = File.OpenRead(path);
            var buf = new byte[Math.Min(4096, fs.Length)];
            fs.Read(buf, 0, buf.Length);
            return ContainsAuthenticodeMarker(buf);
        }
        catch
        {
            return false;
        }
    }

    private static bool ContainsAuthenticodeMarker(byte[] buf)
    {
        const int peOffset = 0x3C;
        if (buf.Length < peOffset + 4) return false;
        var pe = BitConverter.ToInt32(buf, peOffset);
        if (pe < 0 || pe + 24 >= buf.Length) return false;
        if (buf[pe] != 'P' || buf[pe + 1] != 'E') return false;
        const int certTableOffsetInOptHeader = 128;
        var certDirFileOffset = pe + 24 + certTableOffsetInOptHeader + 4;
        if (certDirFileOffset + 4 >= buf.Length) return false;
        var certSize = BitConverter.ToInt32(buf, certDirFileOffset);
        return certSize > 0;
    }
}
