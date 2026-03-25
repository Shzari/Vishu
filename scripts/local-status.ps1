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

$apiPid = Read-PidValue -PidFile $apiPidFile
$webPid = Read-PidValue -PidFile $webPidFile

$apiProcess = if ($apiPid) { Get-Process -Id $apiPid -ErrorAction SilentlyContinue } else { $null }
$webProcess = if ($webPid) { Get-Process -Id $webPid -ErrorAction SilentlyContinue } else { $null }
$apiPidLabel = if ($apiProcess) { $apiProcess.Id } else { 'not running' }
$webPidLabel = if ($webProcess) { $webProcess.Id } else { 'not running' }

Write-Host "API PID: $apiPidLabel"
Write-Host "WEB PID: $webPidLabel"
Write-Host "API health: $(Test-Url -Url 'http://localhost:3000/health')"
Write-Host "WEB health: $(Test-Url -Url 'http://localhost:3001')"
