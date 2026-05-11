/**
 * PM2 ecosystem - Suscripcion RCV (La Mundial de Seguros)
 *
 * Lanza:
 *   - rcv-api : backend NestJS (dist-nest/main.js compilado)
 *   - rcv-web : servidor Vite preview (build de produccion)
 *
 * Primer despliegue:
 *   cd server && npm install && npm run build:nest && cd ..
 *   cd frontend && npm install && npm run build && cd ..
 *   pm2 start ecosystem.config.js --env production
 *
 * Actualizar despues de un git pull:
 *   cd server && npm install && npm run build:nest && cd ..
 *   pm2 reload ecosystem.config.js --env production
 *
 * Detener todo:
 *   pm2 stop all && pm2 delete all
 */

const path = require('path');

const PORT = parseInt(process.env.PORT, 10) || 3001;
const PUBLIC_WEB_PORT = parseInt(process.env.PUBLIC_WEB_PORT, 10) || 4173;
const PM2_INSTANCES = process.env.PM2_INSTANCES || 1;

module.exports = {
  apps: [
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
      env_production: {
        NODE_ENV: 'production',
        PORT: PORT,
      },
      out_file: path.join(__dirname, 'logs', 'api.out.log'),
      error_file: path.join(__dirname, 'logs', 'api.err.log'),
      merge_logs: true,
      time: true,
    },
    {
      name: 'rcv-web',
      cwd: path.join(__dirname, 'frontend'),
      script: 'node_modules/vite/bin/vite.js',
      args: `preview --host --port ${PUBLIC_WEB_PORT} --strictPort`,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
      },
      out_file: path.join(__dirname, 'logs', 'rcv-web.out.log'),
      error_file: path.join(__dirname, 'logs', 'rcv-web.err.log'),
      merge_logs: true,
      time: true,
    },
  ],
};
