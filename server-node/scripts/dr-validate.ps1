param(
  [Parameter(Mandatory = $true)][string]$BackupFileGz,
  [string]$ChecksumFile = "",
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
if ($ChecksumFile -and -not (Test-Path $ChecksumFile)) { throw "Checksum file not found: $ChecksumFile" }
if (-not $DbHost -or -not $DbPort -or -not $DbUser -or -not $DbPassword) {
  throw "Missing DB connection env vars (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD)"
}

$tmpDb = "edr_dr_validate_" + [System.Guid]::NewGuid().ToString("N").Substring(0, 8)
$tmpSql = Join-Path ([System.IO.Path]::GetTempPath()) ("edr-dr-" + [System.Guid]::NewGuid().ToString("N") + ".sql")

try {
  if ($ChecksumFile) {
    $expected = (Get-Content -Path $ChecksumFile -TotalCount 1).Split(" ")[0].Trim().ToUpperInvariant()
    $actual = (Get-FileHash -Algorithm SHA256 -Path $BackupFileGz).Hash.Trim().ToUpperInvariant()
    if (-not $expected -or $expected -ne $actual) {
      throw "Checksum validation failed"
    }
  }

  gzip -dc $BackupFileGz > $tmpSql
  if ($LASTEXITCODE -ne 0) { throw "gzip decompression failed" }

  $env:MYSQL_PWD = $DbPassword
  & mysql --host=$DbHost --port=$DbPort --user=$DbUser -e "CREATE DATABASE $tmpDb;"
  if ($LASTEXITCODE -ne 0) { throw "create temp db failed" }

  cmd /c "mysql --host=$DbHost --port=$DbPort --user=$DbUser $tmpDb < `"$tmpSql`""
  if ($LASTEXITCODE -ne 0) { throw "restore to temp db failed" }

  & mysql --host=$DbHost --port=$DbPort --user=$DbUser -D $tmpDb -e "SELECT COUNT(*) AS tables_count FROM information_schema.tables WHERE table_schema = '$tmpDb';"
  if ($LASTEXITCODE -ne 0) { throw "validation query failed" }

  Write-Host "DR validation succeeded using temp db: $tmpDb"
}
finally {
  if ($DbHost -and $DbPort -and $DbUser -and $DbPassword -and $tmpDb) {
    $env:MYSQL_PWD = $DbPassword
    & mysql --host=$DbHost --port=$DbPort --user=$DbUser -e "DROP DATABASE IF EXISTS $tmpDb;" | Out-Null
  }
  Remove-Item $tmpSql -ErrorAction SilentlyContinue
  Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
}

