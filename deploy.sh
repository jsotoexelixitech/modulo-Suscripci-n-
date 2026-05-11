#!/usr/bin/env bash
# deploy.sh — Actualizar y reiniciar RCV en el servidor
# Uso: bash deploy.sh
set -e

cd "$(dirname "$0")"

echo "==> [1/4] git pull"
git pull

echo "==> [2/4] Instalando dependencias del backend y compilando NestJS..."
cd server
npm install
npm run build:nest
cd ..

echo "==> [3/4] Instalando dependencias del frontend..."
cd frontend
npm install
cd ..

echo "==> [4/4] Reiniciando procesos PM2..."
# Eliminar y recrear para que los cambios de script/args se apliquen
pm2 delete rcv-api rcv-web 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

echo ""
echo "Deploy completado."
pm2 status
