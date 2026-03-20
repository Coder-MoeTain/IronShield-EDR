using EDR.Agent.Core.Services;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace EDR.Agent.Service;

/// <summary>
/// Background service wrapper for Windows Service hosting.
/// </summary>
public class AgentBackgroundService : BackgroundService
{
    private readonly ILogger<AgentBackgroundService> _logger;
    private readonly ConfigService _configService;

    public AgentBackgroundService(ILogger<AgentBackgroundService> logger)
    {
        _logger = logger;
        _configService = new ConfigService();
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _configService.Load();
        var worker = new AgentWorker(_configService, null);
        await worker.RunAsync(stoppingToken);
    }
}
