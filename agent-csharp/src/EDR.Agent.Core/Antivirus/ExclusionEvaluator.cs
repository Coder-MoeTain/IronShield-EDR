using EDR.Agent.Core.Antivirus.Models;

namespace EDR.Agent.Core.Antivirus;

/// <summary>
/// Evaluates whether a file or process should be excluded from scanning.
/// Defensive only - used to skip known-safe paths/hashes.
/// </summary>
public class ExclusionEvaluator
{
    private readonly AvPolicy _policy;
    private readonly List<AvExclusion> _exclusions;
    private readonly HashSet<string> _excludeHashes;
    private readonly HashSet<string> _excludeExtensions;
    private readonly List<string> _excludePaths;
    private readonly HashSet<string> _excludeProcessNames;

    public ExclusionEvaluator(AvPolicy policy, List<AvExclusion>? exclusions = null)
    {
        _policy = policy;
        _exclusions = exclusions ?? [];
        _excludeHashes = new HashSet<string>(
            (_policy.ExcludeHashes ?? []).Select(h => h.Trim().ToLowerInvariant()),
            StringComparer.OrdinalIgnoreCase);
        _excludeExtensions = new HashSet<string>(
            (_policy.ExcludeExtensions ?? []).Select(e => e.ToLowerInvariant().TrimStart('.')),
            StringComparer.OrdinalIgnoreCase);
        _excludePaths = (_policy.ExcludePaths ?? []).Select(p => p.Replace('\\', '/').TrimEnd('/')).ToList();
        _excludeProcessNames = new HashSet<string>(
            _exclusions
                .Where(e => e.ExclusionType == "process_name" && !string.IsNullOrEmpty(e.Value))
                .Select(e => e.Value!.Trim().ToLowerInvariant()),
            StringComparer.OrdinalIgnoreCase);

        foreach (var ex in _exclusions.Where(e => e.ExclusionType == "hash" && !string.IsNullOrEmpty(e.Value)))
            _excludeHashes.Add(ex.Value!.Trim().ToLowerInvariant());
        foreach (var ex in _exclusions.Where(e => e.ExclusionType == "extension" && !string.IsNullOrEmpty(e.Value)))
            _excludeExtensions.Add(ex.Value!.TrimStart('.').ToLowerInvariant());
        foreach (var ex in _exclusions.Where(e => e.ExclusionType == "path" && !string.IsNullOrEmpty(e.Value)))
            _excludePaths.Add(ex.Value!.Replace('\\', '/').TrimEnd('/'));
    }

    /// <summary>Returns true if the file should be excluded from scanning.</summary>
    public bool IsExcluded(string? filePath, string? fileName, string? sha256, string? signer)
    {
        if (string.IsNullOrEmpty(filePath)) return false;

        var path = filePath.Replace('\\', '/');
        var name = fileName ?? Path.GetFileName(path);

        if (!string.IsNullOrEmpty(sha256) && _excludeHashes.Contains(sha256)) return true;

        var ext = Path.GetExtension(name).TrimStart('.').ToLowerInvariant();
        if (!string.IsNullOrEmpty(ext) && _excludeExtensions.Contains(ext)) return true;

        foreach (var p in _excludePaths)
        {
            var pattern = p.Replace("*", "");
            if (string.IsNullOrEmpty(pattern)) continue;
            if (path.Contains(pattern, StringComparison.OrdinalIgnoreCase)) return true;
            if (path.StartsWith(p, StringComparison.OrdinalIgnoreCase)) return true;
        }

        foreach (var ex in _exclusions.Where(e => e.ExclusionType == "signer" && !string.IsNullOrEmpty(e.Value)))
        {
            if (!string.IsNullOrEmpty(signer) && signer.Contains(ex.Value!, StringComparison.OrdinalIgnoreCase))
                return true;
        }

        foreach (var ex in _exclusions.Where(e => e.ExclusionType == "path" && !string.IsNullOrEmpty(e.Value)))
        {
            var val = ex.Value!.Replace('\\', '/');
            if (path.Contains(val, StringComparison.OrdinalIgnoreCase)) return true;
        }

        return false;
    }

    /// <summary>Returns true if the process should be excluded from scanning (e.g. its image path).</summary>
    public bool IsProcessExcluded(string? processName)
    {
        if (string.IsNullOrEmpty(processName)) return false;
        return _excludeProcessNames.Contains(processName.Trim().ToLowerInvariant());
    }
}

/// <summary>Exclusion rule from backend or policy.</summary>
public class AvExclusion
{
    public string ExclusionType { get; set; } = ""; // path, hash, process_name, signer, extension, policy_group
    public string? Value { get; set; }
    public DateTime? ExpiresAt { get; set; }
}
