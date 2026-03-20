# Uninstall EDR Agent Windows Service
# Run as Administrator

$serviceName = "EDR.Agent"
Stop-Service $serviceName -ErrorAction SilentlyContinue
sc.exe delete $serviceName
Write-Host "Service uninstalled."
