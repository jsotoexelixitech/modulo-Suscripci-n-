import {
  Controller,
  Get,
  Param,
  Query,
  HttpException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiResponse,
  ApiSecurity,
  ApiHeader,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ValrepService } from './valrep.service';

// ── Schemas ───────────────────────────────────────────────────────────────────

const INVALID_SESSION = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    code: { type: 'string', example: 'INVALID_SESSION' },
    message: { type: 'string', example: 'Token de sesión inválido o expirado. Recarga la página.' },
  },
};

const CATALOG_ITEM = {
  type: 'object',
  properties: {
    code: { description: 'Código numérico o alfanumérico del ítem.' },
    label: { type: 'string', description: 'Descripción legible del ítem.' },
  },
};

const UPSTREAM_ERROR = {
  type: 'object',
  properties: {
    ok: { type: 'boolean', example: false },
    error: { type: 'string', example: 'No se pudo obtener la lista de estados' },
    detail: { description: 'Respuesta original de La Mundial o mensaje de error de red.' },
  },
};

// ── Controlador ───────────────────────────────────────────────────────────────

@ApiTags('valrep')
@ApiSecurity('session-token')
@ApiHeader({
  name: 'X-Session-Token',
  required: true,
  description: 'Token de sesión obtenido en `GET /api/session/init`.',
  example: '<obtenido-de-GET-/api/session/init>',
})
@Controller('valrep')
export class ValrepController {
  private readonly logger = new Logger(ValrepController.name);

  constructor(private readonly valrepService: ValrepService) {}

  // ── GET /api/valrep/state ─────────────────────────────────────────────────

  @Get('state')
  @ApiOperation({
    summary: 'Lista de estados venezolanos',
    description: [
      'Retorna los 24 estados de Venezuela disponibles en el catálogo de La Mundial.',
      'Usar el `code` como valor de `cestado` en el endpoint `/api/valrep/city` y en el wizard.',
      '',
      '### Uso en el formulario',
      'El código `code` debe almacenarse en `tomador.cestado` y `tomador.estado` (label) en el wizard.',
    ].join('\n'),
  })
  @ApiOkResponse({
    description: 'Lista de 24 estados venezolanos.',
    schema: {
      type: 'object',
      required: ['ok', 'items'],
      properties: {
        ok: { type: 'boolean', example: true },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              code: { type: 'number', example: 1, description: 'Código numérico del estado (cestado).' },
              label: { type: 'string', example: 'Distrito Capital' },
            },
          },
          example: [
            { code: 1, label: 'Distrito Capital' },
            { code: 24, label: 'Miranda' },
          ],
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Sesión inválida.', schema: INVALID_SESSION })
  @ApiResponse({
    status: 502,
    description: 'No se pudo conectar con La Mundial o la API retornó un error.',
    schema: UPSTREAM_ERROR,
  })
  async getStates() {
    try {
      const items = await this.valrepService.getStates();
      return { ok: true, items };
    } catch (err: any) {
      this.logger.error(`valrep/state: ${err.message}`);
      throw new HttpException(
        { ok: false, error: 'No se pudo obtener la lista de estados', detail: err?.response?.data ?? err.message },
        502,
      );
    }
  }

  // ── GET /api/valrep/city ─────────────────────────────────────────────────

  @Get('city')
  @ApiOperation({
    summary: 'Lista de ciudades venezolanas (con filtro por estado)',
    description: [
      'Retorna ciudades del catálogo de La Mundial.',
      'Si no se provee `cestado`, retorna todas las ciudades (puede ser lenta).',
      '',
      '### Parámetros equivalentes',
      'Acepta tanto `cestado` como `estado` para compatibilidad con versiones anteriores.',
      '',
      '### Uso en el formulario',
      'El código `code` debe almacenarse en `tomador.cciudad` en el wizard.',
    ].join('\n'),
  })
  @ApiQuery({
    name: 'cestado',
    required: false,
    type: Number,
    description: 'Código del estado (obtenido de `/api/valrep/state`). Si se omite, retorna todas las ciudades.',
    example: 1,
  })
  @ApiOkResponse({
    description: 'Lista de ciudades.',
    schema: {
      type: 'object',
      required: ['ok', 'items'],
      properties: {
        ok: { type: 'boolean', example: true },
        cestado: { type: 'number', nullable: true, example: 1, description: 'Código del estado filtrado (null si no se filtró).' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              code: { type: 'number', example: 101, description: 'Código numérico de la ciudad (cciudad).' },
              label: { type: 'string', example: 'Caracas' },
            },
          },
          example: [
            { code: 101, label: 'Caracas' },
            { code: 102, label: 'Chacao' },
          ],
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Sesión inválida.', schema: INVALID_SESSION })
  @ApiResponse({ status: 502, description: 'No se pudo conectar con La Mundial.', schema: UPSTREAM_ERROR })
  async getCities(
    @Query('cestado') cestadoRaw?: string,
    @Query('estado') estadoRaw?: string,
  ) {
    const raw = cestadoRaw ?? estadoRaw;
    const cestado = raw ? parseInt(raw, 10) : undefined;
    try {
      const result = await this.valrepService.getCities(cestado);
      return { ok: true, ...result };
    } catch (err: any) {
      this.logger.error(`valrep/city: ${err.message}`);
      throw new HttpException(
        { ok: false, error: 'No se pudo obtener la lista de ciudades', detail: err?.response?.data ?? err.message },
        502,
      );
    }
  }

  // ── GET /api/valrep/list/:domain ─────────────────────────────────────────

  @Get('list/:domain')
  @ApiOperation({
    summary: 'Lista de catálogo genérico (SEXO, EDOCIVIL, PARENTESCOS, FRECUENCIAS, MATIPCANAL)',
    description: [
      'Retorna listas de valores de referencia para campos del formulario de póliza.',
      '',
      '### Dominios disponibles',
      '| Dominio | Campo en el formulario | Ejemplo de valores |',
      '|---|---|---|',
      '| `SEXO` | `tomador.sexo` | M=Masculino, F=Femenino |',
      '| `EDOCIVIL` | `tomador.estadoCivil` | S=Soltero, C=Casado, D=Divorciado |',
      '| `PARENTESCOS` | Relación titular-tomador | H=Hijo, C=Cónyuge... |',
      '| `FRECUENCIAS` | Frecuencia de pago | A=Anual, S=Semestral, M=Mensual |',
      '| `MATIPCANAL` | Canal de venta | Valores por configurar |',
      '',
      '### Validación',
      'Solo se permiten los 5 dominios listados. Cualquier otro retorna `400`.',
    ].join('\n'),
  })
  @ApiParam({
    name: 'domain',
    type: String,
    enum: ['SEXO', 'EDOCIVIL', 'PARENTESCOS', 'FRECUENCIAS', 'MATIPCANAL'],
    description: 'Nombre del dominio de catálogo (en mayúsculas).',
    example: 'SEXO',
  })
  @ApiOkResponse({
    description: 'Lista de ítems del catálogo.',
    schema: {
      type: 'object',
      required: ['ok', 'domain', 'items'],
      properties: {
        ok: { type: 'boolean', example: true },
        domain: { type: 'string', example: 'SEXO' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'M', description: 'Código del ítem.' },
              label: { type: 'string', example: 'Masculino', description: 'Descripción legible.' },
            },
          },
          example: [
            { code: 'M', label: 'Masculino' },
            { code: 'F', label: 'Femenino' },
          ],
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'El dominio solicitado no está en la lista de permitidos.',
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean', example: false },
        error: { type: 'string', example: 'Dominio no permitido: OTRO' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Sesión inválida.', schema: INVALID_SESSION })
  @ApiResponse({ status: 502, description: 'No se pudo conectar con La Mundial.', schema: UPSTREAM_ERROR })
  async getList(@Param('domain') domainRaw: string) {
    const domain = (domainRaw ?? '').toUpperCase();
    try {
      const result = await this.valrepService.getList(domain);
      return { ok: true, ...result };
    } catch (err: any) {
      if (err.httpStatus === 400) {
        throw new HttpException({ ok: false, error: err.message }, 400);
      }
      this.logger.error(`valrep/list/${domain}: ${err.message}`);
      throw new HttpException(
        { ok: false, error: `No se pudo obtener la lista ${domain}`, detail: err?.response?.data ?? err.message },
        502,
      );
    }
  }
}
