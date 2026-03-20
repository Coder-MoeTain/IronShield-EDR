using System.Diagnostics;
using System.ComponentModel;
using System.Runtime.InteropServices;
using EDR.Agent.Core.Models;

namespace EDR.Agent.Core.Response;

/// <summary>
/// Executes process termination (kill process) response action.
/// Defensive use only - terminates process by PID when instructed by server.
/// NOTE: Agent must run as Administrator or Windows Service (LocalSystem) to kill elevated processes.
/// </summary>
public class ProcessResponseExecutor
{
    private static readonly string TaskKillPath = RuntimeInformation.IsOSPlatform(OSPlatform.Windows)
        ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "taskkill.exe")
        : "taskkill";

    public async Task<(bool Success, string Message)> ExecuteKillProcessAsync(int processId, CancellationToken ct = default)
    {
        try
        {
            // Try taskkill first - more reliable for process trees and protected processes on Windows
            var (taskKillOk, taskKillMsg) = await TryTaskKillAsync(processId, ct);
            if (taskKillOk) return (true, taskKillMsg);

            // Fallback: Process.Kill (may work for same-session processes)
            try
            {
                var process = Process.GetProcessById(processId);
                try
                {
#if NET5_0_OR_GREATER
                    process.Kill(entireProcessTree: true);
#else
                    process.Kill();
#endif
                }
                catch (Win32Exception ex) when (ex.NativeErrorCode == 5) // ERROR_ACCESS_DENIED
                {
                    return (false, $"Access denied: Run agent as Administrator or Windows Service to kill process {processId}");
                }

                await Task.Delay(300, ct);
                return process.HasExited
                    ? (true, $"Process {processId} terminated")
                    : (false, "Process did not exit in time");
            }
            catch (ArgumentException)
            {
                return (false, $"Process {processId} not found (may have already exited)");
            }
        }
        catch (ArgumentException)
        {
            return (false, $"Process {processId} not found (may have already exited)");
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    private static async Task<(bool Ok, string Message)> TryTaskKillAsync(int processId, CancellationToken ct)
    {
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = TaskKillPath,
                Arguments = $"/F /T /PID {processId}",
                CreateNoWindow = true,
                UseShellExecute = false,
                RedirectStandardError = true,
                RedirectStandardOutput = true,
                WorkingDirectory = Environment.SystemDirectory,
            };
            using var p = Process.Start(psi);
            if (p == null) return (false, "Failed to start taskkill");
            var errTask = p.StandardError.ReadToEndAsync(ct);
            await p.WaitForExitAsync(ct);
            var err = await errTask;
            if (p.ExitCode == 0) return (true, $"Process {processId} terminated (taskkill)");
            var msg = !string.IsNullOrWhiteSpace(err) ? err.Trim() : $"taskkill exited with code {p.ExitCode}";
            return (false, msg);
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }
}
