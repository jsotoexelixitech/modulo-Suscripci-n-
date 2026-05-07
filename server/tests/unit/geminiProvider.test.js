/**
 * Tests del proveedor Gemini OCR (sin red real).
 *
 * Mockeamos `@google/genai` para validar:
 *   - Cadena de fallback Pro -> Flash -> Flash-Lite cuando un modelo falla.
 *   - Reintentos automáticos en errores transitorios.
 *   - Validación de campos críticos (si faltan, baja al siguiente modelo).
 *   - Devolución correcta de mismatch (header detectado != slot).
 */

const fs = require('fs/promises');
const path = require('path');
const os = require('os');

// Mock del SDK de Google. La instancia se reasigna en cada test.
const mockGenerateContent = jest.fn();
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: (...args) => mockGenerateContent(...args) },
  })),
  Type: {
    OBJECT: 'OBJECT',
    STRING: 'STRING',
    NUMBER: 'NUMBER',
    BOOLEAN: 'BOOLEAN',
    ARRAY: 'ARRAY',
  },
}));

// Helper: crea un archivo temporal con bytes mínimos para simular un JPG.
async function makeTempFile() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ocr-test-'));
  const file = path.join(dir, 'sample.jpg');
  // Cabecera mínima de JPEG (FF D8 FF) + relleno
  const buf = Buffer.from([0xff, 0xd8, 0xff, ...new Array(2048).fill(0)]);
  await fs.writeFile(file, buf);
  return file;
}

// Respuesta canónica de Gemini para mockear
function geminiResponse(jsonObj) {
  return {
    text: JSON.stringify(jsonObj),
    response: { text: () => JSON.stringify(jsonObj) },
  };
}

describe('geminiProvider.extract', () => {
  let extract;
  let getModelChain;
  let tmpFile;

  beforeAll(async () => {
    tmpFile = await makeTempFile();
  });

  beforeEach(() => {
    jest.resetModules();
    process.env.GEMINI_API_KEY = 'test-key';
    delete process.env.GEMINI_MODEL;
    delete process.env.GEMINI_MODELS;
    delete process.env.GEMINI_MAX_RETRIES;
    mockGenerateContent.mockReset();

    const provider = require('../../src/services/ocrProviders/geminiProvider');
    extract = provider.extract;
    getModelChain = provider.getModelChain;
  });

  test('cadena por defecto es pro -> flash -> flash-lite', () => {
    expect(getModelChain()).toEqual([
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
    ]);
  });

  test('GEMINI_MODEL personalizado va primero, los defaults se preservan al final', () => {
    process.env.GEMINI_MODEL = 'gemini-2.5-pro';
    jest.resetModules();
    const { getModelChain: g } = require('../../src/services/ocrProviders/geminiProvider');
    expect(g()).toEqual([
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
    ]);
  });

  test('GEMINI_MODELS sobreescribe la cadena por completo', () => {
    process.env.GEMINI_MODELS = 'a,b,c';
    jest.resetModules();
    const { getModelChain: g } = require('../../src/services/ocrProviders/geminiProvider');
    expect(g()).toEqual(['a', 'b', 'c']);
  });

  test('éxito al primer intento devuelve fields y meta del modelo principal', async () => {
    mockGenerateContent.mockResolvedValueOnce(
      geminiResponse({
        documentoTipo: 'cedula',
        nombre: 'Juan',
        apellido: 'Perez',
        identificacion: '12345678',
        tipoDoc: 'V',
      })
    );

    const result = await extract(tmpFile, 'image/jpeg', 'cedula');
    expect(result.fields.identificacion).toBe('12345678');
    expect(result.meta.model).toBe('gemini-2.5-pro');
    expect(result.meta.chainAttempts).toHaveLength(1);
    expect(result.meta.chainAttempts[0].criticalOk).toBe(true);
  });

  test('fallback a flash cuando pro falla con error permanente', async () => {
    mockGenerateContent
      .mockRejectedValueOnce(Object.assign(new Error('Model not found'), { status: 404 }))
      .mockResolvedValueOnce(
        geminiResponse({
          documentoTipo: 'cedula',
          nombre: 'Ana',
          apellido: 'Lopez',
          identificacion: '99999999',
          tipoDoc: 'V',
        })
      );

    const result = await extract(tmpFile, 'image/jpeg', 'cedula');
    expect(result.fields.identificacion).toBe('99999999');
    expect(result.meta.model).toBe('gemini-2.5-flash');
    expect(result.meta.chainAttempts).toHaveLength(2);
    expect(result.meta.chainAttempts[0].error).toMatch(/Model not found/);
  });

  test('reintenta el mismo modelo en error transitorio (rate limit) antes de cambiar', async () => {
    process.env.GEMINI_MAX_RETRIES = '2';
    jest.resetModules();
    const { extract: ex } = require('../../src/services/ocrProviders/geminiProvider');

    mockGenerateContent
      .mockRejectedValueOnce(Object.assign(new Error('rate limit exceeded'), { status: 429 }))
      .mockRejectedValueOnce(Object.assign(new Error('rate limit exceeded'), { status: 429 }))
      .mockResolvedValueOnce(
        geminiResponse({
          documentoTipo: 'cedula',
          nombre: 'Maria',
          apellido: 'Garcia',
          identificacion: '11111111',
          tipoDoc: 'V',
        })
      );

    const result = await ex(tmpFile, 'image/jpeg', 'cedula');
    expect(result.fields.identificacion).toBe('11111111');
    expect(result.meta.model).toBe('gemini-2.5-pro');
    expect(mockGenerateContent).toHaveBeenCalledTimes(3);
  }, 20000);

  test('si pro devuelve campos críticos vacíos, intenta con flash', async () => {
    mockGenerateContent
      .mockResolvedValueOnce(
        geminiResponse({
          documentoTipo: 'cedula',
          nombre: null,
          apellido: null,
          identificacion: null,
        })
      )
      .mockResolvedValueOnce(
        geminiResponse({
          documentoTipo: 'cedula',
          nombre: 'Pedro',
          apellido: 'Suarez',
          identificacion: '22222222',
          tipoDoc: 'V',
        })
      );

    const result = await extract(tmpFile, 'image/jpeg', 'cedula');
    expect(result.meta.model).toBe('gemini-2.5-flash');
    expect(result.fields.identificacion).toBe('22222222');
  });

  test('mismatch (documentoTipo != docType solicitado) NO baja a otro modelo', async () => {
    mockGenerateContent.mockResolvedValueOnce(
      geminiResponse({
        documentoTipo: 'licencia',
        identificacion: null,
      })
    );

    const result = await extract(tmpFile, 'image/jpeg', 'cedula');
    expect(result.fields.documentoTipo).toBe('licencia');
    expect(result.meta.model).toBe('gemini-2.5-pro');
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  test('si TODOS los modelos fallan, lanza error con detalle de la cadena', async () => {
    mockGenerateContent.mockRejectedValue(
      Object.assign(new Error('Model not found'), { status: 404 })
    );

    await expect(extract(tmpFile, 'image/jpeg', 'cedula')).rejects.toThrow(
      /OCR fallo en toda la cadena/
    );
  });

  test('certificado normaliza anio -> año para compat frontend', async () => {
    mockGenerateContent.mockResolvedValueOnce(
      geminiResponse({
        documentoTipo: 'certificado',
        placa: 'AB123CD',
        marca: 'Toyota',
        modelo: 'Corolla',
        anio: '2020',
      })
    );

    const result = await extract(tmpFile, 'image/jpeg', 'certificado');
    expect(result.fields['año']).toBe('2020');
    expect(result.fields.anio).toBeUndefined();
  });

  test('mimetype no soportado lanza error claro', async () => {
    await expect(extract(tmpFile, 'image/bmp', 'cedula')).rejects.toThrow(
      /no soportado/
    );
  });
});
