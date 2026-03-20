# Run agent after endpoint was deleted - clears stored key so agent re-registers
# Usage: .\run-agent-fresh.ps1

$configPath = "src\EDR.Agent.Service\bin\Debug\net8.0\config.json"
if (Test-Path $configPath) {
    $config = Get-Content $configPath -Raw | ConvertFrom-Json
    $config.PSObject.Properties.Remove("AgentKey")
    $config | ConvertTo-Json | Set-Content $configPath
    Write-Host "[OK] Cleared AgentKey from config - agent will re-register"
}

dotnet run --project src/EDR.Agent.Service -- --console
