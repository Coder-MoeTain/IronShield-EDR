using EDR.Agent.Core.Antivirus;
using EDR.Agent.Core.Antivirus.Models;
using EDR.Agent.Core.Collectors;
using EDR.Agent.Core.Models;
using EDR.Agent.Core.Response;
using EDR.Agent.Core.Services;
using EDR.Agent.Core.Transport;
using EDR.Agent.Core.Utils;

namespace EDR.Agent.Service;

/// <summary>
/// Main agent worker - registration, heartbeat, event collection, and upload.
/// </summary>
public class AgentWorker
{
    private readonly ConfigService _configService;
    private readonly AgentConfig _config;
    private readonly SystemInfoService _systemInfo;
    private readonly LocalQueueService _queue;
    private readonly HttpTransport _transport;
    private readonly List<EventCollectorBase> _collectors;
    private CancellationTokenSource? _cts;
    private Task? _heartbeatTask;
    private Task? _uploadTask;
    private Task? _collectTask;
    private const string AgentVersion = "1.0.0";
    private UpdateCheckService? _updateChecker;

    private volatile int _effectiveHeartbeatMinutes;
    private volatile int _effectiveBatchIntervalSeconds;
    private volatile int _effectiveBatchSize;
    private volatile int _effectivePollSeconds;

    public AgentWorker(ConfigService configService, object? _)
    {
        _configService = configService;
        _config = configService.Load();
        _systemInfo = new SystemInfoService();
        _queue = new LocalQueueService(_config.LocalQueuePath);
        _transport = new HttpTransport(_config.ServerUrl, _config.AgentKey);
        _collectors = new List<EventCollectorBase>
        {
            new ProcessCollector(),
            new WindowsEventCollector(),
            new SysmonCollector(),
            new NetworkCollector(),
        };
    }

    public AgentWorker(AgentConfig config, object? _)
    {
        _configService = new ConfigService();
        _configService.Config = config;
        _config = config;
        _systemInfo = new SystemInfoService();
        _queue = new LocalQueueService(_config.LocalQueuePath);
        _transport = new HttpTransport(_config.ServerUrl, _config.AgentKey);
        _collectors = new List<EventCollectorBase>
        {
            new ProcessCollector(),
            new WindowsEventCollector(),
            new SysmonCollector(),
            new NetworkCollector(),
        };
    }

    public async Task RunAsync(CancellationToken ct = default)
    {
        _cts = CancellationTokenSource.CreateLinkedTokenSource(ct);

        // Load persisted queue
        var loaded = _queue.LoadFromDisk();
        if (loaded > 0)
            Console.WriteLine($"[Agent] Loaded {loaded} events from queue");

        // Ensure registered
        if (string.IsNullOrEmpty(_config.AgentKey))
        {
            await RegisterAsync(_cts.Token);
        }
        else
        {
            _transport.SetAgentKey(_config.AgentKey);
        }

        _updateChecker = new UpdateCheckService(_config.ServerUrl, AgentVersion);
        _ = SendImmediateHeartbeatAndNetworkAsync(_cts.Token);
        _heartbeatTask = HeartbeatLoopAsync(_cts.Token);
        _uploadTask = UploadLoopAsync(_cts.Token);
        _collectTask = CollectLoopAsync(_cts.Token);
        var commandTask = CommandPollLoopAsync(_cts.Token);
        var triageTask = TriageTaskPollLoopAsync(_cts.Token);
        var updateTask = UpdateCheckLoopAsync(_cts.Token);
        var avTask = AvTaskPollLoopAsync(_cts.Token);

        await Task.WhenAll(_heartbeatTask, _uploadTask, _collectTask, commandTask, triageTask, updateTask, avTask);
    }

    private async Task RegisterAsync(CancellationToken ct)
    {
        var payload = _systemInfo.GetRegistrationPayload(AgentVersion);
        var token = _config.RegistrationToken;
        if (string.IsNullOrEmpty(token))
        {
            Console.WriteLine("[Agent] No registration token. Set in config or EDR_REGISTRATION_TOKEN.");
            return;
        }

        try
        {
            var result = await _transport.RegisterAsync(payload, token, ct);
            _configService.SaveAgentKey(result.AgentKey);
            _transport.SetAgentKey(result.AgentKey);
            Console.WriteLine($"[Agent] Registered. EndpointId={result.EndpointId}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Agent] Registration failed: {ex.Message}");
        }
    }

    private async Task SendImmediateHeartbeatAndNetworkAsync(CancellationToken ct)
    {
        if (string.IsNullOrEmpty(_config.AgentKey)) return;
        try
        {
            await Task.Delay(2000, ct);
            var payload = _systemInfo.GetHeartbeatPayload(AgentVersion);
            await _transport.HeartbeatAsync(payload, ct);
            if (payload.Connections is { Count: > 0 } conns)
            {
                try { await _transport.PushNetworkConnectionsAsync(conns.Select(c => new { local_address = c.LocalAddress, local_port = c.LocalPort, remote_address = c.RemoteAddress, remote_port = c.RemotePort, protocol = c.Protocol, state = c.State }), ct); }
                catch { }
            }
        }
        catch { }
    }

    private async Task HeartbeatLoopAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                if (!string.IsNullOrEmpty(_config.AgentKey))
                {
                    var payload = _systemInfo.GetHeartbeatPayload(AgentVersion);
                    await _transport.HeartbeatAsync(payload, ct);
                    if (payload.Connections is { Count: > 0 } conns)
                    {
                        try
                        {
                            await _transport.PushNetworkConnectionsAsync(conns.Select(c => new
                            {
                                local_address = c.LocalAddress,
                                local_port = c.LocalPort,
                                remote_address = c.RemoteAddress,
                                remote_port = c.RemotePort,
                                protocol = c.Protocol,
                                state = c.State,
                            }), ct);
                        }
                        catch { /* non-fatal */ }
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Agent] Heartbeat failed: {ex.Message}");
                if (ex.Message.Contains("Unknown agent key", StringComparison.OrdinalIgnoreCase))
                {
                    Console.WriteLine("[Agent] Endpoint deleted on server. Clearing key and re-registering...");
                    _configService.ClearAgentKey();
                    _config.AgentKey = null;
                    await RegisterAsync(ct);
                    if (!string.IsNullOrEmpty(_config.AgentKey))
                        _transport.SetAgentKey(_config.AgentKey);
                }
            }

            var hbInterval = _effectiveHeartbeatMinutes > 0 ? _effectiveHeartbeatMinutes : _config.HeartbeatIntervalMinutes;
            await Task.Delay(TimeSpan.FromMinutes(hbInterval), ct);
        }
    }

    private async Task UploadLoopAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            var batchInterval = _effectiveBatchIntervalSeconds > 0 ? _effectiveBatchIntervalSeconds : _config.EventBatchIntervalSeconds;
            await Task.Delay(TimeSpan.FromSeconds(batchInterval), ct);
            if (string.IsNullOrEmpty(_config.AgentKey)) continue;

            var batchSize = _effectiveBatchSize > 0 ? _effectiveBatchSize : _config.MaxEventsPerBatch;
            var batch = _queue.DequeueBatch(batchSize);
            if (batch.Count == 0) continue;

            var apiObjects = batch.Select(EventSerializer.ToApiObject).ToList();
            var retries = _config.MaxRetries;
            while (retries > 0)
            {
                try
                {
                    await _transport.SendEventsBatchAsync(apiObjects, ct);
                    break;
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[Agent] Upload failed ({retries} retries): {ex.Message}");
                    retries--;
                    _queue.EnqueueRange(batch);
                    await Task.Delay(TimeSpan.FromSeconds(5), ct);
                }
            }
        }
    }

    private async Task CollectLoopAsync(CancellationToken ct)
    {
        var interval = TimeSpan.FromSeconds(_config.EventBatchIntervalSeconds);
        while (!ct.IsCancellationRequested)
        {
            foreach (var collector in _collectors)
            {
                try
                {
                    await foreach (var evt in collector.CollectAsync(ct))
                    {
                        _queue.Enqueue(evt);
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[Agent] Collector {collector.SourceName} error: {ex.Message}");
                }
            }

            await Task.Delay(interval, ct);
        }
    }

    private async Task CommandPollLoopAsync(CancellationToken ct)
    {
        if (string.IsNullOrEmpty(_config.AgentKey)) return;

        var poller = new CommandPollingService(_config.ServerUrl, _config.AgentKey);
        var processExecutor = new ProcessResponseExecutor();
        var triageCollector = new TriageCollector();
        var pollInterval = _effectivePollSeconds > 0 ? _effectivePollSeconds : _config.CommandPollIntervalSeconds;

        while (!ct.IsCancellationRequested)
        {
            try
            {
                var actions = await poller.GetPendingAsync(ct);
                foreach (var action in actions)
                {
                    try
                    {
                        if (action.ActionType == "kill_process")
                        {
                            var pid = action.ProcessId;
                            if (pid == null || pid == 0)
                            {
                                await poller.SubmitResultAsync(action.Id, false, "No process_id in action parameters", null, ct);
                            }
                            else
                            {
                                var (ok, msg) = await processExecutor.ExecuteKillProcessAsync(pid.Value, ct);
                                await poller.SubmitResultAsync(action.Id, ok, msg, null, ct);
                            }
                        }
                        else if (action.ActionType == "request_heartbeat")
                        {
                            var payload = _systemInfo.GetHeartbeatPayload(AgentVersion);
                            await _transport.HeartbeatAsync(payload, ct);
                            if (payload.Connections is { Count: > 0 } conns)
                            {
                                try { await _transport.PushNetworkConnectionsAsync(conns.Select(c => new { local_address = c.LocalAddress, local_port = c.LocalPort, remote_address = c.RemoteAddress, remote_port = c.RemotePort, protocol = c.Protocol, state = c.State }), ct); }
                                catch { }
                            }
                            await poller.SubmitResultAsync(action.Id, true, "Heartbeat sent", null, ct);
                        }
                        else if (action.ActionType == "collect_triage")
                        {
                            var data = await triageCollector.CollectAsync("full", ct);
                            await poller.SubmitResultAsync(action.Id, true, "Triage collected", data, ct);
                        }
                        else if (action.ActionType == "simulate_isolation" || action.ActionType == "mark_investigating")
                        {
                            await poller.SubmitResultAsync(action.Id, true, "Acknowledged", null, ct);
                        }
                    }
                    catch (Exception ex)
                    {
                        await poller.SubmitResultAsync(action.Id, false, ex.Message, null, ct);
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Agent] Command poll error: {ex.Message}");
            }
            await Task.Delay(TimeSpan.FromSeconds(pollInterval), ct);
        }
    }

    private async Task TriageTaskPollLoopAsync(CancellationToken ct)
    {
        if (string.IsNullOrEmpty(_config.AgentKey)) return;

        var triagePoller = new TriageTaskPollingService(_config.ServerUrl, _config.AgentKey);
        var triageCollector = new TriageCollector();
        var pollInterval = _effectivePollSeconds > 0 ? _effectivePollSeconds : _config.CommandPollIntervalSeconds;

        while (!ct.IsCancellationRequested)
        {
            await Task.Delay(TimeSpan.FromSeconds(pollInterval), ct);
            try
            {
                var policy = await _transport.GetPolicyAsync(ct);
                if (policy != null)
                {
                    _effectiveHeartbeatMinutes = policy.HeartbeatIntervalMinutes;
                    _effectiveBatchIntervalSeconds = policy.TelemetryIntervalSeconds;
                    _effectiveBatchSize = policy.BatchUploadSize;
                    _effectivePollSeconds = policy.PollIntervalSeconds;
                }

                var tasks = await triagePoller.GetPendingAsync(ct);
                foreach (var task in tasks)
                {
                    try
                    {
                        var data = await triageCollector.CollectAsync(task.RequestType, ct);
                        await triagePoller.SubmitResultAsync(task.Id, data, true, "Triage collected", ct);
                    }
                    catch (Exception ex)
                    {
                        await triagePoller.SubmitResultAsync(task.Id, new { error = ex.Message }, false, ex.Message, ct);
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Agent] Triage poll error: {ex.Message}");
            }
        }
    }

    private async Task UpdateCheckLoopAsync(CancellationToken ct)
    {
        if (string.IsNullOrEmpty(_config.AgentKey) || _updateChecker == null) return;

        while (!ct.IsCancellationRequested)
        {
            await Task.Delay(TimeSpan.FromHours(24), ct);
            try
            {
                var update = await _updateChecker.CheckAsync(ct);
                if (update != null)
                {
                    Console.WriteLine($"[Agent] Update available: {update.Version}. Download: {update.DownloadUrl}");
                    // Future: download and apply update
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Agent] Update check error: {ex.Message}");
            }
        }
    }

    private async Task AvTaskPollLoopAsync(CancellationToken ct)
    {
        if (string.IsNullOrEmpty(_config.AgentKey)) return;

        var avPoller = new AvTaskPollingService(_config.ServerUrl, _config.AgentKey);
        var pollInterval = _effectivePollSeconds > 0 ? _effectivePollSeconds : _config.CommandPollIntervalSeconds;

        while (!ct.IsCancellationRequested)
        {
            await Task.Delay(TimeSpan.FromSeconds(pollInterval), ct);
            try
            {
                var policy = await _transport.GetAvPolicyAsync(ct);
                if (policy == null) continue;

                var sigService = new SignatureUpdateService(_transport);
                var signatures = await sigService.LoadOrFetchAsync(ct);
                await _transport.SubmitAvUpdateStatusAsync(
                    signatures.Count > 0 ? "loaded" : "empty",
                    "up_to_date",
                    null,
                    ct);

                var matcher = new SignatureMatcher(signatures);
                var quarantine = new QuarantineService();
                var scanner = new FileScanService(matcher, policy);
                var executor = new ScanTaskExecutor(scanner, quarantine, policy);

                var tasks = await avPoller.GetPendingAsync(ct);
                foreach (var task in tasks)
                {
                    try
                    {
                        var result = await executor.ExecuteAsync(task, ct);
                        var apiResults = result.Results.Select(r => new
                        {
                            r.FilePath,
                            r.FileName,
                            r.Sha256,
                            r.FileSize,
                            r.DetectionName,
                            r.DetectionType,
                            r.Family,
                            r.Severity,
                            r.Score,
                            r.Disposition,
                            r.SignerStatus,
                            raw_details = r.RawDetails,
                        }).ToList();
                        await _transport.SubmitAvScanResultAsync(task.Id, apiResults, ct);

                        foreach (var qr in result.Quarantined)
                        {
                            try
                            {
                                await _transport.SubmitAvQuarantineResultAsync(
                                    qr.OriginalPath,
                                    qr.QuarantinePath,
                                    qr.Sha256,
                                    qr.DetectionName,
                                    ct);
                            }
                            catch { }
                        }

                        await avPoller.SubmitResultAsync(
                            task.Id,
                            result.FilesScanned,
                            result.DetectionsFound,
                            true,
                            null,
                            ct);
                    }
                    catch (Exception ex)
                    {
                        await avPoller.SubmitResultAsync(task.Id, 0, 0, false, ex.Message, ct);
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Agent] AV task poll error: {ex.Message}");
            }
        }
    }
}
