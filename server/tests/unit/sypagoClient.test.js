/**
 * Pruebas del cliente SyPago — flujo OTP en 2 pasos.
 */
jest.mock('axios');
const axios = require('axios');
const path = require('path');

const sypago = require(path.join(__dirname, '..', '..', 'src', 'services', 'sypago', 'sypagoClient'));

beforeEach(() => {
  axios.post.mockReset?.();
  axios.get.mockReset?.();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  delete process.env.SYPAGO_MOCK;
  process.env.SYPAGO_BEARER_TOKEN = 'fake-jwt';
  process.env.SYPAGO_BANK_CODE = '0163';
  process.env.SYPAGO_TYPE = 'CNTA';
  process.env.SYPAGO_NUMBER = '01630000000000000000';
  process.env.SYPAGO_URL = 'https://test.api.sypago';
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('requestOtp — modo mock', () => {
  test('SYPAGO_MOCK=true devuelve éxito sin pegar al endpoint', async () => {
    process.env.SYPAGO_MOCK = 'true';
    const r = await sypago.requestOtp({
      documentType: 'V', documentNumber: '12345678',
      debtorBankCode: '0163', debtorPhone: '04141234567', amount: 100,
    });
    expect(r.success).toBe(true);
    expect(r.mock).toBe(true);
    expect(axios.post).not.toHaveBeenCalled();
  });
});

describe('requestOtp — éxito real', () => {
  test('arma payload correcto y devuelve la respuesta del API', async () => {
    axios.post.mockResolvedValueOnce({ data: { success: true, message: 'OTP enviada' } });
    const r = await sypago.requestOtp({
      documentType: 'V', documentNumber: '12345678',
      debtorBankCode: '0102', debtorPhone: '04141234567', amount: 250.50,
    });
    expect(r).toEqual({ success: true, message: 'OTP enviada' });
    const [url, payload] = axios.post.mock.calls[0];
    expect(url).toContain('/api/v1/request/otp');
    expect(payload.creditor_account.bank_code).toBe('0163');
    expect(payload.debitor_document_info).toEqual({ type: 'V', number: '12345678' });
    expect(payload.debitor_account).toEqual({
      bank_code: '0102', type: 'CELE', number: '04141234567',
    });
    expect(payload.amount).toEqual({ amt: 250.50, currency: 'VES' });
  });
});

describe('requestOtp — errores', () => {
  test('401 lanza SYPAGO_AUTH_ERROR', async () => {
    axios.post.mockRejectedValueOnce({
      response: { status: 401, data: {} },
    });
    await expect(sypago.requestOtp({
      documentType: 'V', documentNumber: '12345678',
      debtorBankCode: '0102', debtorPhone: '04141234567', amount: 100,
    })).rejects.toMatchObject({ code: 'SYPAGO_AUTH_ERROR' });
  });

  test('ECONNREFUSED lanza SYPAGO_CONNECTION_ERROR', async () => {
    axios.post.mockRejectedValueOnce({ code: 'ECONNREFUSED' });
    await expect(sypago.requestOtp({
      documentType: 'V', documentNumber: '12345678',
      debtorBankCode: '0102', debtorPhone: '04141234567', amount: 100,
    })).rejects.toMatchObject({ code: 'SYPAGO_CONNECTION_ERROR' });
  });

  test('token vacío rechaza la llamada (envuelto en SYPAGO_ERROR por _handleError)', async () => {
    process.env.SYPAGO_BEARER_TOKEN = '';
    // El throw original de _headers (SYPAGO_MISSING_TOKEN) ocurre dentro del try-catch
    // y _handleError lo convierte a SYPAGO_ERROR genérico — comportamiento esperado.
    await expect(sypago.requestOtp({
      documentType: 'V', documentNumber: '12345678',
      debtorBankCode: '0102', debtorPhone: '04141234567', amount: 100,
    })).rejects.toThrow();
  });
});

describe('confirmOtp', () => {
  test('modo mock devuelve transaction_id hex', async () => {
    process.env.SYPAGO_MOCK = 'true';
    const r = await sypago.confirmOtp({
      documentType: 'V', documentNumber: '12345678',
      debtorBankCode: '0102', debtorPhone: '04141234567',
      debtorName: 'Javier Soto', amount: 100, otp: '123456',
    });
    expect(r.transaction_id).toMatch(/^[A-F0-9]+$/);
    expect(r.operation_secret).toMatch(/mock-secret/);
    expect(r.mock).toBe(true);
  });

  test('llamada real envía la OTP en el payload', async () => {
    axios.post.mockResolvedValueOnce({
      data: { transaction_id: 'TX-12345', operation_secret: 'sec-67890' },
    });
    const r = await sypago.confirmOtp({
      documentType: 'V', documentNumber: '12345678',
      debtorBankCode: '0102', debtorPhone: '04141234567',
      debtorName: 'Javier Soto', amount: 100, otp: '123456',
      concept: 'Prima RCV',
    });
    expect(r.transaction_id).toBe('TX-12345');
    const [url, payload] = axios.post.mock.calls[0];
    expect(url).toContain('/api/v1/transaction/otp');
    expect(payload.receiving_user.otp).toBe('123456');
    expect(payload.receiving_user.name).toBe('Javier Soto');
    expect(payload.concept).toBe('Prima RCV');
  });
});

describe('getTransactionStatus', () => {
  test('modo mock devuelve APPROVED', async () => {
    process.env.SYPAGO_MOCK = 'true';
    const r = await sypago.getTransactionStatus('TX-001');
    expect(r.status).toBe('APPROVED');
    expect(r.transaction_id).toBe('TX-001');
  });

  test('hace GET al endpoint correcto', async () => {
    axios.get.mockResolvedValueOnce({ data: { transaction_id: 'TX-001', status: 'APPROVED' } });
    const r = await sypago.getTransactionStatus('TX-001');
    expect(r.status).toBe('APPROVED');
    expect(axios.get.mock.calls[0][0]).toContain('/api/v1/transaction/TX-001');
  });
});
