param(
  [Parameter(Mandatory = $true)][string]$BackupFileGz,
  [string]$DbHost = $env:DB_HOST,
  [string]$DbPort = $env:DB_PORT,
  [string]$DbUser = $env:DB_USER,
  [SecureString]$DbPasswordSecure = $null
)

if ($DbPasswordSecure) {
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($DbPasswordSecure)
  try { $DbPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
$DbPassword = if ($DbPassword) { $DbPassword } else { $env:DB_PASSWORD }

if (-not (Test-Path $BackupFileGz)) { throw "Backup file not found: $BackupFileGz" }
if (-not $DbHost -or -not $DbPort -or -not $DbUser -or -not $DbPassword) {
  throw "Missing DB connection env vars (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD)"
}

$tmpSql = Join-Path ([System.IO.Path]::GetTempPath()) ("edr-restore-" + [System.Guid]::NewGuid().ToString("N") + ".sql")

try {
  gzip -dc $BackupFileGz > $tmpSql
  if ($LASTEXITCODE -ne 0) { throw "gzip decompression failed" }

  $env:MYSQL_PWD = $DbPassword
  cmd /c "mysql --host=$DbHost --port=$DbPort --user=$DbUser < `"$tmpSql`""
  if ($LASTEXITCODE -ne 0) { throw "mysql restore failed" }

  Write-Host "Restore completed from $BackupFileGz"
}
finally {
  Remove-Item $tmpSql -ErrorAction SilentlyContinue
  Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
}

