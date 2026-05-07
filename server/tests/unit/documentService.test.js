/**
 * Pruebas de validateDocument y simulateOcr (sin red).
 */
const path = require('path');
const {
  validateDocument,
  simulateOcr,
  VALID_DOC_TYPES,
  DOC_TYPE_LABELS,
} = require(path.join(__dirname, '..', '..', 'src', 'services', 'documentService'));

describe('validateDocument', () => {
  test('archivo demasiado pequeño se rechaza', () => {
    const r = validateDocument({ size: 100, mimetype: 'image/png' }, 'cedula');
    expect(r.valid).toBe(false);
    expect(r.message).toMatch(/vac[ií]o|corrupto/i);
  });

  test('PNG válido pasa', () => {
    const r = validateDocument({ size: 50000, mimetype: 'image/png' }, 'cedula');
    expect(r.valid).toBe(true);
  });

  test('JPEG válido pasa', () => {
    const r = validateDocument({ size: 50000, mimetype: 'image/jpeg' }, 'cedula');
    expect(r.valid).toBe(true);
  });

  test('PDF válido pasa', () => {
    const r = validateDocument({ size: 200000, mimetype: 'application/pdf' }, 'certificado');
    expect(r.valid).toBe(true);
  });

  test('formato no soportado falla', () => {
    const r = validateDocument({ size: 50000, mimetype: 'image/heic' }, 'cedula');
    expect(r.valid).toBe(false);
    expect(r.message).toMatch(/formato/i);
  });

  test('text/plain rechazado', () => {
    const r = validateDocument({ size: 50000, mimetype: 'text/plain' }, 'cedula');
    expect(r.valid).toBe(false);
  });
});

describe('simulateOcr', () => {
  test.each(['cedula', 'licencia', 'certificado', 'rif'])(
    'devuelve datos consistentes para %s',
    (docType) => {
      const r = simulateOcr(docType);
      expect(r).toBeTruthy();
      expect(typeof r).toBe('object');
      expect(Object.keys(r).length).toBeGreaterThan(0);
    },
  );

  test('cédula contiene nombre, apellido, identificación y tipoDoc', () => {
    const r = simulateOcr('cedula');
    expect(r).toMatchObject({
      nombre: expect.any(String),
      apellido: expect.any(String),
      identificacion: expect.stringMatching(/^\d+$/),
      tipoDoc: expect.stringMatching(/^[VEJ]$/),
    });
  });

  test('certificado contiene placa, marca, modelo y año', () => {
    const r = simulateOcr('certificado');
    expect(r).toMatchObject({
      placa: expect.any(String),
      marca: expect.any(String),
      modelo: expect.any(String),
    });
    expect(r.placa).toMatch(/^[A-Z0-9]+$/);
  });

  test('docType desconocido devuelve objeto vacío', () => {
    expect(simulateOcr('inexistente')).toEqual({});
  });
});

describe('constantes exportadas', () => {
  test('VALID_DOC_TYPES contiene los 4 tipos esperados', () => {
    expect(VALID_DOC_TYPES).toEqual(
      expect.arrayContaining(['cedula', 'licencia', 'certificado', 'rif']),
    );
  });

  test('DOC_TYPE_LABELS tiene texto humano para cada tipo', () => {
    for (const t of VALID_DOC_TYPES) {
      expect(DOC_TYPE_LABELS[t]).toBeTruthy();
      expect(typeof DOC_TYPE_LABELS[t]).toBe('string');
    }
  });
});
