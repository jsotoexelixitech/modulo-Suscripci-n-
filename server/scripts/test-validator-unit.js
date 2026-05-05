/* eslint-disable */
/**
 * Test unitario del validador de tipo de documento.
 *
 * No llama a Gemini real (evita el rate limit del free tier).
 * Inyecta un mock de geminiProvider via require.cache para simular
 * todas las combinaciones de respuestas posibles y verifica que
 * documentService.runOcr() y la ruta de upload reaccionen correctamente.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const path = require('path');
const Module = require('module');

// Reemplaza el provider real por un stub controlado.
const providerPath = path.resolve(__dirname, '..', 'src', 'services', 'ocrProviders', 'geminiProvider.js');
const stub = {
  nextResponse: null,
  async extract(_filePath, _mimetype, _docType) {
    if (!stub.nextResponse) throw new Error('Stub: nextResponse no configurado');
    if (stub.nextResponse instanceof Error) throw stub.nextResponse;
    return stub.nextResponse;
  },
  SUPPORTED_MIME: new Set(['image/png', 'image/jpeg', 'application/pdf']),
};

require.cache[providerPath] = {
  id: providerPath,
  filename: providerPath,
  loaded: true,
  exports: stub,
};

const { runOcr } = require('../src/services/documentService');

// Forzamos provider=gemini para que pase por la rama validada.
process.env.OCR_PROVIDER = 'gemini';

let pass = 0;
let fail = 0;
function assert(name, cond, extra) {
  if (cond) {
    console.log(`  OK   ${name}`);
    pass++;
  } else {
    console.log(`  FAIL ${name}${extra ? ' :: ' + extra : ''}`);
    fail++;
  }
}

async function run() {
  const fakeFile = { path: 'fake.png', mimetype: 'image/png', size: 4096 };

  console.log('\n[1] Documento correcto (slot=cedula, detected=cedula)');
  stub.nextResponse = {
    fields: { documentoTipo: 'cedula', identificacion: '14484939', nombre: 'Juan' },
    meta: { provider: 'gemini', model: 'test', elapsedMs: 10 },
  };
  let r = await runOcr(fakeFile, 'cedula');
  assert('provider=gemini', r.provider === 'gemini', `got=${r.provider}`);
  assert('sin mismatch', !r.mismatch);
  assert('campos extraidos', !!r.fields && r.fields.identificacion === '14484939');
  assert('documentoTipo eliminado del payload publico', r.fields && !('documentoTipo' in r.fields));

  console.log('\n[2] Documento incorrecto (slot=cedula, detected=licencia)');
  stub.nextResponse = {
    fields: { documentoTipo: 'licencia', numeroLicencia: '999' },
    meta: { provider: 'gemini', model: 'test', elapsedMs: 10 },
  };
  r = await runOcr(fakeFile, 'cedula');
  assert('mismatch presente', !!r.mismatch);
  assert('expected=cedula', r.mismatch && r.mismatch.expected === 'cedula');
  assert('detected=licencia', r.mismatch && r.mismatch.detected === 'licencia');
  assert('expectedLabel humano', r.mismatch && /Cedula/i.test(r.mismatch.expectedLabel));
  assert('detectedLabel humano', r.mismatch && /Licencia/i.test(r.mismatch.detectedLabel));
  assert('mensaje accionable', r.mismatch && r.mismatch.message.includes('subido'));
  assert('fields=null en mismatch', r.fields === null);

  console.log('\n[3] Slot=licencia con cedula encima');
  stub.nextResponse = {
    fields: { documentoTipo: 'cedula', identificacion: '14484939' },
    meta: { provider: 'gemini', model: 'test', elapsedMs: 10 },
  };
  r = await runOcr(fakeFile, 'licencia');
  assert('mismatch presente', !!r.mismatch);
  assert('expected=licencia', r.mismatch && r.mismatch.expected === 'licencia');
  assert('detected=cedula', r.mismatch && r.mismatch.detected === 'cedula');

  console.log('\n[4] Slot=certificado con rif encima');
  stub.nextResponse = {
    fields: { documentoTipo: 'rif', rif: 'J-40123456-7' },
    meta: { provider: 'gemini', model: 'test', elapsedMs: 10 },
  };
  r = await runOcr(fakeFile, 'certificado');
  assert('mismatch presente', !!r.mismatch);
  assert('detected=rif', r.mismatch && r.mismatch.detected === 'rif');

  console.log('\n[5] Documento desconocido (slot=cedula, detected=desconocido)');
  stub.nextResponse = {
    fields: { documentoTipo: 'desconocido' },
    meta: { provider: 'gemini', model: 'test', elapsedMs: 10 },
  };
  r = await runOcr(fakeFile, 'cedula');
  assert('mismatch presente', !!r.mismatch);
  assert('detected=desconocido', r.mismatch && r.mismatch.detected === 'desconocido');
  assert('detectedLabel humano', r.mismatch && /no reconocido/i.test(r.mismatch.detectedLabel));

  console.log('\n[6] Gemini falla -> ocrFailed sin datos por defecto');
  stub.nextResponse = new Error('429 RESOURCE_EXHAUSTED');
  r = await runOcr(fakeFile, 'cedula');
  assert('provider=gemini', r.provider === 'gemini');
  assert('ocrFailed=true', r.ocrFailed === true);
  assert('sin mismatch', !r.mismatch);
  assert('fields vacios (no datos mock)', r.fields && Object.keys(r.fields).length === 0);
  assert('error preservado', typeof r.error === 'string' && r.error.includes('429'));

  console.log(`\n=== Resultado: ${pass} OK, ${fail} FAIL ===\n`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch((err) => {
  console.error('Error inesperado:', err);
  process.exit(1);
});
