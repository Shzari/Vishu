$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$runStateDir = Join-Path $root '.codex\run-state'
$apiPidFile = Join-Path $runStateDir 'api.pid'
$webPidFile = Join-Path $runStateDir 'web.pid'

function Stop-TrackedProcess {
  param([string]$PidFile)

  if (-not (Test-Path $PidFile)) {
    return
  }

  $pidValue = (Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1).Trim()
  if ($pidValue) {
    Stop-Process -Id ([int]$pidValue) -Force -ErrorAction SilentlyContinue
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

Stop-TrackedProcess -PidFile $apiPidFile
Stop-TrackedProcess -PidFile $webPidFile
Stop-PortListeners -Ports @(3000, 3001)

Write-Host 'Stopped local Vishu services.'
