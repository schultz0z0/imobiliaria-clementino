param(
  [Parameter(Mandatory = $true)]
  [string]$BundleDirectory
)

$ErrorActionPreference = 'Stop'
$bundle = [System.IO.Path]::GetFullPath($BundleDirectory)
$complete = Join-Path $bundle 'COMPLETE'
$manifestPath = Join-Path $bundle 'manifest.json'
if (-not (Test-Path -LiteralPath $complete -PathType Leaf)) { throw 'COMPLETE marker is missing.' }
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw 'manifest.json is missing.' }
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($manifest.version -ne 1) { throw "Unsupported manifest version: $($manifest.version)" }

foreach ($artifactName in @('database', 'media', 'release')) {
  $artifact = $manifest.artifacts.$artifactName
  $artifactPath = Join-Path $bundle $artifact.path
  $item = Get-Item -LiteralPath $artifactPath
  if ($item.Length -ne [int64]$artifact.size) { throw "Artifact size mismatch: $($artifact.path)" }
  $hash = (Get-FileHash -LiteralPath $artifactPath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($hash -ne $artifact.sha256) { throw "Artifact checksum mismatch: $($artifact.path)" }
}

$suffix = [guid]::NewGuid().ToString('N').Substring(0, 12)
$container = "clementino-migration-validation-$suffix"
$databaseVolume = "clementino_migration_validation_db_$suffix"
$mediaVolume = "clementino_migration_validation_media_$suffix"
$releaseVolume = "clementino_migration_validation_release_$suffix"
$createdVolumes = New-Object System.Collections.Generic.List[string]
$containerCreated = $false

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

try {
  Write-Host 'Creating disposable Docker volumes.'
  foreach ($volume in @($databaseVolume, $mediaVolume, $releaseVolume)) {
    Invoke-Docker 'volume' 'create' $volume *> $null
    $createdVolumes.Add($volume)
  }
  Invoke-Docker 'run' '-d' '--name' $container `
    '-e' 'POSTGRES_DB=validation' '-e' 'POSTGRES_USER=validation' '-e' 'POSTGRES_PASSWORD=validation' `
    '-v' "${databaseVolume}:/var/lib/postgresql/data" 'postgres:16-alpine' *> $null
  $containerCreated = $true

  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    & docker 'exec' $container 'pg_isready' '-U' 'validation' '-d' 'validation' *> $null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) { throw 'Disposable PostgreSQL did not become ready.' }

  Write-Host 'Restoring and checking the disposable PostgreSQL database.'
  Invoke-Docker 'cp' (Join-Path $bundle 'database.dump') "${container}:/tmp/database.dump"
  Invoke-Docker 'exec' $container 'pg_restore' '-U' 'validation' '-d' 'validation' '--clean' '--if-exists' '--no-owner' '--no-acl' '--exit-on-error' '/tmp/database.dump'
  $databaseCounts = Invoke-DockerText 'exec' $container 'psql' '-U' 'validation' '-d' 'validation' '-At' '-F' '|' '-c' @'
SELECT
  (SELECT count(*) FROM properties),
  (SELECT count(*) FROM properties WHERE status = 'published'),
  (SELECT count(*) FROM properties WHERE status = 'inactive'),
  (SELECT count(*) FROM admin_users),
  (SELECT count(*) FROM property_media);
'@
  $expectedDatabaseCounts = "$($manifest.counts.properties)|$($manifest.counts.publishedProperties)|$($manifest.counts.inactiveProperties)|$($manifest.counts.adminUsers)|$($manifest.counts.mediaRecords)"
  if ($databaseCounts -ne $expectedDatabaseCounts) { throw "Database count mismatch: $databaseCounts" }

  Write-Host 'Restoring and counting disposable media and release volumes.'
  Invoke-Docker 'run' '--rm' '-v' "${mediaVolume}:/target" '-v' "${bundle}:/bundle:ro" 'postgres:16-alpine' 'tar' '-xzf' '/bundle/media.tar.gz' '-C' '/target'
  Invoke-Docker 'run' '--rm' '-v' "${releaseVolume}:/target" '-v' "${bundle}:/bundle:ro" 'postgres:16-alpine' 'tar' '-xzf' '/bundle/release.tar.gz' '-C' '/target'
  $privateFiles = [int](Invoke-DockerText 'run' '--rm' '-v' "${mediaVolume}:/source:ro" 'postgres:16-alpine' 'sh' '-c' 'find /source/private -type f | wc -l')
  $publicFiles = [int](Invoke-DockerText 'run' '--rm' '-v' "${mediaVolume}:/source:ro" 'postgres:16-alpine' 'sh' '-c' 'find /source/public -type f | wc -l')
  if ($privateFiles -ne [int]$manifest.counts.privateMediaFiles) { throw "Private media count mismatch: $privateFiles" }
  if ($publicFiles -ne [int]$manifest.counts.publicMediaFiles) { throw "Public media count mismatch: $publicFiles" }
  Invoke-Docker 'run' '--rm' '-v' "${releaseVolume}:/source:ro" 'postgres:16-alpine' 'sh' '-ceu' 'test -e /source/current/release-manifest.json'

  Write-Host "Disposable restore validated: database=$databaseCounts private=$privateFiles public=$publicFiles"
}
finally {
  if ($containerCreated) { & docker 'rm' '-f' $container *> $null }
  foreach ($volume in $createdVolumes) {
    $existing = (& docker 'volume' 'inspect' '--format' '{{.Name}}' $volume 2>$null | Out-String).Trim()
    if ($existing -eq $volume) { & docker 'volume' 'rm' $volume *> $null }
  }
}
