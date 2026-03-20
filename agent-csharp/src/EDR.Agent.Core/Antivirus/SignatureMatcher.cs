using System.Collections.Concurrent;
using EDR.Agent.Core.Antivirus.Models;

namespace EDR.Agent.Core.Antivirus;

/// <summary>
/// Matches file hashes and metadata against signature database.
/// </summary>
public class SignatureMatcher
{
    private readonly ConcurrentDictionary<string, AvSignature> _hashSignatures = new();
    private readonly List<AvSignature> _patternSignatures = new();
    private readonly object _lock = new();

    public SignatureMatcher() { }

    public SignatureMatcher(IEnumerable<AvSignature> signatures)
    {
        LoadSignatures(signatures);
    }

    private readonly List<AvSignature> _binaryPatternSignatures = new();
    private const int MaxBinaryScanBytes = 1024 * 1024;

    public void LoadSignatures(IEnumerable<AvSignature> signatures)
    {
        _hashSignatures.Clear();
        _patternSignatures.Clear();
        lock (_lock) _binaryPatternSignatures.Clear();
        foreach (var s in signatures ?? [])
        {
            if (s.SignatureType == "hash" && !string.IsNullOrEmpty(s.HashValue))
            {
                var key = (s.HashValue ?? "").ToLowerInvariant().Trim();
                _hashSignatures[key] = s;
            }
            else if (s.SignatureType == "path" || s.SignatureType == "filename")
            {
                lock (_lock) _patternSignatures.Add(s);
            }
            else if (s.SignatureType == "pattern" && !string.IsNullOrEmpty(s.Pattern))
            {
                lock (_lock) _binaryPatternSignatures.Add(s);
            }
        }
    }

    public AvSignature? MatchHash(string? sha256)
    {
        if (string.IsNullOrEmpty(sha256)) return null;
        var key = sha256.ToLowerInvariant().Trim();
        return _hashSignatures.TryGetValue(key, out var sig) ? sig : null;
    }

    public AvSignature? MatchPath(string? filePath, string? fileName)
    {
        if (_patternSignatures.Count == 0) return null;
        var path = (filePath ?? "").Replace('\\', '/');
        var name = fileName ?? Path.GetFileName(path);

        lock (_lock)
        {
            foreach (var s in _patternSignatures)
            {
                var pattern = s.Pattern ?? "";
                if (string.IsNullOrEmpty(pattern)) continue;
                try
                {
                    var regex = new System.Text.RegularExpressions.Regex(pattern,
                        System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                    if (regex.IsMatch(path) || regex.IsMatch(name))
                        return s;
                }
                catch
                {
                    if (path.Contains(pattern, StringComparison.OrdinalIgnoreCase) ||
                        name.Contains(pattern, StringComparison.OrdinalIgnoreCase))
                        return s;
                }
            }
        }
        return null;
    }

    /// <summary>Match file against binary pattern signatures. Bounded scan (max 1MB) for safety.</summary>
    public AvSignature? MatchBinaryPattern(string filePath)
    {
        if (_binaryPatternSignatures.Count == 0) return null;
        try
        {
            var fi = new FileInfo(filePath);
            if (fi.Length == 0 || fi.Length > MaxBinaryScanBytes) return null;

            var buf = new byte[Math.Min((int)fi.Length, MaxBinaryScanBytes)];
            using var fs = File.OpenRead(filePath);
            var read = fs.Read(buf, 0, buf.Length);

            lock (_lock)
            {
                foreach (var s in _binaryPatternSignatures)
                {
                    var pattern = ParseHexPattern(s.Pattern ?? "");
                    if (pattern.Length == 0) continue;
                    if (ContainsSequence(buf.AsSpan(0, read), pattern))
                        return s;
                }
            }
        }
        catch { }
        return null;
    }

    private static byte[] ParseHexPattern(string hex)
    {
        hex = hex.Replace(" ", "").Replace("-", "").Replace("0x", "");
        if (hex.Length % 2 != 0) return [];
        var bytes = new byte[hex.Length / 2];
        for (var i = 0; i < bytes.Length; i++)
        {
            if (!byte.TryParse(hex.AsSpan(i * 2, 2), System.Globalization.NumberStyles.HexNumber, null, out bytes[i]))
                return [];
        }
        return bytes;
    }

    private static bool ContainsSequence(ReadOnlySpan<byte> haystack, byte[] needle)
    {
        if (needle.Length == 0 || needle.Length > haystack.Length) return false;
        for (var i = 0; i <= haystack.Length - needle.Length; i++)
        {
            if (haystack.Slice(i, needle.Length).SequenceEqual(needle)) return true;
        }
        return false;
    }

    public int SignatureCount => _hashSignatures.Count + _patternSignatures.Count + _binaryPatternSignatures.Count;
}
