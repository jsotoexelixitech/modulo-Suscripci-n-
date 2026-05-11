import { Controller, Get, Post, Req, Res, HttpCode } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiTooManyRequestsResponse,
  ApiHeader,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { SessionService } from './session.service';

const SESSION_INIT_RESPONSE = {
  type: 'object',
  required: ['token', 'expiresIn', 'expiresAt'],
  properties: {
    token: {
      type: 'string',
      description: 'Token HMAC-SHA256 que debe enviarse como header `X-Session-Token` en cada request.',
      example: '<obtenido-de-GET-/api/session/init>',
    },
    expiresIn: {
      type: 'number',
      description: 'Tiempo de vida del token en milisegundos.',
      example: 14400000,
    },
    expiresAt: {
      type: 'string',
      format: 'date-time',
      description: 'Timestamp ISO 8601 de expiración.',
      example: '2026-05-11T18:31:34.184Z',
    },
  },
};

const INVALID_SESSION_RESPONSE = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    code: { type: 'string', example: 'INVALID_SESSION' },
    message: { type: 'string', example: 'Token de sesión inválido o expirado.' },
  },
};

@ApiTags('session')
@Controller('session')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  /**
   * GET /api/session/init
   *
   * Genera un token de sesión firmado con HMAC-SHA256.
   * Es el primer endpoint que debe llamarse al cargar la app.
   * No requiere autenticación — es una capa anti-bot, no un sistema de login.
   */
  @Get('init')
  @ApiOperation({
    summary: 'Inicializar sesión — primer paso obligatorio',
    description: [
      'Genera un **token HMAC-SHA256** que actúa como capa anti-bot.',
      '',
      '### Flujo de uso',
      '1. Al cargar la app, llama `GET /api/session/init`.',
      '2. Guarda el `token` en memoria (no en `localStorage` ni cookies).',
      '3. Envía `X-Session-Token: <token>` en **todos** los requests posteriores.',
      '4. Llama `POST /api/session/refresh` cuando queden menos de 10 min para `expiresAt`.',
      '',
      '### Notas',
      '- TTL: **4 horas** (14 400 000 ms)',
      '- Límite: 30 tokens por IP por hora (evita generación masiva)',
      '- No es un sistema de autenticación de usuarios — no hay login ni password',
    ].join('\n'),
  })
  @ApiOkResponse({
    description: 'Token generado exitosamente.',
    schema: SESSION_INIT_RESPONSE,
  })
  @ApiTooManyRequestsResponse({
    description: 'Se superó el límite de 30 tokens por hora para esta IP.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        code: { type: 'string', example: 'TOO_MANY_REQUESTS' },
        message: { type: 'string', example: 'Demasiadas solicitudes. Espera un momento.' },
        retryAfter: { type: 'number', example: 3600 },
      },
    },
  })
  init(@Req() req: Request) {
    const token = this.sessionService.generate(
      req.ip ?? '0.0.0.0',
      req.headers['user-agent'] ?? 'unknown',
    );
    return {
      token,
      expiresIn: this.sessionService.getTtl(),
      expiresAt: new Date(Date.now() + this.sessionService.getTtl()).toISOString(),
    };
  }

  /**
   * POST /api/session/refresh
   *
   * Renueva el token antes de que expire. Invalida el anterior.
   */
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Renovar token de sesión antes de que expire',
    description: [
      'Invalida el token actual y genera uno nuevo.',
      '',
      '### Cuándo llamar',
      'El frontend debe llamar este endpoint cuando `Date.now() > expiresAt - 600_000`',
      '(10 minutos antes de la expiración). El interceptor de Axios lo hace automáticamente.',
      '',
      '### Comportamiento',
      '- El token anterior queda **inmediatamente inválido**.',
      '- Si el token enviado ya expiró o es inválido → `401 INVALID_SESSION`.',
    ].join('\n'),
  })
  @ApiHeader({
    name: 'X-Session-Token',
    required: true,
    description: 'Token actual a renovar (obtenido previamente en `/api/session/init`).',
    example: '<obtenido-de-GET-/api/session/init>',
  })
  @ApiOkResponse({
    description: 'Nuevo token generado. El anterior ya no es válido.',
    schema: SESSION_INIT_RESPONSE,
  })
  @ApiUnauthorizedResponse({
    description: 'Token inválido, expirado o no enviado.',
    schema: INVALID_SESSION_RESPONSE,
  })
  refresh(@Req() req: Request, @Res() res: Response) {
    const oldToken = req.headers['x-session-token'] as string | undefined;
    if (!oldToken) {
      return res.status(401).json({
        success: false,
        code: 'INVALID_SESSION',
        message: 'Header X-Session-Token requerido.',
      });
    }

    const newToken = this.sessionService.refresh(
      oldToken,
      req.ip ?? '0.0.0.0',
      req.headers['user-agent'] ?? 'unknown',
    );

    if (!newToken) {
      return res.status(401).json({
        success: false,
        code: 'INVALID_SESSION',
        message: 'Token de sesión inválido o expirado.',
      });
    }

    return res.json({
      token: newToken,
      expiresIn: this.sessionService.getTtl(),
      expiresAt: new Date(Date.now() + this.sessionService.getTtl()).toISOString(),
    });
  }
}
