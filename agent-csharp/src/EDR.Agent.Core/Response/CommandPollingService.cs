using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using EDR.Agent.Core.Models;
using EDR.Agent.Core.Transport;

namespace EDR.Agent.Core.Response;

/// <summary>
/// Polls server for pending response actions and executes them.
/// </summary>
public class CommandPollingService
{
    private readonly HttpClient _client;
    private readonly string _baseUrl;
    private readonly string _agentKey;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public CommandPollingService(string baseUrl, string agentKey)
    {
        _baseUrl = baseUrl.TrimEnd('/');
        _agentKey = agentKey;
        _client = new HttpClient();
        _client.DefaultRequestHeaders.Add("X-Agent-Key", agentKey);
    }

    public async Task<List<ResponseAction>> GetPendingAsync(CancellationToken ct = default)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, $"{_baseUrl}/api/agent/actions/pending");
        AgentRequestSigner.SignRequest(req, _agentKey, null);
        var res = await _client.SendAsync(req, ct);
        if (!res.IsSuccessStatusCode) return new List<ResponseAction>();
        var data = await res.Content.ReadFromJsonAsync<PendingActionsResponse>(JsonOptions, ct);
        return data?.Actions ?? new List<ResponseAction>();
    }

    public async Task SubmitResultAsync(long actionId, bool success, string? message = null, object? result = null, CancellationToken ct = default)
    {
        var body = new { success, message, result };
        var json = JsonSerializer.Serialize(body, JsonOptions);
        using var req = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl}/api/agent/actions/{actionId}/result");
        req.Content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");
        AgentRequestSigner.SignRequest(req, _agentKey, json);
        var res = await _client.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();
    }

    private class PendingActionsResponse
    {
        [JsonPropertyName("actions")]
        public List<ResponseAction> Actions { get; set; } = new();
    }
}
