import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as path from 'path';
import * as express from 'express';

async function bootstrap() {
  try {
    require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
  } catch (_) {}

  const app = await NestFactory.create(AppModule);

  const PORT = parseInt(process.env.PORT ?? '3001', 10);
  const NODE_ENV = process.env.NODE_ENV ?? 'development';
  const rawOrigins = process.env.CORS_ORIGINS ?? '';
  const allowNoOrigin = process.env.CORS_ALLOW_NO_ORIGIN === 'true';
  const allowedOrigins = rawOrigins
    ? rawOrigins.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

  // ── Seguridad HTTP ──────────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // ── CORS ────────────────────────────────────────────────────────────────────
  // Modo permisivo si:
  //   - NODE_ENV=development, O
  //   - CORS_ALLOW_NO_ORIGIN=true, O
  //   - CORS_ORIGINS está vacío
  // En ese caso permite TODO (incluido el tunnel de Cloudflare con dominio dinamico).
  // En producción estricta (CORS_ORIGINS lleno y CORS_ALLOW_NO_ORIGIN=false) → solo la lista.
  const permissive =
    NODE_ENV !== 'production' || allowNoOrigin || !rawOrigins;

  app.enableCors({
    origin: permissive
      ? true
      : (origin, callback) => {
          if (!origin) return callback(null, true);
          if (allowedOrigins.includes(origin)) return callback(null, true);
          // No tirar excepción 500 — sólo negar el header CORS.
          return callback(null, false);
        },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Session-Token'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'Retry-After'],
    maxAge: 600,
  });

  // ── Validación global ───────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // ── Prefijo global de API ───────────────────────────────────────────────────
  app.setGlobalPrefix('api');

  // ── Swagger ─────────────────────────────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('RCV Suscripción — API')
    .setDescription(
      '## API para la emisión de pólizas RCV venezolanas\n\n' +
      'Integra **La Mundial de Seguros** (cotización y emisión), **Google Gemini** (OCR de documentos), ' +
      '**SyPago** (débito OTP bancario) y **Meritop** (verificación de pago móvil).\n\n' +
      '---\n\n' +
      '### Autenticación\n\n' +
      'Todas las rutas **excepto** `GET /api/session/init`, `GET /api/health` y esta documentación ' +
      'requieren el header:\n\n' +
      '```\nX-Session-Token: <token>\n```\n\n' +
      'Obtén el token llamando `GET /api/session/init` (sin credenciales). ' +
      'El token expira en **4 horas** y puede renovarse con `POST /api/session/refresh`.\n\n' +
      '---\n\n' +
      '### Flujo estándar de emisión\n\n' +
      '```\n' +
      '1. GET  /api/session/init              → obtener X-Session-Token\n' +
      '2. POST /api/documents/upload          → OCR cédula, licencia, certificado, RIF\n' +
      '3. GET  /api/policies/inma/marcas      → catálogo de marcas INMA\n' +
      '4. GET  /api/policies/inma/modelos     → modelos de la marca\n' +
      '5. GET  /api/policies/inma/versiones   → versiones del modelo\n' +
      '6. GET  /api/policies/inma/categorias-uso → categorías de uso\n' +
      '7. POST /api/policies/quote            → cotizar prima (Bs y USD)\n' +
      '8. POST /api/payments/otp/request      → solicitar OTP al banco del cliente\n' +
      '9. POST /api/payments/otp/confirm      → confirmar débito con OTP\n' +
      '10. POST /api/policies/emit            → emitir póliza definitiva\n' +
      '```\n\n' +
      '---\n\n' +
      '### Códigos de error comunes\n\n' +
      '| HTTP | Código | Significado |\n' +
      '|---|---|---|\n' +
      '| 400 | `*_MISSING_FIELDS` | Campos requeridos ausentes |\n' +
      '| 401 | `INVALID_SESSION` | Token de sesión inválido o expirado |\n' +
      '| 409 | `LAMUNDIAL_PLATE_ALREADY_INSURED` | Vehículo ya tiene póliza vigente |\n' +
      '| 422 | `MERITOP_B001` | Pago móvil no encontrado |\n' +
      '| 422 | `SYPAGO_ERROR` | OTP incorrecta o expirada |\n' +
      '| 429 | `TOO_MANY_REQUESTS` | Rate limit alcanzado |\n' +
      '| 429 | `OTP_CONFIRM_RATE_LIMIT` | Protección anti-doble-débito activa |\n' +
      '| 502 | `LAMUNDIAL_*` | Error de negocio en La Mundial |\n' +
      '| 503 | `*_CONNECTION_ERROR` | Sin conexión con el proveedor externo |\n' +
      '| 504 | `LAMUNDIAL_NETWORK` | Timeout conectando con La Mundial |',
    )
    .setVersion('2.0.0')
    .setContact('Soporte Técnico', '', 'soporte@exelixi.com')
    .setLicense('Privado', '')
    .addServer(`http://localhost:${PORT}`, 'Desarrollo local')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-Session-Token',
        in: 'header',
        description: 'Token obtenido en `GET /api/session/init`. TTL: 4 horas.',
      },
      'session-token',
    )
    .addTag('session', 'Tokens de sesión anti-bot — inicio y renovación')
    .addTag('ocr', 'OCR de documentos venezolanos con Google Gemini (Cédula, Licencia, Certificado, RIF)')
    .addTag('policies', 'Cotización y emisión de pólizas RCV — La Mundial de Seguros + catálogo INMA')
    .addTag('payments', 'Pagos bancarios: SyPago (débito OTP) y Meritop (verificación pago móvil)')
    .addTag('valrep', 'Catálogos de referencia: estados, ciudades, sexo, estado civil, frecuencias')
    .addTag('health', 'Estado del servidor')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'RCV API Docs',
  });

  // ── Static files (uploads) ──────────────────────────────────────────────────
  app.use('/files', express.static(path.join(__dirname, '../uploads')));

  // ── SPA fallback en producción ──────────────────────────────────────────────
  if (NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, '../../frontend/dist');
    app.use(express.static(distPath));
    // path-to-regexp v8+ ya no acepta '*' solo como wildcard.
    // Usamos middleware sin path con check interno para el SPA fallback.
    app.use((req: any, res: any, next: any) => {
      if (req.path?.startsWith('/api') || req.path?.startsWith('/files')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  await app.listen(PORT);

  const sessionStatus =
    process.env.SESSION_ENABLED === 'false' ? 'DESACTIVADO' : 'ACTIVO';

  console.log(`
  RCV Server NestJS [${NODE_ENV}]
  API:    http://localhost:${PORT}/api/health
  Docs:   http://localhost:${PORT}/api/docs
  Sesión: ${sessionStatus}
`);
}

bootstrap();
