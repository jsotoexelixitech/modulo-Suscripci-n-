/**
 * Construye un instance de Express equivalente al de src/index.js pero sin
 * llamar a `listen()` — listo para inyectar a supertest.
 *
 * Replica el wiring exacto del bootstrap real para que los tests vean las
 * mismas rutas, mismo CORS y mismo body parser.
 */
const express = require('express');
const cors = require('cors');
const path = require('path');

function buildApp() {
  const uploadRoutes = require(path.join(__dirname, '..', '..', 'src', 'routes', 'upload'));
  const valrepRoutes = require(path.join(__dirname, '..', '..', 'src', 'routes', 'valrep'));

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', uploadRoutes);
  app.use('/api/valrep', valrepRoutes);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', env: 'test', time: new Date().toISOString() });
  });

  return app;
}

module.exports = { buildApp };
