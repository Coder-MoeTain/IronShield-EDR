using EDR.Agent.Core.Models;

namespace EDR.Agent.Core.Collectors;

/// <summary>
/// Base class for event collectors.
/// </summary>
public abstract class EventCollectorBase
{
    public abstract string SourceName { get; }

    /// <summary>
    /// Collect events since last call. Returns events to be queued.
    /// </summary>
    public abstract IAsyncEnumerable<TelemetryEvent> CollectAsync(CancellationToken ct = default);

    /// <summary>
    /// Start continuous collection (e.g. event log subscription).
    /// </summary>
    public virtual Task StartAsync(CancellationToken ct) => Task.CompletedTask;

    public virtual void Stop() { }
}
