$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$runStateDir = Join-Path $root '.codex\run-state'
$apiPidFile = Join-Path $runStateDir 'api.pid'
$webPidFile = Join-Path $runStateDir 'web.pid'

function Read-PidValue {
  param([string]$PidFile)

  if (-not (Test-Path $PidFile)) {
    return $null
  }

  $value = (Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1).Trim()
  if (-not $value) {
    return $null
  }

  return [int]$value
}

function Test-Url {
  param([string]$Url)

  try {
    $response = Invoke-WebRequest -UseBasicParsing $Url -TimeoutSec 5
    return "OK ($($response.StatusCode))"
  } catch {
    return 'DOWN'
  }
}

function Resolve-PortPid {
  param([int]$Port)

  try {
    $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop |
      Select-Object -First 1
    if ($connection -and $connection.OwningProcess) {
      return [int]$connection.OwningProcess
    }
  } catch {
    return $null
  }

  return $null
}

$apiPid = Read-PidValue -PidFile $apiPidFile
$webPid = Read-PidValue -PidFile $webPidFile

$apiResolvedPid = $apiPid
$webResolvedPid = $webPid

$apiProcess = if ($apiResolvedPid) { Get-Process -Id $apiResolvedPid -ErrorAction SilentlyContinue } else { $null }
$webProcess = if ($webResolvedPid) { Get-Process -Id $webResolvedPid -ErrorAction SilentlyContinue } else { $null }

if (-not $apiProcess) {
  $apiResolvedPid = Resolve-PortPid -Port 3000
  $apiProcess = if ($apiResolvedPid) { Get-Process -Id $apiResolvedPid -ErrorAction SilentlyContinue } else { $null }
}

if (-not $webProcess) {
  $webResolvedPid = Resolve-PortPid -Port 3001
  $webProcess = if ($webResolvedPid) { Get-Process -Id $webResolvedPid -ErrorAction SilentlyContinue } else { $null }
}

$apiPidLabel = if ($apiProcess) { $apiProcess.Id } else { 'not running' }
$webPidLabel = if ($webProcess) { $webProcess.Id } else { 'not running' }

if (($apiResolvedPid -ne $apiPid) -and $apiProcess) {
  $apiPidLabel = "$apiPidLabel (detected by port)"
}

if (($webResolvedPid -ne $webPid) -and $webProcess) {
  $webPidLabel = "$webPidLabel (detected by port)"
}

Write-Host "API PID: $apiPidLabel"
Write-Host "WEB PID: $webPidLabel"
Write-Host "API health: $(Test-Url -Url 'http://localhost:3000/health')"
Write-Host "WEB health: $(Test-Url -Url 'http://localhost:3001')"
