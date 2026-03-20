<#
.SYNOPSIS
    IronShield EDR Agent Installer - Build, configure, and install the Windows agent as a service.

.DESCRIPTION
    This script builds the EDR agent, creates config.json, and installs it as a Windows service.
    Run as Administrator for service installation.

.PARAMETER ServerUrl
    EDR server URL (e.g., https://edr.example.com or http://localhost:3001)

.PARAMETER RegistrationToken
    Bootstrap registration token from the server .env (AGENT_REGISTRATION_TOKEN)

.PARAMETER InstallPath
    Installation directory. Default: %ProgramData%\IronShieldEDR\Agent

.PARAMETER Uninstall
    Remove the agent service and optionally delete files.

.PARAMETER Upgrade
    Stop existing service, reinstall with current build.

.PARAMETER StartService
    Start the service after install. Default: $true

.EXAMPLE
    .\Install-Agent.ps1 -ServerUrl "https://edr.example.com" -RegistrationToken "your-token"
.EXAMPLE
    .\Install-Agent.ps1 -Uninstall
.EXAMPLE
    .\Install-Agent.ps1 -ServerUrl "http://localhost:3001" -RegistrationToken "abc123" -Upgrade
#>

[CmdletBinding()]
param(
    [Parameter()]
    [string]$ServerUrl = "http://localhost:3001",

    [Parameter()]
    [string]$RegistrationToken = "",

    [Parameter()]
    [string]$InstallPath = "$env:ProgramData\IronShieldEDR\Agent",

    [Parameter()]
    [switch]$Uninstall,

    [Parameter()]
    [switch]$Upgrade,

    [Parameter()]
    [bool]$StartService = $true
)

$ErrorActionPreference = "Stop"
$serviceName = "EDR.Agent"
$displayName = "IronShield EDR Agent"

function Test-Administrator {
    $current = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($current)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Uninstall-Agent {
    Write-Host "[Uninstall] Stopping service..." -ForegroundColor Yellow
    Stop-Service -Name $serviceName -ErrorAction SilentlyContinue -Force
    Start-Sleep -Seconds 2

    Write-Host "[Uninstall] Removing service..." -ForegroundColor Yellow
    $svc = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if ($svc) {
        sc.exe delete $serviceName
        Start-Sleep -Seconds 2
        Write-Host "[Uninstall] Service removed." -ForegroundColor Green
    } else {
        Write-Host "[Uninstall] Service not found." -ForegroundColor Gray
    }

    Write-Host "[Uninstall] Installation files remain at: $InstallPath" -ForegroundColor Gray
    Write-Host "[Uninstall] Delete manually if desired." -ForegroundColor Gray
}

function Install-Agent {
    if (-not (Test-Administrator)) {
        Write-Error "This script must be run as Administrator. Right-click PowerShell and 'Run as administrator'."
        exit 1
    }

    $scriptRoot = $PSScriptRoot
    $publishDir = Join-Path $scriptRoot "publish"
    $exePath = Join-Path $publishDir "EDR.Agent.Service.exe"

    # Upgrade: stop and remove existing
    if ($Upgrade) {
        Write-Host "[Upgrade] Stopping existing service..." -ForegroundColor Yellow
        Stop-Service -Name $serviceName -ErrorAction SilentlyContinue -Force
        Start-Sleep -Seconds 2
        $svc = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
        if ($svc) {
            sc.exe delete $serviceName
            Start-Sleep -Seconds 2
        }
    }

    # Build and publish
    Write-Host "[Build] Publishing agent..." -ForegroundColor Cyan
    Push-Location $scriptRoot
    try {
        dotnet publish src\EDR.Agent.Service\EDR.Agent.Service.csproj -c Release -o $publishDir
        if ($LASTEXITCODE -ne 0) {
            throw "dotnet publish failed"
        }
    } finally {
        Pop-Location
    }

    if (-not (Test-Path $exePath)) {
        Write-Error "Build failed. Exe not found: $exePath"
        exit 1
    }
    Write-Host "[Build] Published to $publishDir" -ForegroundColor Green

    # Create install directory and copy files
    if (-not (Test-Path $InstallPath)) {
        New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
    }
    Write-Host "[Install] Copying files to $InstallPath" -ForegroundColor Cyan
    Copy-Item -Path "$publishDir\*" -Destination $InstallPath -Recurse -Force

    $installExe = Join-Path $InstallPath "EDR.Agent.Service.exe"
    $configPath = Join-Path $InstallPath "config.json"

    # Create or update config.json
    $config = @{
        ServerUrl = $ServerUrl.TrimEnd('/')
        RegistrationToken = $RegistrationToken
        HeartbeatIntervalMinutes = 5
        EventBatchIntervalSeconds = 30
    }

    # Preserve existing AgentKey if upgrading
    if (Test-Path $configPath) {
        try {
            $existing = Get-Content $configPath -Raw | ConvertFrom-Json
            if ($existing.PSObject.Properties.Name -contains "AgentKey" -and $existing.AgentKey) {
                $config["AgentKey"] = $existing.AgentKey
                Write-Host "[Config] Preserved existing AgentKey" -ForegroundColor Gray
            }
        } catch { }
    }

    $config | ConvertTo-Json | Set-Content $configPath -Encoding UTF8
    Write-Host "[Config] Created config.json" -ForegroundColor Green

    # Create queue directory
    $queuePath = Join-Path $InstallPath "queue"
    if (-not (Test-Path $queuePath)) {
        New-Item -ItemType Directory -Path $queuePath -Force | Out-Null
    }

    # Install Windows service
    Write-Host "[Service] Installing Windows service..." -ForegroundColor Cyan
    $binaryPath = "`"$installExe`""
    New-Service -Name $serviceName -DisplayName $displayName -BinaryPathName $binaryPath -StartupType Automatic -ErrorAction Stop
    Write-Host "[Service] Installed successfully." -ForegroundColor Green

    if ($StartService) {
        Write-Host "[Service] Starting service..." -ForegroundColor Cyan
        Start-Service -Name $serviceName
        Write-Host "[Service] Started." -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "=== Installation Complete ===" -ForegroundColor Green
    Write-Host "  Server: $ServerUrl"
    Write-Host "  Path:   $InstallPath"
    Write-Host "  Service: $serviceName"
    Write-Host ""
    Write-Host "Commands:"
    Write-Host "  Start-Service $serviceName"
    Write-Host "  Stop-Service $serviceName"
    Write-Host "  Get-Service $serviceName"
}

# Main
if ($Uninstall) {
    Uninstall-Agent
} else {
    if ([string]::IsNullOrWhiteSpace($RegistrationToken)) {
        Write-Warning "RegistrationToken is empty. Agent will register on first run if server allows."
        $r = Read-Host "Continue anyway? (y/N)"
        if ($r -ne "y" -and $r -ne "Y") { exit 0 }
    }
    Install-Agent
}
