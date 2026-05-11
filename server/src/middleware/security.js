/**
 * Middlewares de seguridad — Suscripcion RCV
 *
 * Capas implementadas:
 *   1. Rate limiting por endpoint (protege costos de Gemini y La Mundial)
 *   2. CORS estricto (solo orígenes autorizados)
 *   3. Validación de token de sesión (X-Session-Token)
 *   4. Headers de seguridad HTTP
 */

const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const crypto = require('crypto');

// ── Almacén en memoria de sesiones activas ────────────────────────────────
// Para producción con múltiples instancias PM2 en cluster, reemplazar por Redis.
// En fork mode (1 instancia) este Map es suficiente.
const activeSessions = new Map(); // token → { createdAt, ip, userAgent }

const SESSION_TTL_MS  = 2 * 60 * 60 * 1000; // 2 horas
const SESSION_SECRET  = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const NODE_ENV        = process.env.NODE_ENV || 'development';

// En desarrollo la sesión está desactivada por defecto para no interrumpir
// el flujo de trabajo con Postman/curl. En producción está siempre activa
// salvo que se fuerce SESSION_ENABLED=false explícitamente en .env.
const SESSION_ENABLED = NODE_ENV === 'production'
  ? process.env.SESSION_ENABLED !== 'false'       // prod: true a menos que se diga false
  : process.env.SESSION_ENABLED === 'true';        // dev:  false a menos que se diga true

// Limpiar sesiones expiradas cada 15 minutos
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of activeSessions) {
    if (now - data.createdAt > SESSION_TTL_MS) {
      activeSessions.delete(token);
    }
  }
}, 15 * 60 * 1000);


// ── 1. RATE LIMITERS ─────────────────────────────────────────────────────

/** Mensaje de error estándar para rate limit */
const rateLimitHandler = (req, res) => {
  res.status(429).json({
    success: false,
    code: 'TOO_MANY_REQUESTS',
    message: 'Demasiadas solicitudes. Espera un momento antes de intentarlo de nuevo.',
    retryAfter: Math.ceil(res.getHeader('Retry-After') || 60),
  });
};

/**
 * OCR Upload — 10 documentos por minuto por IP.
 * Cada llamada cuesta tokens de Gemini 2.5 Pro.
 */
const ocrLimiter = rateLimit({
  windowMs:         60 * 1000,
  max:              parseInt(process.env.RATE_LIMIT_OCR, 10) || 10,
  standardHeaders: 'draft-7',
  legacyHeaders:    false,
  keyGenerator:    (req) => ipKeyGenerator(req),
  handler:          rateLimitHandler,
  skip:            () => NODE_ENV !== 'production',
});

/**
 * Emisión de póliza — 3 emisiones por minuto por IP.
 * Cada llamada crea un registro real en La Mundial.
 */
const emitLimiter = rateLimit({
  windowMs:         60 * 1000,
  max:              parseInt(process.env.RATE_LIMIT_EMIT, 10) || 3,
  standardHeaders: 'draft-7',
  legacyHeaders:    false,
  keyGenerator:    (req) => ipKeyGenerator(req),
  handler:          rateLimitHandler,
  skip:            () => NODE_ENV !== 'production',
});

/**
 * Cotización — 20 cotizaciones por minuto por IP.
 */
const quoteLimiter = rateLimit({
  windowMs:         60 * 1000,
  max:              parseInt(process.env.RATE_LIMIT_QUOTE, 10) || 20,
  standardHeaders: 'draft-7',
  legacyHeaders:    false,
  keyGenerator:    (req) => ipKeyGenerator(req),
  handler:          rateLimitHandler,
  skip:            () => NODE_ENV !== 'production',
});

/**
 * Pagos (Meritop / SyPago) — 5 intentos por minuto por IP.
 */
const paymentsLimiter = rateLimit({
  windowMs:         60 * 1000,
  max:              parseInt(process.env.RATE_LIMIT_PAYMENTS, 10) || 5,
  standardHeaders: 'draft-7',
  legacyHeaders:    false,
  keyGenerator:    (req) => ipKeyGenerator(req),
  handler:          rateLimitHandler,
  skip:            () => NODE_ENV !== 'production',
});

/**
 * Confirmación OTP SyPago — máx. 2 confirmaciones por 30 s por IP.
 * Capa extra de defensa contra doble-débito por clicks rápidos o reintentos
 * de red. Se aplica además del idempotency store en-memoria del endpoint.
 * En desarrollo está activo siempre (no tiene el skip de NODE_ENV).
 */
const otpConfirmLimiter = rateLimit({
  windowMs:         30 * 1000,
  max:              parseInt(process.env.RATE_LIMIT_OTP_CONFIRM, 10) || 2,
  standardHeaders: 'draft-7',
  legacyHeaders:    false,
  keyGenerator:    (req) => ipKeyGenerator(req),
  handler(req, res) {
    res.status(429).json({
      success: false,
      code: 'OTP_CONFIRM_RATE_LIMIT',
      message: 'Ya se procesó una confirmación OTP recientemente. Espera unos segundos antes de intentarlo de nuevo.',
      retryAfter: 30,
    });
  },
});

/**
 * General — 200 req por minuto para todo lo demás (catálogos, valrep).
 */
const generalLimiter = rateLimit({
  windowMs:         60 * 1000,
  max:              parseInt(process.env.RATE_LIMIT_GENERAL, 10) || 200,
  standardHeaders: 'draft-7',
  legacyHeaders:    false,
  keyGenerator:    (req) => ipKeyGenerator(req),
  handler:          rateLimitHandler,
  skip:            () => NODE_ENV !== 'production',
});

/**
 * Init de sesión — 30 tokens por hora por IP (evita generación masiva).
 */
const sessionInitLimiter = rateLimit({
  windowMs:         60 * 60 * 1000,
  max:              30,
  standardHeaders: 'draft-7',
  legacyHeaders:    false,
  keyGenerator:    (req) => ipKeyGenerator(req),
  handler:          rateLimitHandler,
});


// ── 2. CORS ESTRICTO ─────────────────────────────────────────────────────

/**
 * Devuelve la configuración de CORS según el entorno.
 * En producción solo permite dominios explícitamente autorizados.
 */
function buildCorsOptions() {
  const raw = process.env.CORS_ORIGINS || '';
  if (!raw || raw === '*') {
    // Dev sin restricción
    return { origin: true, credentials: true };
  }

  const allowed = raw.split(',').map((o) => o.trim()).filter(Boolean);

  return {
    origin(origin, callback) {
      // Peticiones sin Origin (curl, Postman, server-to-server) — bloquear en prod
      if (!origin) {
        if (process.env.CORS_ALLOW_NO_ORIGIN === 'true') {
          return callback(null, true);
        }
        return callback(new Error('Origen no permitido'), false);
      }
      if (allowed.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origen bloqueado por CORS: ${origin}`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Session-Token'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'Retry-After'],
    maxAge: 600, // preflight cache 10 min
  };
}


// ── 3. SESSION TOKEN ─────────────────────────────────────────────────────

/**
 * Genera un token de sesión firmado con HMAC-SHA256.
 * Formato: <timestamp>.<random>.<hmac>
 */
function generateSessionToken(ip) {
  const ts     = Date.now().toString(36);
  const rand   = crypto.randomBytes(16).toString('hex');
  const payload = `${ts}.${rand}.${ip}`;
  const hmac  = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex').slice(0, 16);
  return `${ts}.${rand}.${hmac}`;
}

/**
 * Verifica que el token tiene la firma correcta y no ha expirado.
 */
function verifySessionToken(token, ip) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [ts, rand, hmac] = parts;
  const payload  = `${ts}.${rand}.${ip}`;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex').slice(0, 16);

  if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))) return false;

  // Verificar TTL
  const createdAt = parseInt(ts, 36);
  if (isNaN(createdAt) || Date.now() - createdAt > SESSION_TTL_MS) return false;

  // Verificar que está en el almacén activo
  return activeSessions.has(token);
}

/**
 * Middleware: valida X-Session-Token en todas las rutas /api/* excepto
 * /api/health y /api/session/init.
 */
function requireSession(req, res, next) {
  if (!SESSION_ENABLED) return next();

  // Rutas públicas que no necesitan token.
  // req.path viene sin el prefijo /api porque el middleware se monta en app.use('/api', ...).
  // Comparamos contra la ruta relativa al mount point.
  const PUBLIC = ['/health', '/session/init', '/session/refresh'];
  if (PUBLIC.some((p) => req.path === p || req.path.startsWith(p + '/'))) {
    return next();
  }

  const token = req.headers['x-session-token'];
  if (!verifySessionToken(token, req.ip)) {
    return res.status(401).json({
      success: false,
      code: 'INVALID_SESSION',
      message: 'Sesión inválida o expirada. Recarga la página.',
    });
  }

  next();
}


// ── 4. HEADERS DE SEGURIDAD HTTP ─────────────────────────────────────────

/**
 * Agrega headers de seguridad estándar a todas las respuestas.
 */
function securityHeaders(req, res, next) {
  // Evitar que la respuesta se incruste en iframes externos
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  // Evitar detección de MIME type
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Referrer mínimo
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // No indexar en buscadores
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  // Eliminar header que revela la tecnología
  res.removeHeader('X-Powered-By');
  next();
}


// ── Exportaciones ─────────────────────────────────────────────────────────

module.exports = {
  // Rate limiters (aplicar por ruta)
  ocrLimiter,
  emitLimiter,
  quoteLimiter,
  paymentsLimiter,
  otpConfirmLimiter,
  generalLimiter,
  sessionInitLimiter,

  // CORS
  buildCorsOptions,

  // Sesión
  requireSession,
  generateSessionToken,
  activeSessions,
  SESSION_TTL_MS,

  // Headers
  securityHeaders,
};
