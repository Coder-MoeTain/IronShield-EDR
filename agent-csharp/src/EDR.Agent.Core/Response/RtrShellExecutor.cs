using System.Diagnostics;
using System.IO;
using System.Text;

namespace EDR.Agent.Core.Response;

/// <summary>
/// Allowlisted shell commands for RTR-lite (not full CrowdStrike RTR).
/// </summary>
public sealed class RtrShellExecutor
{
    private static readonly HashSet<string> AllowFirstToken = new(StringComparer.OrdinalIgnoreCase)
    {
        "whoami", "hostname", "ipconfig", "ver", "systeminfo", "netstat", "route", "arp", "getmac", "echo",
        // Read-only / inventory (still org policy gated on server)
        "tasklist", "schtasks", "query", "driverquery", "fltmc", "mountvol", "vol",
    };

    private const int MaxOutputBytes = 96 * 1024;
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(45);

    public Task<(bool Ok, string Message, object? Result)> ExecuteAsync(string? command, CancellationToken ct)
    {
        var cmd = (command ?? "").Trim();
        if (string.IsNullOrEmpty(cmd) || cmd.Length > 480)
            return Task.FromResult<(bool, string, object?)>((false, "Invalid command", null));

        if (cmd.IndexOfAny(new[] { '|', '&', ';', '<', '>', '\n', '\r', '`' }) >= 0)
            return Task.FromResult<(bool, string, object?)>((false, "Forbidden shell metacharacters", null));

        var parts = cmd.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0)
            return Task.FromResult<(bool, string, object?)>((false, "Empty command", null));

        var first = parts[0];
        if (first.Contains('\\') || first.Contains('/'))
            first = Path.GetFileName(first);

        if (!AllowFirstToken.Contains(first))
            return Task.FromResult<(bool, string, object?)>((false, $"Command not allowlisted: {first}", null));

        return Task.Run(() => RunCmd(cmd, ct), ct);
    }

    private static (bool Ok, string Message, object? Result) RunCmd(string fullCommand, CancellationToken ct)
    {
        try
        {
            using var proc = new Process();
            proc.StartInfo = new ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = "/c " + fullCommand,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8,
            };
            proc.Start();
            using var reg = ct.Register(() => { try { proc.Kill(true); } catch { } });
            if (!proc.WaitForExit((int)Timeout.TotalMilliseconds))
            {
                try { proc.Kill(true); } catch { }
                return (false, "Command timed out", new { stdout = "", stderr = "timeout", exit_code = -1 });
            }

            var stdout = ReadLimited(proc.StandardOutput);
            var stderr = ReadLimited(proc.StandardError);
            var code = proc.ExitCode;
            return (true, "ok", new { stdout, stderr, exit_code = code });
        }
        catch (Exception ex)
        {
            return (false, ex.Message, new { stdout = "", stderr = ex.Message, exit_code = -1 });
        }
    }

    private static string ReadLimited(StreamReader sr)
    {
        var sb = new StringBuilder();
        int total = 0;
        string? line;
        while ((line = sr.ReadLine()) != null)
        {
            if (total + line.Length + 1 > MaxOutputBytes) break;
            sb.AppendLine(line);
            total += line.Length + 1;
        }
        return sb.ToString();
    }
}
