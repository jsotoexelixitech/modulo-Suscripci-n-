import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { SessionService } from '../../modules/session/session.service';

@Injectable()
export class SessionGuardMiddleware implements NestMiddleware {
  constructor(private readonly sessionService: SessionService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // En development la sesión se ignora (igual que en el Express original).
    // En producción se respeta SESSION_ENABLED.
    const isDev = (process.env.NODE_ENV ?? 'development') === 'development';
    if (isDev || process.env.SESSION_ENABLED === 'false') {
      return next();
    }

    const token = req.headers['x-session-token'] as string | undefined;
    if (!token || !this.sessionService.isValid(token)) {
      return res.status(401).json({
        success: false,
        code: 'INVALID_SESSION',
        message: 'Token de sesión inválido o expirado. Recarga la página.',
      });
    }
    next();
  }
}
