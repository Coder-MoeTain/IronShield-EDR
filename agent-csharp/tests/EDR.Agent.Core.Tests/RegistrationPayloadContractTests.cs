using System.Text.Json;
using Xunit;

namespace EDR.Agent.Core.Tests;

/// <summary>
/// Registration POST body must use snake_case keys expected by Node Zod (tenant_slug), matching HttpTransport JSON options.
/// </summary>
public class RegistrationPayloadContractTests
{
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false,
    };

    [Fact]
    public void Registration_dictionary_serializes_tenant_slug_for_server()
    {
        var dict = new Dictionary<string, object?>
        {
            ["hostname"] = "workstation",
            ["os_version"] = "Win10",
            ["agent_version"] = "1.0.0",
            ["tenant_slug"] = "acme",
        };
        var json = JsonSerializer.Serialize(dict, Options);
        Assert.Contains("\"tenant_slug\":\"acme\"", json);
        Assert.Contains("\"hostname\":\"workstation\"", json);
    }
}
