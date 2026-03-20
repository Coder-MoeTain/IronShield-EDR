using System.Diagnostics;
using EDR.Agent.Core.Models;

namespace EDR.Agent.Core.Response;

/// <summary>
/// Executes process termination (kill process) response action.
/// Defensive use only - terminates process by PID when instructed by server.
/// </summary>
public class ProcessResponseExecutor
{
    public async Task<(bool Success, string Message)> ExecuteKillProcessAsync(int processId, CancellationToken ct = default)
    {
        try
        {
            var process = Process.GetProcessById(processId);
            process.Kill();
            await Task.Delay(500, ct);
            if (process.HasExited)
                return (true, $"Process {processId} terminated");
            return (false, "Process did not exit in time");
        }
        catch (ArgumentException)
        {
            return (false, $"Process {processId} not found");
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }
}
