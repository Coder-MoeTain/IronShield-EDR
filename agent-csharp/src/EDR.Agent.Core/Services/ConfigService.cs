using System.Text.Json;
using EDR.Agent.Core.Models;

namespace EDR.Agent.Core.Services;

/// <summary>
/// Loads and manages agent configuration from JSON file and environment.
/// </summary>
public class ConfigService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = false,
    };

    public AgentConfig Config { get; set; }

    public ConfigService()
    {
        Config = new AgentConfig();
    }

    /// <summary>
    /// Load config from file and override with environment variables.
    /// </summary>
    public AgentConfig Load(string? configPath = null)
    {
        configPath ??= Path.Combine(AppContext.BaseDirectory, "config.json");

        if (File.Exists(configPath))
        {
            try
            {
                var json = File.ReadAllText(configPath);
                var loaded = JsonSerializer.Deserialize<AgentConfig>(json, JsonOptions);
                if (loaded != null)
                    Config = loaded;
            }
            catch (Exception ex)
            {
                // Log and keep defaults
                Console.WriteLine($"[Config] Failed to load {configPath}: {ex.Message}");
            }
        }

        // Environment overrides
        if (Environment.GetEnvironmentVariable("EDR_SERVER_URL") is { } url)
            Config.ServerUrl = url.TrimEnd('/');
        if (Environment.GetEnvironmentVariable("EDR_REGISTRATION_TOKEN") is { } token)
            Config.RegistrationToken = token;
        if (Environment.GetEnvironmentVariable("EDR_AGENT_KEY") is { } key)
            Config.AgentKey = key;

        return Config;
    }

    /// <summary>
    /// Persist agent key after registration.
    /// </summary>
    public void SaveAgentKey(string agentKey)
    {
        Config.AgentKey = agentKey;
        SaveConfig();
    }

    /// <summary>
    /// Clear agent key (e.g. when endpoint was deleted on server). Agent will re-register on next run.
    /// </summary>
    public void ClearAgentKey()
    {
        Config.AgentKey = null;
        SaveConfig();
    }

    private void SaveConfig()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "config.json");
        try
        {
            var json = JsonSerializer.Serialize(Config, JsonOptions);
            File.WriteAllText(path, json);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Config] Failed to save config: {ex.Message}");
        }
    }
}
