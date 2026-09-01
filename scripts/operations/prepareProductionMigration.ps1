param(
  [Parameter(Mandatory = $false)]
  [string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $scriptDirectory '..\..'))
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
  $OutputDirectory = Join-Path (Split-Path -Parent $repositoryRoot) "Imobiliaria Clementino-migration-$timestamp"
}

$outputPath = [System.IO.Path]::GetFullPath($OutputDirectory)
$repositoryPrefix = $repositoryRoot.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
if ($outputPath -eq $repositoryRoot -or $outputPath.StartsWith($repositoryPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw 'The migration output cannot be the repository root or a directory inside the repository root.'
}
if ($outputPath -eq [System.IO.Path]::GetPathRoot($outputPath)) {
  throw 'The migration output cannot be a drive root.'
}
if (Test-Path -LiteralPath $outputPath) {
  throw "The migration output already exists: $outputPath"
}

$partialPath = "$outputPath.partial-$([guid]::NewGuid().ToString('N'))"
$composeArguments = @('compose', '-f', (Join-Path $repositoryRoot 'compose.dev.yaml'))
$postgresWasRunning = $false
$postgresContainer = $null
$containerDump = '/tmp/clementino-production-state.dump'

function Invoke-Docker {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  & docker @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Docker command failed with exit code $LASTEXITCODE" }
}

function Invoke-DockerText {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  $result = & docker @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Docker command failed with exit code $LASTEXITCODE" }
  return (($result | Out-String).Trim())
}

function Get-Artifact {
  param([string]$Directory, [string]$FileName)
  $file = Join-Path $Directory $FileName
  $item = Get-Item -LiteralPath $file
  if ($item.Length -lt 1) { throw "Empty migration artifact: $FileName" }
  return [ordered]@{
    path = $FileName
    size = [int64]$item.Length
    sha256 = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
  }
}

try {
  Invoke-Docker info *> $null
  New-Item -ItemType Directory -Path $partialPath | Out-Null

  $postgresContainer = Invoke-DockerText @composeArguments 'ps' '-a' '-q' 'postgres'
  if ($postgresContainer) {
    $postgresWasRunning = (Invoke-DockerText 'inspect' '--format' '{{.State.Running}}' $postgresContainer) -eq 'true'
  }
  if (-not $postgresWasRunning) {
    Invoke-Docker @composeArguments 'up' '-d' 'postgres'
  }
  $postgresContainer = Invoke-DockerText @composeArguments 'ps' '-q' 'postgres'
  if (-not $postgresContainer) { throw 'The local PostgreSQL container is unavailable.' }
  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    & docker @composeArguments 'exec' '-T' 'postgres' 'pg_isready' '-U' 'clementino_dev' '-d' 'clementino_dev' *> $null
    if ($LASTEXITCODE -eq 0) {
      $ready = $true
      break
    }
    Start-Sleep -Seconds 2
  }
  if (-not $ready) { throw 'The local PostgreSQL container did not become ready within 60 seconds.' }

  $countsText = Invoke-DockerText @composeArguments 'exec' '-T' 'postgres' 'psql' '-U' 'clementino_dev' '-d' 'clementino_dev' '-At' '-F' '|' '-c' @'
SELECT
  (SELECT count(*) FROM properties),
  (SELECT count(*) FROM properties WHERE status = 'published'),
  (SELECT count(*) FROM properties WHERE status = 'inactive'),
  (SELECT count(*) FROM admin_users),
  (SELECT count(*) FROM property_media);
'@
  $databaseCounts = $countsText.Split('|')
  if ($databaseCounts.Count -ne 5) { throw "Unexpected PostgreSQL count output: $countsText" }

  Invoke-Docker @composeArguments 'exec' '-T' 'postgres' 'pg_dump' '-U' 'clementino_dev' '-d' 'clementino_dev' '--format=custom' '--no-owner' '--no-acl' "--file=$containerDump"
  Invoke-Docker 'cp' "${postgresContainer}:${containerDump}" (Join-Path $partialPath 'database.dump')
  Invoke-Docker @composeArguments 'exec' '-T' 'postgres' 'rm' '-f' $containerDump

  foreach ($volume in @(
    'imobiliaria-clementino-dev_dev_media_private',
    'imobiliaria-clementino-dev_dev_media_public',
    'imobiliaria-clementino-dev_dev_releases'
  )) {
    Invoke-Docker 'volume' 'inspect' $volume *> $null
  }

  Invoke-Docker 'run' '--rm' `
    '-v' 'imobiliaria-clementino-dev_dev_media_private:/source/private:ro' `
    '-v' 'imobiliaria-clementino-dev_dev_media_public:/source/public:ro' `
    '-v' "${partialPath}:/bundle" `
    'postgres:16-alpine' 'tar' '-czf' '/bundle/media.tar.gz' '-C' '/source' 'private' 'public'
  Invoke-Docker 'run' '--rm' `
    '-v' 'imobiliaria-clementino-dev_dev_releases:/source:ro' `
    '-v' "${partialPath}:/bundle" `
    'postgres:16-alpine' 'tar' '-czf' '/bundle/release.tar.gz' '-C' '/source' '.'

  $privateMediaFiles = [int](Invoke-DockerText 'run' '--rm' '-v' 'imobiliaria-clementino-dev_dev_media_private:/source:ro' 'postgres:16-alpine' 'sh' '-c' 'find /source -type f | wc -l')
  $publicMediaFiles = [int](Invoke-DockerText 'run' '--rm' '-v' 'imobiliaria-clementino-dev_dev_media_public:/source:ro' 'postgres:16-alpine' 'sh' '-c' 'find /source -type f | wc -l')

  $manifest = [ordered]@{
    version = 1
    createdAt = (Get-Date).ToUniversalTime().ToString('o')
    counts = [ordered]@{
      properties = [int]$databaseCounts[0]
      publishedProperties = [int]$databaseCounts[1]
      inactiveProperties = [int]$databaseCounts[2]
      adminUsers = [int]$databaseCounts[3]
      mediaRecords = [int]$databaseCounts[4]
      privateMediaFiles = $privateMediaFiles
      publicMediaFiles = $publicMediaFiles
    }
    artifacts = [ordered]@{
      database = Get-Artifact $partialPath 'database.dump'
      media = Get-Artifact $partialPath 'media.tar.gz'
      release = Get-Artifact $partialPath 'release.tar.gz'
    }
  }
  $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText(
    (Join-Path $partialPath 'manifest.json'),
    ($manifest | ConvertTo-Json -Depth 8),
    $utf8WithoutBom
  )

  $checksumLines = @(
    "$($manifest.artifacts.database.sha256)  database.dump"
    "$($manifest.artifacts.media.sha256)  media.tar.gz"
    "$($manifest.artifacts.release.sha256)  release.tar.gz"
  )
  [System.IO.File]::WriteAllText((Join-Path $partialPath 'SHA256SUMS'), (($checksumLines -join "`n") + "`n"), [System.Text.Encoding]::ASCII)
  [System.IO.File]::WriteAllText((Join-Path $partialPath 'COMPLETE'), "complete`n", [System.Text.Encoding]::ASCII)

  Move-Item -LiteralPath $partialPath -Destination $outputPath
  $partialPath = $null
  Write-Host "Migration bundle created: $outputPath"
  Write-Host ($manifest.counts | ConvertTo-Json -Compress)
}
finally {
  if ($postgresContainer) {
    & docker @composeArguments 'exec' '-T' 'postgres' 'rm' '-f' $containerDump *> $null
  }
  if (-not $postgresWasRunning -and $postgresContainer) {
    & docker @composeArguments 'stop' 'postgres' *> $null
  }
  if ($partialPath -and (Test-Path -LiteralPath $partialPath)) {
    $resolvedPartial = [System.IO.Path]::GetFullPath($partialPath)
    if ($resolvedPartial.StartsWith(($outputPath + '.partial-'), [System.StringComparison]::OrdinalIgnoreCase)) {
      Remove-Item -LiteralPath $resolvedPartial -Recurse -Force
    }
  }
}
