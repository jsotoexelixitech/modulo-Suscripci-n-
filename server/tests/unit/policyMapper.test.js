/**
 * Pruebas unitarias del mapper La Mundial.
 *
 * Cubre las funciones públicas que transforman el `wizardState` del frontend
 * en los payloads exactos que esperan getCotizacionAuto y createEmissionAuto.
 *
 * Estos tests NO tocan red — la única dependencia externa es `catalogs.js`
 * (resolución estática de códigos por texto) que se ejercita tal cual.
 */
const path = require('path');

const policyMapper = require(path.join(__dirname, '..', '..', 'src', 'services', 'lamundial', 'policyMapper'));

describe('policyMapper.buildQuoteRequest', () => {
  const baseState = {
    vehicle: {
      placa: 'AE123KT',
      marca: 'TOYOTA',
      modelo: 'COROLLA',
      año: '2020',
      uso: 'Particular',
      cmarca: '074',
      cmodelo: '005',
      cversion: '03',
    },
  };

  test('arma payload mínimo con plan por defecto RCVBAS', () => {
    const { payload } = policyMapper.buildQuoteRequest(baseState);

    expect(payload).toMatchObject({
      cmarca: '074',
      cmodelo: '005',
      cversion: '03',
      fano: 2020,
      cplan: 'RCVBAS',
      ntoneladas: 60,
    });
    expect(payload.ccategoria_uso).toBeGreaterThan(0);
  });

  test('respeta plan override pasado en overrides', () => {
    const { payload } = policyMapper.buildQuoteRequest(baseState, { plan: 'RUSPAT' });
    expect(payload.cplan).toBe('RUSPAT');
  });

  test('prioriza ccategoria_uso numérico del vehicle sobre el mapeo por texto', () => {
    const state = { vehicle: { ...baseState.vehicle, uso: 'Particular', ccategoria_uso: 9 } };
    const { payload } = policyMapper.buildQuoteRequest(state);
    expect(payload.ccategoria_uso).toBe(9);
  });

  test('cuando no hay año cae al año actual', () => {
    const state = { vehicle: { ...baseState.vehicle, año: '' } };
    const { payload } = policyMapper.buildQuoteRequest(state);
    expect(payload.fano).toBe(new Date().getFullYear());
  });

  test('expone metadata con label del vehículo', () => {
    const { metadata } = policyMapper.buildQuoteRequest(baseState);
    expect(metadata).toHaveProperty('vehicleLabel');
    expect(metadata.vehicleFallback).toBe(false);
  });
});

describe('policyMapper.buildEmissionRequest', () => {
  const wizardState = {
    tomador: {
      tipoDoc: 'V',
      identificacion: '12345678',
      nombre: 'JAVIER',
      apellido: 'SOTO',
      sexo: 'M',
      fechaNac: '1990-01-15',
      telefono: '04141234567',
      email: 'test@example.com',
      direccion: 'Av. Principal',
      cestado: '1',
      cciudad: '5',
    },
    vehicle: {
      placa: 'AE123KT',
      marca: 'TOYOTA',
      modelo: 'COROLLA',
      año: '2020',
      color: 'Plateado',
      serial: '1HGBH41JXMN109186',
      uso: 'Particular',
      cmarca: '074',
      cmodelo: '005',
      cversion: '03',
      ccategoria_uso: 1,
    },
    sameInsured: true,
  };

  const cotizacion = { mprima: 1234.56, mprimaext: 25.50, ptasa: 0.005 };

  test('payload contiene todos los campos críticos para createEmissionAuto', () => {
    const { payload } = policyMapper.buildEmissionRequest(wizardState, cotizacion);

    expect(payload).toMatchObject({
      cramo: expect.any(Number),
      plan: expect.any(String),
      frecuencia: expect.any(String),
      fecha_emision: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),

      tipo_cedula_tomador: 'V',
      rif_tomador: '12345678',
      nombre_tomador: 'JAVIER',
      apellido_tomador: 'SOTO',

      marca: '074',
      modelo: '005',
      version: '03',
      placa: 'AE123KT',
      color: 'Plateado',
      serial_carroceria: '1HGBH41JXMN109186',
      ccategoria_uso: 1,

      mprima: 1234.56,
      mprimaext: 25.50,
      ptasa: 0.005,
    });
  });

  test('usa cestado/cciudad del tomador como código numérico cuando están seteados', () => {
    const { payload } = policyMapper.buildEmissionRequest(wizardState, cotizacion);
    expect(payload.estado_tomador).toBe(1);
    expect(payload.ciudad_tomador).toBe(5);
  });

  test('cuando sameInsured=false utiliza datos del asegurado titular distinto', () => {
    const state = {
      ...wizardState,
      sameInsured: false,
      asegurado: {
        ...wizardState.tomador,
        nombre: 'OTRO',
        apellido: 'TITULAR',
        identificacion: '87654321',
        cestado: '2',
        cciudad: '8',
      },
    };
    const { payload } = policyMapper.buildEmissionRequest(state, cotizacion);
    expect(payload.nombre_titular).toBe('OTRO');
    expect(payload.apellido_titular).toBe('TITULAR');
    expect(payload.rif_titular).toBe('87654321');
    expect(payload.estado_titular).toBe(2);
    expect(payload.ciudad_titular).toBe(8);
  });

  test('declaraciones legales tienen los defaults aceptados por La Mundial', () => {
    const { payload } = policyMapper.buildEmissionRequest(wizardState, cotizacion);
    expect(payload.dec_persona_politica).toBe('0');
    expect(payload.dec_term_y_cod).toBe('1');
  });

  test('serial vacío no rompe el mapper (lo deja como string vacío)', () => {
    const state = { ...wizardState, vehicle: { ...wizardState.vehicle, serial: '' } };
    const { payload } = policyMapper.buildEmissionRequest(state, cotizacion);
    expect(payload.serial_carroceria).toBe('');
  });
});
