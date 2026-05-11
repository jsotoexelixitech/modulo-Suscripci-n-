/**
 * Rutas de sesión — genera y renueva tokens de acceso a la API.
 *
 * GET  /api/session/init     → genera un token nuevo (el frontend lo llama al cargar)
 * POST /api/session/refresh  → renueva un token existente antes de que expire
 */
const express = require('express');
const {
  generateSessionToken,
  activeSessions,
  SESSION_TTL_MS,
  sessionInitLimiter,
} = require('../middleware/security');

const router = express.Router();

/**
 * GET /api/session/init
 *
 * Genera un token de sesión firmado con HMAC-SHA256.
 * El frontend lo guarda en memoria y lo envía en cada request
 * como header X-Session-Token.
 *
 * No requiere autenticación de usuario — es una capa anti-bot,
 * no un sistema de login.
 */
router.get('/init', sessionInitLimiter, (req, res) => {
  const token = generateSessionToken(req.ip);
  activeSessions.set(token, {
    createdAt: Date.now(),
    ip:        req.ip,
    userAgent: req.headers['user-agent'] || 'unknown',
  });

  res.json({
    token,
    expiresIn: SESSION_TTL_MS,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  });
});

/**
 * POST /api/session/refresh
 *
 * Renueva el token 10 minutos antes de que expire.
 * El frontend lo llama automáticamente via interceptor de Axios.
 */
router.post('/refresh', (req, res) => {
  const oldToken = req.headers['x-session-token'];
  if (!oldToken || !activeSessions.has(oldToken)) {
    return res.status(401).json({
      success: false,
      code: 'INVALID_SESSION',
      message: 'Token de sesión inválido o inexistente.',
    });
  }

  // Eliminar el anterior y generar uno nuevo
  activeSessions.delete(oldToken);
  const newToken = generateSessionToken(req.ip);
  activeSessions.set(newToken, {
    createdAt: Date.now(),
    ip:        req.ip,
    userAgent: req.headers['user-agent'] || 'unknown',
  });

  res.json({
    token:     newToken,
    expiresIn: SESSION_TTL_MS,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  });
});

module.exports = router;
