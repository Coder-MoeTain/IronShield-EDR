using EDR.Agent.Core.Models;
using EDR.Agent.Core.Security;
using Xunit;

namespace EDR.Agent.Core.Tests;

public class ResponseCommandVerifierTests
{
    [Fact]
    public void Rejects_unsigned_when_required()
    {
        var action = new ResponseAction { Id = 1, ActionType = "kill_process" };
        var ok = ResponseCommandVerifier.TryVerify(action, 10, "test-key", requireSigned: true, out var err);
        Assert.False(ok);
        Assert.Equal("unsigned_command_rejected", err);
    }

    [Fact]
    public void Allows_unsigned_when_not_required()
    {
        var action = new ResponseAction { Id = 1, ActionType = "kill_process" };
        var ok = ResponseCommandVerifier.TryVerify(action, 10, "test-key", requireSigned: false, out var err);
        Assert.True(ok);
        Assert.Null(err);
    }
}
