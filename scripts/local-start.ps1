param(
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$apiDir = Join-Path $root 'apps\api'
$webDir = Join-Path $root 'apps\web'
$runLogsDir = Join-Path $root '.codex\run-logs'
$runStateDir = Join-Path $root '.codex\run-state'

New-Item -ItemType Directory -Force -Path $runLogsDir | Out-Null
New-Item -ItemType Directory -Force -Path $runStateDir | Out-Null

$apiPidFile = Join-Path $runStateDir 'api.pid'
$webPidFile = Join-Path $runStateDir 'web.pid'
$caddyPidFile = Join-Path $runStateDir 'caddy.pid'
$apiOutLog = Join-Path $runLogsDir 'api-local.out.log'
$apiErrLog = Join-Path $runLogsDir 'api-local.err.log'
$webOutLog = Join-Path $runLogsDir 'web-local.out.log'
$webErrLog = Join-Path $runLogsDir 'web-local.err.log'
$caddyOutLog = Join-Path $runLogsDir 'caddy-local.out.log'
$caddyErrLog = Join-Path $runLogsDir 'caddy-local.err.log'

$nodeExe = (Get-Command node).Source
$npmCmd = (Get-Command npm.cmd).Source
if ([string]::IsNullOrWhiteSpace($env:ADMIN_PROXY_SECRET)) {
  $env:ADMIN_PROXY_SECRET = [guid]::NewGuid().ToString('N')
}
$nextBin = Join-Path $webDir 'node_modules\next\dist\bin\next'
if (-not (Test-Path $nextBin)) {
  $nextBin = Join-Path $root 'node_modules\next\dist\bin\next'
}
$localCaddyExe = Join-Path $root 'tools\caddy\caddy.exe'
$caddyExe = if (Test-Path $localCaddyExe) {
  $localCaddyExe
} else {
  $pathCaddy = Get-Command caddy -ErrorAction SilentlyContinue
  if ($pathCaddy) { $pathCaddy.Source } else { $null }
}

function Stop-TrackedProcess {
  param([string]$PidFile)

  if (-not (Test-Path $PidFile)) {
    return
  }

  $pidLine = Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1
  $pidValue = if ($null -eq $pidLine) { '' } else { $pidLine.ToString().Trim() }
  if ([string]::IsNullOrWhiteSpace($pidValue)) {
    Remove-Item $PidFile -ErrorAction SilentlyContinue
    return
  }

  $existing = Get-Process -Id ([int]$pidValue) -ErrorAction SilentlyContinue
  if ($existing) {
    Stop-Process -Id $existing.Id -Force -ErrorAction SilentlyContinue
  }

  Remove-Item $PidFile -ErrorAction SilentlyContinue
}

function Stop-PortListeners {
  param([int[]]$Ports)

  foreach ($port in $Ports) {
    $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($listener in $listeners) {
      Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
    }
  }
}

function Wait-ForUrl {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 45
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing $Url -TimeoutSec 5
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return $true
      }
    } catch {
      Start-Sleep -Milliseconds 800
    }
  }

  return $false
}

Stop-TrackedProcess -PidFile $apiPidFile
Stop-TrackedProcess -PidFile $webPidFile
Stop-TrackedProcess -PidFile $caddyPidFile
Stop-PortListeners -Ports @(3000, 3001)

if (-not $SkipBuild) {
  Write-Host 'Building workspace...'
  & $npmCmd 'run' 'build'
  if ($LASTEXITCODE -ne 0) {
    throw 'Build failed. App was not started.'
  }
}

Remove-Item $apiOutLog, $apiErrLog, $webOutLog, $webErrLog, $caddyOutLog, $caddyErrLog -ErrorAction SilentlyContinue

$apiProcess = Start-Process -FilePath $nodeExe `
  -ArgumentList 'dist/main.js' `
  -WorkingDirectory $apiDir `
  -RedirectStandardOutput $apiOutLog `
  -RedirectStandardError $apiErrLog `
  -PassThru

$webProcess = Start-Process -FilePath $nodeExe `
  -ArgumentList $nextBin, 'start', '--port', '3001' `
  -WorkingDirectory $webDir `
  -RedirectStandardOutput $webOutLog `
  -RedirectStandardError $webErrLog `
  -PassThru

Set-Content -Path $apiPidFile -Value $apiProcess.Id
Set-Content -Path $webPidFile -Value $webProcess.Id

$apiReady = Wait-ForUrl -Url 'http://localhost:3000/health'
$webReady = Wait-ForUrl -Url 'http://localhost:3001'
$caddyReady = $false
$caddyStarted = $false

if ($caddyExe) {
  $caddyProcess = Start-Process -FilePath $caddyExe `
    -ArgumentList 'run', '--config', (Join-Path $root 'Caddyfile'), '--adapter', 'caddyfile' `
    -WorkingDirectory $root `
    -RedirectStandardOutput $caddyOutLog `
    -RedirectStandardError $caddyErrLog `
    -PassThru

  Set-Content -Path $caddyPidFile -Value $caddyProcess.Id
  $caddyStarted = $true
  $caddyReady = Wait-ForUrl -Url 'http://localhost' -TimeoutSeconds 20
} else {
  Write-Host 'Caddy was not found on PATH; starting the local Node reverse proxy instead.' -ForegroundColor Yellow
  $proxyProcess = Start-Process -FilePath $nodeExe `
    -ArgumentList (Join-Path $root 'scripts\reverse-proxy.js') `
    -WorkingDirectory $root `
    -RedirectStandardOutput $caddyOutLog `
    -RedirectStandardError $caddyErrLog `
    -PassThru

  Set-Content -Path $caddyPidFile -Value $proxyProcess.Id
  $caddyStarted = $true
  $caddyReady = Wait-ForUrl -Url 'http://localhost' -TimeoutSeconds 20
}

if (-not $apiReady -or -not $webReady -or ($caddyStarted -and -not $caddyReady)) {
  Write-Host ''
  Write-Host 'Startup failed.' -ForegroundColor Red
  if (Test-Path $apiErrLog) {
    Write-Host ''
    Write-Host 'API error log:' -ForegroundColor Yellow
    Get-Content $apiErrLog -Tail 40
  }
  if (Test-Path $webErrLog) {
    Write-Host ''
    Write-Host 'Web error log:' -ForegroundColor Yellow
    Get-Content $webErrLog -Tail 40
  }
  if (Test-Path $caddyErrLog) {
    Write-Host ''
    Write-Host 'Caddy error log:' -ForegroundColor Yellow
    Get-Content $caddyErrLog -Tail 40
  }
  throw 'One or more services failed to become ready.'
}

Write-Host ''
Write-Host 'Vishu local app is running.' -ForegroundColor Green
if ($caddyStarted) {
  Write-Host "Web: http://localhost"
}
Write-Host "Web direct: http://localhost:3001"
Write-Host "API: http://localhost:3000"
Write-Host "Health: http://localhost:3000/health"
Write-Host "Logs: $runLogsDir"
