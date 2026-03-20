using System.Net.Http.Json;
using System.Text.Json;
using EDR.Agent.Core.Antivirus.Models;

namespace EDR.Agent.Core.Antivirus;

/// <summary>
/// Polls backend for pending AV scan tasks.
/// </summary>
public class AvTaskPollingService
{
    private readonly HttpClient _client;
    private readonly string _baseUrl;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public AvTaskPollingService(string baseUrl, string agentKey)
    {
        _baseUrl = baseUrl.TrimEnd('/');
        _client = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
        _client.DefaultRequestHeaders.Add("User-Agent", "EDR-Agent/1.0");
        _client.DefaultRequestHeaders.Add("X-Agent-Key", agentKey);
    }

    public async Task<List<AvScanTask>> GetPendingAsync(CancellationToken ct = default)
    {
        var res = await _client.GetAsync($"{_baseUrl}/api/agent/av/tasks/pending", ct);
        if (!res.IsSuccessStatusCode) return [];
        var data = await res.Content.ReadFromJsonAsync<AvTasksResponse>(JsonOptions, ct);
        return (data?.Tasks ?? []).Select(t => new AvScanTask { Id = t.Id, TaskType = t.TaskType ?? "full_scan", TargetPath = t.TargetPath }).ToList();
    }

    public async Task SubmitResultAsync(long taskId, int filesScanned, int detectionsFound, bool success = true, string? errorMessage = null, CancellationToken ct = default)
    {
        var body = new { files_scanned = filesScanned, detections_found = detectionsFound, success, error_message = errorMessage };
        var res = await _client.PostAsJsonAsync($"{_baseUrl}/api/agent/av/tasks/{taskId}/result", body, JsonOptions, ct);
        res.EnsureSuccessStatusCode();
    }

    private class AvTasksResponse
    {
        public List<AvTaskDto>? Tasks { get; set; }
    }

    private class AvTaskDto
    {
        public long Id { get; set; }
        public string? TaskType { get; set; }
        public string? TargetPath { get; set; }
    }
}
