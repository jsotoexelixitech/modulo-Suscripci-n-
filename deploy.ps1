#requires -Version 5.1
<#
.SYNOPSIS
    Despliegue profesional del proyecto Suscripcion RCV.

.DESCRIPTION
    Valida variables de entorno criticas, construye el frontend para
    produccion y levanta el sistema con PM2 (cluster) o Docker Compose
    segun lo disponible y lo elegido por parametro. Es idempotente:
    si ya hay procesos PM2, los recarga (zero-downtime cuando aplica).

.PARAMETER Mode
    Modo de despliegue: pm2 (default) | docker | static

.PARAMETER SkipBuild
    Salta la construccion del frontend (asume que dist/ esta listo).

.PARAMETER SkipInstall
    Salta npm install en server y frontend.

.PARAMETER NoFrontend
    No despliega el frontend (solo API).

.EXAMPLE
    .\deploy.ps1

.EXAMPLE
    .\deploy.ps1 -Mode pm2 -SkipBuild

.EXAMPLE
    .\deploy.ps1 -Mode docker
#>

[CmdletBinding()]
param(
    [ValidateSet('pm2', 'docker', 'static')]
    [string]$Mode = 'pm2',
    [switch]$SkipBuild,
    [switch]$SkipInstall,
    [switch]$NoFrontend
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------

function Write-Section { param([string]$Title)
    Write-Host ''
    Write-Host ('=' * 70) -ForegroundColor DarkCyan
    Write-Host (' {0}' -f $Title) -ForegroundColor Cyan
    Write-Host ('=' * 70) -ForegroundColor DarkCyan
}
function Write-Ok    { param([string]$Msg) Write-Host "[OK]    $Msg" -ForegroundColor Green }
function Write-Info  { param([string]$Msg) Write-Host "[INFO]  $Msg" -ForegroundColor Cyan }
function Write-Warn  { param([string]$Msg) Write-Host "[WARN]  $Msg" -ForegroundColor Yellow }
function Write-Err   { param([string]$Msg) Write-Host "[ERROR] $Msg" -ForegroundColor Red }

# -----------------------------------------------------------------------------
# Paths
# -----------------------------------------------------------------------------

$RootDir     = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServerDir   = Join-Path $RootDir 'server'
$FrontendDir = Join-Path $RootDir 'frontend'
$DistDir     = Join-Path $FrontendDir 'dist'
$EnvFile     = Join-Path $RootDir '.env'
$LogDir      = Join-Path $RootDir 'logs'
$Ecosystem   = Join-Path $RootDir 'ecosystem.config.js'

if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }

Set-Location $RootDir

Write-Section "Suscripcion RCV - Deploy [$Mode]"

# -----------------------------------------------------------------------------
# 1) Validacion de variables de entorno criticas
# -----------------------------------------------------------------------------

Write-Section '1/5  Validacion de .env'

if (-not (Test-Path $EnvFile)) {
    Write-Err 'No existe .env. Ejecuta primero: .\setup.ps1'
    exit 1
}

function Read-EnvFile {
    param([string]$Path)
    $map = [ordered]@{}
    if (-not (Test-Path $Path)) { return $map }
    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -match '^\s*#') { continue }
        if ($line -match '^\s*$') { continue }
        if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
            $key = $matches[1]
            $val = $matches[2].Trim().Trim('"').Trim("'")
            $map[$key] = $val
            [System.Environment]::SetEnvironmentVariable($key, $val, 'Process')
        }
    }
    return $map
}

$envMap = Read-EnvFile -Path $EnvFile

# Variables criticas por entorno de produccion
$critical = @(
    @{ Key='NODE_ENV';       MinLen=1;   Hint='Debe valer production o staging.' },
    @{ Key='PORT';           MinLen=1;   Hint='Puerto del API (ej. 3001).' },
    @{ Key='SESSION_SECRET'; MinLen=24;  Hint='Generar con setup.ps1.' },
    @{ Key='JWT_SECRET';     MinLen=24;  Hint='Generar con setup.ps1.' },
    @{ Key='CORS_ORIGINS';   MinLen=1;   Hint='Lista de origenes permitidos.' }
)

$validationErrors = New-Object System.Collections.Generic.List[string]
foreach ($c in $critical) {
    $val = if ($envMap.Contains($c.Key)) { $envMap[$c.Key] } else { '' }
    if ([string]::IsNullOrWhiteSpace($val)) {
        $validationErrors.Add("$($c.Key) esta vacio. $($c.Hint)") | Out-Null
    } elseif ($val.Length -lt $c.MinLen) {
        $validationErrors.Add("$($c.Key) es muy corto (>= $($c.MinLen) chars). $($c.Hint)") | Out-Null
    }
}

# Validacion adicional para OCR si no es mock
$ocrProvider = if ($envMap.Contains('OCR_PROVIDER')) { $envMap['OCR_PROVIDER'] } else { 'mock' }
if ($ocrProvider -eq 'openai') {
    if ([string]::IsNullOrWhiteSpace($envMap['OPENAI_API_KEY'])) {
        $validationErrors.Add('OPENAI_API_KEY requerido cuando OCR_PROVIDER=openai') | Out-Null
    }
} elseif ($ocrProvider -eq 'gemini') {
    if ([string]::IsNullOrWhiteSpace($envMap['GEMINI_API_KEY'])) {
        $validationErrors.Add('GEMINI_API_KEY requerido cuando OCR_PROVIDER=gemini') | Out-Null
    }
}

if ($validationErrors.Count -gt 0) {
    Write-Err 'Validacion de entorno fallida:'
    foreach ($e in $validationErrors) { Write-Host "  - $e" -ForegroundColor Red }
    Write-Info 'Edita .env y vuelve a ejecutar deploy.ps1'
    exit 1
}

Write-Ok 'Variables criticas OK'
Write-Host ('  NODE_ENV     = {0}' -f $envMap['NODE_ENV'])     -ForegroundColor Gray
Write-Host ('  PORT         = {0}' -f $envMap['PORT'])         -ForegroundColor Gray
Write-Host ('  OCR_PROVIDER = {0}' -f $ocrProvider)            -ForegroundColor Gray

if (($envMap['NODE_ENV']) -ne 'production') {
    Write-Warn "NODE_ENV=$($envMap['NODE_ENV']) (se recomienda 'production' en deploy)"
}

# -----------------------------------------------------------------------------
# 2) Instalacion de dependencias
# -----------------------------------------------------------------------------

Write-Section '2/5  Dependencias'

function Invoke-NpmInstall {
    param([string]$Name, [string]$Path)
    if (-not (Test-Path (Join-Path $Path 'package.json'))) {
        Write-Warn "$Name : sin package.json en $Path"
        return
    }
    Write-Info "$Name : npm ci (production-friendly)..."
    Push-Location $Path
    try {
        # npm ci respeta package-lock.json y es ideal para deploy
        if (Test-Path (Join-Path $Path 'package-lock.json')) {
            & npm ci --no-audit --no-fund --loglevel=error
        } else {
            & npm install --no-audit --no-fund --loglevel=error
        }
        if ($LASTEXITCODE -ne 0) { throw "npm install fallo en $Name" }
        Write-Ok "$Name : dependencias listas"
    } finally {
        Pop-Location
    }
}

if ($SkipInstall) {
    Write-Warn 'Salto npm install (parametro -SkipInstall)'
} else {
    Invoke-NpmInstall -Name 'server'   -Path $ServerDir
    if (-not $NoFrontend) {
        Invoke-NpmInstall -Name 'frontend' -Path $FrontendDir
    }
}

# -----------------------------------------------------------------------------
# 3) Build del frontend
# -----------------------------------------------------------------------------

Write-Section '3/5  Build de produccion'

if ($NoFrontend) {
    Write-Info 'Salto el build del frontend (-NoFrontend)'
} elseif ($SkipBuild) {
    if (-not (Test-Path $DistDir)) {
        Write-Err "No existe dist/ y se uso -SkipBuild. Quita el flag o ejecuta build manualmente."
        exit 1
    }
    Write-Warn 'Salto build (parametro -SkipBuild). Usando dist/ existente.'
} else {
    Push-Location $FrontendDir
    try {
        Write-Info 'Construyendo frontend (tsc + vite build)...'
        & npm run build
        if ($LASTEXITCODE -ne 0) { throw 'Build del frontend fallo' }
        if (-not (Test-Path $DistDir)) { throw 'El build termino pero no se genero dist/' }

        $size = (Get-ChildItem -Recurse $DistDir | Measure-Object -Property Length -Sum).Sum
        $sizeMB = [Math]::Round($size / 1MB, 2)
        Write-Ok "Build OK ($sizeMB MB en dist/)"
    } catch {
        Write-Err "Fallo el build: $($_.Exception.Message)"
        exit 1
    } finally {
        Pop-Location
    }
}

# -----------------------------------------------------------------------------
# 4) Despliegue segun modo elegido
# -----------------------------------------------------------------------------

Write-Section "4/5  Despliegue [$Mode]"

switch ($Mode) {

    'pm2' {
        if (-not (Get-Command 'pm2' -ErrorAction SilentlyContinue)) {
            Write-Err 'PM2 no instalado. Ejecuta: npm install -g pm2'
            exit 1
        }
        if (-not (Test-Path $Ecosystem)) {
            Write-Err "No se encontro ecosystem.config.js en $Ecosystem"
            exit 1
        }

        try {
            $list = & pm2 jlist 2>$null
            $hasProcesses = ($list -and $list.Trim() -ne '[]')

            if ($hasProcesses) {
                Write-Info 'PM2 ya tiene procesos. Recargando (zero-downtime)...'
                & pm2 reload $Ecosystem --env production --update-env
                if ($LASTEXITCODE -ne 0) { throw 'pm2 reload fallo' }
            } else {
                Write-Info 'Iniciando procesos en PM2 (cluster)...'
                & pm2 start $Ecosystem --env production
                if ($LASTEXITCODE -ne 0) { throw 'pm2 start fallo' }
            }

            & pm2 save 2>&1 | Out-Null
            Write-Ok 'PM2 desplegado y persistido'

            Write-Host ''
            & pm2 list
        } catch {
            Write-Err "Error en despliegue PM2: $($_.Exception.Message)"
            exit 1
        }
    }

    'docker' {
        if (-not (Get-Command 'docker' -ErrorAction SilentlyContinue)) {
            Write-Err 'Docker no instalado.'
            exit 1
        }
        $composeFile = Join-Path $RootDir 'docker-compose.yml'
        if (-not (Test-Path $composeFile)) {
            Write-Err "No existe docker-compose.yml en $composeFile"
            exit 1
        }
        Write-Info 'docker compose up -d --build...'
        & docker compose up -d --build
        if ($LASTEXITCODE -ne 0) { Write-Err 'docker compose fallo'; exit 1 }
        Write-Ok 'Stack de Docker arriba'
        & docker compose ps
    }

    'static' {
        # Solo build estatico + arranca el server con node directo (no PM2)
        if ($NoFrontend) {
            Write-Warn 'Modo static con -NoFrontend no tiene mucho sentido.'
        }
        Write-Info 'Iniciando backend con node (sin cluster)...'
        $stdout = Join-Path $LogDir 'rcv-api.out.log'
        $stderr = Join-Path $LogDir 'rcv-api.err.log'
        $proc = Start-Process -FilePath 'node' `
            -ArgumentList 'src/index.js' `
            -WorkingDirectory $ServerDir `
            -RedirectStandardOutput $stdout `
            -RedirectStandardError $stderr `
            -PassThru -WindowStyle Hidden
        Write-Ok "Backend iniciado (PID $($proc.Id))"
        Write-Info "Logs: $stdout"
        Write-Info "Sirve dist/ con tu reverse proxy (Nginx/Caddy/Cloudflare)."
    }
}

# -----------------------------------------------------------------------------
# 5) Health check y resumen final
# -----------------------------------------------------------------------------

Write-Section '5/5  Health check'

$apiPort = [int]$envMap['PORT']
$webPort = if ($envMap.Contains('PUBLIC_WEB_PORT')) { [int]$envMap['PUBLIC_WEB_PORT'] } else { 4173 }
$healthUrl = "http://localhost:$apiPort/api/health"

Write-Info "Esperando a que el API responda en $healthUrl ..."
$ok = $false
for ($i = 1; $i -le 15; $i++) {
    Start-Sleep -Seconds 1
    try {
        $resp = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($resp.StatusCode -eq 200) {
            Write-Ok "API respondio 200 OK ($i intento(s))"
            Write-Host "  Body: $($resp.Content)" -ForegroundColor DarkGray
            $ok = $true
            break
        }
    } catch {
        # silencioso, reintenta
    }
}
if (-not $ok) {
    Write-Warn 'El API no respondio en 15s. Revisa logs en logs\rcv-api.err.log'
}

Write-Section 'Despliegue finalizado'

Write-Host 'URLs:' -ForegroundColor White
Write-Host "  API health : http://localhost:$apiPort/api/health" -ForegroundColor Cyan
if (-not $NoFrontend) {
    if ($Mode -eq 'pm2' -or $Mode -eq 'docker') {
        Write-Host "  Frontend   : http://localhost:$webPort" -ForegroundColor Cyan
    } else {
        Write-Host "  Frontend   : sirve frontend\dist con tu reverse proxy" -ForegroundColor Cyan
    }
}

Write-Host ''
Write-Host 'Comandos utiles:' -ForegroundColor White
if ($Mode -eq 'pm2') {
    Write-Host '  pm2 list                  Ver procesos'           -ForegroundColor Gray
    Write-Host '  pm2 logs rcv-api          Logs API'               -ForegroundColor Gray
    Write-Host '  pm2 reload all            Zero-downtime reload'   -ForegroundColor Gray
    Write-Host '  .\stop.ps1                Detener todo'           -ForegroundColor Gray
} elseif ($Mode -eq 'docker') {
    Write-Host '  docker compose ps         Ver servicios'          -ForegroundColor Gray
    Write-Host '  docker compose logs -f    Logs'                   -ForegroundColor Gray
    Write-Host '  .\stop.ps1                Detener todo'           -ForegroundColor Gray
}

Write-Host ''
Write-Ok 'Todo listo.'
Write-Host ''
