namespace EDR.Agent.Core.Antivirus;

/// <summary>
/// Classifies known ransomware families / names from signatures (defensive string matching only).
/// </summary>
public static class RansomwarePatterns
{
    /// <summary>Heuristic: combined signals typical of staged ransomware payloads.</summary>
    public static bool LooksLikeRansomwareBehavior(int heuristicScore, IReadOnlyList<HeuristicEngine.HeuristicRule> rules, double? entropy)
    {
        if (heuristicScore < 68) return false;
        if (!entropy.HasValue || entropy.Value < 6.8) return false;

        var names = new HashSet<string>(rules.Select(r => r.Name));
        var risky =
            names.Contains("double_extension") ||
            names.Contains("misleading_extension") ||
            names.Contains("unsigned_in_suspicious_path");
        var entropyHit = entropy > 7.1 && names.Contains("high_entropy_suspicious_path");
        return risky && (entropyHit || heuristicScore >= 85);
    }

    /// <summary>Signature metadata suggests known ransomware family/name (admin-defined signatures).</summary>
    public static bool IsKnownRansomwareSignature(string? family, string? detectionName)
    {
        var f = (family ?? "").ToLowerInvariant();
        var n = (detectionName ?? "").ToLowerInvariant();
        if (string.IsNullOrEmpty(f) && string.IsNullOrEmpty(n)) return false;

        foreach (var token in RansomwareTokens)
        {
            if (f.Contains(token, StringComparison.Ordinal) || n.Contains(token, StringComparison.Ordinal))
                return true;
        }

        return false;
    }

    private static readonly string[] RansomwareTokens =
    [
        "ransomware", "ransom", "locker", "cryptolocker", "crypt0", "wannacry", "wanna cry",
        "ryuk", "maze", "revil", "sodinokibi", "lockbit", "blackcat", "alphv", "conti",
        "darkside", "babuk", "cerber", "teslacrypt", "petya", "notpetya", "bad rabbit",
        "gandcrab", "dharma", "phobos", "stop", "djvu", "medusa", "akira", "play ",
    ];
}
