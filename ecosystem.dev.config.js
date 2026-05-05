// PM2 — Modo DESARROLLO con Cloudflare Tunnel persistente
// Uso:
//   pm2 start ecosystem.dev.config.js
//   pm2 logs                      (ver todos los logs)
//   pm2 logs rcv-tunnel           (ver URL de cloudflare)
//   pm2 stop all
//   pm2 delete all

const path = require('path')
const ROOT = __dirname

module.exports = {
  apps: [
    {
      name      : 'rcv-api',
      cwd       : path.join(ROOT, 'server'),
      script    : 'node_modules/.bin/nodemon',
      args      : 'src/index.js',
      watch     : false,
      autorestart: true,
      env: { NODE_ENV: 'development' },
      out_file  : path.join(ROOT, 'logs', 'api.out.log'),
      error_file: path.join(ROOT, 'logs', 'api.err.log'),
      merge_logs: true,
      time      : true,
    },
    {
      name      : 'rcv-web',
      cwd       : path.join(ROOT, 'frontend'),
      script    : 'node_modules/.bin/vite',
      args      : '--host',
      watch     : false,
      autorestart: true,
      env: { NODE_ENV: 'development' },
      out_file  : path.join(ROOT, 'logs', 'web.out.log'),
      error_file: path.join(ROOT, 'logs', 'web.err.log'),
      merge_logs: true,
      time      : true,
    },
    {
      name      : 'rcv-tunnel',
      script    : 'cloudflared',
      args      : 'tunnel --url http://localhost:5180',
      watch     : false,
      autorestart: true,
      out_file  : path.join(ROOT, 'logs', 'tunnel.out.log'),
      error_file: path.join(ROOT, 'logs', 'tunnel.err.log'),
      merge_logs: true,
      time      : true,
    },
  ],
}
