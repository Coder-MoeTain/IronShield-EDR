param(
  [string]$OutDir = ".\backups",
  [string]$DbHost = $env:DB_HOST,
  [string]$DbPort = $env:DB_PORT,
  [string]$DbUser = $env:DB_USER,
  [SecureString]$DbPasswordSecure = $null,
  [string]$DbName = $env:DB_NAME
)

if ($DbPasswordSecure) {
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($DbPasswordSecure)
  try { $DbPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
$DbPassword = if ($DbPassword) { $DbPassword } else { $env:DB_PASSWORD }

if (-not $DbHost -or -not $DbPort -or -not $DbUser -or -not $DbPassword -or -not $DbName) {
  throw "Missing DB connection env vars (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME)"
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$base = Join-Path $OutDir "$DbName-$ts.sql"
$gz = "$base.gz"
$sha = "$gz.sha256"

$env:MYSQL_PWD = $DbPassword
try {
  & mysqldump --host=$DbHost --port=$DbPort --user=$DbUser --databases $DbName --single-transaction --routines --triggers --events > $base
  if ($LASTEXITCODE -ne 0) { throw "mysqldump failed" }
  gzip -f $base
  if ($LASTEXITCODE -ne 0) { throw "gzip failed" }
  $hash = Get-FileHash -Algorithm SHA256 -Path $gz
  "$($hash.Hash)  $([System.IO.Path]::GetFileName($gz))" | Out-File -Encoding ascii $sha
  Write-Host "Backup created: $gz"
  Write-Host "Checksum file: $sha"
}
finally {
  Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
}

