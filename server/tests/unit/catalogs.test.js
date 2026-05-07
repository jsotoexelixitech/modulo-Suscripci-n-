/**
 * Pruebas de los catálogos estáticos La Mundial.
 *
 * No tocan red. resolveVehicleCodesLive se prueba aparte con axios mockeado.
 */
const path = require('path');
const catalogs = require(path.join(__dirname, '..', '..', 'src', 'services', 'lamundial', 'catalogs'));

describe('catalogs.resolveVehicleCodes', () => {
  test('Toyota Corolla devuelve códigos exactos sin fallback', () => {
    const r = catalogs.resolveVehicleCodes('Toyota', 'Corolla');
    expect(r.cmarca).toBe('074');
    expect(r.cmodelo).toBe('005');
    expect(r.fallback).toBe(false);
  });

  test('marca conocida, modelo desconocido cae al primer modelo con fallback=true', () => {
    const r = catalogs.resolveVehicleCodes('Toyota', 'ModeloInexistente');
    expect(r.cmarca).toBe('074');
    expect(r.fallback).toBe(true);
    expect(r.fallbackReason).toMatch(/modelo/i);
  });

  test('marca desconocida devuelve DEFAULT_BRAND con fallback=true', () => {
    const r = catalogs.resolveVehicleCodes('MarcaInexistente', 'ModeloInexistente');
    expect(r).toMatchObject(catalogs.DEFAULT_BRAND);
    expect(r.fallback).toBe(true);
    expect(r.fallbackReason).toMatch(/marca/i);
  });

  test('normaliza acentos y mayúsculas (Corolla / corolla / CORÓLLA)', () => {
    const r1 = catalogs.resolveVehicleCodes('toyota', 'corolla');
    const r2 = catalogs.resolveVehicleCodes('TOYOTA', 'CORÓLLA');
    expect(r1.cmodelo).toBe('005');
    expect(r2.cmodelo).toBe('005');
  });

  test('alias RAV4 / RAV 4 ambos resuelven al mismo modelo', () => {
    const r1 = catalogs.resolveVehicleCodes('Toyota', 'RAV4');
    const r2 = catalogs.resolveVehicleCodes('Toyota', 'RAV 4');
    expect(r1.cmodelo).toBe('016');
    expect(r2.cmodelo).toBe('016');
  });
});

describe('catalogs.resolveUsageCategory', () => {
  test('Particular = 1', () => {
    expect(catalogs.resolveUsageCategory('Particular')).toBe(1);
  });

  test('Comercial = 1 (mismo grupo La Mundial)', () => {
    expect(catalogs.resolveUsageCategory('Comercial')).toBe(1);
  });

  test('Carga = 4', () => {
    expect(catalogs.resolveUsageCategory('Carga')).toBe(4);
  });

  test('Transporte público = 2', () => {
    expect(catalogs.resolveUsageCategory('Transporte público')).toBe(2);
    expect(catalogs.resolveUsageCategory('TRANSPORTE PUBLICO')).toBe(2);
  });

  test('Motos = 5', () => {
    expect(catalogs.resolveUsageCategory('Motos')).toBe(5);
  });

  test('default Particular cuando es desconocido', () => {
    expect(catalogs.resolveUsageCategory('Algo raro')).toBe(1);
  });

  test('matching parcial: "transporte de pasajeros" → 2', () => {
    expect(catalogs.resolveUsageCategory('transporte de pasajeros')).toBe(2);
  });
});

describe('catalogs.resolveStateCode', () => {
  test('Distrito Capital = 1', () => {
    expect(catalogs.resolveStateCode('Distrito Capital')).toBe(1);
    expect(catalogs.resolveStateCode('CARACAS')).toBe(1);
  });

  test('Miranda = 15', () => {
    expect(catalogs.resolveStateCode('Miranda')).toBe(15);
  });

  test('Zulia = 24', () => {
    expect(catalogs.resolveStateCode('Zulia')).toBe(24);
  });

  test('La Guaira = 22 (alias de Vargas)', () => {
    expect(catalogs.resolveStateCode('La Guaira')).toBe(22);
    expect(catalogs.resolveStateCode('Vargas')).toBe(22);
  });

  test('estado desconocido devuelve DEFAULT_STATE_CODE', () => {
    expect(catalogs.resolveStateCode('Otro')).toBe(catalogs.DEFAULT_STATE_CODE);
  });
});

describe('catalogs.resolveCityCode', () => {
  test('siempre devuelve DEFAULT_CITY_CODE (catálogo estático no diferencia)', () => {
    expect(catalogs.resolveCityCode('Cualquier ciudad', 1)).toBe(catalogs.DEFAULT_CITY_CODE);
  });
});
