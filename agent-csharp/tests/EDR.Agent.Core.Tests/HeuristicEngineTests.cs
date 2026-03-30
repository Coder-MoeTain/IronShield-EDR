using System.Runtime.InteropServices;
using EDR.Agent.Core.Antivirus;
using Xunit;

namespace EDR.Agent.Core.Tests;

public class HeuristicEngineTests
{
    [Fact]
    public void ScoreFileWithDetails_OnNonWindows_ReturnsEmptyRules()
    {
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            return;

        var path = @"/tmp/malicious.pdf.exe";
        var (total, rules) = HeuristicEngine.ScoreFileWithDetails(path, "malicious.pdf.exe", 1000, false, null, false);
        Assert.Equal(0, total);
        Assert.Empty(rules);
    }

    [Fact]
    public void ScoreFileWithDetails_DoubleExtension_OnWindows_IncludesRule()
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            return;

        var path = @"C:\Users\Public\Downloads\document.pdf.exe";
        var (total, rules) = HeuristicEngine.ScoreFileWithDetails(path, "document.pdf.exe", 1000, false, null, false);
        Assert.Contains(rules, r => r.Name == "double_extension");
        Assert.True(total >= 40);
    }

    [Fact]
    public void ScoreFileWithDetails_SuspiciousPeImports_AddsScore_OnWindows()
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            return;

        var path = @"C:\Windows\Temp\app.exe";
        var (total, rules) = HeuristicEngine.ScoreFileWithDetails(path, "app.exe", 1000, false, null, hasSuspiciousPeImports: true);
        Assert.Contains(rules, r => r.Name == "suspicious_pe_imports");
        Assert.True(total >= 25);
    }

    [Fact]
    public void EstimateEntropy_LowEntropyRepeatingBytes_ReturnsLowValue()
    {
        var tmp = Path.Combine(Path.GetTempPath(), $"ent_{Guid.NewGuid():N}.dat");
        try
        {
            var buf = new byte[2048];
            Array.Fill(buf, (byte)'A');
            File.WriteAllBytes(tmp, buf);
            var e = HeuristicEngine.EstimateEntropy(tmp);
            Assert.NotNull(e);
            Assert.True(e < 1.0, $"expected low entropy, got {e}");
        }
        finally
        {
            try { File.Delete(tmp); } catch { /* ignore */ }
        }
    }

    [Fact]
    public void EstimateEntropy_ShortFile_ReturnsNull()
    {
        var tmp = Path.Combine(Path.GetTempPath(), $"ent_short_{Guid.NewGuid():N}.dat");
        try
        {
            File.WriteAllBytes(tmp, new byte[128]);
            Assert.Null(HeuristicEngine.EstimateEntropy(tmp));
        }
        finally
        {
            try { File.Delete(tmp); } catch { /* ignore */ }
        }
    }
}
