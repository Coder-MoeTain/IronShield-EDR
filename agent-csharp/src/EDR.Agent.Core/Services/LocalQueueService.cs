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
    private readonly ConcurrentQueue<QueuedItem> _memoryQueue = new();
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false,
    };

    public record QueuedItem(TelemetryEvent Event, string? FilePath);

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
        var fp = TryPersistToFile(evt);
        _memoryQueue.Enqueue(new QueuedItem(evt, fp));
    }

    public void EnqueueRange(IEnumerable<TelemetryEvent> events)
    {
        foreach (var evt in events)
            _memoryQueue.Enqueue(new QueuedItem(evt, null));
    }

    /// <summary>
    /// Dequeue up to maxCount events.
    /// Persisted items are only deleted after successful server ack via AckBatch().
    /// </summary>
    public List<QueuedItem> DequeueBatch(int maxCount)
    {
        var batch = new List<QueuedItem>();
        while (batch.Count < maxCount && _memoryQueue.TryDequeue(out var item))
            batch.Add(item);
        return batch;
    }

    /// <summary>
    /// Peek at next batch without removing.
    /// </summary>
    public List<QueuedItem> PeekBatch(int maxCount)
    {
        var batch = new List<QueuedItem>();
        var items = _memoryQueue.ToArray();
        foreach (var it in items.Take(maxCount))
            batch.Add(it);
        return batch;
    }

    private string? TryPersistToFile(TelemetryEvent evt)
    {
        try
        {
            var file = Path.Combine(_queueDir, $"evt_{DateTime.UtcNow:yyyyMMddHHmmss}_{Guid.NewGuid():N}.json");
            var json = JsonSerializer.Serialize(evt, JsonOptions);
            File.WriteAllText(file, json);
            return file;
        }
        catch { return null; /* best effort */ }
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
                        _memoryQueue.Enqueue(new QueuedItem(evt, file));
                        loaded++;
                    }
                }
                catch { /* skip corrupt */ }
            }
        }
        catch { }
        return loaded;
    }

    /// <summary>
    /// Delete persisted files for a batch after the server confirms receipt.
    /// </summary>
    public void AckBatch(IEnumerable<QueuedItem> batch)
    {
        foreach (var item in batch)
        {
            var fp = item.FilePath;
            if (string.IsNullOrWhiteSpace(fp)) continue;
            try { File.Delete(fp); } catch { /* best effort */ }
        }
    }
}
