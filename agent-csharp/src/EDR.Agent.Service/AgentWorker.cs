using EDR.Agent.Core.Antivirus;
using EDR.Agent.Core.Antivirus.Models;
using EDR.Agent.Core.Collectors;
using EDR.Agent.Core.Models;
using EDR.Agent.Core.Response;
using EDR.Agent.Core.Services;
using EDR.Agent.Core.Transport;
using EDR.Agent.Core.Utils;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.IO;

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

    /// <summary>NGAV state from last AV poll (-1 = not yet loaded).</summary>
    private volatile int _ngavSignatureCount = -1;
    private volatile string? _ngavBundleVersion;
    private bool? _ngavRealtimeEnabled;

    /// <summary>Last EDR (sensor) policy from management server — Phase 8 policy sync telemetry.</summary>
    private int? _lastEdrPolicyId;
    private DateTimeOffset? _lastEdrPolicySyncUtc;

    private int _heartbeatConnectedLogged;

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

        Console.WriteLine($"[Agent] ServerUrl={_config.ServerUrl}");
        Console.WriteLine($"[Agent] RegistrationToken={(string.IsNullOrEmpty(_config.RegistrationToken) ? "(missing — set in config.json or EDR_REGISTRATION_TOKEN)" : "(set)")} AgentKey={(string.IsNullOrEmpty(_config.AgentKey) ? "(none — will register if token is set)" : "(present)")}");

        // Ensure registered
        if (string.IsNullOrEmpty(_config.AgentKey))
        {
            await RegisterAsync(_cts.Token);
        }
        else
        {
            _transport.SetAgentKey(_config.AgentKey);
        }

        if (string.IsNullOrEmpty(_config.AgentKey))
        {
            Console.WriteLine("[Agent] No agent key after registration step — heartbeats and uploads are disabled until registration succeeds (check ServerUrl, backend running, and registration token).");
        }

        _updateChecker = new UpdateCheckService(_config.ServerUrl, AgentVersion);
        _ = SendImmediateHeartbeatAndNetworkAsync(_cts.Token);
        _ = InitialPolicyFetchAsync(_cts.Token);
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
        var payload = _systemInfo.GetRegistrationPayload(AgentVersion, _config.TenantSlug);
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
            EnrichSensorTelemetry(payload);
            await _transport.HeartbeatAsync(payload, ct);
            LogHeartbeatConnectedOnce();
            if (payload.Connections is { Count: > 0 } conns)
            {
                try { await _transport.PushNetworkConnectionsAsync(conns.Select(c => new { local_address = c.LocalAddress, local_port = c.LocalPort, remote_address = c.RemoteAddress, remote_port = c.RemotePort, protocol = c.Protocol, state = c.State }), ct); }
                catch (Exception ex)
                {
                    Console.WriteLine($"[Agent] Initial network push failed: {ex.Message}");
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Agent] Initial heartbeat failed: {ex.Message}");
        }
    }

    private void LogHeartbeatConnectedOnce()
    {
        if (Interlocked.CompareExchange(ref _heartbeatConnectedLogged, 1, 0) != 0) return;
        Console.WriteLine("[Agent] Connected — heartbeat accepted by server. Refresh All hosts in the dashboard if status looks stale.");
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
                    EnrichSensorTelemetry(payload);
                    await _transport.HeartbeatAsync(payload, ct);
                    LogHeartbeatConnectedOnce();
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
        var hostIsolation = new HostIsolationService();
        var triageCollector = new TriageCollector();
        var edrQuarantine = new EdrQuarantineService();
        var networkBlock = new NetworkBlockService();
        var scriptRunner = new ScriptRunner();
        var rtrShell = new RtrShellExecutor();
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
                                Console.WriteLine("[Agent] kill_process: missing process_id in parameters (check server JSON / dashboard payload)");
                                await poller.SubmitResultAsync(action.Id, false, "No process_id in action parameters", null, ct);
                            }
                            else
                            {
                                var (ok, msg) = await processExecutor.ExecuteKillProcessAsync(pid.Value, ct);
                                Console.WriteLine(ok
                                    ? $"[Agent] kill_process PID {pid.Value}: {msg}"
                                    : $"[Agent] kill_process PID {pid.Value} failed: {msg}");
                                await poller.SubmitResultAsync(action.Id, ok, msg, null, ct);
                            }
                        }
                        else if (action.ActionType == "request_heartbeat")
                        {
                            var payload = _systemInfo.GetHeartbeatPayload(AgentVersion);
                            EnrichSensorTelemetry(payload);
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
                        else if (action.ActionType == "isolate_host" || action.ActionType == "simulate_isolation")
                        {
                            var (isoOk, isoMsg) = await hostIsolation.ApplyIsolationAsync(_config.ServerUrl, ct);
                            Console.WriteLine(isoOk
                                ? $"[Agent] isolate_host: {isoMsg}"
                                : $"[Agent] isolate_host failed: {isoMsg}");
                            await poller.SubmitResultAsync(action.Id, isoOk, isoMsg, null, ct);
                        }
                        else if (action.ActionType == "lift_isolation")
                        {
                            var (liftOk, liftMsg) = await hostIsolation.RemoveIsolationAsync(ct);
                            Console.WriteLine(liftOk
                                ? $"[Agent] lift_isolation: {liftMsg}"
                                : $"[Agent] lift_isolation failed: {liftMsg}");
                            await poller.SubmitResultAsync(action.Id, liftOk, liftMsg, null, ct);
                        }
                        else if (action.ActionType == "quarantine_file")
                        {
                            var path = GetActionParam(action, "file_path");
                            var (qOk, qMsg, sha) = await edrQuarantine.QuarantineFileAsync(path ?? "", ct);
                            await poller.SubmitResultAsync(action.Id, qOk, qMsg, sha != null ? new { sha256 = sha } : null, ct);
                        }
                        else if (action.ActionType == "block_ip")
                        {
                            var ip = GetActionParam(action, "ip");
                            var (bOk, bMsg) = await networkBlock.BlockOutboundIpAsync(ip ?? "", ct);
                            await poller.SubmitResultAsync(action.Id, bOk, bMsg, null, ct);
                        }
                        else if (action.ActionType == "run_script")
                        {
                            var scriptPath = GetActionParam(action, "script_path");
                            var (sOk, sMsg) = await scriptRunner.RunAllowlistedScriptAsync(_config, scriptPath, ct);
                            await poller.SubmitResultAsync(action.Id, sOk, sMsg, null, ct);
                        }
                        else if (action.ActionType == "mark_investigating")
                        {
                            await poller.SubmitResultAsync(action.Id, true, "Acknowledged", null, ct);
                        }
                        else if (action.ActionType == "rtr_shell")
                        {
                            var cmd = GetActionParam(action, "command");
                            if (string.IsNullOrWhiteSpace(cmd))
                            {
                                Console.WriteLine("[Agent] rtr_shell: missing \"command\" in parameters (server may have sent parameters as a string; agent updated to parse both).");
                                await poller.SubmitResultAsync(action.Id, false, "Missing command in action parameters", null, ct);
                            }
                            else
                            {
                                var (rtrOk, rtrMsg, rtrRes) = await rtrShell.ExecuteAsync(cmd, ct);
                                await poller.SubmitResultAsync(action.Id, rtrOk, rtrMsg, rtrRes, ct);
                            }
                        }
                        else if (action.ActionType == "delete_schtask")
                        {
                            var taskName = GetActionParam(action, "task_name") ?? GetActionParam(action, "name");
                            var (ok, msg) = await DeleteScheduledTaskAsync(taskName, ct);
                            await poller.SubmitResultAsync(action.Id, ok, msg, null, ct);
                        }
                        else if (action.ActionType == "delete_run_key")
                        {
                            var hive = GetActionParam(action, "hive") ?? "HKCU";
                            var keyPath = GetActionParam(action, "key_path") ?? GetActionParam(action, "keyPath");
                            var valueName = GetActionParam(action, "value_name") ?? GetActionParam(action, "valueName");
                            var (ok, msg) = await DeleteRunValueAsync(hive, keyPath, valueName, ct);
                            await poller.SubmitResultAsync(action.Id, ok, msg, null, ct);
                        }
                        else if (action.ActionType == "delete_path")
                        {
                            var path = GetActionParam(action, "path");
                            var (ok, msg) = await DeletePathAsync(path, ct);
                            await poller.SubmitResultAsync(action.Id, ok, msg, null, ct);
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
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(pollInterval), ct);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    private static string? GetActionParam(ResponseAction action, string key)
    {
        if (!action.Parameters.HasValue) return null;
        try
        {
            var el = action.Parameters.Value;
            // API may send parameters as a JSON string (double-encoded) — same as ProcessId handling.
            if (el.ValueKind == JsonValueKind.String)
            {
                var s = el.GetString();
                if (string.IsNullOrWhiteSpace(s)) return null;
                using var doc = JsonDocument.Parse(s);
                el = doc.RootElement;
            }
            if (el.ValueKind != JsonValueKind.Object) return null;
            if (!el.TryGetProperty(key, out var p)) return null;
            return p.ValueKind == JsonValueKind.String ? p.GetString() : p.ToString();
        }
        catch
        {
            return null;
        }
    }

    private static bool IsSafeRemediationPath(string fullPath)
    {
        try
        {
            var p = Path.GetFullPath(fullPath).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            var allowedRoots = new[]
            {
                @"C:\Users\Public",
                @"C:\Program Files (x86)\Microsoft",
                @"C:\Program Files\Microsoft",
            };
            return allowedRoots.Any(r =>
                p.StartsWith(Path.GetFullPath(r).TrimEnd('\\') + "\\", StringComparison.OrdinalIgnoreCase)
                || string.Equals(p, Path.GetFullPath(r).TrimEnd('\\'), StringComparison.OrdinalIgnoreCase)
            );
        }
        catch
        {
            return false;
        }
    }

    private static Task<(bool Ok, string Message)> DeleteScheduledTaskAsync(string? taskName, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(taskName)) return Task.FromResult((false, "task_name required"));
        var name = taskName.Trim();
        if (name.Length > 128) return Task.FromResult((false, "task_name too long"));
        return RunProcessAsync("schtasks.exe", $"/delete /tn \"{name}\" /f", ct);
    }

    private static Task<(bool Ok, string Message)> DeleteRunValueAsync(string hive, string? keyPath, string? valueName, CancellationToken ct)
    {
        var h = (hive ?? "HKCU").Trim().ToUpperInvariant();
        if (h is not ("HKCU" or "HKEY_CURRENT_USER"))
            return Task.FromResult((false, "Only HKCU is allowed for delete_run_key"));
        if (string.IsNullOrWhiteSpace(keyPath) || string.IsNullOrWhiteSpace(valueName))
            return Task.FromResult((false, "key_path and value_name required"));
        var kp = keyPath.Trim().TrimStart('\\');
        var vn = valueName.Trim();
        // Safety: restrict to Run key (this is the malware persistence described)
        if (!kp.Equals(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", StringComparison.OrdinalIgnoreCase))
            return Task.FromResult((false, "Only HKCU\\...\\Run is allowed"));
        return RunProcessAsync("reg.exe", $"delete \"HKCU\\{kp}\" /v \"{vn}\" /f", ct);
    }

    private static Task<(bool Ok, string Message)> DeletePathAsync(string? path, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(path)) return Task.FromResult((false, "path required"));
        var full = path.Trim().TrimEnd('\\');
        if (!IsSafeRemediationPath(full)) return Task.FromResult((false, "Path not allowed for delete_path"));
        try
        {
            if (File.Exists(full))
            {
                File.Delete(full);
                return Task.FromResult((true, "File deleted"));
            }
            if (Directory.Exists(full))
            {
                Directory.Delete(full, true);
                return Task.FromResult((true, "Directory deleted"));
            }
            return Task.FromResult((true, "Path not found (already removed)"));
        }
        catch (Exception ex)
        {
            return Task.FromResult((false, ex.Message));
        }
    }

    private static async Task<(bool Ok, string Message)> RunProcessAsync(string fileName, string arguments, CancellationToken ct)
    {
        try
        {
            using var p = new Process();
            p.StartInfo = new ProcessStartInfo
            {
                FileName = fileName,
                Arguments = arguments,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
            };
            p.Start();
            using var reg = ct.Register(() => { try { p.Kill(true); } catch { } });
            if (!p.WaitForExit(30_000))
            {
                try { p.Kill(true); } catch { }
                return (false, "Timed out");
            }
            var stdout = await p.StandardOutput.ReadToEndAsync();
            var stderr = await p.StandardError.ReadToEndAsync();
            if (p.ExitCode == 0) return (true, string.IsNullOrWhiteSpace(stdout) ? "ok" : stdout.Trim());
            var msg = string.IsNullOrWhiteSpace(stderr) ? stdout : stderr;
            msg = string.IsNullOrWhiteSpace(msg) ? $"exit {p.ExitCode}" : msg.Trim();
            return (false, msg);
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
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
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(pollInterval), ct);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            try
            {
                var policy = await _transport.GetPolicyAsync(ct);
                ApplyEndpointPolicy(policy);

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

    /// <summary>Fetch EDR policy once so heartbeats can report policy id before the first triage poll.</summary>
    private async Task InitialPolicyFetchAsync(CancellationToken ct)
    {
        if (string.IsNullOrEmpty(_config.AgentKey)) return;
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(4), ct);
            var policy = await _transport.GetPolicyAsync(ct);
            ApplyEndpointPolicy(policy);
        }
        catch
        {
            /* non-fatal */
        }
    }

    private void ApplyEndpointPolicy(EndpointPolicy? policy)
    {
        if (policy == null) return;
        _effectiveHeartbeatMinutes = policy.HeartbeatIntervalMinutes;
        _effectiveBatchIntervalSeconds = policy.TelemetryIntervalSeconds;
        _effectiveBatchSize = policy.BatchUploadSize;
        _effectivePollSeconds = policy.PollIntervalSeconds;
        _lastEdrPolicyId = policy.PolicyId;
        _lastEdrPolicySyncUtc = DateTimeOffset.UtcNow;
    }

    private async Task UpdateCheckLoopAsync(CancellationToken ct)
    {
        if (string.IsNullOrEmpty(_config.AgentKey) || _updateChecker == null) return;

        var firstWait = true;
        while (!ct.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(firstWait ? TimeSpan.FromSeconds(45) : TimeSpan.FromHours(24), ct);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            firstWait = false;
            try
            {
                var update = await _updateChecker.CheckAsync(ct);
                if (update != null)
                {
                    Console.WriteLine($"[Agent] Update available: {update.Version}. Download: {update.DownloadUrl}");
                    if (_config.VerifyAgentUpdates)
                    {
                        var (ok, msg) = await VerifyUpdateArtifactAsync(update, _config.AgentUpdatePublicKeyPem, ct);
                        Console.WriteLine(ok
                            ? $"[Agent] Update verification OK: {msg}"
                            : $"[Agent] Update verification FAILED: {msg}");
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Agent] Update check error: {ex.Message}");
            }
        }
    }

    private static async Task<(bool Ok, string Message)> VerifyUpdateArtifactAsync(
        UpdateInfo update,
        string? publicKeyPem,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(update.DownloadUrl))
            return (false, "missing download_url");
        if (string.IsNullOrWhiteSpace(update.ChecksumSha256) || update.ChecksumSha256.Trim().Length != 64)
            return (false, "missing/invalid checksum_sha256 (expected 64 hex chars)");

        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromMinutes(5) };
            var bytes = await http.GetByteArrayAsync(update.DownloadUrl, ct);
            var sha = SHA256.HashData(bytes);
            var hex = Convert.ToHexString(sha).ToLowerInvariant();
            var expected = update.ChecksumSha256.Trim().ToLowerInvariant();
            if (!string.Equals(hex, expected, StringComparison.OrdinalIgnoreCase))
                return (false, $"checksum mismatch expected={expected} got={hex}");

            // Optional signature verification: signature over UTF8(sha256_hex)
            if (!string.IsNullOrWhiteSpace(update.SignatureBase64) && !string.IsNullOrWhiteSpace(publicKeyPem))
            {
                using var rsa = RSA.Create();
                rsa.ImportFromPem(publicKeyPem);
                var sig = Convert.FromBase64String(update.SignatureBase64.Trim());
                var data = Encoding.UTF8.GetBytes(expected);
                var ok = rsa.VerifyData(data, sig, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
                if (!ok) return (false, "RSA signature invalid");
            }

            return (true, $"sha256={expected.Substring(0, 12)}… size={bytes.Length}B");
        }
        catch (Exception e)
        {
            return (false, e.Message);
        }
    }

    private async Task AvTaskPollLoopAsync(CancellationToken ct)
    {
        if (string.IsNullOrEmpty(_config.AgentKey)) return;

        var avPoller = new AvTaskPollingService(_config.ServerUrl, _config.AgentKey);
        var pollInterval = _effectivePollSeconds > 0 ? _effectivePollSeconds : _config.CommandPollIntervalSeconds;

        while (!ct.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(pollInterval), ct);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            try
            {
                var policy = await _transport.GetAvPolicyAsync(ct);
                if (policy == null) continue;

                _ngavRealtimeEnabled = policy.RealtimeEnabled;
                var sigVer = await _transport.GetAvSignaturesVersionAsync(ct);
                _ngavBundleVersion = sigVer?.Version;

                var sigService = new SignatureUpdateService(_transport);
                var signatures = await sigService.LoadOrFetchAsync(ct);
                _ngavSignatureCount = signatures.Count;
                await _transport.SubmitAvUpdateStatusAsync(
                    _ngavBundleVersion ?? (signatures.Count > 0 ? "loaded" : "empty"),
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

    /// <summary>Falcon-style sensor telemetry on every heartbeat (queue backlog, uptime, containment, health).</summary>
    private void EnrichSensorTelemetry(HeartbeatPayload? payload)
    {
        if (payload == null) return;
        try
        {
            payload.QueueDepth = _queue.Count;
            var proc = Process.GetCurrentProcess();
            payload.ProcessUptimeSeconds = (int)Math.Max(0, (DateTime.UtcNow - proc.StartTime.ToUniversalTime()).TotalSeconds);
            payload.HostIsolationActive = HostIsolationService.IsIsolationActive();
            var q = payload.QueueDepth ?? 0;
            payload.SensorOperationalStatus = q > 2000 ? "degraded" : "ok";

            if (_updateChecker != null)
            {
                if (_updateChecker.LastCheckUtc.HasValue)
                {
                    payload.AgentUpdateStatus = _updateChecker.LastUpdateAvailable ? "update_available" : "up_to_date";
                    payload.AvailableAgentVersion = _updateChecker.LastTargetVersion;
                    payload.LastAgentUpdateCheckUtc = _updateChecker.LastCheckUtc.Value.ToString("O");
                }
                else
                {
                    payload.AgentUpdateStatus = "unknown";
                }
            }

            if (_ngavSignatureCount >= 0)
            {
                payload.AvSignatureBundle = _ngavBundleVersion;
                payload.AvRealtimeEnabled = _ngavRealtimeEnabled;
                payload.AvSignatureCount = _ngavSignatureCount;
                if (_ngavSignatureCount == 0)
                    payload.AvPreventionStatus = "degraded";
                else if (_ngavRealtimeEnabled == true)
                    payload.AvPreventionStatus = "active";
                else
                    payload.AvPreventionStatus = "monitor_only";
            }

            if (_lastEdrPolicySyncUtc.HasValue)
            {
                payload.EdrPolicyId = _lastEdrPolicyId;
                payload.LastEdrPolicySyncUtc = _lastEdrPolicySyncUtc.Value.ToString("O");
            }
        }
        catch
        {
            // best-effort only
        }
    }
}
