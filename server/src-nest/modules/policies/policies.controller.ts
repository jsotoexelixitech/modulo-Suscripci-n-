import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpException,
  Logger,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiTooManyRequestsResponse,
  ApiResponse,
  ApiSecurity,
  ApiHeader,
  ApiQuery,
} from '@nestjs/swagger';
import { PoliciesService } from './policies.service';
import { QuoteDto, EmitDto } from './dto/quote.dto';

// ── Schemas ───────────────────────────────────────────────────────────────────

const INVALID_SESSION = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    code: { type: 'string', example: 'INVALID_SESSION' },
    message: { type: 'string', example: 'Token de sesión inválido o expirado. Recarga la página.' },
  },
};

const LAMUNDIAL_ERROR = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    code: {
      type: 'string',
      enum: [
        'LAMUNDIAL_ERROR',
        'LAMUNDIAL_PLATE_ALREADY_INSURED',
        'LAMUNDIAL_MISSING_FIELDS',
        'LAMUNDIAL_UNAUTHORIZED',
        'LAMUNDIAL_SP_OUTDATED',
        'LAMUNDIAL_NETWORK',
        'LAMUNDIAL_APIKEY_MISSING',
        'LAMUNDIAL_SERVER_ERROR',
        'INVALID_PAYLOAD',
        'QUOTE_ERROR',
        'EMIT_ERROR',
      ],
      example: 'LAMUNDIAL_PLATE_ALREADY_INSURED',
    },
    message: { type: 'string', example: 'El vehículo ya posee una póliza vigente.' },
    stage: { type: 'string', enum: ['quote', 'emit'], example: 'emit' },
    details: {
      type: 'array',
      items: { type: 'string' },
      example: ['placa invalida (6-8 alfanumericos en mayusculas)'],
      description: 'Solo presente cuando `code=INVALID_PAYLOAD`.',
    },
    internalPolicyId: {
      type: 'string',
      example: 'INT-20260511120000-1234',
      description: 'Solo presente cuando se generó antes de fallar la emisión.',
    },
  },
};

const QUOTE_OK = {
  type: 'object',
  required: ['success', 'mprima', 'mprimaext', 'ptasa'],
  properties: {
    success: { type: 'boolean', example: true },
    mprima: {
      type: 'number',
      example: 198114.5,
      description: 'Prima en bolívares (Bs). Se usa para el total a cobrar.',
    },
    mprimaext: {
      type: 'number',
      example: 408.29,
      description: 'Prima en divisas (USD referencial).',
    },
    ptasa: {
      type: 'number',
      example: 485.2251,
      description: 'Tasa de cambio BCV usada en el cálculo.',
    },
    metadata: {
      type: 'object',
      properties: {
        vehicleLabel: { type: 'string', example: 'TOYOTA / COROLLA' },
        vehicleFallback: { type: 'boolean', example: false },
        vehicleFallbackReason: { type: 'string', nullable: true },
      },
    },
    mode: { type: 'string', enum: ['live', 'mock'], example: 'live' },
  },
};

const EMIT_OK = {
  type: 'object',
  required: ['success', 'internalPolicyId', 'cnpoliza', 'cnrecibo', 'emittedAt'],
  properties: {
    success: { type: 'boolean', example: true },
    internalPolicyId: {
      type: 'string',
      example: 'INT-20260511120000-1234',
      description: 'ID interno generado antes de llamar a La Mundial. Usar para soporte.',
    },
    cnpoliza: {
      type: 'string',
      example: 'LM-2026-123456',
      description: 'Número de póliza asignado por La Mundial de Seguros.',
    },
    cnrecibo: {
      type: 'string',
      example: 'REC-456789',
      description: 'Número de recibo de cobro.',
    },
    urlpoliza: {
      type: 'string',
      example: 'https://qaapisys2000.lamundialdeseguros.com/polizas/LM-2026-123456.pdf',
      description: 'URL directa al PDF de la póliza emitida.',
    },
    ncuota: {
      type: 'number',
      example: 1,
      description: 'Número de cuota (1 para pago anual único).',
    },
    quote: {
      type: 'object',
      description: 'Valores económicos de la cotización previa a la emisión.',
      properties: {
        mprima: { type: 'number', example: 198114.5 },
        mprimaext: { type: 'number', example: 408.29 },
        ptasa: { type: 'number', example: 485.2251 },
      },
    },
    emittedAt: {
      type: 'string',
      format: 'date-time',
      example: '2026-05-11T12:00:00.000Z',
    },
    metadata: {
      type: 'object',
      properties: {
        vehicleLabel: { type: 'string', example: 'TOYOTA / COROLLA' },
        internalPolicyId: { type: 'string', example: 'INT-20260511120000-1234' },
      },
    },
  },
};

// ── Controlador ───────────────────────────────────────────────────────────────

@ApiTags('policies')
@ApiSecurity('session-token')
@ApiHeader({
  name: 'X-Session-Token',
  required: true,
  description: 'Token de sesión obtenido en `GET /api/session/init`.',
  example: '<obtenido-de-GET-/api/session/init>',
})
@Controller('policies')
export class PoliciesController {
  private readonly logger = new Logger(PoliciesController.name);

  constructor(private readonly policiesService: PoliciesService) {}

  // ── POST /api/policies/quote ─────────────────────────────────────────────

  @Post('quote')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Cotizar prima RCV de un vehículo',
    description: [
      'Llama a `getCotizacionAuto` de La Mundial de Seguros y retorna la prima en Bs y USD.',
      '',
      '### Body requerido',
      '```json',
      '{',
      '  "state": {',
      '    "vehicle": {',
      '      "cmarca": "10",',
      '      "cmodelo": "27",',
      '      "cversion": "1",',
      '      "año": 2022,',
      '      "ccategoria_uso": 1',
      '    }',
      '  },',
      '  "plan": "RCVBAS"',
      '}',
      '```',
      '',
      '### Planes disponibles',
      '- `RCVBAS` — Responsabilidad Civil Básica (valor más bajo, cobertura estándar)',
      '- `RUSPAT` — Extensión de cobertura patrimonial',
      '',
      '### Modo mock',
      'Configura `POLICY_MODE=mock` en `.env` para retornar prima ficticia sin llamar a La Mundial.',
    ].join('\n'),
  })
  @ApiOkResponse({ description: 'Prima calculada exitosamente.', schema: QUOTE_OK })
  @ApiBadRequestResponse({
    description: '`state.vehicle` faltante o campos requeridos incompletos.',
    schema: LAMUNDIAL_ERROR,
  })
  @ApiUnauthorizedResponse({ description: 'Sesión inválida.', schema: INVALID_SESSION })
  @ApiTooManyRequestsResponse({ description: 'Límite de 20 cotizaciones por minuto por IP superado.' })
  @ApiResponse({
    status: 502,
    description: [
      'Error de La Mundial. Códigos posibles:',
      '- `LAMUNDIAL_PLATE_ALREADY_INSURED` — vehículo ya asegurado',
      '- `LAMUNDIAL_SP_OUTDATED` — versión del SP desactualizada (contactar soporte)',
      '- `LAMUNDIAL_UNAUTHORIZED` — API key inválida',
      '- `LAMUNDIAL_SERVER_ERROR` — error interno en La Mundial',
    ].join('\n'),
    schema: LAMUNDIAL_ERROR,
  })
  @ApiResponse({ status: 504, description: 'Timeout de red al conectar con La Mundial.', schema: LAMUNDIAL_ERROR })
  async quote(@Body() dto: QuoteDto) {
    try {
      const result = await this.policiesService.quote(dto.state, { plan: dto.plan });
      return {
        success: true,
        mprima: result.mprima,
        mprimaext: result.mprimaext,
        ptasa: result.ptasa,
        metadata: result.metadata,
        mode: this.policiesService.getMode(),
      };
    } catch (err: any) {
      this.logger.error(`Quote error: ${err.message}`, err.stack);
      throw new HttpException(
        { success: false, code: err.code ?? 'QUOTE_ERROR', message: err.message },
        err.httpStatus ?? 502,
      );
    }
  }

  // ── POST /api/policies/emit ──────────────────────────────────────────────

  @Post('emit')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Cotizar y emitir póliza RCV completa',
    description: [
      'Ejecuta **cotización + emisión** en un solo paso. Una vez llamado, se genera una póliza real.',
      '',
      '> ⚠️ **Irreversible:** cada llamada exitosa crea un registro en La Mundial. Úsalo solo cuando el usuario haya completado y confirmado todos los datos.',
      '',
      '### Pasos internos',
      '1. Construye payload desde `state` (wizard completo)',
      '2. Llama `getCotizacionAuto` para obtener `mprima/mprimaext/ptasa`',
      '3. Valida el payload localmente (`validateEmissionPayload`) — rechaza con 400 antes de gastar cupo',
      '4. Registra `internalPolicyId` en log **antes** de emitir (permite auditoría si la red falla)',
      '5. Llama `createEmissionAuto` → retorna `cnpoliza, cnrecibo, urlpoliza`',
      '',
      '### Body mínimo requerido',
      '```json',
      '{',
      '  "state": {',
      '    "tomador": { "nombre": "...", "apellido": "...", "identificacion": "18456329", ... },',
      '    "vehicle": { "placa": "AE123KT", "serial": "VIN...", "cmarca": "10", ... }',
      '  }',
      '}',
      '```',
    ].join('\n'),
  })
  @ApiOkResponse({ description: 'Póliza emitida exitosamente.', schema: EMIT_OK })
  @ApiBadRequestResponse({
    description: '`state` incompleto o validación local fallida (payload inválido).',
    schema: LAMUNDIAL_ERROR,
  })
  @ApiUnauthorizedResponse({ description: 'Sesión inválida.', schema: INVALID_SESSION })
  @ApiTooManyRequestsResponse({ description: 'Límite de 3 emisiones por minuto por IP superado.' })
  @ApiResponse({
    status: 409,
    description: '`LAMUNDIAL_PLATE_ALREADY_INSURED` — el vehículo ya tiene una póliza vigente.',
    schema: LAMUNDIAL_ERROR,
  })
  @ApiResponse({ status: 502, description: 'Error de negocio o autenticación con La Mundial.', schema: LAMUNDIAL_ERROR })
  @ApiResponse({ status: 504, description: 'Timeout de red al conectar con La Mundial.', schema: LAMUNDIAL_ERROR })
  async emit(@Body() dto: EmitDto) {
    try {
      const result = await this.policiesService.emit(dto.state, {
        plan: dto.plan,
        frecuencia: dto.frecuencia,
        fechaEmision: dto.fechaEmision,
        internalPolicyId: dto.internalPolicyId,
      });
      return { success: true, ...result };
    } catch (err: any) {
      this.logger.error(`Emit error: ${err.message}`, err.stack);
      throw new HttpException(
        {
          success: false,
          code: err.code ?? 'EMIT_ERROR',
          message: err.message,
          ...(err.details && { details: err.details }),
          ...(err.internalPolicyId && { internalPolicyId: err.internalPolicyId }),
        },
        err.httpStatus ?? 502,
      );
    }
  }

  // ── Catálogo INMA ────────────────────────────────────────────────────────

  @Get('inma/anios')
  @ApiOperation({
    summary: 'Rango de años del catálogo INMA',
    description: 'Retorna el rango `{ min, max }` de años de fabricación disponibles en La Mundial.',
  })
  @ApiOkResponse({
    description: 'Rango de años.',
    schema: {
      type: 'object',
      properties: {
        min: { type: 'number', example: 2000 },
        max: { type: 'number', example: 2027 },
      },
    },
  })
  @ApiUnauthorizedResponse({ schema: INVALID_SESSION })
  @ApiResponse({ status: 502, description: 'Error conectando con La Mundial.' })
  async getAnios() {
    try {
      const result = await this.policiesService.getInmaAnios();
      return { success: true, ...result };
    } catch (err: any) {
      throw new HttpException({ code: 'INMA_ERROR', message: err.message }, err.httpStatus ?? 502);
    }
  }

  @Get('inma/marcas')
  @ApiOperation({
    summary: 'Lista de marcas de vehículos para un año',
    description: 'Retorna el catálogo de marcas disponibles para el año indicado.',
  })
  @ApiQuery({ name: 'fano', required: true, type: Number, example: 2022, description: 'Año de fabricación (4 dígitos).' })
  @ApiOkResponse({
    description: 'Lista de marcas.',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          cmarca: { type: 'string', example: '10' },
          xmarca: { type: 'string', example: 'TOYOTA' },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ schema: INVALID_SESSION })
  @ApiBadRequestResponse({ description: '`fano` faltante o no numérico.' })
  @ApiResponse({ status: 502, description: 'Error conectando con La Mundial.' })
  async getMarcas(@Query('fano') fano: string) {
    try {
      const data = await this.policiesService.getInmaMarcas(parseInt(fano, 10));
      return { success: true, data };
    } catch (err: any) {
      throw new HttpException({ code: 'INMA_ERROR', message: err.message }, err.httpStatus ?? 502);
    }
  }

  @Get('inma/modelos')
  @ApiOperation({
    summary: 'Lista de modelos para un año + marca',
    description: 'Los códigos `cmarca` y `cmodelo` se obtienen de los endpoints previos.',
  })
  @ApiQuery({ name: 'fano', required: true, type: Number, example: 2022 })
  @ApiQuery({ name: 'cmarca', required: true, type: String, example: '10', description: 'Código de marca (de `/inma/marcas`).' })
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          cmodelo: { type: 'string', example: '27' },
          xmodelo: { type: 'string', example: 'COROLLA' },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ schema: INVALID_SESSION })
  @ApiResponse({ status: 502, description: 'Error conectando con La Mundial.' })
  async getModelos(@Query('fano') fano: string, @Query('cmarca') cmarca: string) {
    try {
      const data = await this.policiesService.getInmaModelos(parseInt(fano, 10), cmarca);
      return { success: true, data };
    } catch (err: any) {
      throw new HttpException({ code: 'INMA_ERROR', message: err.message }, err.httpStatus ?? 502);
    }
  }

  @Get('inma/versiones')
  @ApiOperation({
    summary: 'Lista de versiones/carrocerías para año + marca + modelo',
    description: 'Cada versión tiene su propio `cversion`. Llamar **antes** de `/quote`.',
  })
  @ApiQuery({ name: 'fano', required: true, type: Number, example: 2022 })
  @ApiQuery({ name: 'cmarca', required: true, type: String, example: '10' })
  @ApiQuery({ name: 'cmodelo', required: true, type: String, example: '27', description: 'Código de modelo (de `/inma/modelos`).' })
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          cversion: { type: 'string', example: '1' },
          xversion: { type: 'string', example: 'SEDAN 1.8L' },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ schema: INVALID_SESSION })
  @ApiResponse({ status: 502, description: 'Error conectando con La Mundial.' })
  async getVersiones(
    @Query('fano') fano: string,
    @Query('cmarca') cmarca: string,
    @Query('cmodelo') cmodelo: string,
  ) {
    try {
      const data = await this.policiesService.getInmaVersiones(parseInt(fano, 10), cmarca, cmodelo);
      return { success: true, data };
    } catch (err: any) {
      throw new HttpException({ code: 'INMA_ERROR', message: err.message }, err.httpStatus ?? 502);
    }
  }

  @Get('inma/categorias-uso')
  @ApiOperation({
    summary: 'Categorías de uso para un vehículo específico',
    description: [
      'Retorna las categorías de uso válidas para la combinación año+marca+modelo+versión.',
      'El `ccategoria_uso` seleccionado debe incluirse en el body de `/quote` y `/emit`.',
      '',
      '### Categorías comunes',
      '| Código | Descripción |',
      '|---|---|',
      '| 1 | Vehículo particular |',
      '| 2 | Vehículo de carga |',
      '| 3 | Vehículo de transporte público |',
    ].join('\n'),
  })
  @ApiQuery({ name: 'fano', required: true, type: Number, example: 2022 })
  @ApiQuery({ name: 'cmarca', required: true, type: String, example: '10' })
  @ApiQuery({ name: 'cmodelo', required: true, type: String, example: '27' })
  @ApiQuery({ name: 'cversion', required: true, type: String, example: '1', description: 'Código de versión (de `/inma/versiones`).' })
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ccategoria_uso: { type: 'number', example: 1 },
          xcategoria_uso: { type: 'string', example: 'PARTICULAR' },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ schema: INVALID_SESSION })
  @ApiResponse({ status: 502, description: 'Error conectando con La Mundial.' })
  async getCategoriasUso(
    @Query('fano') fano: string,
    @Query('cmarca') cmarca: string,
    @Query('cmodelo') cmodelo: string,
    @Query('cversion') cversion: string,
  ) {
    try {
      const data = await this.policiesService.getCategoriasUso(parseInt(fano, 10), cmarca, cmodelo, cversion);
      return { success: true, data };
    } catch (err: any) {
      throw new HttpException({ code: 'INMA_ERROR', message: err.message }, err.httpStatus ?? 502);
    }
  }

  @Get('inma/resolver')
  @ApiOperation({
    summary: 'Resolver texto libre (OCR) contra el catálogo INMA',
    description: [
      'Recibe `marca` y opcionalmente `modelo` como texto libre (ej. resultado de OCR del certificado',
      'de circulación) y los resuelve contra el catálogo oficial de La Mundial.',
      '',
      'Devuelve `{ cmarca, xmarca, cmodelo?, xmodelo?, versiones[], fallback }`.',
      'Si `fallback: true`, la coincidencia fue parcial — el usuario debe confirmar manualmente.',
    ].join('\n'),
  })
  @ApiQuery({ name: 'fano', required: true, type: Number, example: 2022 })
  @ApiQuery({ name: 'marca', required: true, type: String, example: 'Toyota' })
  @ApiQuery({ name: 'modelo', required: false, type: String, example: 'Corolla' })
  @ApiOkResponse({
    description: 'Resultado de la resolución (puede incluir `fallback: true`).',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        fallback: { type: 'boolean', example: false },
        cmarca: { type: 'string', example: '10' },
        xmarca: { type: 'string', example: 'TOYOTA' },
        cmodelo: { type: 'string', example: '27' },
        xmodelo: { type: 'string', example: 'COROLLA' },
        versiones: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              cversion: { type: 'string', example: '1' },
              xversion: { type: 'string', example: 'SEDAN 1.8L' },
            },
          },
        },
        message: { type: 'string', nullable: true },
      },
    },
  })
  @ApiBadRequestResponse({ description: '`fano` o `marca` faltantes.' })
  @ApiUnauthorizedResponse({ schema: INVALID_SESSION })
  @ApiResponse({ status: 502, description: 'Error conectando con La Mundial.' })
  async resolveInma(
    @Query('fano') fano: string,
    @Query('marca') marca: string,
    @Query('modelo') modelo?: string,
  ) {
    const fanoNum = parseInt(fano, 10);
    if (!fanoNum || !marca) {
      throw new HttpException(
        { success: false, message: 'fano y marca requeridos' },
        400,
      );
    }
    try {
      const data = await this.policiesService.resolveVehicle(fanoNum, marca, modelo ?? '');
      return data;
    } catch (err: any) {
      throw new HttpException(
        { success: false, code: 'INMA_ERROR', message: err.message },
        err.httpStatus ?? 502,
      );
    }
  }
}
