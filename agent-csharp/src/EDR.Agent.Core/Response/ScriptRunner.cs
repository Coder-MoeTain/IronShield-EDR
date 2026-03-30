using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using EDR.Agent.Core.Models;

namespace EDR.Agent.Core.Response;

/// <summary>
/// Runs an allowlisted script path (mini-RTR). Only paths under configured prefixes execute.
/// </summary>
public sealed class ScriptRunner
{
    public async Task<(bool Success, string Message)> RunAllowlistedScriptAsync(
        AgentConfig config,
        string? scriptPath,
        IEnumerable<string>? blockedSha256 = null,
        CancellationToken ct = default)
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            return (false, "run_script is only supported on Windows");

        if (string.IsNullOrWhiteSpace(scriptPath))
            return (false, "script_path parameter required");

        var path = Path.GetFullPath(Environment.ExpandEnvironmentVariables(scriptPath.Trim()));
        var prefixes = config.ScriptAllowlistPrefixes ?? new List<string>();
        if (prefixes.Count == 0)
            return (false, "ScriptAllowlistPrefixes is empty in agent config — set allowed path prefixes");

        var ok = prefixes.Any(p =>
        {
            var prefix = Path.GetFullPath(Environment.ExpandEnvironmentVariables(p));
            return path.StartsWith(prefix.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)
                || path.Equals(prefix, StringComparison.OrdinalIgnoreCase);
        });

        if (!ok)
            return (false, "Script path not under any ScriptAllowlistPrefixes");

        if (!File.Exists(path))
            return (false, $"Script file not found: {path}");

        var shaList = config.ScriptAllowlistSha256 ?? new List<string>();
        var blocked = new HashSet<string>(
            (blockedSha256 ?? Array.Empty<string>())
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x.Trim().ToLowerInvariant()),
            StringComparer.Ordinal);

        if (shaList.Count > 0 || blocked.Count > 0)
        {
            string hex;
            await using (var fs = File.OpenRead(path))
            {
                using var sha256 = SHA256.Create();
                var hash = await sha256.ComputeHashAsync(fs, ct).ConfigureAwait(false);
                hex = Convert.ToHexString(hash).ToLowerInvariant();
            }
            if (blocked.Contains(hex))
                return (false, "Script SHA-256 is explicitly blocked by policy");

            var okHash = shaList.Any(h =>
                !string.IsNullOrWhiteSpace(h) &&
                string.Equals(hex, h.Trim().ToLowerInvariant(), StringComparison.Ordinal));
            if (shaList.Count > 0 && !okHash)
                return (false, "Script SHA-256 not in ScriptAllowlistSha256");
        }

        return await RunPowerShellFileAsync(path, ct).ConfigureAwait(false);
    }

    private static async Task<(bool Success, string Message)> RunPowerShellFileAsync(string path, CancellationToken ct)
    {
        var psi = new ProcessStartInfo
        {
            FileName = "powershell.exe",
            Arguments = $"-NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"{path}\"",
            CreateNoWindow = true,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            WorkingDirectory = Path.GetDirectoryName(path) ?? Environment.SystemDirectory,
        };
        using var p = new Process { StartInfo = psi };
        p.Start();
        var outTask = p.StandardOutput.ReadToEndAsync(ct);
        var errTask = p.StandardError.ReadToEndAsync(ct);
        await p.WaitForExitAsync(ct).ConfigureAwait(false);
        var stdout = (await outTask.ConfigureAwait(false)).Trim();
        var stderr = (await errTask.ConfigureAwait(false)).Trim();
        if (p.ExitCode != 0)
        {
            var detail = string.IsNullOrEmpty(stderr) ? stdout : stderr;
            return (false, $"Exit {p.ExitCode}: {detail}");
        }
        return (true, stdout.Length > 2000 ? stdout[..2000] + "…" : stdout);
    }
}
