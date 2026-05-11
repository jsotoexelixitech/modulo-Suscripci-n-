#!/usr/bin/env bash
# deploy.sh — Actualizar y reiniciar RCV en el servidor de produccion
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

echo "==> [3/4] Instalando dependencias del frontend y compilando..."
cd frontend
npm install
npm run build
cd ..

echo "==> [4/4] Reiniciando procesos PM2..."
# Si los procesos ya existen, hacemos reload; si no, los levantamos desde cero.
if pm2 list | grep -q "rcv-api"; then
  pm2 reload ecosystem.config.js --env production --update-env
else
  pm2 start ecosystem.config.js --env production
  pm2 save
fi

echo ""
echo "✓ Deploy completado."
pm2 status
