import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpException,
  HttpCode,
  Logger,
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
  ApiParam,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { VerifyMobilePaymentDto, OtpRequestDto, OtpConfirmDto } from './dto/payments.dto';

// ── Schemas reutilizables ─────────────────────────────────────────────────────

const INVALID_SESSION = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    code: { type: 'string', example: 'INVALID_SESSION' },
    message: { type: 'string', example: 'Token de sesión inválido o expirado. Recarga la página.' },
  },
};

const MERITOP_ERROR_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    code: {
      type: 'string',
      enum: [
        'MERITOP_MISSING_FIELDS',
        'MERITOP_INVALID_PHONE',
        'MERITOP_INVALID_AMOUNT',
        'MERITOP_INVALID_DATE',
        'MERITOP_B001',
        'MERITOP_B002',
        'MERITOP_B003',
        'MERITOP_CONNECTION_ERROR',
        'MERITOP_MISSING_APIKEY',
        'MERITOP_DISABLED',
        'MERITOP_INVALID_APIKEY',
        'MERITOP_IP_NOT_ALLOWED',
      ],
      example: 'MERITOP_B001',
    },
    message: { type: 'string', example: 'Transacción no encontrada' },
    baCode: { type: 'string', nullable: true, example: 'B001' },
    baMessage: { type: 'string', nullable: true },
  },
};

const SYPAGO_ERROR_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    code: {
      type: 'string',
      enum: [
        'SYPAGO_MISSING_FIELDS',
        'SYPAGO_INVALID_PHONE',
        'SYPAGO_INVALID_AMOUNT',
        'SYPAGO_CONNECTION_ERROR',
        'SYPAGO_MISSING_TOKEN',
        'SYPAGO_AUTH_ERROR',
        'SYPAGO_ERROR',
      ],
      example: 'SYPAGO_ERROR',
    },
    message: { type: 'string', example: 'Error procesando la transacción.' },
    sypagoCode: { type: 'string', nullable: true, example: 'E001' },
    stage: { type: 'string', enum: ['otp/request', 'otp/confirm', 'otp/status'], example: 'otp/confirm' },
  },
};

const OTP_RATE_LIMIT_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    code: { type: 'string', example: 'OTP_CONFIRM_RATE_LIMIT' },
    message: { type: 'string', example: 'Ya se procesó una confirmación OTP recientemente. Espera unos segundos antes de intentarlo de nuevo.' },
    retryAfter: { type: 'number', example: 30 },
  },
};

// ── Controlador ───────────────────────────────────────────────────────────────

@ApiTags('payments')
@ApiSecurity('session-token')
@ApiHeader({
  name: 'X-Session-Token',
  required: true,
  description: 'Token de sesión obtenido en `GET /api/session/init`.',
  example: '<obtenido-de-GET-/api/session/init>',
})
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  // ── POST /api/payments/verify-mobile (Meritop) ───────────────────────────

  @Post('verify-mobile')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Verificar pago móvil bancario (Meritop)',
    description: [
      'Consulta si una transferencia/pago móvil venezolano existe y está disponible para ser asociada a una póliza.',
      '',
      '### Flujo',
      '1. El usuario realiza un pago móvil desde su app bancaria.',
      '2. El frontend llama este endpoint con los datos del pago.',
      '3. Si `isVerified: true` → el pago es válido, proceder con la emisión.',
      '',
      '### Códigos de resultado Meritop',
      '| Código | Descripción |',
      '|---|---|',
      '| `B000` | Transacción encontrada (ya fue usada en otra operación) |',
      '| `B001` | Transacción no encontrada |',
      '| `B002` | Transacción duplicada (ya registrada) |',
      '| `B003` | Error de parámetros (campo vacío) |',
      '| `B004` | Error de conexión con el Gateway |',
      '| `B005` | Error de conexión Gateway-AS400 |',
      '| `B010` | ✅ Transacción encontrada y **disponible** |',
      '',
      '### Modo mock',
      'Configura `MERITOP_MOCK=true` en `.env` para simular respuesta exitosa sin VPN.',
    ].join('\n'),
  })
  @ApiOkResponse({
    description: 'Pago verificado (puede ser positivo o negativo).',
    schema: {
      type: 'object',
      required: ['success', 'isVerified'],
      properties: {
        success: { type: 'boolean', example: true },
        isVerified: {
          type: 'boolean',
          example: true,
          description: '`true` solo si el código es `B010`. En cualquier otro caso es `false`.',
        },
        reference: {
          type: 'string',
          nullable: true,
          example: 'REF123456789',
          description: 'Referencia bancaria del pago.',
        },
        verifiedAmount: {
          type: 'number',
          nullable: true,
          example: 198114.5,
          description: 'Monto verificado por el banco.',
        },
        verifiedOn: {
          type: 'string',
          nullable: true,
          format: 'date-time',
          example: '2026-05-11T13:30:00',
        },
        message: {
          type: 'string',
          example: 'Transacción encontrada y disponible',
        },
        code: { type: 'string', example: 'B010' },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Campos faltantes o formato inválido (teléfono, monto o fecha).',
    schema: MERITOP_ERROR_SCHEMA,
  })
  @ApiUnauthorizedResponse({ description: 'Sesión inválida.', schema: INVALID_SESSION })
  @ApiTooManyRequestsResponse({ description: 'Límite de 5 verificaciones por minuto por IP superado.' })
  @ApiResponse({
    status: 422,
    description: 'Error de negocio Meritop (B001-B005). El pago no está disponible.',
    schema: MERITOP_ERROR_SCHEMA,
  })
  @ApiResponse({
    status: 502,
    description: 'API Key de Meritop inválida, IP no autorizada o error de autenticación.',
    schema: MERITOP_ERROR_SCHEMA,
  })
  @ApiResponse({
    status: 503,
    description: 'Sin conexión con Meritop (VPN caída, red interna no alcanzable).',
    schema: MERITOP_ERROR_SCHEMA,
  })
  async verifyMobile(@Body() dto: VerifyMobilePaymentDto) {
    const { sourcePhoneNumber, bankCode, amount, paidOn } = dto;

    const missing: string[] = [];
    if (!sourcePhoneNumber) missing.push('sourcePhoneNumber');
    if (!bankCode) missing.push('bankCode');
    if (amount == null) missing.push('amount');
    if (!paidOn) missing.push('paidOn');
    if (missing.length > 0) {
      throw new HttpException(
        { success: false, code: 'MERITOP_MISSING_FIELDS', message: `Faltan campos: ${missing.join(', ')}`, missing },
        400,
      );
    }

    const phoneRe = /^(0|\+?58)4\d{9}$|^04\d{9}$/;
    if (!phoneRe.test(String(sourcePhoneNumber).replace(/\s/g, ''))) {
      throw new HttpException(
        { success: false, code: 'MERITOP_INVALID_PHONE', message: 'Número de teléfono inválido. Formato: 04XXXXXXXXX' },
        400,
      );
    }

    const parsedAmount = parseFloat(String(amount));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new HttpException(
        { success: false, code: 'MERITOP_INVALID_AMOUNT', message: 'El monto debe ser un número positivo.' },
        400,
      );
    }

    if (isNaN(Date.parse(paidOn))) {
      throw new HttpException(
        { success: false, code: 'MERITOP_INVALID_DATE', message: 'Fecha inválida. Usa ISO 8601.' },
        400,
      );
    }

    try {
      const result = await this.paymentsService.verifyMobilePayment({
        sourcePhoneNumber: String(sourcePhoneNumber).replace(/\s/g, ''),
        bankCode: String(bankCode).trim(),
        amount: parsedAmount,
        paidOn,
      });

      return {
        success: true,
        isVerified: result.isVerified,
        reference: result.reference,
        verifiedAmount: result.verifiedAmount,
        verifiedOn: result.verifiedOn,
        message: result.message,
        code: result.code,
      };
    } catch (err: any) {
      this._handleMeritopError(err);
    }
  }

  // ── POST /api/payments/otp/request (SyPago Paso 1) ──────────────────────

  @Post('otp/request')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Solicitar OTP bancaria para débito SyPago (Paso 1 de 2)',
    description: [
      'Solicita al banco del cliente que le envíe una **clave OTP** por SMS, Push o Email.',
      '',
      '### Flujo completo SyPago',
      '```',
      'Cliente        Frontend         Backend          Banco',
      '  |                |               |               |',
      '  |── Datos pago ─►|               |               |',
      '  |                |── POST /otp/request ─────────►|',
      '  |                |               |               |── OTP SMS/Push ──►|',
      '  |◄── ingresa OTP ─|               |               |',
      '  |                |── POST /otp/confirm ─(OTP)───►|',
      '  |                |               |               |── débita cuenta ──|',
      '  |                |◄── transaction_id ────────────|',
      '```',
      '',
      '### Importante',
      '- La OTP tiene validez de **~5 minutos**.',
      '- Una vez solicitada, hay que confirmarla con `POST /otp/confirm`.',
      '- Si el usuario no recibe la OTP, puede solicitar una nueva llamando este endpoint de nuevo.',
    ].join('\n'),
  })
  @ApiOkResponse({
    description: 'OTP enviada al cliente por el banco.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'OTP enviada al cliente.' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Campos faltantes o teléfono/monto inválido.', schema: SYPAGO_ERROR_SCHEMA })
  @ApiUnauthorizedResponse({ description: 'Sesión inválida.', schema: INVALID_SESSION })
  @ApiTooManyRequestsResponse({ description: 'Límite de pagos por minuto superado.' })
  @ApiResponse({ status: 422, description: 'Error de negocio SyPago.', schema: SYPAGO_ERROR_SCHEMA })
  @ApiResponse({ status: 502, description: 'Error de autenticación con SyPago.', schema: SYPAGO_ERROR_SCHEMA })
  @ApiResponse({ status: 503, description: 'Sin conexión con SyPago.', schema: SYPAGO_ERROR_SCHEMA })
  async otpRequest(@Body() dto: OtpRequestDto) {
    const { documentType, documentNumber, debtorBankCode, debtorPhone, amount } = dto;

    const missing: string[] = [];
    if (!documentType) missing.push('documentType');
    if (!documentNumber) missing.push('documentNumber');
    if (!debtorBankCode) missing.push('debtorBankCode');
    if (!debtorPhone) missing.push('debtorPhone');
    if (amount == null) missing.push('amount');
    if (missing.length > 0) {
      throw new HttpException(
        { success: false, code: 'SYPAGO_MISSING_FIELDS', message: `Faltan campos: ${missing.join(', ')}`, missing },
        400,
      );
    }

    const parsedAmount = parseFloat(String(amount));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new HttpException(
        { success: false, code: 'SYPAGO_INVALID_AMOUNT', message: 'El monto debe ser positivo.' },
        400,
      );
    }

    const phoneRe = /^04\d{9}$/;
    if (!phoneRe.test(String(debtorPhone).replace(/\s/g, ''))) {
      throw new HttpException(
        { success: false, code: 'SYPAGO_INVALID_PHONE', message: 'Teléfono inválido. Formato: 04XXXXXXXXX' },
        400,
      );
    }

    try {
      const result = await this.paymentsService.requestOtp({
        documentType,
        documentNumber: String(documentNumber).trim(),
        debtorBankCode,
        debtorPhone: String(debtorPhone).replace(/\s/g, ''),
        amount: parsedAmount,
      });
      return { success: true, message: result?.message ?? 'OTP enviada al cliente.' };
    } catch (err: any) {
      this._handleSypagoError(err, 'otp/request');
    }
  }

  // ── POST /api/payments/otp/confirm (SyPago Paso 2) ──────────────────────

  @Post('otp/confirm')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Confirmar OTP y ejecutar débito bancario (Paso 2 de 2)',
    description: [
      'Envía la OTP que el cliente recibió para **ejecutar el débito real** en la cuenta bancaria.',
      '',
      '> ⚠️ **Irreversible:** cada confirmación exitosa debita la cuenta del cliente. No llamar más de una vez.',
      '',
      '### Protección triple anti-doble-débito',
      '| Capa | Mecanismo | Alcance |',
      '|---|---|---|',
      '| **Frontend** | `useRef` latch síncrono | Bloquea clicks dobles instantáneos |',
      '| **Backend** | Idempotency store SHA-256 (TTL 120s) | Rechaza duplicados en ventana de 2 min |',
      '| **Rate limit** | Máx. 2 confirmaciones / 30s / IP | Capa final de defensa |',
      '',
      '### Respuesta duplicada',
      'Si la misma transacción se envía dos veces dentro de los 120s, la segunda respuesta incluye',
      '`"duplicate": true` con el resultado de la primera (sin volver a debitar al cliente).',
      '',
      '### Verificación del pago',
      'Después de confirmar, el frontend puede consultar el estado con `GET /otp/status/:transactionId`.',
    ].join('\n'),
  })
  @ApiOkResponse({
    description: 'Débito iniciado exitosamente.',
    schema: {
      type: 'object',
      required: ['success', 'transaction_id'],
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Transacción iniciada.' },
        transaction_id: {
          type: 'string',
          example: 'TXN-ABC123456',
          description: 'ID de la transacción. Usar para consultar estado.',
        },
        operation_secret: {
          type: 'string',
          example: 'SECRET-XYZ789',
          description: 'Secret para operaciones de reversión (guardar en logs).',
        },
        mock: {
          type: 'boolean',
          example: false,
          description: '`true` si se procesó en modo mock (`SYPAGO_MOCK=true`).',
        },
        duplicate: {
          type: 'boolean',
          example: false,
          description: '`true` si era una solicitud duplicada (idempotency hit). El débito NO se repitió.',
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Campos faltantes.', schema: SYPAGO_ERROR_SCHEMA })
  @ApiUnauthorizedResponse({ description: 'Sesión inválida.', schema: INVALID_SESSION })
  @ApiTooManyRequestsResponse({
    description: '**Rate limit OTP:** máximo 2 confirmaciones cada 30 segundos por IP.',
    schema: OTP_RATE_LIMIT_SCHEMA,
  })
  @ApiResponse({ status: 422, description: 'OTP incorrecta, expirada o error de negocio SyPago.', schema: SYPAGO_ERROR_SCHEMA })
  @ApiResponse({ status: 502, description: 'Error de autenticación con SyPago.', schema: SYPAGO_ERROR_SCHEMA })
  @ApiResponse({ status: 503, description: 'Sin conexión con SyPago.', schema: SYPAGO_ERROR_SCHEMA })
  async otpConfirm(@Body() dto: OtpConfirmDto) {
    const { documentType, documentNumber, debtorBankCode, debtorPhone, debtorName, amount, otp, concept } = dto;

    const missing: string[] = [];
    if (!documentType) missing.push('documentType');
    if (!documentNumber) missing.push('documentNumber');
    if (!debtorBankCode) missing.push('debtorBankCode');
    if (!debtorPhone) missing.push('debtorPhone');
    if (!debtorName) missing.push('debtorName');
    if (amount == null) missing.push('amount');
    if (!otp) missing.push('otp');
    if (missing.length > 0) {
      throw new HttpException(
        { success: false, code: 'SYPAGO_MISSING_FIELDS', message: `Faltan campos: ${missing.join(', ')}`, missing },
        400,
      );
    }

    const parsedOtp = String(otp).trim();
    const parsedPhone = String(debtorPhone).replace(/\s/g, '');
    const parsedDoc = String(documentNumber).trim();
    const parsedAmount = parseFloat(String(amount));
    const parsedName = String(debtorName).trim();

    try {
      const { responseBody, duplicate } = await this.paymentsService.confirmOtp({
        documentType,
        documentNumber: parsedDoc,
        debtorBankCode,
        debtorPhone: parsedPhone,
        debtorName: parsedName,
        amount: parsedAmount,
        otp: parsedOtp,
        concept,
      });

      return duplicate ? { ...responseBody, duplicate: true } : responseBody;
    } catch (err: any) {
      this._handleSypagoError(err, 'otp/confirm');
    }
  }

  // ── GET /api/payments/otp/status/:transactionId ──────────────────────────

  @Get('otp/status/:transactionId')
  @ApiOperation({
    summary: 'Consultar estado de una transacción SyPago (polling)',
    description: [
      'Consulta el estado actual de un débito previamente iniciado con `/otp/confirm`.',
      '',
      '### Estados posibles',
      '| Estado | Significado |',
      '|---|---|',
      '| `PENDING` | En proceso, banco aún no confirmó |',
      '| `APPROVED` | Débito aprobado y procesado |',
      '| `REJECTED` | Débito rechazado por el banco |',
      '| `EXPIRED` | La transacción expiró sin ser procesada |',
    ].join('\n'),
  })
  @ApiParam({
    name: 'transactionId',
    type: String,
    description: 'ID de transacción retornado por `POST /otp/confirm`.',
    example: 'TXN-ABC123456',
  })
  @ApiOkResponse({
    description: 'Estado de la transacción.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        status: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'], example: 'APPROVED' },
        transaction_id: { type: 'string', example: 'TXN-ABC123456' },
        message: { type: 'string', example: 'Transacción aprobada.' },
      },
    },
  })
  @ApiBadRequestResponse({ description: '`transactionId` no provisto.' })
  @ApiUnauthorizedResponse({ description: 'Sesión inválida.', schema: INVALID_SESSION })
  @ApiResponse({ status: 422, description: 'Transacción no encontrada o error de SyPago.', schema: SYPAGO_ERROR_SCHEMA })
  @ApiResponse({ status: 503, description: 'Sin conexión con SyPago.', schema: SYPAGO_ERROR_SCHEMA })
  async otpStatus(@Param('transactionId') transactionId: string) {
    if (!transactionId) {
      throw new HttpException({ success: false, message: 'transactionId requerido.' }, 400);
    }
    try {
      const result = await this.paymentsService.getOtpStatus(transactionId);
      return { success: true, ...result };
    } catch (err: any) {
      this._handleSypagoError(err, 'otp/status');
    }
  }

  // ── Error handlers ────────────────────────────────────────────────────────

  private _handleMeritopError(err: any): never {
    const code = err.code ?? 'MERITOP_ERROR';
    const message = err.message ?? 'Error verificando el pago móvil.';
    if (['MERITOP_CONNECTION_ERROR', 'MERITOP_MISSING_APIKEY', 'MERITOP_DISABLED'].includes(code)) {
      throw new HttpException({ success: false, code, message }, 503);
    }
    if (['MERITOP_INVALID_APIKEY', 'MERITOP_IP_NOT_ALLOWED', 'MERITOP_AUTH_ERROR'].includes(code)) {
      throw new HttpException({ success: false, code, message }, 502);
    }
    throw new HttpException({
      success: false, code, message,
      baCode: err.baCode ?? null,
      baMessage: err.baMessage ?? null,
    }, 422);
  }

  private _handleSypagoError(err: any, stage: string): never {
    const code = err.code ?? 'SYPAGO_ERROR';
    const message = err.message ?? 'Error con SyPago.';
    if (['SYPAGO_CONNECTION_ERROR', 'SYPAGO_MISSING_TOKEN'].includes(code)) {
      throw new HttpException({ success: false, code, message, stage }, 503);
    }
    if (code === 'SYPAGO_AUTH_ERROR') {
      throw new HttpException({ success: false, code, message, stage }, 502);
    }
    throw new HttpException({
      success: false, code, message,
      sypagoCode: err.sypagoCode ?? null,
      stage,
    }, err.httpStatus ?? 422);
  }
}
