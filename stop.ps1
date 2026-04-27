#requires -Version 5.1
<#
.SYNOPSIS
    Detiene de forma limpia el backend, frontend y servicios de infraestructura.

.DESCRIPTION
    Cierra los procesos que esten escuchando en los puertos de desarrollo y
    produccion, detiene PM2 si esta corriendo y baja docker compose si existe.
    Es idempotente: si nada esta corriendo, simplemente reporta el estado.

.PARAMETER OnlyDev
    Solo detiene procesos de desarrollo (puertos 3001 / 5173).

.PARAMETER OnlyProd
    Solo detiene PM2 / docker compose.

.PARAMETER Force
    Mata procesos con Stop-Process -Force sin esperar cierre limpio.

.EXAMPLE
    .\stop.ps1

.EXAMPLE
    .\stop.ps1 -Force
#>

[CmdletBinding()]
param(
    [switch]$OnlyDev,
    [switch]$OnlyProd,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

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

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvFile = Join-Path $RootDir '.env'
Set-Location $RootDir

# -----------------------------------------------------------------------------
# Lectura simple del .env para obtener puertos
# -----------------------------------------------------------------------------

function Get-EnvVar {
    param([string]$Path, [string]$Key, [string]$Default)
    if (-not (Test-Path $Path)) { return $Default }
    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -match "^\s*$Key\s*=\s*(.*)$") {
            $val = $matches[1].Trim().Trim('"').Trim("'")
            if (-not [string]::IsNullOrWhiteSpace($val)) { return $val }
        }
    }
    return $Default
}

$apiPort  = [int](Get-EnvVar -Path $EnvFile -Key 'PORT'            -Default '3001')
$webPort  = [int](Get-EnvVar -Path $EnvFile -Key 'PUBLIC_WEB_PORT' -Default '4173')
$devPort  = 5173

Write-Section 'Suscripcion RCV - Stop'

# -----------------------------------------------------------------------------
# Detener procesos por puerto
# -----------------------------------------------------------------------------

function Stop-ByPort {
    param(
        [int]$Port,
        [string]$Label
    )

    $stopped = 0
    try {
        $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    } catch {
        $conns = @()
    }

    if (-not $conns -or ($conns | Measure-Object).Count -eq 0) {
        Write-Info "$Label : puerto $Port libre"
        return 0
    }

    $pids = @($conns | Select-Object -ExpandProperty OwningProcess -Unique)
    foreach ($processId in $pids) {
        if ($processId -eq 0) { continue }
        try {
            $proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
            if ($null -eq $proc) { continue }
            $procName = $proc.ProcessName

            if ($Force) {
                Stop-Process -Id $processId -Force -ErrorAction Stop
            } else {
                Stop-Process -Id $processId -ErrorAction Stop
            }
            Write-Ok "$Label : PID $processId ($procName) detenido (puerto $Port)"
            $stopped++
        } catch {
            Write-Warn "$Label : no se pudo detener PID $processId : $($_.Exception.Message)"
        }
    }
    return $stopped
}

if (-not $OnlyProd) {
    Write-Host ''
    Write-Host 'Detener desarrollo:' -ForegroundColor White
    [void](Stop-ByPort -Port $apiPort -Label 'Backend')
    [void](Stop-ByPort -Port $devPort -Label 'Frontend dev')
}

if (-not $OnlyDev) {
    Write-Host ''
    Write-Host 'Detener produccion:' -ForegroundColor White

    # Frontend prod si esta servido por preview
    [void](Stop-ByPort -Port $webPort -Label 'Frontend prod')

    # PM2
    if (Get-Command 'pm2' -ErrorAction SilentlyContinue) {
        try {
            $pm2List = & pm2 jlist 2>$null
            if ($LASTEXITCODE -eq 0 -and $pm2List -and $pm2List.Trim() -ne '[]') {
                Write-Info 'Deteniendo procesos PM2...'
                & pm2 stop all 2>&1 | Out-Null
                & pm2 delete all 2>&1 | Out-Null
                Write-Ok 'PM2 detenido'
            } else {
                Write-Info 'PM2 sin procesos activos'
            }
        } catch {
            Write-Warn "No se pudo consultar PM2: $($_.Exception.Message)"
        }
    } else {
        Write-Info 'PM2 no instalado (saltando)'
    }

    # Docker compose
    $composeFile = Join-Path $RootDir 'docker-compose.yml'
    if (Test-Path $composeFile) {
        if (Get-Command 'docker' -ErrorAction SilentlyContinue) {
            try {
                Write-Info 'Bajando servicios docker compose...'
                & docker compose down
                if ($LASTEXITCODE -eq 0) {
                    Write-Ok 'docker compose detenido'
                } else {
                    Write-Warn "docker compose down retorno codigo $LASTEXITCODE"
                }
            } catch {
                Write-Warn "No se pudo detener docker compose: $($_.Exception.Message)"
            }
        } else {
            Write-Info 'Docker no instalado (saltando)'
        }
    }
}

# -----------------------------------------------------------------------------
# Limpieza opcional de ventanas residuales de PowerShell con titulo conocido
# -----------------------------------------------------------------------------

$titles = @('RCV Backend (Express)', 'RCV Frontend (Vite)')
foreach ($t in $titles) {
    $procs = Get-Process powershell -ErrorAction SilentlyContinue | Where-Object {
        $_.MainWindowTitle -eq $t
    }
    foreach ($p in $procs) {
        try {
            if ($Force) { Stop-Process -Id $p.Id -Force -ErrorAction Stop }
            else        { Stop-Process -Id $p.Id -ErrorAction Stop }
            Write-Ok "Ventana '$t' cerrada (PID $($p.Id))"
        } catch {
            Write-Warn "No se pudo cerrar ventana '$t' (PID $($p.Id))"
        }
    }
}

Write-Host ''
Write-Ok 'Stop finalizado.'
Write-Host ''
