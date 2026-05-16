using System.Text.Json;
using EDR.Agent.Core.Models;
using EDR.Agent.Core.Security;

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
        if (Environment.GetEnvironmentVariable("EDR_REQUIRE_HTTPS") is { } requireHttpsRaw)
        {
            if (bool.TryParse(requireHttpsRaw, out var requireHttps))
                Config.RequireHttps = requireHttps;
        }
        if (Environment.GetEnvironmentVariable("EDR_REGISTRATION_TOKEN") is { } token)
            Config.RegistrationToken = token;
        if (Environment.GetEnvironmentVariable("EDR_AGENT_KEY") is { } key)
            Config.AgentKey = key;
        if (Environment.GetEnvironmentVariable("EDR_TENANT_SLUG") is { } tslug && !string.IsNullOrWhiteSpace(tslug))
            Config.TenantSlug = tslug.Trim();
        if (Environment.GetEnvironmentVariable("EDR_WEB_URL_PROTECTION") is { } webProtRaw)
        {
            if (bool.TryParse(webProtRaw, out var webProt))
                Config.WebUrlProtectionEnabled = webProt;
        }

        // Normalize and validate
        Config.ServerUrl = (Config.ServerUrl ?? "").Trim().TrimEnd('/');
        // Plain HTTP base URLs cannot satisfy RequireHttps (HttpTransport rejects http:// when true).
        if (!string.IsNullOrWhiteSpace(Config.ServerUrl) &&
            Config.ServerUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
            Config.RequireHttps)
        {
            Console.WriteLine("[Config] ServerUrl uses http:// so RequireHttps is set to false.");
            Config.RequireHttps = false;
        }
        if (string.IsNullOrWhiteSpace(Config.ServerUrl))
        {
            Console.WriteLine("[Config] Missing ServerUrl. Set EDR_SERVER_URL or create config.json (see config.example.json).");
        }

        HydrateSecretsFromProtectedFields();

        return Config;
    }

    void HydrateSecretsFromProtectedFields()
    {
        if (string.IsNullOrEmpty(Config.AgentKey) && !string.IsNullOrEmpty(Config.AgentKeyProtected))
        {
            Config.AgentKey = SecretProtector.Unprotect(Config.AgentKeyProtected);
        }
        if (!string.IsNullOrEmpty(Config.RegistrationToken) && Config.RegistrationToken.StartsWith("dpapi:", StringComparison.OrdinalIgnoreCase))
        {
            Config.RegistrationToken = SecretProtector.Unprotect(Config.RegistrationToken["dpapi:".Length..]) ?? "";
        }
    }

    /// <summary>
    /// Persist agent key after registration.
    /// </summary>
    public void SaveAgentKey(string agentKey, long? endpointId = null)
    {
        Config.AgentKey = agentKey;
        Config.AgentKeyProtected = SecretProtector.Protect(agentKey);
        if (endpointId.HasValue && endpointId.Value > 0)
            Config.EndpointId = endpointId;
        SaveConfig();
    }

    /// <summary>
    /// Clear agent key (e.g. when endpoint was deleted on server). Agent will re-register on next run.
    /// </summary>
    public void ClearAgentKey()
    {
        Config.AgentKey = null;
        Config.AgentKeyProtected = null;
        SaveConfig();
    }

    private void SaveConfig()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "config.json");
        try
        {
            var toSave = new AgentConfig
            {
                ServerUrl = Config.ServerUrl,
                RequireHttps = Config.RequireHttps,
                PinnedServerCertThumbprints = Config.PinnedServerCertThumbprints,
                ClientCertificatePfxPath = Config.ClientCertificatePfxPath,
                ClientCertificatePfxPassword = Config.ClientCertificatePfxPassword,
                RegistrationToken = Config.RegistrationToken,
                TenantSlug = Config.TenantSlug,
                AgentKeyProtected = Config.AgentKeyProtected ?? SecretProtector.Protect(Config.AgentKey),
                EndpointId = Config.EndpointId,
                HeartbeatIntervalMinutes = Config.HeartbeatIntervalMinutes,
                EventBatchIntervalSeconds = Config.EventBatchIntervalSeconds,
                CommandPollIntervalSeconds = Config.CommandPollIntervalSeconds,
                MaxEventsPerBatch = Config.MaxEventsPerBatch,
                MaxRetries = Config.MaxRetries,
                LocalQueuePath = Config.LocalQueuePath,
                MaxWindowsEventLogEventsPerPoll = Config.MaxWindowsEventLogEventsPerPoll,
                MaxSysmonEventsPerPoll = Config.MaxSysmonEventsPerPoll,
                ScriptAllowlistPrefixes = Config.ScriptAllowlistPrefixes,
                ScriptAllowlistSha256 = Config.ScriptAllowlistSha256,
                VerifyAgentUpdates = Config.VerifyAgentUpdates,
                AgentUpdatePublicKeyPem = Config.AgentUpdatePublicKeyPem,
                AutoInstallUpdates = Config.AutoInstallUpdates,
                UpdaterExecutablePath = Config.UpdaterExecutablePath,
                UpdateTargetPath = Config.UpdateTargetPath,
                WebUrlProtectionEnabled = Config.WebUrlProtectionEnabled,
            };
            var json = JsonSerializer.Serialize(toSave, JsonOptions);
            File.WriteAllText(path, json);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Config] Failed to save config: {ex.Message}");
        }
    }
}
