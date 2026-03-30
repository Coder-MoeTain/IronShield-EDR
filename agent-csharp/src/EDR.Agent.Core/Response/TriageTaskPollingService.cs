using System.Net.Http.Json;
using System.Text.Json;
using EDR.Agent.Core.Models;
using EDR.Agent.Core.Transport;

namespace EDR.Agent.Core.Response;

/// <summary>
/// Polls server for pending triage tasks and submits results.
/// Phase 3 - separate from response_actions flow.
/// </summary>
public class TriageTaskPollingService
{
    private readonly HttpClient _client;
    private readonly string _baseUrl;
    private readonly string _agentKey;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public TriageTaskPollingService(string baseUrl, string agentKey)
    {
        _baseUrl = baseUrl.TrimEnd('/');
        _agentKey = agentKey;
        _client = new HttpClient();
        _client.DefaultRequestHeaders.Add("X-Agent-Key", agentKey);
    }

    public async Task<List<TriageTask>> GetPendingAsync(CancellationToken ct = default)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, $"{_baseUrl}/api/agent/tasks/pending");
        AgentRequestSigner.SignRequest(req, _agentKey, null);
        var res = await _client.SendAsync(req, ct);
        if (!res.IsSuccessStatusCode) return new List<TriageTask>();
        var data = await res.Content.ReadFromJsonAsync<TriageTasksResponse>(JsonOptions, ct);
        return data?.Tasks ?? new List<TriageTask>();
    }

    public async Task SubmitResultAsync(long requestId, object result, bool success = true, string? message = null, CancellationToken ct = default)
    {
        var body = new { request_id = requestId, result, success, message };
        var json = JsonSerializer.Serialize(body, JsonOptions);
        using var req = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl}/api/agent/triage/result");
        req.Content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");
        AgentRequestSigner.SignRequest(req, _agentKey, json);
        var res = await _client.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();
    }

    private class TriageTasksResponse
    {
        public List<TriageTask> Tasks { get; set; } = new();
    }
}
