/**
 * Schemas reutilizables de Swagger para evitar duplicación entre controladores.
 */

export const ErrorSchema = (code: string, message: string) => ({
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    code: { type: 'string', example: code },
    message: { type: 'string', example: message },
    path: { type: 'string', example: '/api/...' },
    timestamp: { type: 'string', example: '2026-05-11T14:00:00.000Z' },
  },
});

export const SESSION_INVALID = ErrorSchema(
  'INVALID_SESSION',
  'Token de sesión inválido o expirado. Recarga la página.',
);

export const RATE_LIMIT_SCHEMA = ErrorSchema(
  'TOO_MANY_REQUESTS',
  'Demasiadas solicitudes. Espera un momento antes de intentarlo de nuevo.',
);

export const MISSING_FIELDS_SCHEMA = (fields: string[]) =>
  ErrorSchema('MISSING_FIELDS', `Faltan campos requeridos: ${fields.join(', ')}`);
