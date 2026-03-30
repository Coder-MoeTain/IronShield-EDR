using EDR.Agent.Core.WebUrl;

namespace EDR.Agent.Core.Tests;

public class WebUrlHostsFileWriterTests
{
    [Fact]
    public void RemoveIronShieldSection_strips_marked_block()
    {
        var input = """
            127.0.0.1 localhost

            # BEGIN IRONSHIELD-WEB-BLOCK
            127.0.0.1 bad.example
            # END IRONSHIELD-WEB-BLOCK
            """;

        var stripped = WebUrlHostsFileWriter.RemoveIronShieldSection(input);
        Assert.DoesNotContain("IRONSHIELD", stripped);
        Assert.DoesNotContain("bad.example", stripped);
        Assert.Contains("localhost", stripped);
    }
}
