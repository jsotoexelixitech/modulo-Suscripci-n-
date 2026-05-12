import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
  BadRequestException,
  HttpException,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs/promises';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiTooManyRequestsResponse,
  ApiPayloadTooLargeResponse,
  ApiSecurity,
  ApiHeader,
  ApiResponse,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { OcrService } from './ocr.service';

// ── Schemas de respuesta ──────────────────────────────────────────────────────

const CEDULA_FIELDS = {
  type: 'object',
  description: 'Campos extraídos de la Cédula de Identidad venezolana.',
  properties: {
    nombre: { type: 'string', example: 'Maria', description: 'Primer nombre del titular.' },
    apellido: { type: 'string', example: 'Fernandez', description: 'Primer apellido del titular.' },
    identificacion: { type: 'string', example: '18456329', description: 'Número de cédula (solo dígitos, sin V-).' },
    tipoDoc: { type: 'string', enum: ['V', 'E', 'P'], example: 'V', description: 'V=venezolano, E=extranjero, P=pasaporte.' },
    fechaNacimiento: { type: 'string', format: 'date', example: '1990-04-15' },
    sexo: { type: 'string', enum: ['Masculino', 'Femenino'], example: 'Femenino' },
    estadoCivil: {
      type: 'string',
      enum: ['Soltero(a)', 'Casado(a)', 'Divorciado(a)', 'Viudo(a)'],
      example: 'Soltero(a)',
    },
  },
};

const LICENCIA_FIELDS = {
  type: 'object',
  description: 'Campos extraídos de la Licencia de Conducir (INTT).',
  properties: {
    numeroLicencia: { type: 'string', example: 'LIC-0234567' },
    categoria: { type: 'string', example: '5ta', description: '1ra, 2da, 3ra, 4ta, 5ta, A, B o C.' },
    vencimiento: { type: 'string', format: 'date', example: '2027-06-30' },
  },
};

const CERTIFICADO_FIELDS = {
  type: 'object',
  description: 'Campos extraídos del Certificado de Circulación o Título de Propiedad (INTT).',
  properties: {
    placa: { type: 'string', example: 'AE123KT', description: 'Sin espacios ni guiones.' },
    marca: { type: 'string', example: 'Toyota' },
    modelo: { type: 'string', example: 'Corolla' },
    año: { type: 'string', example: '2020', description: '4 dígitos.' },
    serial: { type: 'string', example: 'VIN20TOYCO2020001', description: 'Serial de carrocería (VIN).' },
    color: { type: 'string', example: 'Blanco', description: 'Color principal de la carrocería.' },
  },
};

const RIF_FIELDS = {
  type: 'object',
  description: 'Campos extraídos del RIF (SENIAT).',
  properties: {
    rif: { type: 'string', example: 'J-40123456-7', description: 'Con guiones y dígito verificador.' },
    razonSocial: { type: 'string', example: 'Empresa Ejemplo C.A.', nullable: true },
  },
};

const OCR_META = {
  type: 'object',
  description: 'Metadatos del proceso OCR (solo presente si `provider=gemini`).',
  properties: {
    provider: { type: 'string', example: 'gemini' },
    model: { type: 'string', example: 'gemini-2.5-pro', description: 'Modelo que produjo el resultado final.' },
    elapsedMs: { type: 'number', example: 1250, description: 'Tiempo total de la cadena de modelos.' },
    singleCallMs: { type: 'number', example: 980, description: 'Tiempo de la última llamada exitosa.' },
    chainAttempts: {
      type: 'array',
      description: 'Log de cada intento en la cadena de fallback.',
      items: {
        type: 'object',
        properties: {
          model: { type: 'string', example: 'gemini-2.5-pro' },
          attempts: { type: 'number', example: 1 },
          elapsedMs: { type: 'number', example: 980 },
          criticalOk: { type: 'boolean', example: true },
          missing: { type: 'array', items: { type: 'string' }, example: [] },
        },
      },
    },
  },
};

const OCR_SUCCESS_SCHEMA = {
  type: 'object',
  required: ['success', 'provider', 'fields'],
  properties: {
    success: { type: 'boolean', example: true },
    provider: { type: 'string', enum: ['gemini', 'mock'], example: 'gemini' },
    fields: {
      description: 'Campos extraídos. La estructura varía según `docType`.',
      oneOf: [CEDULA_FIELDS, LICENCIA_FIELDS, CERTIFICADO_FIELDS, RIF_FIELDS],
    },
    meta: OCR_META,
    ocrFailed: {
      type: 'boolean',
      example: false,
      description: 'Solo presente y `true` si Gemini falló. `fields` estará vacío y el usuario debe completar manualmente.',
    },
    error: {
      type: 'string',
      example: 'OCR falló en toda la cadena: ...',
      description: 'Mensaje técnico de error (solo si `ocrFailed=true`).',
    },
    mismatch: {
      type: 'object',
      description: 'Presente si el documento subido no corresponde al `docType` solicitado.',
      properties: {
        expected: { type: 'string', example: 'cedula' },
        detected: { type: 'string', example: 'licencia' },
        expectedLabel: { type: 'string', example: 'Cedula de Identidad' },
        detectedLabel: { type: 'string', example: 'Licencia de Conducir' },
        message: {
          type: 'string',
          example: 'El documento subido parece ser un(a) "Licencia de Conducir", pero el sistema esperaba un(a) "Cedula de Identidad".',
        },
      },
    },
  },
};

const INVALID_SESSION = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    code: { type: 'string', example: 'INVALID_SESSION' },
    message: { type: 'string', example: 'Token de sesión inválido o expirado. Recarga la página.' },
  },
};

// ── Controlador ───────────────────────────────────────────────────────────────

@ApiTags('ocr')
@ApiSecurity('session-token')
@ApiHeader({
  name: 'X-Session-Token',
  required: true,
  description: 'Token obtenido en `GET /api/session/init`. Requerido en todos los endpoints protegidos.',
  example: '<obtenido-de-GET-/api/session/init>',
})
@Controller('documents')
export class OcrController {
  private readonly logger = new Logger(OcrController.name);

  constructor(private readonly ocrService: OcrService) {}

  /**
   * POST /api/documents/upload
   */
  @Post('upload')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(__dirname, '../../../uploads'),
        filename: (_req, file, cb) => {
          const unique = `${uuidv4()}${extname(file.originalname)}`;
          cb(null, unique);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const allowed = [
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/webp',
          'image/heic',
          'image/heif',
          'application/pdf',
        ];
        if (allowed.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}. Usa JPG, PNG, HEIC o PDF.`), false);
        }
      },
      limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB (iPhone HEIC originales)
    }),
  )
  @ApiOperation({
    summary: 'Subir documento y extraer datos con OCR',
    description: [
      'Extrae campos estructurados de documentos venezolanos oficiales usando **Google Gemini**.',
      '',
      '### Documentos soportados',
      '| `docType` | Documento | Campos clave |',
      '|---|---|---|',
      '| `cedula` | Cédula de Identidad (SAIME) | nombre, apellido, identificacion, tipoDoc, fechaNacimiento, sexo, estadoCivil |',
      '| `licencia` | Licencia de Conducir (INTT) | numeroLicencia, categoria, vencimiento |',
      '| `certificado` | Certificado de Circulación o Título de Propiedad (INTT) | placa, marca, modelo, año, serial, color |',
      '| `rif` | Registro Único de Información Fiscal (SENIAT) | rif, razonSocial |',
      '',
      '### Estrategia de fallback (Gemini)',
      'Se intenta con la cadena: `gemini-2.5-pro → gemini-2.5-flash → gemini-2.5-flash-lite`.',
      'Si un modelo produce campos críticos vacíos, se pasa automáticamente al siguiente.',
      '',
      '### Detección de tipo real',
      'Gemini identifica el tipo de documento real en la imagen, **independientemente** de `docType`.',
      'Si detecta un documento diferente al solicitado, retorna `mismatch` con el mensaje al usuario.',
      '',
      '### Formatos aceptados',
      'JPG, PNG, WebP, HEIC/HEIF, PDF. Tamaño máximo: **10 MB**.',
      '',
      '### Modo mock',
      'Si `OCR_PROVIDER=mock` en `.env`, retorna datos simulados sin llamar a Gemini.',
    ].join('\n'),
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Multipart/form-data con el archivo y el tipo de documento.',
    schema: {
      type: 'object',
      required: ['file', 'docType'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Imagen o PDF del documento. JPG, PNG, WebP, HEIC o PDF. Máximo 10 MB.',
        },
        docType: {
          type: 'string',
          enum: ['cedula', 'licencia', 'certificado', 'rif'],
          example: 'cedula',
          description: 'Tipo de documento que se espera en el archivo.',
        },
      },
    },
  })
  @ApiOkResponse({
    description: [
      'OCR procesado. Posibles escenarios:',
      '- `fields` con datos completos → extracción exitosa',
      '- `ocrFailed: true` + `fields: {}` → Gemini falló, el usuario completa manualmente',
      '- `mismatch` presente → el documento no coincide con el `docType` solicitado',
    ].join('\n'),
    schema: OCR_SUCCESS_SCHEMA,
  })
  @ApiBadRequestResponse({
    description: 'No se envió archivo, o `docType` falta o es inválido.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'string',
          example: 'El campo "docType" es requerido (cedula|licencia|certificado|rif).',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Token de sesión ausente, inválido o expirado.',
    schema: INVALID_SESSION,
  })
  @ApiTooManyRequestsResponse({
    description: 'Se superó el límite de 10 uploads por minuto para esta IP.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        code: { type: 'string', example: 'TOO_MANY_REQUESTS' },
        message: { type: 'string', example: 'Demasiadas solicitudes. Espera un momento.' },
        retryAfter: { type: 'number', example: 60 },
      },
    },
  })
  @ApiPayloadTooLargeResponse({
    description: 'El archivo supera el límite de 10 MB.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'El archivo supera el límite de 10 MB.' },
      },
    },
  })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('docType') docType: string,
  ) {
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo. El campo debe llamarse "file".');
    }
    if (!docType) {
      throw new BadRequestException('El campo "docType" es requerido (cedula|licencia|certificado|rif).');
    }

    this.logger.log(`OCR upload: docType=${docType} file=${file.originalname} size=${file.size}`);

    const result = await this.ocrService.processDocument(file, docType);

    // Si Gemini detectó que el documento subido NO corresponde al slot,
    // borramos el archivo y devolvemos 422 con detalle accionable (igual que Express viejo).
    if (result.mismatch) {
      await fs.unlink(result.finalPath).catch(() => {});
      throw new HttpException(
        {
          success: false,
          code: 'DOC_TYPE_MISMATCH',
          message: result.mismatch.message,
          expected: result.mismatch.expected,
          detected: result.mismatch.detected,
          expectedLabel: result.mismatch.expectedLabel,
          detectedLabel: result.mismatch.detectedLabel,
          ocrProvider: result.provider,
          ...(result.meta ? { ocrMeta: result.meta } : {}),
        },
        422,
      );
    }

    // Estructura compatible con el frontend (idéntica al Express viejo)
    return {
      success: true,
      message: result.ocrFailed
        ? 'Archivo recibido. No pudimos leer los datos automáticamente.'
        : 'Documento procesado exitosamente.',
      docType,
      file: {
        id: uuidv4(),
        name: file.originalname,
        size: file.size,
        mimeType: result.finalMimetype,
        url: `/files/${result.finalFilename}`,
      },
      ocr: result.fields ?? {},
      ocrProvider: result.provider,
      ...(result.ocrFailed ? { ocrFailed: true } : {}),
      ...(result.meta ? { ocrMeta: result.meta } : {}),
      ...(result.error ? { ocrError: result.error } : {}),
    };
  }
}
