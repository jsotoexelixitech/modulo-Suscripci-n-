/**
 * Pruebas del cliente Meritop con axios mockeado.
 */
jest.mock('axios');
const axios = require('axios');
const path = require('path');

const { verifyMobilePayment } = require(
  path.join(__dirname, '..', '..', 'src', 'services', 'meritop', 'meritopClient'),
);

beforeEach(() => {
  axios.post.mockReset();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  delete process.env.MERITOP_MOCK;
  delete process.env.MERITOP_ENABLED;
  process.env.MERITOP_APIKEY = 'fake-key';
  process.env.MERITOP_URL2 = 'http://test-meritop';
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('verifyMobilePayment — modo mock', () => {
  test('MERITOP_MOCK=true devuelve respuesta simulada', async () => {
    process.env.MERITOP_MOCK = 'true';
    const r = await verifyMobilePayment({
      sourcePhoneNumber: '04141234567',
      bankCode: '0163',
      amount: 100,
      paidOn: '2026-05-07T12:00:00',
    });
    expect(r.isVerified).toBe(true);
    expect(r.code).toBe('B010');
    expect(r.verifiedAmount).toBe(100);
    expect(r.reference).toMatch(/^REF\d+/);
    expect(axios.post).not.toHaveBeenCalled();
  });
});

describe('verifyMobilePayment — modo deshabilitado', () => {
  test('MERITOP_ENABLED=false lanza MERITOP_DISABLED', async () => {
    process.env.MERITOP_ENABLED = 'false';
    await expect(verifyMobilePayment({})).rejects.toMatchObject({
      code: 'MERITOP_DISABLED',
    });
  });
});

describe('verifyMobilePayment — errores 400 amigables', () => {
  test('B001 mapea a MERITOP_B001 con mensaje amigable', async () => {
    axios.post
      .mockResolvedValueOnce({ data: { token: 'JWT', expirationDate: new Date(Date.now() + 600_000).toISOString() } })
      .mockRejectedValueOnce({
        response: { status: 400, data: { code: 'B001', message: 'no encontrada' } },
      });

    await expect(verifyMobilePayment({
      sourcePhoneNumber: '04141234567', bankCode: '0163', amount: 100, paidOn: 'now',
    })).rejects.toMatchObject({
      code: 'MERITOP_B001',
      baCode: 'B001',
    });
  });

  test('B002 mapea con mensaje "duplicada"', async () => {
    axios.post
      .mockResolvedValueOnce({ data: { token: 'JWT', expirationDate: new Date(Date.now() + 600_000).toISOString() } })
      .mockRejectedValueOnce({
        response: { status: 400, data: { code: 'B002' } },
      });

    await expect(verifyMobilePayment({
      sourcePhoneNumber: '04141234567', bankCode: '0163', amount: 100, paidOn: 'now',
    })).rejects.toMatchObject({
      code: 'MERITOP_B002',
      message: expect.stringMatching(/duplicada/i),
    });
  });
});

describe('verifyMobilePayment — error de red', () => {
  test('sin response (red caída) lanza MERITOP_CONNECTION_ERROR', async () => {
    axios.post
      .mockResolvedValueOnce({ data: { token: 'JWT', expirationDate: new Date(Date.now() + 600_000).toISOString() } })
      .mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await expect(verifyMobilePayment({
      sourcePhoneNumber: '04141234567', bankCode: '0163', amount: 100, paidOn: 'now',
    })).rejects.toMatchObject({
      code: 'MERITOP_CONNECTION_ERROR',
    });
  });
});

describe('verifyMobilePayment — éxito', () => {
  test('respuesta isverified=true devuelve estructura normalizada', async () => {
    axios.post
      .mockResolvedValueOnce({ data: { token: 'JWT', expirationDate: new Date(Date.now() + 600_000).toISOString() } })
      .mockResolvedValueOnce({
        data: {
          isverified: true,
          bankreference: '987654321',
          verifiedAmount: 250.50,
          verifiedOn: '2026-05-07T13:30:00',
          message: 'OK',
        },
      });

    const r = await verifyMobilePayment({
      sourcePhoneNumber: '04141234567', bankCode: '0163', amount: 250.50, paidOn: 'now',
    });

    expect(r).toMatchObject({
      isVerified: true,
      reference: '987654321',
      verifiedAmount: 250.50,
      message: 'OK',
      code: 'B010',
    });
  });
});
