/**
 * Pruebas de integración HTTP para las rutas de catálogo INMA.
 * Mockeamos lamundialClient para no tocar red.
 */
const request = require('supertest');
const path = require('path');

jest.mock('../../src/services/lamundial/lamundialClient', () => ({
  getInmaAnios: jest.fn(),
  getInmaMarcas: jest.fn(),
  getInmaModelos: jest.fn(),
  getInmaVersiones: jest.fn(),
  getCategoriasUso: jest.fn(),
  getCotizacionAuto: jest.fn(),
  createEmissionAuto: jest.fn(),
  _internal: {},
}));

const lmc = require('../../src/services/lamundial/lamundialClient');
const { buildApp } = require(path.join(__dirname, '..', 'helpers', 'buildApp'));

const app = buildApp();

beforeEach(() => {
  Object.values(lmc).forEach((v) => typeof v?.mockReset === 'function' && v.mockReset());
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('GET /api/catalogo/anios', () => {
  test('devuelve { min, max }', async () => {
    lmc.getInmaAnios.mockResolvedValueOnce({ min: 1990, max: 2026 });
    const r = await request(app).get('/api/catalogo/anios');
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
    expect(r.body.min).toBe(1990);
    expect(r.body.max).toBe(2026);
  });

  test('error upstream → 502', async () => {
    lmc.getInmaAnios.mockRejectedValueOnce(new Error('upstream failed'));
    const r = await request(app).get('/api/catalogo/anios');
    expect(r.status).toBe(502);
    expect(r.body.success).toBe(false);
  });
});

describe('GET /api/catalogo/marcas', () => {
  test('sin fano → 400', async () => {
    const r = await request(app).get('/api/catalogo/marcas');
    expect(r.status).toBe(400);
    expect(r.body.success).toBe(false);
  });

  test('con fano válido → 200 con array de marcas', async () => {
    lmc.getInmaMarcas.mockResolvedValueOnce([
      { cmarca: '074', xmarca: 'TOYOTA' },
      { cmarca: '013', xmarca: 'CHEVROLET' },
    ]);
    const r = await request(app).get('/api/catalogo/marcas?fano=2020');
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(2);
    expect(lmc.getInmaMarcas).toHaveBeenCalledWith(2020);
  });
});

describe('GET /api/catalogo/modelos', () => {
  test('sin fano o cmarca → 400', async () => {
    const r1 = await request(app).get('/api/catalogo/modelos?fano=2020');
    expect(r1.status).toBe(400);
    const r2 = await request(app).get('/api/catalogo/modelos?cmarca=074');
    expect(r2.status).toBe(400);
  });

  test('parámetros válidos → 200', async () => {
    lmc.getInmaModelos.mockResolvedValueOnce([
      { cmodelo: '005', xmodelo: 'COROLLA' },
    ]);
    const r = await request(app).get('/api/catalogo/modelos?fano=2020&cmarca=074');
    expect(r.status).toBe(200);
    expect(r.body.data[0].xmodelo).toBe('COROLLA');
  });
});

describe('GET /api/catalogo/versiones', () => {
  test('parámetros válidos devuelven versiones', async () => {
    lmc.getInmaVersiones.mockResolvedValueOnce([
      { cversion: '03', xversion: 'XLI 1.6L 4Cil' },
    ]);
    const r = await request(app).get('/api/catalogo/versiones?fano=2020&cmarca=074&cmodelo=005');
    expect(r.status).toBe(200);
    expect(r.body.data[0].cversion).toBe('03');
  });
});

describe('GET /api/catalogo/categorias-uso (NUEVO)', () => {
  test('falta cversion → 400', async () => {
    const r = await request(app).get('/api/catalogo/categorias-uso?fano=2020&cmarca=074&cmodelo=005');
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/requeridos/i);
  });

  test('parámetros completos → 200 con array de categorías', async () => {
    lmc.getCategoriasUso.mockResolvedValueOnce([
      { ccategoria_uso: 1, xcategoria_uso: 'Auto particular' },
      { ccategoria_uso: 2, xcategoria_uso: 'Comercial' },
    ]);
    const r = await request(app).get(
      '/api/catalogo/categorias-uso?fano=2020&cmarca=074&cmodelo=005&cversion=03',
    );
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
    expect(r.body.data).toHaveLength(2);
    expect(lmc.getCategoriasUso).toHaveBeenCalledWith({
      fano: 2020, cmarca: '074', cmodelo: '005', cversion: '03',
    });
  });

  test('error upstream → 502', async () => {
    lmc.getCategoriasUso.mockRejectedValueOnce(new Error('La Mundial no responde'));
    const r = await request(app).get(
      '/api/catalogo/categorias-uso?fano=2020&cmarca=074&cmodelo=005&cversion=03',
    );
    expect(r.status).toBe(502);
  });
});
