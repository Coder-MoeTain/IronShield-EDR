# DEPRECATED (enterprise): this script created a localhost-bound build with a fallback dev token.
# Keep for historical reference only. Use Install-Agent.ps1 with explicit -ServerUrl and -RegistrationToken,
# and provide config via config.json / environment variables.

$ErrorActionPreference = "Stop"
$scriptRoot = $PSScriptRoot
$distDir = Join-Path $scriptRoot "dist\IronShieldEDR-Agent"
$serverUrl = if ($env:EDR_SERVER_URL) { $env:EDR_SERVER_URL } else { "" }
$registrationToken = if ($env:EDR_REGISTRATION_TOKEN) { $env:EDR_REGISTRATION_TOKEN } else { "" }

if ([string]::IsNullOrWhiteSpace($serverUrl) -or [string]::IsNullOrWhiteSpace($registrationToken)) {
    throw "Set EDR_SERVER_URL and EDR_REGISTRATION_TOKEN in your environment before building."
}

Write-Host "[Build] Publishing agent for Windows (self-contained)..." -ForegroundColor Cyan
Push-Location $scriptRoot
try {
    if (Test-Path $distDir) { Remove-Item $distDir -Recurse -Force }
    New-Item -ItemType Directory -Path $distDir -Force | Out-Null

    dotnet publish src\EDR.Agent.Service\EDR.Agent.Service.csproj `
        -c Release `
        -r win-x64 `
        --self-contained true `
        -p:PublishSingleFile=true `
        -p:IncludeNativeLibrariesForSelfExtract=true `
        -o $distDir

    if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed" }
} finally {
    Pop-Location
}

# Create config.json with ServerUrl pre-bound
$configPath = Join-Path $distDir "config.json"
$config = @{
    ServerUrl = $serverUrl
    RegistrationToken = $registrationToken
    HeartbeatIntervalMinutes = 5
    EventBatchIntervalSeconds = 30
} | ConvertTo-Json
$config | Set-Content $configPath -Encoding UTF8
Write-Host "[Config] Created config.json with ServerUrl=$serverUrl" -ForegroundColor Green

# Create queue directory
New-Item -ItemType Directory -Path (Join-Path $distDir "queue") -Force | Out-Null

$exePath = Join-Path $distDir "EDR.Agent.Service.exe"
Write-Host ""
Write-Host "=== Build Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Location: $distDir" -ForegroundColor Yellow
Write-Host "Executable: $exePath" -ForegroundColor Yellow
Write-Host ""
Write-Host "To run:"
Write-Host "  cd `"$distDir`""
Write-Host "  .\EDR.Agent.Service.exe --console"
Write-Host ""
Write-Host "Use --console for dev (clear logs). Without it, the generic host runs (Production)."
Write-Host "RegistrationToken is set for localhost; override with EDR_REGISTRATION_TOKEN before build."
Write-Host ""
