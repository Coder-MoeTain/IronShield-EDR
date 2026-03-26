param(
  [string]$OutDir = ".\backups",
  [string]$DbHost = $env:DB_HOST,
  [string]$DbPort = $env:DB_PORT,
  [string]$DbUser = $env:DB_USER,
  [SecureString]$DbPasswordSecure = $null,
  [string]$DbName = $env:DB_NAME
)

$started = Get-Date
$evidenceDir = Join-Path $OutDir "dr-evidence"
New-Item -ItemType Directory -Force -Path $evidenceDir | Out-Null

if ($DbPasswordSecure) {
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($DbPasswordSecure)
  try { $DbPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
$DbPassword = if ($DbPassword) { $DbPassword } else { $env:DB_PASSWORD }

if (-not $DbHost -or -not $DbPort -or -not $DbUser -or -not $DbPassword -or -not $DbName) {
  throw "Missing DB connection env vars (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME)"
}

try {
  $env:MYSQL_PWD = $DbPassword

  $ts = Get-Date -Format "yyyyMMdd-HHmmss"
  $base = Join-Path $OutDir "$DbName-$ts.sql"
  $gz = "$base.gz"
  $sha = "$gz.sha256"

  New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
  & mysqldump --host=$DbHost --port=$DbPort --user=$DbUser --databases $DbName --single-transaction --routines --triggers --events > $base
  if ($LASTEXITCODE -ne 0) { throw "mysqldump failed" }
  gzip -f $base
  if ($LASTEXITCODE -ne 0) { throw "gzip failed" }

  $hash = Get-FileHash -Algorithm SHA256 -Path $gz
  "$($hash.Hash)  $([System.IO.Path]::GetFileName($gz))" | Out-File -Encoding ascii $sha

  & "$PSScriptRoot\dr-validate.ps1" -BackupFileGz $gz -ChecksumFile $sha -DbHost $DbHost -DbPort $DbPort -DbUser $DbUser -DbPassword $DbPassword
  if ($LASTEXITCODE -ne 0) { throw "dr validation failed" }

  $finished = Get-Date
  $evidence = [PSCustomObject]@{
    started_utc = $started.ToUniversalTime().ToString("o")
    finished_utc = $finished.ToUniversalTime().ToString("o")
    duration_seconds = [Math]::Round(($finished - $started).TotalSeconds, 2)
    db_name = $DbName
    backup_file = (Resolve-Path $gz).Path
    checksum_file = (Resolve-Path $sha).Path
    backup_sha256 = $hash.Hash
    status = "pass"
  }
  $evidenceFile = Join-Path $evidenceDir ("dr-drill-$ts.json")
  $evidence | ConvertTo-Json -Depth 4 | Out-File -Encoding utf8 $evidenceFile
  Write-Host "DR drill succeeded. Evidence: $evidenceFile"
}
catch {
  $failed = Get-Date
  $evidence = [PSCustomObject]@{
    started_utc = $started.ToUniversalTime().ToString("o")
    finished_utc = $failed.ToUniversalTime().ToString("o")
    duration_seconds = [Math]::Round(($failed - $started).TotalSeconds, 2)
    db_name = $DbName
    status = "fail"
    error = $_.Exception.Message
  }
  $tsFail = Get-Date -Format "yyyyMMdd-HHmmss"
  $evidenceFile = Join-Path $evidenceDir ("dr-drill-$tsFail-fail.json")
  $evidence | ConvertTo-Json -Depth 4 | Out-File -Encoding utf8 $evidenceFile
  throw
}
finally {
  Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
}

