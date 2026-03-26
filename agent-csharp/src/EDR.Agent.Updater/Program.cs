using System.Text.Json;

record RollbackManifest(string TargetPath, string BackupPath, string InstalledPath, DateTime CreatedAtUtc);

static class ProgramEntry
{
    static int Main(string[] args)
    {
        try
        {
            var map = ParseArgs(args);
            if (map.ContainsKey("rollback"))
            {
                return RunRollback(map);
            }
            return RunInstall(map);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex.Message);
            return 1;
        }
    }

    private static int RunInstall(Dictionary<string, string> args)
    {
        var artifact = Required(args, "artifact");
        var target = Required(args, "target");
        var manifest = Required(args, "manifest");

        if (!File.Exists(artifact)) throw new InvalidOperationException("artifact not found");
        var targetDir = Path.GetDirectoryName(target) ?? AppContext.BaseDirectory;
        Directory.CreateDirectory(targetDir);

        var backupDir = Path.Combine(targetDir, "rollback");
        Directory.CreateDirectory(backupDir);
        var backupPath = Path.Combine(backupDir, $"{Path.GetFileName(target)}.{DateTime.UtcNow:yyyyMMddHHmmss}.bak");

        if (File.Exists(target))
        {
            File.Copy(target, backupPath, overwrite: true);
        }
        File.Copy(artifact, target, overwrite: true);

        var m = new RollbackManifest(
            TargetPath: Path.GetFullPath(target),
            BackupPath: File.Exists(backupPath) ? Path.GetFullPath(backupPath) : "",
            InstalledPath: Path.GetFullPath(artifact),
            CreatedAtUtc: DateTime.UtcNow
        );
        var json = JsonSerializer.Serialize(m, new JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(manifest, json);
        Console.WriteLine($"installed={target}");
        Console.WriteLine($"manifest={manifest}");
        return 0;
    }

    private static int RunRollback(Dictionary<string, string> args)
    {
        var manifestPath = Required(args, "manifest");
        if (!File.Exists(manifestPath)) throw new InvalidOperationException("manifest not found");
        var json = File.ReadAllText(manifestPath);
        var m = JsonSerializer.Deserialize<RollbackManifest>(json) ?? throw new InvalidOperationException("invalid manifest");
        if (string.IsNullOrWhiteSpace(m.BackupPath) || !File.Exists(m.BackupPath))
            throw new InvalidOperationException("backup artifact not found");
        File.Copy(m.BackupPath, m.TargetPath, overwrite: true);
        Console.WriteLine($"rolled_back={m.TargetPath}");
        return 0;
    }

    private static Dictionary<string, string> ParseArgs(string[] args)
    {
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < args.Length; i++)
        {
            var a = args[i];
            if (!a.StartsWith("--")) continue;
            var key = a.TrimStart('-');
            if (i + 1 < args.Length && !args[i + 1].StartsWith("--"))
            {
                map[key] = args[i + 1];
                i++;
            }
            else
            {
                map[key] = "true";
            }
        }
        return map;
    }

    private static string Required(Dictionary<string, string> args, string key)
    {
        if (!args.TryGetValue(key, out var v) || string.IsNullOrWhiteSpace(v))
            throw new InvalidOperationException($"missing --{key}");
        return v;
    }
}

