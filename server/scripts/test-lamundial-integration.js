/**
 * Test de integracion REAL contra el ambiente QA de La Mundial.
 *
 * ATENCION: este script consume cupo de la apikey y emite una poliza real
 * en el ambiente QA. Solo correr cuando quieras validar end-to-end.
 *
 * Uso:
 *   1. Asegurate de tener LAMUNDIAL_BASE_URL y LAMUNDIAL_APIKEY en .env
 *      o exportadas en tu shell.
 *   2. node server/scripts/test-lamundial-integration.js [--placa=EX999999]
 *
 * Si omites --placa, generamos una EX + 6 digitos aleatorios (suficientemente
 * unica en QA salvo colision).
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const policyService = require('../src/services/lamundial/policyService');

function arg(name, def) {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (found) return found.split('=', 2)[1];
  return def;
}

function randomPlate() {
  const n = String(Math.floor(100000 + Math.random() * 899999));
  return `EX${n}`;
}

const state = {
  tomador: {
    tipoDoc: 'V',
    identificacion: 'V-25.221.952',
    nombre: 'Gabriel',
    apellido: 'Estacio',
    telefono: '+584241829583',
    email: 'gabriel@example.com',
    sexo: 'M',
    fechaNac: '1996-10-13',
    estadoCivil: 'Soltero',
    estado: 'Caracas',
    ciudad: 'Caracas',
    direccion: 'Av. Norte, Caracas',
  },
  sameInsured: true,
  asegurado: {},
  vehicle: {
    placa: arg('placa', randomPlate()),
    marca: 'Toyota',
    modelo: 'Corolla',
    año: '2020',
    color: 'Blanco',
    serial: 'SC1S6ZMV3024399',
    uso: 'Particular',
  },
  selectedPlan: { name: 'RCV Basico', price: 'Bs 200.000' },
};

(async () => {
  console.log('Modo:', policyService.getMode());
  console.log('Placa de prueba:', state.vehicle.placa);
  console.log('---');

  try {
    console.log('Cotizando...');
    const q = await policyService.quote(state);
    console.log('  mprima   :', q.mprima);
    console.log('  mprimaext:', q.mprimaext);
    console.log('  ptasa    :', q.ptasa);
    console.log('  vehiculo :', q.metadata.vehicleLabel);

    console.log('\nEmitiendo (esto crea poliza real en QA)...');
    const r = await policyService.quoteAndEmit(state, { plan: 'RCVBAS', frecuencia: 'A' });
    console.log('  cnpoliza :', r.cnpoliza);
    console.log('  cnrecibo :', r.cnrecibo);
    console.log('  urlpoliza:', r.urlpoliza);
    console.log('  ncuota   :', r.ncuota);
    console.log('  internal :', r.internalPolicyId);
    console.log('\nOK. Abre la URL en navegador para ver el PDF emitido.');
  } catch (err) {
    console.error('FAIL', err.code || 'ERR', err.message);
    if (err.raw) console.error('  raw:', JSON.stringify(err.raw, null, 2));
    process.exit(1);
  }
})();
