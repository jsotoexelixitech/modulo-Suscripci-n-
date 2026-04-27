#requires -Version 5.1
<#
.SYNOPSIS
    Inicia el entorno de desarrollo (backend + frontend) en ventanas separadas.

.DESCRIPTION
    Verifica que los servicios de infraestructura (si aplica) esten corriendo.
    Si no lo estan, los arranca con docker compose. Lanza el backend (Express)
    y el frontend (Vite) en ventanas de PowerShell separadas y visibles.
    Es idempotente: si los servicios ya estan corriendo, no los duplica.

.PARAMETER NoFrontend
    Inicia solo el backend.

.PARAMETER NoBackend
    Inicia solo el frontend.

.PARAMETER Quiet
    No abre nuevas ventanas, ejecuta procesos en background ocultos.

.EXAMPLE
    .\start-dev.ps1

.EXAMPLE
    .\start-dev.ps1 -NoFrontend
#>

[CmdletBinding()]
param(
    [switch]$NoFrontend,
    [switch]$NoBackend,
    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# -----------------------------------------------------------------------------
# Helpers de logging
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
$EnvFile     = Join-Path $RootDir '.env'
$LogDir      = Join-Path $RootDir 'logs'

if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }

Set-Location $RootDir

# -----------------------------------------------------------------------------
# Carga de .env (inyecta variables al proceso actual)
# -----------------------------------------------------------------------------

function Import-DotEnv {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return @{} }
    $map = [ordered]@{}
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

Write-Section 'Suscripcion RCV - Modo Desarrollo'

if (-not (Test-Path $EnvFile)) {
    Write-Warn 'No existe .env. Ejecuta primero: .\setup.ps1'
    Write-Info 'Continuando con valores por defecto...'
    $env = @{}
} else {
    $env = Import-DotEnv -Path $EnvFile
    Write-Ok '.env cargado'
}

$apiPort = if ($env.Contains('PORT'))            { $env['PORT'] }            else { '3001' }
$webPort = if ($env.Contains('VITE_DEV_PORT'))   { $env['VITE_DEV_PORT'] }   else { '5173' }

# -----------------------------------------------------------------------------
# Verificacion de prerequisitos minimos
# -----------------------------------------------------------------------------

if (-not (Get-Command 'node' -ErrorAction SilentlyContinue)) {
    Write-Err 'Node.js no esta instalado. Ejecuta primero .\setup.ps1'
    exit 1
}

if (-not (Test-Path (Join-Path $ServerDir 'node_modules'))) {
    Write-Err 'No hay node_modules en server/. Ejecuta primero .\setup.ps1'
    exit 1
}

if (-not (Test-Path (Join-Path $FrontendDir 'node_modules'))) {
    Write-Err 'No hay node_modules en frontend/. Ejecuta primero .\setup.ps1'
    exit 1
}

# -----------------------------------------------------------------------------
# Servicios de infraestructura (docker compose si existe)
# -----------------------------------------------------------------------------

$composeFile = Join-Path $RootDir 'docker-compose.yml'
if (Test-Path $composeFile) {
    if (Get-Command 'docker' -ErrorAction SilentlyContinue) {
        Write-Info 'Verificando servicios docker compose...'
        try {
            $running = & docker compose ps --status running 2>$null
            if ($LASTEXITCODE -ne 0 -or -not $running) {
                Write-Info 'Levantando servicios docker compose...'
                & docker compose up -d
                Write-Ok 'Servicios de infraestructura arriba'
            } else {
                Write-Ok 'Servicios docker compose ya estaban corriendo'
            }
        } catch {
            Write-Warn "No se pudo verificar docker: $($_.Exception.Message)"
        }
    } else {
        Write-Warn 'Docker no instalado. Saltando docker compose.'
    }
}

# -----------------------------------------------------------------------------
# Verificacion de puertos en uso
# -----------------------------------------------------------------------------

function Test-PortInUse {
    param([int]$Port)
    try {
        $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        return ($conns | Measure-Object).Count -gt 0
    } catch {
        return $false
    }
}

if (-not $NoBackend -and (Test-PortInUse -Port ([int]$apiPort))) {
    Write-Warn "El puerto $apiPort ya esta en uso. El backend podria fallar al iniciar."
    Write-Info 'Sugerencia: ejecuta .\stop.ps1 antes para liberar puertos.'
}

if (-not $NoFrontend -and (Test-PortInUse -Port ([int]$webPort))) {
    Write-Warn "El puerto $webPort ya esta en uso. Vite puede asignar otro automaticamente."
}

# -----------------------------------------------------------------------------
# Lanzamiento de procesos
# -----------------------------------------------------------------------------

function Start-DevWindow {
    param(
        [string]$Title,
        [string]$WorkingDirectory,
        [string]$NpmScript,
        [string]$LogFile
    )

    $cmd = @(
        "`$Host.UI.RawUI.WindowTitle = '$Title'",
        "Set-Location -LiteralPath '$WorkingDirectory'",
        "Write-Host '=== $Title ===' -ForegroundColor Cyan",
        "npm run $NpmScript"
    ) -join '; '

    if ($Quiet) {
        # Modo background: redirige logs a archivo
        $stdout = Join-Path $LogDir "$LogFile.out.log"
        $stderr = Join-Path $LogDir "$LogFile.err.log"
        $proc = Start-Process -FilePath 'powershell' `
            -ArgumentList '-NoProfile', '-NonInteractive', '-Command', $cmd `
            -WorkingDirectory $WorkingDirectory `
            -RedirectStandardOutput $stdout `
            -RedirectStandardError $stderr `
            -PassThru -WindowStyle Hidden
        Write-Ok "$Title iniciado en background (PID $($proc.Id))"
        Write-Info "  stdout -> $stdout"
        Write-Info "  stderr -> $stderr"
    } else {
        $proc = Start-Process -FilePath 'powershell' `
            -ArgumentList '-NoExit', '-NoProfile', '-Command', $cmd `
            -WorkingDirectory $WorkingDirectory `
            -PassThru -WindowStyle Normal
        Write-Ok "$Title abierto en nueva ventana (PID $($proc.Id))"
    }

    return $proc
}

$started = New-Object System.Collections.Generic.List[object]

if (-not $NoBackend) {
    try {
        $backend = Start-DevWindow `
            -Title 'RCV Backend (Express)' `
            -WorkingDirectory $ServerDir `
            -NpmScript 'dev' `
            -LogFile 'backend-dev'
        $started.Add(@{ name='backend'; pid=$backend.Id; port=$apiPort })
    } catch {
        Write-Err "Fallo al iniciar el backend: $($_.Exception.Message)"
    }
}

if (-not $NoFrontend) {
    try {
        $frontend = Start-DevWindow `
            -Title 'RCV Frontend (Vite)' `
            -WorkingDirectory $FrontendDir `
            -NpmScript 'dev' `
            -LogFile 'frontend-dev'
        $started.Add(@{ name='frontend'; pid=$frontend.Id; port=$webPort })
    } catch {
        Write-Err "Fallo al iniciar el frontend: $($_.Exception.Message)"
    }
}

# -----------------------------------------------------------------------------
# Resumen
# -----------------------------------------------------------------------------

Write-Section 'Servicios iniciados'

if ($started.Count -eq 0) {
    Write-Warn 'No se inicio ningun proceso.'
    exit 1
}

foreach ($s in $started) {
    Write-Host ('  {0,-10} PID={1,-7} puerto={2}' -f $s.name, $s.pid, $s.port) -ForegroundColor Gray
}

Write-Host ''
Write-Host 'URLs de acceso:' -ForegroundColor White
if (-not $NoBackend)  { Write-Host "  API:      http://localhost:$apiPort/api/health" -ForegroundColor Cyan }
if (-not $NoFrontend) { Write-Host "  Frontend: http://localhost:$webPort"             -ForegroundColor Cyan }

Write-Host ''
Write-Info 'Espera unos segundos a que Vite y nodemon terminen el primer build.'
Write-Info "Para detener todo: .\stop.ps1"
Write-Host ''
