param(
  [Parameter(Mandatory = $true)][string]$RestoredBaseUrl
)

$checks = @(
  "$RestoredBaseUrl/healthz",
  "$RestoredBaseUrl/readyz"
)

foreach ($u in $checks) {
  try {
    $r = Invoke-WebRequest -Uri $u -Method GET -TimeoutSec 10
    Write-Host "[OK] $u -> $($r.StatusCode)"
  }
  catch {
    Write-Host "[FAIL] $u -> $($_.Exception.Message)"
    exit 1
  }
}

Write-Host "DR drill baseline checks passed."
exit 0

