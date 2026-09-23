param([switch]$SkipInstall)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
function Run-Npm {
  & npm.cmd @args
  if ($LASTEXITCODE -ne 0) { throw "npm falló: $($args -join ' ')" }
}
if (!(Test-Path .env)) {
  $secret = [Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')
  (Get-Content .env.example -Raw).Replace('cambie_esta_clave_por_una_muy_segura', $secret) | Set-Content .env
}
& docker info *> $null
if ($LASTEXITCODE -ne 0) { throw 'Abra Docker Desktop. Si WSL2 acaba de instalarse, reinicie Windows; si persiste, active virtualización en BIOS/UEFI.' }
if (!$SkipInstall) { Run-Npm ci }
Run-Npm run infra:up
& docker compose up -d --wait postgres minio
if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL o MinIO no están disponibles.' }
Run-Npm run db:generate
Run-Npm run db:migrate
Run-Npm run db:seed
Write-Host 'Web: http://localhost:3000 | API: http://localhost:4000/api/health/ready'
Run-Npm run dev
