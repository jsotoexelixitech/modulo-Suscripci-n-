# nginx + HTTPS — Suscripcion RCV

## Opciones según tu situación

### Sin dominio → Cloudflare Quick Tunnel (más fácil, ya funciona)
La app Express ya corre en el puerto `3001`. El tunnel te da HTTPS automático:

```powershell
cloudflared tunnel --url http://localhost:3001
```

**Problema:** la URL `*.trycloudflare.com` cambia cada vez que reinicias.  
**Solución:** usar un Named Tunnel (necesitas dominio, aunque sea gratuito).

---

### Con dominio → nginx + Let's Encrypt (URL fija y HTTPS real)

**1. Copia los archivos al servidor Linux:**
```bash
scp nginx/suscripcion-rcv.conf  usuario@ip-servidor:~/
scp nginx/setup-nginx.sh        usuario@ip-servidor:~/
```

**2. En el servidor, ejecuta:**
```bash
# Sin dominio (certificado autofirmado — navegador mostrará advertencia)
sudo bash setup-nginx.sh

# Con dominio (Let's Encrypt — HTTPS real y permanente)
sudo bash setup-nginx.sh tudominio.com
```

**3. El script hace todo automáticamente:**
- Instala nginx
- Genera el certificado (autofirmado o Let's Encrypt)
- Copia la config y habilita el sitio
- Reinicia nginx

**4. Luego despliega la app con PM2:**
```bash
.\deploy.ps1
```

---

## Arquitectura en producción

```
Internet
    │
    │  HTTPS (443)
    ▼
 nginx  ──────────────────────────────
    │   proxy_pass http://127.0.0.1:3001
    ▼
 Express (PM2 cluster)   puerto 3001
    │
    ├── /api/*      → rutas del backend
    └── /*          → frontend estático (dist/)
```

## Gestión de nginx
```bash
sudo nginx -t                    # Verificar config
sudo systemctl reload nginx      # Recargar sin downtime
sudo systemctl status nginx      # Ver estado
tail -f /var/log/nginx/rcv-error.log   # Logs de error
```

## Renovación automática de Let's Encrypt
Certbot instala un cron automático. Para forzar la renovación:
```bash
sudo certbot renew --dry-run
```
