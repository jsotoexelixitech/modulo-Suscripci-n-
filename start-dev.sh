#!/usr/bin/env bash
# =============================================================
#  start-dev.sh — Entorno de desarrollo en Linux/macOS
#  Uso:
#    chmod +x start-dev.sh
#    ./start-dev.sh              # solo backend + frontend
#    ./start-dev.sh --tunnel     # backend + frontend + Cloudflare HTTPS
# =============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WITH_TUNNEL=false

# --- Argumentos ----------------------------------------------
for arg in "$@"; do
  case $arg in
    --tunnel|-t) WITH_TUNNEL=true ;;
  esac
done

# --- Colores -------------------------------------------------
B='\033[1m'; C='\033[36m'; G='\033[32m'; Y='\033[33m'; R='\033[31m'; N='\033[0m'

banner() { echo -e "\n${C}==============================${N}"; echo -e "${B}  $1${N}"; echo -e "${C}==============================${N}"; }
ok()     { echo -e "${G}[OK]${N} $1"; }
info()   { echo -e "${C}[>>]${N} $1"; }
warn()   { echo -e "${Y}[!!]${N} $1"; }
die()    { echo -e "${R}[ERROR]${N} $1"; exit 1; }

banner "Suscripcion RCV — Modo Desarrollo"

# --- Verificaciones ------------------------------------------
command -v node  >/dev/null 2>&1 || die "Node.js no instalado. Instala con: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs"
command -v npm   >/dev/null 2>&1 || die "npm no encontrado"

# --- .env ----------------------------------------------------
if [[ ! -f "$ROOT/.env" ]]; then
  warn ".env no existe. Copiando desde .env.example..."
  cp "$ROOT/.env.example" "$ROOT/.env"
  warn "Edita .env con tus credenciales antes de usar en produccion."
fi

# Cargar variables de .env al entorno actual
set -a
# shellcheck disable=SC1090
source "$ROOT/.env" 2>/dev/null || true
set +a

API_PORT="${PORT:-3001}"
WEB_PORT="${VITE_DEV_PORT:-5173}"

# --- Dependencias --------------------------------------------
if [[ ! -d "$ROOT/node_modules" ]]; then
  info "Instalando dependencias raiz..."
  cd "$ROOT" && npm install --silent
  ok "node_modules raiz listos"
fi

if [[ ! -d "$ROOT/server/node_modules" ]]; then
  info "Instalando dependencias del backend..."
  cd "$ROOT" && npm install --prefix server --silent
  ok "server/node_modules listos"
fi

if [[ ! -d "$ROOT/frontend/node_modules" ]]; then
  info "Instalando dependencias del frontend..."
  cd "$ROOT" && npm install --prefix frontend --silent
  ok "frontend/node_modules listos"
fi

mkdir -p "$ROOT/logs"

# --- Levantar backend + frontend -----------------------------
banner "Iniciando servicios"

cd "$ROOT"

if $WITH_TUNNEL; then
  command -v cloudflared >/dev/null 2>&1 || die "cloudflared no instalado. Ver: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"

  info "Modo: Backend + Frontend + Cloudflare Tunnel"

  # Cloudflare en background, captura la URL
  CF_LOG="$ROOT/logs/cloudflare.log"
  cloudflared tunnel --url "http://localhost:$API_PORT" > "$CF_LOG" 2>&1 &
  CF_PID=$!

  # Espera a que aparezca la URL del tunnel
  info "Esperando URL de Cloudflare..."
  for i in $(seq 1 20); do
    CF_URL=$(grep -oP 'https://[a-z0-9\-]+\.trycloudflare\.com' "$CF_LOG" 2>/dev/null | head -1 || true)
    [[ -n "$CF_URL" ]] && break
    sleep 1
  done

  echo ""
  if [[ -n "${CF_URL:-}" ]]; then
    echo -e "${B}${G}  URL pública HTTPS: $CF_URL${N}"
    echo -e "${G}  Accesible desde cualquier dispositivo con internet${N}"
  else
    warn "La URL de Cloudflare aun no aparece. Revisa: tail -f $CF_LOG"
  fi
  echo ""

  # Backend + Frontend en foreground (Ctrl+C detiene todo)
  trap "kill $CF_PID 2>/dev/null; exit" INT TERM
  npm run dev

else
  info "Modo: Backend + Frontend (local)"
  echo ""
  echo -e "  API:      ${C}http://localhost:$API_PORT/api/health${N}"
  echo -e "  Frontend: ${C}http://localhost:$WEB_PORT${N}"
  echo ""
  info "Para acceso externo HTTPS: ./start-dev.sh --tunnel"
  echo ""
  npm run dev
fi
