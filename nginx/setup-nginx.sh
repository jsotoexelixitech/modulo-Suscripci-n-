#!/usr/bin/env bash
# =============================================================
#  setup-nginx.sh — Configurar nginx + HTTPS para Suscripcion-RCV
#
#  Ejecutar en el servidor Linux como root o con sudo:
#    chmod +x setup-nginx.sh
#    sudo ./setup-nginx.sh
#
#  Con dominio real (Let's Encrypt):
#    sudo ./setup-nginx.sh --domain tudominio.com
# =============================================================
set -euo pipefail

DOMAIN="${1:-}"
CONF_NAME="suscripcion-rcv"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "=========================================="
echo "  La Mundial RCV — Setup nginx + HTTPS"
echo "=========================================="

# --- 1. Instalar nginx ------------------------------------
echo ""
echo ">> Instalando nginx..."
apt-get update -qq
apt-get install -y nginx

# --- 2. Certificado SSL -----------------------------------
if [[ -n "$DOMAIN" ]]; then
    echo ">> Instalando Certbot (Let's Encrypt) para: $DOMAIN"
    apt-get install -y certbot python3-certbot-nginx
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email admin@"$DOMAIN" --redirect
    SSL_CERT="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
    SSL_KEY="/etc/letsencrypt/live/$DOMAIN/privkey.pem"
    # Actualizar conf con las rutas de Let's Encrypt
    sed -i "s|tudominio.com|$DOMAIN|g" "$SCRIPT_DIR/$CONF_NAME.conf"
    sed -i "s|# ssl_certificate     /etc/letsencrypt|ssl_certificate     /etc/letsencrypt|" "$SCRIPT_DIR/$CONF_NAME.conf"
    sed -i "s|# ssl_certificate_key /etc/letsencrypt|ssl_certificate_key /etc/letsencrypt|" "$SCRIPT_DIR/$CONF_NAME.conf"
    sed -i "s|ssl_certificate     /etc/ssl/certs/rcv-selfsigned.crt;|# ssl_certificate     /etc/ssl/certs/rcv-selfsigned.crt;|" "$SCRIPT_DIR/$CONF_NAME.conf"
    sed -i "s|ssl_certificate_key /etc/ssl/private/rcv-selfsigned.key;|# ssl_certificate_key /etc/ssl/private/rcv-selfsigned.key;|" "$SCRIPT_DIR/$CONF_NAME.conf"
    echo "[OK] Certificado Let's Encrypt configurado"
else
    echo ">> Generando certificado autofirmado (navegador mostrara advertencia)..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/ssl/private/rcv-selfsigned.key \
        -out    /etc/ssl/certs/rcv-selfsigned.crt \
        -subj   "/CN=localhost/O=La Mundial de Seguros/C=VE" 2>/dev/null
    echo "[OK] Certificado autofirmado generado"
fi

# --- 3. Copiar config de nginx ----------------------------
echo ""
echo ">> Copiando configuracion de nginx..."
cp "$SCRIPT_DIR/$CONF_NAME.conf" "/etc/nginx/sites-available/$CONF_NAME"

# Habilitar el sitio
ln -sf "/etc/nginx/sites-available/$CONF_NAME" "/etc/nginx/sites-enabled/$CONF_NAME"

# Desactivar el sitio default de nginx si existe
rm -f /etc/nginx/sites-enabled/default

# --- 4. Verificar y recargar nginx ------------------------
echo ">> Verificando configuracion de nginx..."
nginx -t
systemctl enable nginx
systemctl restart nginx
echo "[OK] nginx corriendo"

# --- 5. Resumen -------------------------------------------
echo ""
echo "=========================================="
echo "  SETUP COMPLETADO"
if [[ -n "$DOMAIN" ]]; then
    echo "  URL: https://$DOMAIN"
else
    IP=$(hostname -I | awk '{print $1}')
    echo "  URL (autofirmado): https://$IP"
    echo "  NOTA: El navegador mostrara 'No seguro'."
    echo "  Para HTTPS real obtén un dominio y ejecuta:"
    echo "    sudo ./setup-nginx.sh tudominio.com"
fi
echo "  Express (PM2): pm2 status"
echo "  Logs nginx:    tail -f /var/log/nginx/rcv-error.log"
echo "=========================================="
