using System.Net.NetworkInformation;
using System.Runtime.InteropServices;
using EDR.Agent.Core.Models;

namespace EDR.Agent.Core.Collectors;

/// <summary>
/// Collects active TCP connections as network activity events.
/// </summary>
public class NetworkCollector : EventCollectorBase
{
    public override string SourceName => "NetworkMonitor";

    public override async IAsyncEnumerable<TelemetryEvent> CollectAsync([System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken ct = default)
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            yield break;

        var events = new List<TelemetryEvent>();
        await Task.Run(() =>
        {
            try
            {
                var props = IPGlobalProperties.GetIPGlobalProperties();
                foreach (var conn in props.GetActiveTcpConnections().Take(150))
                {
                    if (conn.State == TcpState.Listen) continue;
                    var localAddr = conn.LocalEndPoint.Address?.ToString();
                    var remoteAddr = conn.RemoteEndPoint.Address?.ToString();
                    if (string.IsNullOrEmpty(remoteAddr) || remoteAddr == "0.0.0.0") continue;

                    events.Add(new TelemetryEvent
                    {
                        EventId = $"net_{localAddr}_{conn.LocalEndPoint.Port}_{remoteAddr}_{conn.RemoteEndPoint.Port}_{DateTime.UtcNow:O}",
                        Hostname = Environment.MachineName,
                        Timestamp = DateTime.UtcNow,
                        EventSource = SourceName,
                        EventType = "network_connection",
                        SourceIp = localAddr,
                        DestinationIp = remoteAddr,
                        DestinationPort = conn.RemoteEndPoint.Port,
                        Protocol = "TCP",
                        RawData = new Dictionary<string, object?>
                        {
                            ["local_address"] = localAddr,
                            ["local_port"] = conn.LocalEndPoint.Port,
                            ["remote_address"] = remoteAddr,
                            ["remote_port"] = conn.RemoteEndPoint.Port,
                            ["state"] = conn.State.ToString(),
                        },
                    });
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[NetworkCollector] {ex.Message}");
            }
        }, ct);

        foreach (var evt in events)
            yield return evt;
    }
}
