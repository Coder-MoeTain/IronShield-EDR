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
    configService.Load();
    var worker = new AgentWorker(configService, null);
    var cts = new CancellationTokenSource();
    Console.CancelKeyPress += (_, e) => { e.Cancel = true; cts.Cancel(); };
    await worker.RunAsync(cts.Token);
}
