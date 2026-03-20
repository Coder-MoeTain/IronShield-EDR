using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using EDR.Agent.Core.Models;

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
        var res = await _client.GetAsync($"{_baseUrl}/api/agent/actions/pending", ct);
        if (!res.IsSuccessStatusCode) return new List<ResponseAction>();
        var data = await res.Content.ReadFromJsonAsync<PendingActionsResponse>(JsonOptions, ct);
        return data?.Actions ?? new List<ResponseAction>();
    }

    public async Task SubmitResultAsync(long actionId, bool success, string? message = null, object? result = null, CancellationToken ct = default)
    {
        var body = new { success, message, result };
        var res = await _client.PostAsJsonAsync($"{_baseUrl}/api/agent/actions/{actionId}/result", body, JsonOptions, ct);
        res.EnsureSuccessStatusCode();
    }

    private class PendingActionsResponse
    {
        [JsonPropertyName("actions")]
        public List<ResponseAction> Actions { get; set; } = new();
    }
}
