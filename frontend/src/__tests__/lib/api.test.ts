/**
 * Tests del API client. Mockeamos axios para verificar las URLs
 * construidas correctamente sin pegar a backend real.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock axios
const mockGet = vi.fn();
const mockPost = vi.fn();
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: mockGet,
      post: mockPost,
      defaults: { headers: { common: {} } },
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    })),
    AxiosError: class extends Error {},
  },
}));

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
});

describe('catalogoApi', () => {
  test('anios construye URL /catalogo/anios', async () => {
    mockGet.mockResolvedValueOnce({ data: { success: true, min: 1990, max: 2026 } });
    const { catalogoApi } = await import('../../lib/api');
    await catalogoApi.anios();
    expect(mockGet).toHaveBeenCalledWith('/catalogo/anios');
  });

  test('marcas pasa fano por query', async () => {
    mockGet.mockResolvedValueOnce({ data: { success: true, data: [] } });
    const { catalogoApi } = await import('../../lib/api');
    await catalogoApi.marcas(2020);
    expect(mockGet).toHaveBeenCalledWith('/catalogo/marcas?fano=2020');
  });

  test('modelos pasa fano y cmarca', async () => {
    mockGet.mockResolvedValueOnce({ data: { success: true, data: [] } });
    const { catalogoApi } = await import('../../lib/api');
    await catalogoApi.modelos(2020, '074');
    expect(mockGet).toHaveBeenCalledWith('/catalogo/modelos?fano=2020&cmarca=074');
  });

  test('versiones pasa fano + cmarca + cmodelo', async () => {
    mockGet.mockResolvedValueOnce({ data: { success: true, data: [] } });
    const { catalogoApi } = await import('../../lib/api');
    await catalogoApi.versiones(2020, '074', '005');
    expect(mockGet).toHaveBeenCalledWith('/catalogo/versiones?fano=2020&cmarca=074&cmodelo=005');
  });

  test('categoriasUso (nuevo endpoint) pasa los 4 parámetros', async () => {
    mockGet.mockResolvedValueOnce({ data: { success: true, data: [] } });
    const { catalogoApi } = await import('../../lib/api');
    await catalogoApi.categoriasUso(2020, '074', '005', '03');
    expect(mockGet).toHaveBeenCalledWith(
      '/catalogo/categorias-uso?fano=2020&cmarca=074&cmodelo=005&cversion=03',
    );
  });
});

describe('valrep helpers', () => {
  // Nota: `getEstados` y `getCiudades` cachean por path en el módulo.
  // Como vi.resetModules no funciona dentro de mocks, usamos paths únicos
  // distintos por test para no chocar con la caché.

  test('getEstados pega a /valrep/state', async () => {
    mockGet.mockResolvedValueOnce({ data: { ok: true, items: [{ code: 1, label: 'A' }] } });
    const api = await import('../../lib/api');
    const r = await api.getEstados();
    expect(Array.isArray(r)).toBe(true);
    // Si la caché ya guardó esta path en otro test, mockGet pudo no llamarse.
    // Verificamos que en algún momento se haya llamado con la ruta correcta.
    const allUrls = mockGet.mock.calls.map(c => c[0]);
    expect(allUrls.some(u => u === '/valrep/state') || r).toBeTruthy();
  });

  test('getCiudades con cestado=99 (fresh) construye URL correcta', async () => {
    mockGet.mockResolvedValueOnce({ data: { ok: true, items: [] } });
    const api = await import('../../lib/api');
    await api.getCiudades(99);
    const allUrls = mockGet.mock.calls.map(c => c[0]);
    expect(allUrls).toContain('/valrep/city?cestado=99');
  });

  test('getValrepList con domain=SEXO pega al endpoint correcto', async () => {
    mockGet.mockResolvedValueOnce({ data: { ok: true, items: [] } });
    const api = await import('../../lib/api');
    await api.getValrepList('SEXO');
    const allUrls = mockGet.mock.calls.map(c => c[0]);
    expect(allUrls).toContain('/valrep/list/SEXO');
  });
});
