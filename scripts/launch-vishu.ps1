param(
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host 'Starting Vishu...' -ForegroundColor Cyan

$npmCmd = (Get-Command npm.cmd).Source
$startCommand = if ($SkipBuild) { 'local:start-fast' } else { 'local:start' }

& $npmCmd 'run' $startCommand
if ($LASTEXITCODE -ne 0) {
  throw "Failed to start Vishu with '$startCommand'."
}

$launchUrl = 'https://vishu.shop'

Start-Process $launchUrl

Write-Host ''
Write-Host "Vishu is ready at $launchUrl" -ForegroundColor Green
