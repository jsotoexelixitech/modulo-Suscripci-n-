#requires -Version 5.1
<#
.SYNOPSIS
    Setup completo del proyecto Suscripcion RCV - La Mundial de Seguros.

.DESCRIPTION
    Verifica dependencias del sistema, instala paquetes Node, genera el
    archivo .env con secrets seguros, prepara carpetas de runtime y, si
    existe docker-compose.yml, levanta servicios opcionales (Postgres,
    Redis, etc.). Es idempotente: puede ejecutarse multiples veces.

.PARAMETER Force
    Reinstala dependencias borrando node_modules antes.

.PARAMETER SkipInstall
    Salta la instalacion de paquetes npm.

.EXAMPLE
    .\setup.ps1

.EXAMPLE
    .\setup.ps1 -Force
#>

[CmdletBinding()]
param(
    [switch]$Force,
    [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# -----------------------------------------------------------------------------
# Helpers de logging (ASCII puro)
# -----------------------------------------------------------------------------

function Write-Section {
    param([string]$Title)
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
$EnvExample  = Join-Path $RootDir '.env.example'
$UploadsDir  = Join-Path $ServerDir 'uploads'
$LogDir      = Join-Path $RootDir 'logs'

Set-Location $RootDir

Write-Section 'Suscripcion RCV - Setup del Proyecto'
Write-Info "Directorio raiz: $RootDir"

# -----------------------------------------------------------------------------
# 1) Verificacion de prerequisitos del sistema
# -----------------------------------------------------------------------------

Write-Section '1/6  Verificacion de prerequisitos'

function Test-Tool {
    param(
        [string]$Name,
        [string]$Command,
        [string]$VersionArg = '--version',
        [string]$MinVersion = $null,
        [bool]$Required = $true
    )

    $cmd = Get-Command $Command -ErrorAction SilentlyContinue
    if (-not $cmd) {
        if ($Required) {
            Write-Err "$Name no esta instalado. Comando requerido: $Command"
            return $false
        } else {
            Write-Warn "$Name no esta instalado (opcional)."
            return $false
        }
    }

    try {
        $rawVersion = & $Command $VersionArg 2>&1 | Select-Object -First 1
        Write-Ok "$Name disponible: $rawVersion"
        return $true
    } catch {
        Write-Warn "$Name detectado pero no se pudo leer la version."
        return $true
    }
}

$nodeOk   = Test-Tool -Name 'Node.js' -Command 'node' -VersionArg '--version' -Required $true
$npmOk    = Test-Tool -Name 'npm'     -Command 'npm'  -VersionArg '--version' -Required $true
$gitOk    = Test-Tool -Name 'Git'     -Command 'git'  -VersionArg '--version' -Required $true
$dockerOk = Test-Tool -Name 'Docker'  -Command 'docker' -VersionArg '--version' -Required $false
$pm2Ok    = Test-Tool -Name 'PM2'     -Command 'pm2'  -VersionArg '--version' -Required $false

if (-not $nodeOk -or -not $npmOk -or -not $gitOk) {
    Write-Err 'Faltan herramientas requeridas. Instala Node.js (>=18), npm y Git.'
    Write-Info 'Descarga Node.js: https://nodejs.org/'
    Write-Info 'Descarga Git:     https://git-scm.com/downloads'
    exit 1
}

# Validacion suave de version de Node (>=18)
try {
    $nodeVer = (& node --version).TrimStart('v')
    $nodeMajor = [int]($nodeVer.Split('.')[0])
    if ($nodeMajor -lt 18) {
        Write-Warn "Node.js $nodeVer detectado. Se recomienda >= 18 LTS."
    }
} catch {
    Write-Warn 'No se pudo validar la version exacta de Node.'
}

# -----------------------------------------------------------------------------
# 2) Preparacion de carpetas runtime
# -----------------------------------------------------------------------------

Write-Section '2/6  Carpetas de runtime'

foreach ($dir in @($UploadsDir, $LogDir)) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Ok "Creada carpeta: $dir"
    } else {
        Write-Info "Ya existe: $dir"
    }
}

$keepFile = Join-Path $UploadsDir '.gitkeep'
if (-not (Test-Path $keepFile)) {
    New-Item -ItemType File -Path $keepFile -Force | Out-Null
}

# -----------------------------------------------------------------------------
# 3) Generacion / actualizacion del archivo .env
# -----------------------------------------------------------------------------

Write-Section '3/6  Variables de entorno (.env)'

if (-not (Test-Path $EnvExample)) {
    Write-Err "No se encontro .env.example en $EnvExample"
    exit 1
}

function New-Secret {
    param([int]$Bytes = 48)
    $buf = New-Object byte[] $Bytes
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $rng.GetBytes($buf)
    } finally {
        $rng.Dispose()
    }
    return [Convert]::ToBase64String($buf).TrimEnd('=').Replace('+', '-').Replace('/', '_')
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
        }
    }
    return $map
}

if (-not (Test-Path $EnvFile)) {
    Copy-Item -Path $EnvExample -Destination $EnvFile
    Write-Ok 'Creado .env a partir de .env.example'
} else {
    Write-Info '.env ya existe. Se respetan los valores actuales.'
}

# Cargar valores actuales y rellenar secrets vacios
$envValues = Read-EnvFile -Path $EnvFile

$secretsToFill = @('SESSION_SECRET', 'JWT_SECRET')
$generatedAny = $false

foreach ($key in $secretsToFill) {
    if (-not $envValues.Contains($key) -or [string]::IsNullOrWhiteSpace($envValues[$key])) {
        $newVal = New-Secret -Bytes 48
        $envValues[$key] = $newVal
        $generatedAny = $true
        Write-Ok "Generado $key (64 chars seguros)"
    } else {
        Write-Info "$key ya configurado (se conserva)"
    }
}

# Defaults razonables si quedaron vacios
$defaults = [ordered]@{
    'NODE_ENV'           = 'development'
    'APP_NAME'           = 'RCV-LaMundial'
    'PORT'               = '3001'
    'CORS_ORIGINS'       = 'http://localhost:5173,http://localhost:5174,http://localhost:5175'
    'JSON_BODY_LIMIT'    = '1mb'
    'UPLOAD_MAX_SIZE_MB' = '10'
    'UPLOAD_DIR'         = 'uploads'
    'JWT_EXPIRES_IN'     = '12h'
    'OCR_PROVIDER'       = 'mock'
    'OPENAI_MODEL'       = 'gpt-4o-mini'
    'GEMINI_MODEL'       = 'gemini-2.0-flash'
    'PM2_INSTANCES'      = 'max'
    'PUBLIC_WEB_PORT'    = '4173'
    'VITE_APP_NAME'      = 'La Mundial de Seguros'
}

foreach ($k in $defaults.Keys) {
    if (-not $envValues.Contains($k) -or [string]::IsNullOrWhiteSpace($envValues[$k])) {
        $envValues[$k] = $defaults[$k]
        $generatedAny = $true
    }
}

if ($generatedAny) {
    # Reescribir .env preservando comentarios del .env.example
    $exampleLines = Get-Content -LiteralPath $EnvExample
    $output = New-Object System.Collections.Generic.List[string]
    $written = @{}

    foreach ($line in $exampleLines) {
        if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=') {
            $key = $matches[1]
            if ($envValues.Contains($key)) {
                $val = $envValues[$key]
                $output.Add("$key=$val") | Out-Null
                $written[$key] = $true
            } else {
                $output.Add($line) | Out-Null
            }
        } else {
            $output.Add($line) | Out-Null
        }
    }

    # Agregar al final cualquier variable extra que no estuviera en el example
    $extras = @($envValues.Keys | Where-Object { -not $written.ContainsKey($_) })
    if ($extras.Count -gt 0) {
        $output.Add('') | Out-Null
        $output.Add('# --- Variables adicionales ---') | Out-Null
        foreach ($k in $extras) {
            $output.Add("$k=$($envValues[$k])") | Out-Null
        }
    }

    Set-Content -LiteralPath $EnvFile -Value $output -Encoding UTF8
    Write-Ok '.env actualizado con secrets y defaults'
} else {
    Write-Info '.env ya estaba completo. Sin cambios.'
}

# Crear frontend/.env si no existe (para variables VITE_*)
$FrontendEnv = Join-Path $FrontendDir '.env'
if (-not (Test-Path $FrontendEnv)) {
    $viteEnvLines = @(
        '# Frontend (Vite) - Variables expuestas al navegador',
        '# Solo variables con prefijo VITE_ son visibles al cliente.',
        "VITE_APP_NAME=$($envValues['VITE_APP_NAME'])",
        "VITE_API_URL="
    )
    Set-Content -LiteralPath $FrontendEnv -Value $viteEnvLines -Encoding UTF8
    Write-Ok 'Creado frontend/.env'
} else {
    Write-Info 'frontend/.env ya existe (sin cambios)'
}

# -----------------------------------------------------------------------------
# 4) Instalacion de dependencias npm
# -----------------------------------------------------------------------------

Write-Section '4/6  Instalacion de dependencias npm'

function Install-Module {
    param(
        [string]$Name,
        [string]$Path
    )

    if (-not (Test-Path (Join-Path $Path 'package.json'))) {
        Write-Warn "$Name : no se encontro package.json en $Path"
        return
    }

    $modules = Join-Path $Path 'node_modules'

    if ($Force -and (Test-Path $modules)) {
        Write-Info "$Name : eliminando node_modules (modo Force)"
        Remove-Item -Recurse -Force $modules
    }

    if ((Test-Path $modules) -and -not $Force) {
        Write-Info "$Name : node_modules ya existe. Ejecutando 'npm install' incremental."
    } else {
        Write-Info "$Name : instalando dependencias..."
    }

    Push-Location $Path
    try {
        & npm install --no-audit --no-fund --loglevel=error
        if ($LASTEXITCODE -ne 0) {
            throw "npm install fallo en $Name (exit $LASTEXITCODE)"
        }
        Write-Ok "$Name : dependencias instaladas"
    } finally {
        Pop-Location
    }
}

if ($SkipInstall) {
    Write-Warn 'Salto la instalacion (parametro -SkipInstall)'
} else {
    try {
        Install-Module -Name 'server'   -Path $ServerDir
        Install-Module -Name 'frontend' -Path $FrontendDir
    } catch {
        Write-Err "Error instalando dependencias: $($_.Exception.Message)"
        exit 1
    }
}

# -----------------------------------------------------------------------------
# 5) Servicios de infraestructura opcionales (Docker)
# -----------------------------------------------------------------------------

Write-Section '5/6  Servicios de infraestructura'

$composeFile = Join-Path $RootDir 'docker-compose.yml'
if (Test-Path $composeFile) {
    if ($dockerOk) {
        Write-Info 'docker-compose.yml detectado. Levantando servicios...'
        try {
            Push-Location $RootDir
            & docker compose up -d
            if ($LASTEXITCODE -eq 0) {
                Write-Ok 'Servicios de Docker arriba'
                & docker compose ps
            } else {
                Write-Warn "docker compose retorno codigo $LASTEXITCODE"
            }
        } catch {
            Write-Warn "No se pudieron levantar los servicios: $($_.Exception.Message)"
        } finally {
            Pop-Location
        }
    } else {
        Write-Warn 'docker-compose.yml encontrado pero Docker no esta instalado. Se omite.'
    }
} else {
    Write-Info 'No hay docker-compose.yml. El proyecto actual no requiere DB ni Redis.'
    Write-Info 'Las variables DATABASE_URL / REDIS_URL del .env quedan reservadas para el futuro.'
}

# -----------------------------------------------------------------------------
# 6) Validacion final y resumen
# -----------------------------------------------------------------------------

Write-Section '6/6  Resumen de configuracion'

$finalEnv = Read-EnvFile -Path $EnvFile

function Get-EnvVal { param([string]$k) if ($finalEnv.Contains($k)) { return $finalEnv[$k] } else { return '' } }

$summary = [ordered]@{
    'NODE_ENV'      = Get-EnvVal 'NODE_ENV'
    'PORT (API)'    = Get-EnvVal 'PORT'
    'PUBLIC_WEB'    = Get-EnvVal 'PUBLIC_WEB_PORT'
    'CORS_ORIGINS'  = Get-EnvVal 'CORS_ORIGINS'
    'OCR_PROVIDER'  = Get-EnvVal 'OCR_PROVIDER'
    'PM2_INSTANCES' = Get-EnvVal 'PM2_INSTANCES'
}

Write-Host ''
Write-Host 'Variables actuales:' -ForegroundColor White
foreach ($k in $summary.Keys) {
    Write-Host ('  {0,-15} = {1}' -f $k, $summary[$k]) -ForegroundColor Gray
}

Write-Host ''
Write-Host 'Estado de secrets:' -ForegroundColor White
foreach ($k in @('SESSION_SECRET', 'JWT_SECRET')) {
    $v = Get-EnvVal $k
    if ([string]::IsNullOrWhiteSpace($v)) {
        Write-Host ('  {0,-15} = (vacio)' -f $k) -ForegroundColor Red
    } else {
        Write-Host ('  {0,-15} = {1}...' -f $k, $v.Substring(0, [Math]::Min(12, $v.Length))) -ForegroundColor DarkGray
    }
}

# Lista de cosas que el usuario debe configurar manualmente si quiere
$manual = New-Object System.Collections.Generic.List[string]
if ((Get-EnvVal 'OCR_PROVIDER') -ne 'mock') {
    if ((Get-EnvVal 'OCR_PROVIDER') -eq 'openai' -and [string]::IsNullOrWhiteSpace((Get-EnvVal 'OPENAI_API_KEY'))) {
        $manual.Add('OPENAI_API_KEY (OCR_PROVIDER=openai esta activo)')
    }
    if ((Get-EnvVal 'OCR_PROVIDER') -eq 'gemini' -and [string]::IsNullOrWhiteSpace((Get-EnvVal 'GEMINI_API_KEY'))) {
        $manual.Add('GEMINI_API_KEY (OCR_PROVIDER=gemini esta activo)')
    }
}
if (-not $pm2Ok) {
    $manual.Add('PM2 (opcional, requerido para deploy.ps1 en cluster): npm i -g pm2')
}
if (-not $dockerOk) {
    $manual.Add('Docker Desktop (opcional, requerido si usas docker-compose)')
}

Write-Host ''
if ($manual.Count -gt 0) {
    Write-Warn 'Pendientes de configuracion manual:'
    foreach ($m in $manual) { Write-Host "  - $m" -ForegroundColor Yellow }
} else {
    Write-Ok 'No hay pendientes manuales. Listo para arrancar.'
}

Write-Host ''
Write-Host '----------------------------------------------------------------------' -ForegroundColor DarkCyan
Write-Ok 'Setup finalizado correctamente.'
Write-Host ''
Write-Host 'Siguientes pasos:' -ForegroundColor White
Write-Host '  Desarrollo : .\start-dev.ps1'   -ForegroundColor Gray
Write-Host '  Detener    : .\stop.ps1'        -ForegroundColor Gray
Write-Host '  Despliegue : .\deploy.ps1'      -ForegroundColor Gray
Write-Host '----------------------------------------------------------------------' -ForegroundColor DarkCyan
Write-Host ''
