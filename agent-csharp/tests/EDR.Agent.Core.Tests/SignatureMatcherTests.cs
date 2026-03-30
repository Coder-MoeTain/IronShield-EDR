using EDR.Agent.Core.Antivirus;
using EDR.Agent.Core.Antivirus.Models;
using Xunit;

namespace EDR.Agent.Core.Tests;

public class SignatureMatcherTests
{
    [Fact]
    public void MatchHash_IsCaseInsensitive()
    {
        var sig = new AvSignature
        {
            SignatureUuid = "u1",
            Name = "Test",
            SignatureType = "hash",
            HashValue = "AAA",
        };
        var m = new SignatureMatcher([sig]);
        Assert.NotNull(m.MatchHash("aaa"));
        Assert.Equal("Test", m.MatchHash("aaa")!.Name);
    }

    [Fact]
    public void MatchPath_UsesRegexWhenValid()
    {
        var sig = new AvSignature
        {
            SignatureUuid = "u2",
            Name = "PathRule",
            SignatureType = "path",
            Pattern = @"evil\.exe$",
        };
        var m = new SignatureMatcher([sig]);
        Assert.NotNull(m.MatchPath(@"C:\temp\evil.exe", "evil.exe"));
        Assert.Null(m.MatchPath(@"C:\temp\good.exe", "good.exe"));
    }

    [Fact]
    public void MatchPath_FallsBackToSubstringOnInvalidRegex()
    {
        var sig = new AvSignature
        {
            SignatureUuid = "u3",
            Name = "BadRegex",
            SignatureType = "filename",
            Pattern = "[invalid(regex",
        };
        var m = new SignatureMatcher([sig]);
        Assert.NotNull(m.MatchPath(@"C:\foo\[invalid(regex\bar.txt", "bar.txt"));
    }

    [Fact]
    public void MatchBinaryPattern_FindsHexSequenceInFile()
    {
        var tmp = Path.Combine(Path.GetTempPath(), $"sigmatch_{Guid.NewGuid():N}.bin");
        try
        {
            var payload = new byte[512];
            Array.Fill(payload, (byte)0x00);
            payload[100] = 0xDE;
            payload[101] = 0xAD;
            payload[102] = 0xBE;
            payload[103] = 0xEF;
            File.WriteAllBytes(tmp, payload);

            var sig = new AvSignature
            {
                SignatureUuid = "u4",
                Name = "BinPat",
                SignatureType = "pattern",
                Pattern = "DE AD BE EF",
            };
            var m = new SignatureMatcher([sig]);
            Assert.NotNull(m.MatchBinaryPattern(tmp));
            Assert.Equal("BinPat", m.MatchBinaryPattern(tmp)!.Name);
        }
        finally
        {
            try { File.Delete(tmp); } catch { /* ignore */ }
        }
    }

    [Fact]
    public void LoadSignatures_ReplacesPrevious()
    {
        var m = new SignatureMatcher([
            new AvSignature { SignatureType = "hash", HashValue = "aa", Name = "A", SignatureUuid = "1" },
        ]);
        Assert.NotNull(m.MatchHash("aa"));
        m.LoadSignatures([
            new AvSignature { SignatureType = "hash", HashValue = "bb", Name = "B", SignatureUuid = "2" },
        ]);
        Assert.Null(m.MatchHash("aa"));
        Assert.NotNull(m.MatchHash("bb"));
    }
}
