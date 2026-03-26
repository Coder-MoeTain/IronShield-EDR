using EDR.Agent.Core.Services;
using EDR.Agent.Service;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

// Run as console for development; use install script for Windows Service
var runAsService = !args.Contains("--console") && OperatingSystem.IsWindows();

if (runAsService)
{
    var builder = Host.CreateApplicationBuilder(args);
    builder.Services.AddWindowsService(options => options.ServiceName = "EDR.Agent");
    builder.Services.AddHostedService<AgentBackgroundService>();
    await builder.Build().RunAsync();
}
else
{
    var configService = new ConfigService();
    var cfg = configService.Load();
    // Dev/local option: run against plain HTTP backend.
    // --no-ssl flips RequireHttps=false and, if URL is https://, downgrades to http://.
    if (args.Contains("--no-ssl", StringComparer.OrdinalIgnoreCase))
    {
        var allowInsecure = string.Equals(
            Environment.GetEnvironmentVariable("EDR_ALLOW_INSECURE_HTTP"),
            "true",
            StringComparison.OrdinalIgnoreCase);
        if (!allowInsecure)
            throw new InvalidOperationException("--no-ssl is disabled. Set EDR_ALLOW_INSECURE_HTTP=true for local-only testing.");
        cfg.RequireHttps = false;
        if (!string.IsNullOrWhiteSpace(cfg.ServerUrl) &&
            cfg.ServerUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            cfg.ServerUrl = "http://" + cfg.ServerUrl.Substring("https://".Length);
        }
        Console.WriteLine("[Config] --no-ssl enabled: RequireHttps=false");
    }
    var worker = new AgentWorker(configService, null);
    var cts = new CancellationTokenSource();
    Console.CancelKeyPress += (_, e) => { e.Cancel = true; cts.Cancel(); };
    await worker.RunAsync(cts.Token);
}
