param(
  [string]$PublicHost = '16.16.77.194',
  [string]$CertName = 'Vishu Self-Signed SSL'
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$certDir = Join-Path $root '.codex\certs'
$pfxPath = Join-Path $certDir 'vishu-selfsigned.pfx'
$cerPath = Join-Path $certDir 'vishu-selfsigned.cer'
$passwordPath = Join-Path $certDir 'vishu-selfsigned.password.txt'

New-Item -ItemType Directory -Force -Path $certDir | Out-Null

$plainPassword = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
$securePassword = ConvertTo-SecureString -String $plainPassword -AsPlainText -Force

$dnsNames = @('localhost', $env:COMPUTERNAME)
if ($PublicHost) {
  $dnsNames += $PublicHost
}

$certificate = New-SelfSignedCertificate `
  -DnsName $dnsNames `
  -CertStoreLocation 'Cert:\LocalMachine\My' `
  -FriendlyName $CertName `
  -NotAfter (Get-Date).AddYears(2) `
  -KeyAlgorithm RSA `
  -KeyLength 2048 `
  -HashAlgorithm 'SHA256'

Export-PfxCertificate -Cert $certificate -FilePath $pfxPath -Password $securePassword | Out-Null
Export-Certificate -Cert $certificate -FilePath $cerPath | Out-Null
Set-Content -Path $passwordPath -Value $plainPassword

Write-Host 'SSL certificate created.' -ForegroundColor Green
Write-Host "PFX: $pfxPath"
Write-Host "CER: $cerPath"
Write-Host "Password file: $passwordPath"
