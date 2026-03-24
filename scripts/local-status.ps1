$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$runStateDir = Join-Path $root '.codex\run-state'
$apiPidFile = Join-Path $runStateDir 'api.pid'
$webPidFile = Join-Path $runStateDir 'web.pid'
$proxyPidFile = Join-Path $runStateDir 'proxy.pid'

$nodeExe = (Get-Command node).Source

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

function Test-Redirect {
  param([string]$Url)

  try {
    Invoke-WebRequest -UseBasicParsing $Url -MaximumRedirection 0 -TimeoutSec 5 | Out-Null
    return 'OK'
  } catch {
    if ($_.Exception.Response) {
      return "OK ($([int]$_.Exception.Response.StatusCode))"
    }

    return 'DOWN'
  }
}

function Test-HttpsUrl {
  param([string]$TargetHost = 'localhost')

  $script = "require('https').get({host:'$TargetHost',port:443,rejectUnauthorized:false},res=>{console.log('OK (' + res.statusCode + ')');res.resume();}).on('error',()=>{console.log('DOWN');process.exit(0);});"
  $result = & $nodeExe -e $script
  if (-not $result) {
    return 'DOWN'
  }

  return ($result | Select-Object -First 1).Trim()
}

$apiPid = Read-PidValue -PidFile $apiPidFile
$webPid = Read-PidValue -PidFile $webPidFile
$proxyPid = Read-PidValue -PidFile $proxyPidFile

$apiProcess = if ($apiPid) { Get-Process -Id $apiPid -ErrorAction SilentlyContinue } else { $null }
$webProcess = if ($webPid) { Get-Process -Id $webPid -ErrorAction SilentlyContinue } else { $null }
$proxyProcess = if ($proxyPid) { Get-Process -Id $proxyPid -ErrorAction SilentlyContinue } else { $null }
$apiPidLabel = if ($apiProcess) { $apiProcess.Id } else { 'not running' }
$webPidLabel = if ($webProcess) { $webProcess.Id } else { 'not running' }
$proxyPidLabel = if ($proxyProcess) { $proxyProcess.Id } else { 'not running' }

Write-Host "API PID: $apiPidLabel"
Write-Host "WEB PID: $webPidLabel"
Write-Host "PROXY PID: $proxyPidLabel"
Write-Host "API health: $(Test-Url -Url 'http://localhost:3000/health')"
Write-Host "WEB health: $(Test-Url -Url 'http://localhost:3001')"
Write-Host "HTTP redirect: $(Test-Redirect -Url 'http://vishu.shop')"
Write-Host "HTTPS health: $(Test-HttpsUrl -TargetHost 'vishu.shop')"
