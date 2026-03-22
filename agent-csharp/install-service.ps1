# Install EDR Agent as Windows Service
# Run as Administrator: .\install-service.ps1

$serviceName = "EDR.Agent"
$displayName = "Open EDR Agent"
$publishDir = Join-Path $PSScriptRoot "publish"
$exePath = Join-Path $publishDir "EDR.Agent.Service.exe"

# Build and publish
Push-Location $PSScriptRoot
dotnet publish src\EDR.Agent.Service\EDR.Agent.Service.csproj -c Release -o $publishDir
Pop-Location

if (-not (Test-Path $exePath)) {
    Write-Error "Build failed. Exe not found: $exePath"
    exit 1
}

# Create service (no --console for service mode)
New-Service -Name $serviceName -DisplayName $displayName -BinaryPathName "`"$exePath`"" -StartupType Automatic

# Recovery: restart service on failure (user-mode resilience / tamper resistance)
try {
    & sc.exe failure $serviceName reset= 86400 actions= restart/60000/restart/60000/restart/60000 | Out-Null
    & sc.exe failureflag $serviceName 1 | Out-Null
    Write-Host "Service failure recovery: restart after 60s (up to 3 times / 24h window)."
} catch {
    Write-Warning "Could not set sc failure actions (run elevated if needed)."
}

Write-Host "Service installed. Start with: Start-Service $serviceName"
