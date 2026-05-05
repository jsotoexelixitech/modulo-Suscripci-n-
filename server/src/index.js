try {
  require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
} catch (_) {
  // dotenv optional; variables can be injected by the host environment
}

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const uploadRoutes = require('./routes/upload');
const valrepRoutes = require('./routes/valrep');

const app      = express();
const PORT     = parseInt(process.env.PORT, 10) || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ── CORS ──────────────────────────────────────────────────────────────────────
// En producción el frontend es servido por este mismo proceso, así que CORS
// solo necesita cubrir dominios externos. En dev cubrimos los puertos de Vite.
const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
];
const corsOrigins = (process.env.CORS_ORIGINS || defaultOrigins.join(','))
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({ origin: corsOrigins }));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));

// ── Archivos subidos (temporales) ─────────────────────────────────────────────
app.use('/files', express.static(path.join(__dirname, '../uploads')));

// ── API ───────────────────────────────────────────────────────────────────────
app.use('/api', uploadRoutes);
app.use('/api/valrep', valrepRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', env: NODE_ENV, time: new Date().toISOString() });
});

// ── Frontend estático (solo en producción) ────────────────────────────────────
// En producción Express sirve el build de Vite directamente.
// Esto elimina la necesidad de un servidor web separado (Nginx, etc.).
// Ejecutar antes: npm run build (desde la raíz o desde frontend/)
if (NODE_ENV === 'production') {
  const distPath = path.resolve(__dirname, '../../frontend/dist');
  app.use(express.static(distPath));

  // SPA fallback — todas las rutas no-API devuelven index.html
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ── Arranque ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  const lines = [
    '',
    `  RCV Server [${NODE_ENV}]`,
    `  API:      http://localhost:${PORT}/api/health`,
  ];
  if (NODE_ENV === 'production') {
    lines.push(`  Frontend: http://localhost:${PORT}`);
  }
  lines.push('');
  console.log(lines.join('\n'));
});
