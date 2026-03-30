using System.Text.Json;
using EDR.Agent.Core.Models;
using Xunit;

namespace EDR.Agent.Core.Tests;

/// <summary>
/// Contract tests: heartbeat JSON must stay compatible with server HeartbeatService expectations.
/// </summary>
public class HeartbeatPayloadContractTests
{
    /// <summary>Matches <see cref="EDR.Agent.Core.Transport.HttpTransport"/> heartbeat serialization.</summary>
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false,
    };

    [Fact]
    public void HeartbeatPayload_serializes_server_expected_json_keys()
    {
        var payload = new HeartbeatPayload
        {
            Hostname = "test-host",
            AgentVersion = "1.0.0",
            CpuPercent = 12.5m,
            ListeningPorts = new List<ListeningPortPayload>
            {
                new() { LocalAddress = "0.0.0.0", LocalPort = 443, Protocol = "TCP" },
            },
            HiddenCItems = new List<HiddenPathPayload>
            {
                new() { Path = @"C:\hidden.txt", IsDirectory = false },
            },
        };

        var json = JsonSerializer.Serialize(payload, Options);
        Assert.Contains("\"hostname\":\"test-host\"", json);
        Assert.Contains("\"listening_ports\"", json);
        Assert.Contains("\"hidden_c_items\"", json);
        Assert.Contains("\"cpu_percent\":12.5", json);
    }

    [Fact]
    public void HeartbeatPayload_serializes_phase4_sensor_telemetry_keys()
    {
        var payload = new HeartbeatPayload
        {
            QueueDepth = 500,
            ProcessUptimeSeconds = 3600,
            HostIsolationActive = false,
            SensorOperationalStatus = "ok",
        };
        var json = JsonSerializer.Serialize(payload, Options);
        Assert.Contains("\"queue_depth\":500", json);
        Assert.Contains("\"process_uptime_seconds\":3600", json);
        Assert.Contains("\"host_isolation_active\":false", json);
        Assert.Contains("\"sensor_operational_status\":\"ok\"", json);
    }

    [Fact]
    public void HeartbeatPayload_roundtrip_preserves_ports()
    {
        var original = new HeartbeatPayload
        {
            ListeningPorts = new List<ListeningPortPayload>
            {
                new() { LocalAddress = "::", LocalPort = 22, Protocol = "TCP" },
            },
        };
        var json = JsonSerializer.Serialize(original, Options);
        var back = JsonSerializer.Deserialize<HeartbeatPayload>(json, Options);
        Assert.NotNull(back?.ListeningPorts);
        Assert.Single(back.ListeningPorts!);
        Assert.Equal(22, back.ListeningPorts![0].LocalPort);
        Assert.Equal("TCP", back.ListeningPorts[0].Protocol);
    }
}
