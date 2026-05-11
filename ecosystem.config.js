/**
 * PM2 ecosystem - Suscripcion RCV (La Mundial de Seguros)
 *
 * Lanza:
 *   - rcv-api : backend NestJS compilado (server/dist-nest/main.js)
 *   - rcv-web : Vite dev server en puerto 5180, con proxy /api → :3001
 *               (el tunnel de Cloudflare apunta a este puerto)
 *
 * Primer despliegue (o después de cambiar ecosystem):
 *   bash deploy.sh
 *
 * Detener todo:
 *   pm2 stop all && pm2 delete all
 */

const path = require('path');

const PORT            = parseInt(process.env.PORT, 10)            || 3001;
const PUBLIC_WEB_PORT = parseInt(process.env.PUBLIC_WEB_PORT, 10) || 5180;
const PM2_INSTANCES   = process.env.PM2_INSTANCES                 || 1;

module.exports = {
  apps: [
    // ── Backend NestJS ────────────────────────────────────────────────────
    {
      name: 'rcv-api',
      cwd: path.join(__dirname, 'server'),
      script: 'dist-nest/main.js',
      instances: PM2_INSTANCES,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: PORT,
      },
      out_file: path.join(__dirname, 'logs', 'api.out.log'),
      error_file: path.join(__dirname, 'logs', 'api.err.log'),
      merge_logs: true,
      time: true,
    },

    // ── Frontend Vite dev (con proxy API → :3001) ─────────────────────────
    {
      name: 'rcv-web',
      cwd: path.join(__dirname, 'frontend'),
      script: 'node_modules/vite/bin/vite.js',
      args: `--host --port ${PUBLIC_WEB_PORT} --strictPort`,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'development',
        // En el servidor desactivamos HMR — no se necesita hot-reload
        // en producción y evita errores de WebSocket cuando se accede
        // por IP/tunnel sin HTTPS.
        VITE_HMR_DISABLE: '1',
      },
      out_file: path.join(__dirname, 'logs', 'web.out.log'),
      error_file: path.join(__dirname, 'logs', 'web.err.log'),
      merge_logs: true,
      time: true,
    },
  ],
};
