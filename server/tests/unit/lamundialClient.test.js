/**
 * Pruebas del cliente HTTP de La Mundial — usa axios mockeado.
 *
 * Verificamos que cada función:
 *   - Use el método HTTP correcto (POST).
 *   - Mande los headers correctos (apikey).
 *   - Parsee la respuesta exitosa correctamente.
 *   - Lance un Error tipado (con `code`) cuando hay error de negocio.
 */
const path = require('path');

// IMPORTANTE: mockear axios ANTES de require el cliente.
jest.mock('axios');
const axios = require('axios');

// Cada vez que el cliente llama a `axios.create`, devolvemos un objeto con
// un `.post` mockeable que controlamos por test.
const mockPost = jest.fn();
axios.create = jest.fn(() => ({ post: mockPost }));

// Setear apikey antes de require el cliente para evitar el throw.
process.env.LAMUNDIAL_APIKEY = 'test-apikey-mock';

const lmc = require(path.join(__dirname, '..', '..', 'src', 'services', 'lamundial', 'lamundialClient'));

beforeEach(() => {
  mockPost.mockReset();
  // Silenciar logs ruidosos del cliente
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('getCotizacionAuto', () => {
  test('respuesta exitosa devuelve mprima/mprimaext/ptasa parseados', async () => {
    mockPost.mockResolvedValueOnce({
      status: 200,
      data: {
        status: true,
        result: { mprima: '1234.56', mprimaext: '25.50', ptasa: '0.005' },
      },
    });

    const r = await lmc.getCotizacionAuto({
      cmarca: '074', cmodelo: '005', cversion: '03', fano: 2020,
      cplan: 'RCVBAS', ccategoria_uso: 1, ntoneladas: 60,
    });

    expect(r.mprima).toBe(1234.56);
    expect(r.mprimaext).toBe(25.5);
    expect(r.ptasa).toBe(0.005);
    expect(mockPost).toHaveBeenCalledWith('/getCotizacionAuto', expect.objectContaining({
      cmarca: '074',
    }));
  });

  test('respuesta con status:false lanza error tipado con código', async () => {
    mockPost.mockResolvedValueOnce({
      status: 200,
      data: {
        status: false,
        result: { error: true, result: { error: 'Faltan campos' } },
      },
    });

    await expect(lmc.getCotizacionAuto({})).rejects.toMatchObject({
      message: expect.stringMatching(/faltan campos/i),
      code: 'LAMUNDIAL_MISSING_FIELDS',
    });
  });

  test('error de red lanza error con code=LAMUNDIAL_NETWORK', async () => {
    mockPost.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(lmc.getCotizacionAuto({})).rejects.toMatchObject({
      code: 'LAMUNDIAL_NETWORK',
    });
  });

  test('mensaje "poliza vigente" mapea a LAMUNDIAL_PLATE_ALREADY_INSURED', async () => {
    mockPost.mockResolvedValueOnce({
      status: 200,
      data: { status: false, result: { result: { error: 'Existe poliza vigente' } } },
    });
    await expect(lmc.getCotizacionAuto({})).rejects.toMatchObject({
      code: 'LAMUNDIAL_PLATE_ALREADY_INSURED',
    });
  });
});

describe('createEmissionAuto', () => {
  test('respuesta exitosa devuelve cnpoliza, cnrecibo y urlpoliza', async () => {
    mockPost.mockResolvedValueOnce({
      status: 200,
      data: {
        status: true,
        result: {
          cnpoliza: 'POL-2026-0001',
          cnrecibo: 'REC-2026-0001',
          urlpoliza: 'https://example.com/poliza.pdf',
          ncuota: 1,
          message: 'Emisión exitosa',
        },
      },
    });

    const r = await lmc.createEmissionAuto({ poliza: 'INT-001', placa: 'AE123KT' });
    expect(r.cnpoliza).toBe('POL-2026-0001');
    expect(r.urlpoliza).toMatch(/^https/);
    expect(mockPost).toHaveBeenCalledWith('/createEmissionAuto', expect.any(Object));
  });

  test('SP desactualizado mapea a LAMUNDIAL_SP_OUTDATED', async () => {
    mockPost.mockResolvedValueOnce({
      status: 200,
      data: { status: false, result: { result: { error: 'Number of supplied values does not match' } } },
    });
    await expect(lmc.createEmissionAuto({})).rejects.toMatchObject({
      code: 'LAMUNDIAL_SP_OUTDATED',
    });
  });
});

describe('getCategoriasUso (nuevo endpoint)', () => {
  test('respuesta exitosa devuelve la lista de categorias_uso', async () => {
    mockPost.mockResolvedValueOnce({
      status: 200,
      data: {
        status: true,
        result: {
          categorias_uso: [
            { ccategoria_uso: 1, xcategoria_uso: 'Auto particular' },
            { ccategoria_uso: 2, xcategoria_uso: 'Comercial' },
          ],
        },
      },
    });

    const list = await lmc.getCategoriasUso({
      fano: 2020, cmarca: '074', cmodelo: '005', cversion: '03',
    });

    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ ccategoria_uso: 1, xcategoria_uso: 'Auto particular' });
    expect(mockPost).toHaveBeenCalledWith('/getCategoriasUso', {
      fano: 2020, cmarca: '074', cmodelo: '005', cversion: '03',
    });
  });

  test('respuesta sin categorias_uso devuelve array vacío', async () => {
    mockPost.mockResolvedValueOnce({
      status: 200,
      data: { status: true, result: {} },
    });
    const list = await lmc.getCategoriasUso({ fano: 2020, cmarca: '0', cmodelo: '0', cversion: '0' });
    expect(list).toEqual([]);
  });

  test('error 401 mapea a LAMUNDIAL_UNAUTHORIZED', async () => {
    mockPost.mockResolvedValueOnce({
      status: 401,
      data: { status: false, result: { error: 'Unauthorized' } },
    });
    await expect(lmc.getCategoriasUso({})).rejects.toMatchObject({
      code: 'LAMUNDIAL_UNAUTHORIZED',
    });
  });
});

describe('catálogo INMA', () => {
  test('getInmaAnios devuelve { min, max }', async () => {
    mockPost.mockResolvedValueOnce({
      status: 200,
      data: { status: true, result: [{ min: 1990, max: 2026 }] },
    });
    const r = await lmc.getInmaAnios();
    expect(r.min).toBe(1990);
    expect(r.max).toBe(2026);
  });

  test('getInmaMarcas pasa fano en el body', async () => {
    mockPost.mockResolvedValueOnce({
      status: 200,
      data: { status: true, result: [{ cmarca: '074', xmarca: 'TOYOTA' }] },
    });
    const r = await lmc.getInmaMarcas(2020);
    expect(r).toHaveLength(1);
    expect(mockPost).toHaveBeenCalledWith('/marca', { fano: 2020 });
  });

  test('getInmaModelos pasa fano y cmarca', async () => {
    mockPost.mockResolvedValueOnce({
      status: 200,
      data: { status: true, result: [{ cmodelo: '005', xmodelo: 'COROLLA' }] },
    });
    await lmc.getInmaModelos(2020, '074');
    expect(mockPost).toHaveBeenCalledWith('/modelo', { fano: 2020, cmarca: '074' });
  });

  test('getInmaVersiones pasa fano + cmarca + cmodelo', async () => {
    mockPost.mockResolvedValueOnce({
      status: 200,
      data: { status: true, result: [{ cversion: '03', xversion: 'XLI' }] },
    });
    await lmc.getInmaVersiones(2020, '074', '005');
    expect(mockPost).toHaveBeenCalledWith('/version', { fano: 2020, cmarca: '074', cmodelo: '005' });
  });
});

describe('extractErrorMessage helper', () => {
  test('extrae error anidado result.result.error', () => {
    const msg = lmc._internal.extractErrorMessage({
      status: false,
      result: { result: { error: 'mensaje profundo' } },
    });
    expect(msg).toBe('mensaje profundo');
  });

  test('cae a result.error si no hay nested', () => {
    const msg = lmc._internal.extractErrorMessage({ result: { error: 'error medio' } });
    expect(msg).toBe('error medio');
  });

  test('cae a message raíz si no hay nada más', () => {
    const msg = lmc._internal.extractErrorMessage({ message: 'mensaje raiz' });
    expect(msg).toBe('mensaje raiz');
  });

  test('null devuelve "Sin respuesta"', () => {
    expect(lmc._internal.extractErrorMessage(null)).toBe('Sin respuesta');
  });
});
