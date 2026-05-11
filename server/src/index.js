try {
  require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
} catch (_) {
  // dotenv optional; variables can be injected by the host environment
}

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const uploadRoutes  = require('./routes/upload');
const valrepRoutes  = require('./routes/valrep');
const sessionRoutes = require('./routes/session');

const {
  buildCorsOptions,
  securityHeaders,
  requireSession,
  generalLimiter,
  ocrLimiter,
  emitLimiter,
  quoteLimiter,
  paymentsLimiter,
  otpConfirmLimiter,
} = require('./middleware/security');

const app      = express();
const PORT     = parseInt(process.env.PORT, 10) || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ── Headers de seguridad HTTP ─────────────────────────────────────────────────
app.use(securityHeaders);

// ── CORS estricto ─────────────────────────────────────────────────────────────
app.use(cors(buildCorsOptions()));

// ── Body parser ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));

// ── Rate limiting general (catálogos, valrep, etc.) ───────────────────────────
app.use('/api', generalLimiter);

// ── Archivos subidos (temporales) ─────────────────────────────────────────────
app.use('/files', express.static(path.join(__dirname, '../uploads')));

// ── Validación de sesión (aplica a todas las rutas /api excepto /session e /health) ──
app.use('/api', requireSession);

// ── API ───────────────────────────────────────────────────────────────────────
app.use('/api/session', sessionRoutes);

// Rate limiters específicos por endpoint costoso
app.use('/api/documents/upload',      ocrLimiter);
app.use('/api/policies/emit',         emitLimiter);
app.use('/api/policies/quote',        quoteLimiter);
app.use('/api/payments',              paymentsLimiter);
// Rate limit específico para confirmación OTP — capa adicional anti-doble-débito
app.use('/api/payments/otp/confirm',  otpConfirmLimiter);

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
  const sessionStatus = process.env.SESSION_ENABLED === 'false' ? 'DESACTIVADO' : 'ACTIVO';
  const lines = [
    '',
    `  RCV Server [${NODE_ENV}]`,
    `  API:      http://localhost:${PORT}/api/health`,
    `  Sesión:   ${sessionStatus}  (SESSION_ENABLED en .env para cambiar)`,
  ];
  if (NODE_ENV === 'production') {
    lines.push(`  Frontend: http://localhost:${PORT}`);
  }
  lines.push('');
  console.log(lines.join('\n'));
});
