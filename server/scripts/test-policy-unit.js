/**
 * Test unitario del modulo La Mundial.
 *
 * Mockea axios para NO golpear el API real (no consume cupo, no requiere red).
 * Verifica:
 *   - Construccion de payloads (mapper).
 *   - Normalizacion de cedula/fecha/placa.
 *   - Validaciones del payload.
 *   - Manejo de errores anidados de La Mundial.
 *   - Flujo orquestado quoteAndEmit (cotiza primero, luego emite).
 *   - Codigos de error tipados (placa duplicada, SP outdated, etc.).
 *
 * Ejecutar:
 *   node server/scripts/test-policy-unit.js
 */
const path = require('path');
const Module = require('module');

// ────────────────────────────────────────────────────────────────────────
// Stub de axios ANTES de cargar el cliente.
// ────────────────────────────────────────────────────────────────────────
const stub = {
  nextResponse: null,
  nextHttpStatus: 200,
  capturedRequests: [],
  shouldThrow: null,
};

const axiosStub = {
  create() {
    return {
      async post(url, body) {
        stub.capturedRequests.push({ url, body });
        if (stub.shouldThrow) {
          const err = stub.shouldThrow;
          stub.shouldThrow = null;
          throw err;
        }
        const data = stub.nextResponse;
        const status = stub.nextHttpStatus;
        stub.nextResponse = null;
        stub.nextHttpStatus = 200;
        return { status, data };
      },
    };
  },
};

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (req, parent, ...rest) {
  if (req === 'axios') {
    return path.resolve(__dirname, '__axios_stub__.js');
  }
  return originalResolve.call(this, req, parent, ...rest);
};
require.cache[path.resolve(__dirname, '__axios_stub__.js')] = {
  id: path.resolve(__dirname, '__axios_stub__.js'),
  filename: path.resolve(__dirname, '__axios_stub__.js'),
  loaded: true,
  exports: axiosStub,
};

// ────────────────────────────────────────────────────────────────────────
// Configuracion de entorno minima para que el cliente arranque
// ────────────────────────────────────────────────────────────────────────
process.env.LAMUNDIAL_BASE_URL = 'https://test.lamundial.local';
process.env.LAMUNDIAL_APIKEY = 'TEST-APIKEY-1234';
process.env.LAMUNDIAL_PRODUCTOR = '80080';
process.env.LAMUNDIAL_CUSUARIO = '4';
process.env.LAMUNDIAL_RAMO = '18';
process.env.LAMUNDIAL_PLAN_DEFAULT = 'RCVBAS';
process.env.LAMUNDIAL_FRECUENCIA_DEFAULT = 'A';
process.env.LAMUNDIAL_TIMEOUT_MS = '5000';
process.env.POLICY_MODE = 'live';

// ────────────────────────────────────────────────────────────────────────
// Cargar modulos despues del stub
// ────────────────────────────────────────────────────────────────────────
const policyService = require('../src/services/lamundial/policyService');
const { buildEmissionRequest, _internal: mapperInternals } =
  require('../src/services/lamundial/policyMapper');
const { validateEmissionPayload } =
  require('../src/services/lamundial/policyValidator');
const { resolveVehicleCodes, resolveStateCode } =
  require('../src/services/lamundial/catalogs');

// ────────────────────────────────────────────────────────────────────────
// Helpers de aserciones
// ────────────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
function assert(name, cond, hint) {
  if (cond) {
    console.log(`  PASS  ${name}`);
    passed++;
  } else {
    console.log(`  FAIL  ${name}` + (hint ? `  -> ${hint}` : ''));
    failed++;
  }
}

function fakeState() {
  return {
    tomador: {
      tipoDoc: 'V',
      identificacion: 'V-25.221.952',
      nombre: 'Gabriel',
      apellido: 'Estacio',
      telefono: '+584241829583',
      email: 'gabriel@example.com',
      sexo: 'M',
      fechaNac: '13/10/1996',
      estadoCivil: 'Soltero',
      estado: 'Caracas',
      ciudad: 'Caracas',
      direccion: 'Av. Norte, Caracas',
    },
    sameInsured: true,
    asegurado: {},
    vehicle: {
      placa: 'ABC-1234',
      marca: 'Toyota',
      modelo: 'Corolla',
      año: '2020',
      color: 'Blanco',
      serial: 'SC1S6ZMV3024399',
      uso: 'Particular',
    },
    selectedPlan: { name: 'Básico', price: 'Bs 200.000', priceNum: 200000 },
  };
}

// ────────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n[1] mapper.normalizeDate acepta varios formatos');
  assert('YYYY-MM-DD', mapperInternals.normalizeDate('2020-04-15') === '2020-04-15');
  assert('DD/MM/YYYY', mapperInternals.normalizeDate('15/04/2020') === '2020-04-15');
  assert('DD-MM-YYYY', mapperInternals.normalizeDate('15-04-2020') === '2020-04-15');
  assert('ISO completo', mapperInternals.normalizeDate('2020-04-15T10:00:00Z') === '2020-04-15');
  assert('vacio -> ""', mapperInternals.normalizeDate('') === '');

  console.log('\n[2] mapper.onlyDigits limpia rif/cedula');
  assert('V-25.221.952 -> 25221952', mapperInternals.onlyDigits('V-25.221.952') === '25221952');
  assert('null -> ""', mapperInternals.onlyDigits(null) === '');

  console.log('\n[3] mapper.upperPlate normaliza placa');
  assert('abc-1234 -> ABC1234', mapperInternals.upperPlate('abc-1234') === 'ABC1234');

  console.log('\n[4] catalogs resuelven Toyota Corolla por nombre');
  const codes = resolveVehicleCodes('Toyota', 'Corolla');
  assert('cmarca=083', codes.cmarca === '083');
  assert('cmodelo=001', codes.cmodelo === '001');
  assert('cversion=03', codes.cversion === '03');
  assert('no es fallback', codes.fallback === false);

  console.log('\n[5] catalogs caen al default Toyota cuando marca desconocida');
  const fb = resolveVehicleCodes('MarcaInventada', 'ModeloX');
  assert('fallback flag', fb.fallback === true);
  assert('cmarca default 083', fb.cmarca === '083');

  console.log('\n[6] catalogs estado Caracas -> 1, desconocido -> 1');
  assert('Caracas -> 1', resolveStateCode('Caracas') === 1);
  assert('Distrito Capital -> 1', resolveStateCode('Distrito Capital') === 1);
  assert('Estado X -> 1', resolveStateCode('NoExiste') === 1);

  console.log('\n[7] buildEmissionRequest construye payload coherente');
  const built = buildEmissionRequest(fakeState(),
    { mprima: 198114.5, mprimaext: 408.29, ptasa: 485.2251 });
  const p = built.payload;
  assert('cramo=18', p.cramo === 18);
  assert('plan=RCVBAS', p.plan === 'RCVBAS');
  assert('frecuencia=A', p.frecuencia === 'A');
  assert('rif sin letra', p.rif_tomador === '25221952');
  assert('placa upper sin guion', p.placa === 'ABC1234');
  assert('fnac normalizada', p.fnac_tomador === '1996-10-13');
  assert('mprima number', typeof p.mprima === 'number' && p.mprima === 198114.5);
  assert('ptasa number', typeof p.ptasa === 'number');
  assert('marca codigo', p.marca === '083');
  assert('color default Blanco', p.color === 'Blanco');
  assert('dec_term_y_cod=1', p.dec_term_y_cod === '1');

  console.log('\n[8] validator detecta placa invalida');
  const bad = { ...p, placa: 'XX' };
  const errs = validateEmissionPayload(bad);
  assert('error de placa', errs.some((e) => e.includes('placa')));

  console.log('\n[9] validator pasa con payload completo');
  const ok = validateEmissionPayload(p);
  assert('sin errores', ok.length === 0, ok.join('; '));

  console.log('\n[10] orquestador quoteAndEmit (live) cotiza y emite');
  // Primera llamada del orquestador es getCotizacionAuto
  stub.capturedRequests.length = 0;
  // Configurar dos respuestas en cadena: cotizacion + emision.
  // Como nuestro stub usa una sola variable, tenemos que envolverlo:
  let step = 0;
  const origCreate = axiosStub.create;
  axiosStub.create = function () {
    return {
      async post(url, body) {
        stub.capturedRequests.push({ url, body });
        if (step === 0) {
          step++;
          return {
            status: 200,
            data: {
              status: true,
              result: { mprima: '198114.50', mprimaext: '408.29', ptasa: 485.2251 },
            },
          };
        }
        return {
          status: 200,
          data: {
            status: true,
            result: {
              message: 'Póliza generada exitosamente',
              cnpoliza: '18-1-0000048127',
              urlpoliza: 'https://qa/poliza/18-1-0000048127/',
              cnrecibo: '18-100143232',
              ncuota: 1,
            },
          },
        };
      },
    };
  };
  // Forzar nuevo cliente (cache interno por config).
  delete require.cache[require.resolve('../src/services/lamundial/lamundialClient')];
  const policyServiceFresh = (() => {
    delete require.cache[require.resolve('../src/services/lamundial/policyService')];
    return require('../src/services/lamundial/policyService');
  })();

  const result = await policyServiceFresh.quoteAndEmit(fakeState(), { plan: 'RCVBAS' });
  assert('cnpoliza ok', result.cnpoliza === '18-1-0000048127');
  assert('cnrecibo ok', result.cnrecibo === '18-100143232');
  assert('urlpoliza ok', !!result.urlpoliza);
  assert('quote.mprima propagada', result.quote.mprima === 198114.5);
  assert('internalPolicyId presente', typeof result.internalPolicyId === 'string');
  assert('llamo a 2 endpoints', stub.capturedRequests.length === 2);
  assert('1ro fue cotizar', stub.capturedRequests[0].url === '/getCotizacionAuto');
  assert('2do fue emitir', stub.capturedRequests[1].url === '/createEmissionAuto');

  console.log('\n[11] orquestador propaga error de placa duplicada');
  step = 0;
  axiosStub.create = function () {
    return {
      async post(url) {
        if (url === '/getCotizacionAuto') {
          return { status: 200, data: { status: true, result: { mprima: '1', mprimaext: '0.1', ptasa: 1 } } };
        }
        // emit
        return {
          status: 400,
          data: {
            status: false,
            result: {
              error: true,
              result: { error: 'Se ha detectado la existencia de una poliza vigente la misma placa del vehiculo.' },
            },
          },
        };
      },
    };
  };
  delete require.cache[require.resolve('../src/services/lamundial/lamundialClient')];
  delete require.cache[require.resolve('../src/services/lamundial/policyService')];
  const ps2 = require('../src/services/lamundial/policyService');
  let caught = null;
  try {
    await ps2.quoteAndEmit(fakeState(), { plan: 'RCVBAS' });
  } catch (e) {
    caught = e;
  }
  assert('lanza error', !!caught);
  assert('codigo PLATE_ALREADY_INSURED', caught && caught.code === 'LAMUNDIAL_PLATE_ALREADY_INSURED');
  assert('http 409', caught && caught.httpStatus === 409);

  console.log('\n[12] orquestador detecta SP outdated');
  axiosStub.create = function () {
    return {
      async post(url) {
        if (url === '/getCotizacionAuto') {
          return { status: 200, data: { status: true, result: { mprima: '1', mprimaext: '0.1', ptasa: 1 } } };
        }
        return {
          status: 400,
          data: {
            status: false,
            result: {
              error: true,
              result: { error: 'Column name or number of supplied values does not match table definition.' },
            },
          },
        };
      },
    };
  };
  delete require.cache[require.resolve('../src/services/lamundial/lamundialClient')];
  delete require.cache[require.resolve('../src/services/lamundial/policyService')];
  const ps3 = require('../src/services/lamundial/policyService');
  caught = null;
  try {
    await ps3.quoteAndEmit(fakeState(), { plan: 'RCVBAS' });
  } catch (e) {
    caught = e;
  }
  assert('codigo SP_OUTDATED', caught && caught.code === 'LAMUNDIAL_SP_OUTDATED');

  console.log('\n[13] modo mock NO toca axios');
  process.env.POLICY_MODE = 'mock';
  delete require.cache[require.resolve('../src/services/lamundial/policyService')];
  const psMock = require('../src/services/lamundial/policyService');
  let calls = 0;
  axiosStub.create = function () {
    return {
      async post() {
        calls++;
        return { status: 500, data: {} };
      },
    };
  };
  const mockResult = await psMock.quoteAndEmit(fakeState());
  assert('mock devuelve LM-2026-...', /^LM-2026-\d+$/.test(mockResult.cnpoliza));
  assert('mock no llama axios', calls === 0);
  process.env.POLICY_MODE = 'live';

  // Restaurar
  axiosStub.create = origCreate;

  // ─────────────────────────────────────────────────────────────────────
  console.log(`\nResumen: ${passed} ok, ${failed} fallos`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Error inesperado en test:', err);
  process.exit(1);
});
