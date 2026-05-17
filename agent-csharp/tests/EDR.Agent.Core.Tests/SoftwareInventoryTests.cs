using EDR.Agent.Core.Models;
using EDR.Agent.Core.Software;
using Xunit;

namespace EDR.Agent.Core.Tests;

public class SoftwareInventoryTests
{
    [Fact]
    public void Fingerprint_IsStable()
    {
        var item = new SoftwareInventoryItemDto
        {
            Name = "Google Chrome",
            Vendor = "Google LLC",
            Version = "124.0.0.0",
            InstallLocation = @"C:\Program Files\Google\Chrome\Application",
        };
        var a = SoftwareInventoryCollector.ComputeFingerprint(item, 42);
        var b = SoftwareInventoryCollector.ComputeFingerprint(item, 42);
        Assert.Equal(a, b);
        Assert.Equal(64, a.Length);
    }

    [Fact]
    public async Task BlockEnforcer_SkipsProtectedProcesses()
    {
        var enforcer = new SoftwareBlockEnforcer();
        var policies = new List<SoftwareBlockPolicyDto>
        {
            new() { Id = "1", SoftwareName = "lsass", Action = "block" },
        };
        var result = await enforcer.EvaluateProcessAsync(1234, "lsass", null, policies);
        Assert.Null(result);
    }

    [Fact]
    public void Diff_DetectsAddedAndRemoved()
    {
        var collector = new SoftwareInventoryCollector();
        var prev = new Dictionary<string, SoftwareInventoryItemDto>
        {
            ["old"] = new SoftwareInventoryItemDto { Fingerprint = "old", Name = "Old App" },
        };
        var current = new List<SoftwareInventoryItemDto>
        {
            new() { Fingerprint = "new", Name = "New App", Version = "1.0" },
        };
        var (added, updated, removed) = collector.Diff(current, prev);
        Assert.Single(added);
        Assert.Empty(updated);
        Assert.Single(removed);
    }
}
