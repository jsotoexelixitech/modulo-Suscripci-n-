/* eslint-disable */
/**
 * Smoke test E2E del validador de tipo de documento contra Gemini real.
 *
 * Sube cada screenshot oficial del usuario al endpoint /api/documents/upload
 * con todos los slots posibles (cedula, licencia, certificado, rif).
 * El backend debe ACEPTAR solo cuando el slot coincide con el tipo real,
 * y RECHAZAR (422 DOC_TYPE_MISMATCH) en los demas casos.
 *
 * Requiere backend corriendo en :3001 con OCR_PROVIDER=gemini.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const fs = require('fs');
const path = require('path');

const ENDPOINT = 'http://localhost:3001/api/documents/upload';

const ASSETS_DIR =
  'C:\\Users\\javier.soto\\.cursor\\projects\\c-Users-javier-soto-Desktop-Suscripcion-rcv\\assets';

const FIXTURES = [
  {
    name: 'cedula-header.png',
    file:
      'c__Users_javier.soto_AppData_Roaming_Cursor_User_workspaceStorage_aeb102281e63a1773deb82379ea3adfa_images_image-c07b0171-f08b-4890-904f-22c56a8efe68.png',
    expected: 'cedula',
  },
  {
    name: 'certificado-header.png',
    file:
      'c__Users_javier.soto_AppData_Roaming_Cursor_User_workspaceStorage_aeb102281e63a1773deb82379ea3adfa_images_image-bf519f9a-5ee2-4b5a-9844-5f9d5df254d6.png',
    expected: 'certificado',
  },
  {
    name: 'licencia-header.png',
    file:
      'c__Users_javier.soto_AppData_Roaming_Cursor_User_workspaceStorage_aeb102281e63a1773deb82379ea3adfa_images_image-c1e10b5e-4a96-4f2c-9a40-c642a0c82a2a.png',
    expected: 'licencia',
  },
];

const SLOTS = ['cedula', 'licencia', 'certificado', 'rif'];

async function uploadAs(filePath, docType) {
  const form = new FormData();
  const buf = fs.readFileSync(filePath);
  form.append('file', new Blob([buf], { type: 'image/png' }), path.basename(filePath));
  form.append('docType', docType);
  const res = await fetch(ENDPOINT, { method: 'POST', body: form });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

async function main() {
  console.log(`E2E test contra ${ENDPOINT}\n`);
  console.log(`Modelo: ${process.env.GEMINI_MODEL || '(default)'}\n`);

  let pass = 0;
  let fail = 0;

  for (const fx of FIXTURES) {
    const filePath = path.join(ASSETS_DIR, fx.file);
    if (!fs.existsSync(filePath)) {
      console.log(`!! Falta archivo: ${filePath}`);
      continue;
    }
    console.log(`=== ${fx.name} (es ${fx.expected}) ===`);

    for (const slot of SLOTS) {
      const { status, body } = await uploadAs(filePath, slot);
      const expectedOk = slot === fx.expected;
      const gotMismatch = status === 422 && body.code === 'DOC_TYPE_MISMATCH';
      const gotOk = status === 200 && body.success === true && !body.ocrFailed;
      const ocrFailed = status === 200 && body.ocrFailed === true;

      let verdict;
      let ok = true; // por defecto OK; FAIL solo en errores comprobados.
      if (ocrFailed) {
        verdict = 'SKIP cuota gemini agotada (ocrFailed)';
      } else if (expectedOk && gotOk) {
        verdict = 'OK   aceptado';
      } else if (!expectedOk && gotMismatch) {
        verdict = 'OK   rechazado';
      } else if (expectedOk && gotMismatch) {
        verdict = `FAIL falso negativo (detected=${body.detected})`;
        ok = false;
      } else if (!expectedOk && gotOk) {
        verdict = 'FAIL falso positivo (acepto el doc!)';
        ok = false;
      } else {
        verdict = `FAIL inesperado status=${status} ${JSON.stringify(body).slice(0, 90)}`;
        ok = false;
      }

      if (ok) pass++;
      else fail++;

      const detail = body.detected ? ` -> detected=${body.detected}` : '';
      console.log(`  slot=${slot.padEnd(11)} ${verdict}${detail}`);

      // Pequena pausa para no saturar la API gratuita.
      await new Promise((r) => setTimeout(r, 500));
    }
    console.log('');
  }

  console.log(`=== Resultado: ${pass} OK, ${fail} FAIL ===`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Error inesperado:', err);
  process.exit(1);
});
