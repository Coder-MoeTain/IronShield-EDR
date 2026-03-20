using System.Collections.Concurrent;
using System.Text.Json;
using EDR.Agent.Core.Models;

namespace EDR.Agent.Core.Services;

/// <summary>
/// In-memory and file-based queue for events when server is unavailable.
/// </summary>
public class LocalQueueService
{
    private readonly string _queueDir;
    private readonly ConcurrentQueue<TelemetryEvent> _memoryQueue = new();
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false,
    };

    public LocalQueueService(string queuePath)
    {
        _queueDir = Path.GetFullPath(queuePath);
        try
        {
            Directory.CreateDirectory(_queueDir);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Queue] Failed to create queue dir: {ex.Message}");
        }
    }

    public int Count => _memoryQueue.Count;

    public void Enqueue(TelemetryEvent evt)
    {
        _memoryQueue.Enqueue(evt);
        TryPersistToFile(evt);
    }

    public void EnqueueRange(IEnumerable<TelemetryEvent> events)
    {
        foreach (var evt in events)
            _memoryQueue.Enqueue(evt);
    }

    /// <summary>
    /// Dequeue up to maxCount events. Does not remove from file backup.
    /// </summary>
    public List<TelemetryEvent> DequeueBatch(int maxCount)
    {
        var batch = new List<TelemetryEvent>();
        while (batch.Count < maxCount && _memoryQueue.TryDequeue(out var evt))
            batch.Add(evt);
        return batch;
    }

    /// <summary>
    /// Peek at next batch without removing.
    /// </summary>
    public List<TelemetryEvent> PeekBatch(int maxCount)
    {
        var batch = new List<TelemetryEvent>();
        var items = _memoryQueue.ToArray();
        foreach (var evt in items.Take(maxCount))
            batch.Add(evt);
        return batch;
    }

    private void TryPersistToFile(TelemetryEvent evt)
    {
        try
        {
            var file = Path.Combine(_queueDir, $"evt_{DateTime.UtcNow:yyyyMMddHHmmss}_{Guid.NewGuid():N}.json");
            var json = JsonSerializer.Serialize(evt, JsonOptions);
            File.WriteAllText(file, json);
        }
        catch { /* best effort */ }
    }

    /// <summary>
    /// Load persisted events from queue directory (e.g. on startup).
    /// </summary>
    public int LoadFromDisk()
    {
        var loaded = 0;
        try
        {
            if (!Directory.Exists(_queueDir)) return 0;
            var files = Directory.GetFiles(_queueDir, "evt_*.json").OrderBy(f => f).ToArray();
            foreach (var file in files)
            {
                try
                {
                    var json = File.ReadAllText(file);
                    var evt = JsonSerializer.Deserialize<TelemetryEvent>(json, JsonOptions);
                    if (evt != null)
                    {
                        _memoryQueue.Enqueue(evt);
                        loaded++;
                    }
                    File.Delete(file);
                }
                catch { /* skip corrupt */ }
            }
        }
        catch { }
        return loaded;
    }
}
