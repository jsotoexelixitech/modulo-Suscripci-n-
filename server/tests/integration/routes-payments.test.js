/**
 * Pruebas de integración HTTP para las rutas de pagos.
 *
 * Mockeamos los clientes de Meritop y SyPago para validar que:
 *   - Las rutas validan campos requeridos antes de invocar el cliente.
 *   - Los formatos (placa, teléfono, monto, fecha) se rechazan con 400.
 *   - Las respuestas exitosas tienen la forma esperada.
 *   - Los errores del cliente se traducen al código HTTP correcto.
 */
const request = require('supertest');
const path = require('path');

// Mocks: jest.fn() declarado adentro del factory porque Jest evalúa estos
// factories ANTES de cualquier código de top-level del archivo.
jest.mock('../../src/services/meritop/meritopClient', () => ({
  verifyMobilePayment: jest.fn(),
  RESULT_CODES: { B010: 'OK', B001: 'No encontrada' },
}));

jest.mock('../../src/services/sypago/sypagoClient', () => ({
  requestOtp: jest.fn(),
  confirmOtp: jest.fn(),
  getTransactionStatus: jest.fn(),
}));

const meritop = require('../../src/services/meritop/meritopClient');
const sypago  = require('../../src/services/sypago/sypagoClient');
const { buildApp } = require(path.join(__dirname, '..', 'helpers', 'buildApp'));

const app = buildApp();

beforeEach(() => {
  meritop.verifyMobilePayment.mockReset();
  sypago.requestOtp.mockReset();
  sypago.confirmOtp.mockReset();
  sypago.getTransactionStatus.mockReset();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('POST /api/payments/verify-mobile', () => {
  test('faltan campos → 400 con missing[]', async () => {
    const r = await request(app).post('/api/payments/verify-mobile').send({});
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('MERITOP_MISSING_FIELDS');
    expect(r.body.missing).toEqual(
      expect.arrayContaining(['sourcePhoneNumber', 'bankCode', 'amount', 'paidOn']),
    );
  });

  test('teléfono mal formado → 400 MERITOP_INVALID_PHONE', async () => {
    const r = await request(app).post('/api/payments/verify-mobile').send({
      sourcePhoneNumber: '123', bankCode: '0163', amount: 100, paidOn: '2026-05-07T12:00:00',
    });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('MERITOP_INVALID_PHONE');
  });

  test('monto inválido → 400 MERITOP_INVALID_AMOUNT', async () => {
    const r = await request(app).post('/api/payments/verify-mobile').send({
      sourcePhoneNumber: '04141234567', bankCode: '0163', amount: -10, paidOn: '2026-05-07T12:00:00',
    });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('MERITOP_INVALID_AMOUNT');
  });

  test('paidOn no parseable → 400', async () => {
    const r = await request(app).post('/api/payments/verify-mobile').send({
      sourcePhoneNumber: '04141234567', bankCode: '0163', amount: 100, paidOn: 'not-a-date',
    });
    expect(r.status).toBe(400);
  });

  test('verificación exitosa → 200 con isVerified=true', async () => {
    meritop.verifyMobilePayment.mockResolvedValueOnce({
      isVerified: true, reference: 'REF123', verifiedAmount: 100, verifiedOn: 'now', message: 'OK', code: 'B010',
    });

    const r = await request(app).post('/api/payments/verify-mobile').send({
      sourcePhoneNumber: '04141234567', bankCode: '0163', amount: 100, paidOn: '2026-05-07T12:00:00',
    });

    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
    expect(r.body.isVerified).toBe(true);
    expect(r.body.reference).toBe('REF123');
  });

  test('error MERITOP_B001 (transacción no encontrada) → respuesta de negocio', async () => {
    meritop.verifyMobilePayment.mockRejectedValueOnce(Object.assign(
      new Error('Transacción no encontrada'),
      { code: 'MERITOP_B001', baCode: 'B001' },
    ));

    const r = await request(app).post('/api/payments/verify-mobile').send({
      sourcePhoneNumber: '04141234567', bankCode: '0163', amount: 100, paidOn: '2026-05-07T12:00:00',
    });

    expect(r.body.success).toBe(false);
  });
});

describe('POST /api/payments/otp/request', () => {
  test('valida campos requeridos', async () => {
    const r = await request(app).post('/api/payments/otp/request').send({});
    expect(r.status).toBe(400);
  });

  test('llama al cliente y devuelve éxito', async () => {
    sypago.requestOtp.mockResolvedValueOnce({ success: true, message: 'OTP enviada' });
    const r = await request(app).post('/api/payments/otp/request').send({
      documentType: 'V', documentNumber: '12345678',
      debtorBankCode: '0102', debtorPhone: '04141234567', amount: 100,
    });
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
    expect(sypago.requestOtp).toHaveBeenCalledTimes(1);
  });

  test('error del cliente se propaga con httpStatus correcto', async () => {
    sypago.requestOtp.mockRejectedValueOnce(Object.assign(
      new Error('Token inválido'),
      { code: 'SYPAGO_AUTH_ERROR', httpStatus: 502 },
    ));
    const r = await request(app).post('/api/payments/otp/request').send({
      documentType: 'V', documentNumber: '12345678',
      debtorBankCode: '0102', debtorPhone: '04141234567', amount: 100,
    });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.body.success).toBe(false);
  });
});

describe('POST /api/payments/otp/confirm', () => {
  test('confirma OTP exitosamente', async () => {
    sypago.confirmOtp.mockResolvedValueOnce({
      transaction_id: 'TX-001', operation_secret: 'sec-001',
    });
    const r = await request(app).post('/api/payments/otp/confirm').send({
      documentType: 'V', documentNumber: '12345678',
      debtorBankCode: '0102', debtorPhone: '04141234567',
      debtorName: 'Javier Soto', amount: 100, otp: '123456',
    });
    expect(r.status).toBe(200);
    expect(r.body.transaction_id || r.body.transactionId).toBeDefined();
  });

  test('falta otp → 400', async () => {
    const r = await request(app).post('/api/payments/otp/confirm').send({
      documentType: 'V', documentNumber: '12345678',
      debtorBankCode: '0102', debtorPhone: '04141234567',
      debtorName: 'Javier Soto', amount: 100,
    });
    expect(r.status).toBe(400);
  });
});

describe('GET /api/payments/otp/status/:id', () => {
  test('consulta estado de transacción', async () => {
    sypago.getTransactionStatus.mockResolvedValueOnce({
      transaction_id: 'TX-001', status: 'APPROVED',
    });
    const r = await request(app).get('/api/payments/otp/status/TX-001');
    expect(r.status).toBe(200);
    expect(r.body.status || r.body.transaction?.status).toBe('APPROVED');
  });
});

describe('GET /api/health', () => {
  test('devuelve estado ok', async () => {
    const r = await request(app).get('/api/health');
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('ok');
  });
});
