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
Write-Host "Service installed. Start with: Start-Service $serviceName"
