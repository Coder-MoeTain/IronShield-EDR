using System.Collections.Concurrent;
using System.Management;
using System.Runtime.InteropServices;
using EDR.Agent.Core.Antivirus.Models;
using EDR.Agent.Core.Models;
using EDR.Agent.Core.Services;

namespace EDR.Agent.Core.DeviceControl;

/// <summary>
/// Subscribes to <see cref="Win32_VolumeChangeEvent"/> (device arrival) for removable storage policy.
/// Defensive only — ejects volumes in <c>block</c> mode; does not install kernel drivers.
/// </summary>
public sealed class DeviceControlWatcher : IDisposable
{
    private readonly Func<AvPolicy?> _getPolicy;
    private readonly LocalQueueService _queue;
    private readonly Func<string> _hostname;
    private ManagementEventWatcher? _watcher;
    private readonly ConcurrentDictionary<string, DateTime> _debounce = new();
    private static readonly TimeSpan DebounceWindow = TimeSpan.FromSeconds(4);
    private bool _disposed;

    public DeviceControlWatcher(Func<AvPolicy?> getPolicy, LocalQueueService queue, Func<string> hostname)
    {
        _getPolicy = getPolicy;
        _queue = queue;
        _hostname = hostname;
    }

    public void Start()
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows)) return;
        if (_watcher != null) return;

        try
        {
            // EventType 2 = device arrival (new volume mount)
            var q = new WqlEventQuery("SELECT * FROM Win32_VolumeChangeEvent WHERE EventType = 2");
            _watcher = new ManagementEventWatcher(q);
            _watcher.EventArrived += OnVolumeEvent;
            _watcher.Start();
        }
        catch
        {
            /* WMI may be unavailable */
        }
    }

    public void Stop()
    {
        try
        {
            if (_watcher != null)
            {
                _watcher.EventArrived -= OnVolumeEvent;
                _watcher.Stop();
                _watcher.Dispose();
                _watcher = null;
            }
        }
        catch { /* ignore */ }
    }

    private void OnVolumeEvent(object sender, EventArrivedEventArgs e)
    {
        try
        {
            if (e.NewEvent.Properties["DriveName"]?.Value is not string driveName) return;
            _ = Task.Run(() => HandleDriveAsync(driveName));
        }
        catch
        {
            /* ignore */
        }
    }

    private async Task HandleDriveAsync(string driveName)
    {
        await Task.Delay(500).ConfigureAwait(false); // allow mount to complete

        var policy = _getPolicy();
        if (policy == null || !policy.DeviceControlEnabled) return;

        var action = policy.EffectiveRemovableStorageAction;
        if (action == "allow") return;

        if (!RemovableVolumeHelper.IsRemovableDriveLetter(driveName))
            return;

        var key = driveName.ToUpperInvariant();
        var now = DateTime.UtcNow;
        if (_debounce.TryGetValue(key, out var last) && now - last < DebounceWindow)
            return;
        _debounce[key] = now;

        string? label = null;
        string driveTypeStr = "Removable";
        try
        {
            var di = new DriveInfo(driveName.Length >= 2 && driveName[1] == ':' ? driveName[..2] : driveName);
            if (di.IsReady) label = di.VolumeLabel;
            driveTypeStr = di.DriveType.ToString();
        }
        catch { /* ignore */ }

        var ejectAttempted = false;
        bool? ejectSuccess = null;
        string? note = null;

        if (action == "block")
        {
            ejectAttempted = true;
            var ok = RemovableVolumeHelper.TryEjectVolume(driveName, out var err);
            ejectSuccess = ok;
            if (!ok) note = err ?? "eject_failed";
        }

        var evt = new TelemetryEvent
        {
            EventId = $"device-control-{Guid.NewGuid():N}",
            Hostname = _hostname(),
            Timestamp = DateTime.UtcNow,
            EventSource = "ironshield.device_control",
            EventType = "usb_removable_volume",
            DeviceControl = new DeviceControlEventDetail
            {
                Action = action,
                DriveLetter = driveName,
                VolumeLabel = label,
                DriveType = driveTypeStr,
                EjectAttempted = ejectAttempted,
                EjectSuccess = ejectSuccess,
                Note = note,
            },
        };

        _queue.Enqueue(evt);

        try
        {
            var line =
                $"[DeviceControl] removable {driveName} action={action} eject={(ejectSuccess == true ? "ok" : ejectSuccess == false ? "fail" : "n/a")}";
            Console.WriteLine(line);
        }
        catch { /* ignore */ }
    }

    public void Dispose()
    {
        if (_disposed) return;
        Stop();
        _disposed = true;
    }
}
