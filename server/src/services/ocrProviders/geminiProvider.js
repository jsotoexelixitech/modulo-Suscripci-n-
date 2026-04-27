/**
 * Gemini OCR provider.
 *
 * Lee un documento (cedula, licencia, certificado RUST o RIF venezolano) usando
 * el modelo Gemini 2.5 Flash-Lite con `responseSchema` para forzar una salida
 * JSON tipada. Si el campo no es legible, devuelve null.
 *
 * Variables de entorno:
 *   GEMINI_API_KEY    Requerido.
 *   GEMINI_MODEL      Opcional. Default: gemini-2.5-flash-lite.
 */

const fs = require('fs/promises');
const { GoogleGenAI, Type } = require('@google/genai');

const DEFAULT_MODEL = 'gemini-2.5-flash-lite';

const SUPPORTED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

let cachedClient = null;

function getClient() {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no esta configurado en .env');
  }
  cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
}

/**
 * Esquemas de respuesta por tipo de documento.
 * Mantienen los mismos nombres de campo que el frontend ya consume,
 * para no romper el contrato actual.
 */
const SCHEMAS = {
  cedula: {
    type: Type.OBJECT,
    properties: {
      nombre: { type: Type.STRING, description: 'Primer nombre del titular' },
      apellido: { type: Type.STRING, description: 'Primer apellido del titular' },
      identificacion: {
        type: Type.STRING,
        description: 'Numero de cedula, solo digitos sin V- ni puntos',
      },
      tipoDoc: {
        type: Type.STRING,
        enum: ['V', 'E', 'P'],
        description: 'V=venezolano, E=extranjero, P=pasaporte',
      },
      fechaNacimiento: {
        type: Type.STRING,
        description: 'Fecha de nacimiento en formato YYYY-MM-DD',
      },
      sexo: {
        type: Type.STRING,
        enum: ['Masculino', 'Femenino'],
      },
    },
    required: ['identificacion'],
  },

  licencia: {
    type: Type.OBJECT,
    properties: {
      numeroLicencia: { type: Type.STRING },
      categoria: {
        type: Type.STRING,
        description: 'Grado o categoria (1ra, 2da, 3ra, 4ta, 5ta, A, B, C)',
      },
      vencimiento: {
        type: Type.STRING,
        description: 'Fecha de vencimiento en formato YYYY-MM-DD',
      },
    },
  },

  certificado: {
    type: Type.OBJECT,
    properties: {
      placa: {
        type: Type.STRING,
        description: 'Placa del vehiculo, sin espacios ni guiones',
      },
      marca: { type: Type.STRING },
      modelo: { type: Type.STRING },
      anio: {
        type: Type.STRING,
        description: 'Ano del vehiculo (YYYY) en cuatro digitos',
      },
      serial: {
        type: Type.STRING,
        description: 'Serial de carroceria (VIN) o serial del motor',
      },
      color: { type: Type.STRING },
    },
  },

  rif: {
    type: Type.OBJECT,
    properties: {
      rif: {
        type: Type.STRING,
        description: 'RIF en formato J-XXXXXXXX-X o V-XXXXXXX-X',
      },
      razonSocial: {
        type: Type.STRING,
        description: 'Razon social o nombre completo del contribuyente',
      },
    },
  },
};

const PROMPTS = {
  cedula:
    'Extrae los datos de esta CEDULA DE IDENTIDAD VENEZOLANA. ' +
    'Si la persona aparece como "VENEZOLANO" usa tipoDoc="V"; si dice "EXTRANJERO" usa "E". ' +
    'El campo identificacion debe contener solo digitos.',
  licencia:
    'Extrae los datos de esta LICENCIA DE CONDUCIR VENEZOLANA. ' +
    'Pon especial atencion a la fecha de vencimiento y al grado o categoria.',
  certificado:
    'Extrae los datos del CERTIFICADO DE CIRCULACION (RUST) o TITULO DE PROPIEDAD del vehiculo. ' +
    'La placa debe ir sin espacios ni guiones. El ano en cuatro digitos.',
  rif:
    'Extrae los datos del REGISTRO UNICO DE INFORMACION FISCAL (RIF) venezolano. ' +
    'Mantiene el formato canonico con guiones (ej. J-12345678-9).',
};

const SYSTEM_INSTRUCTION =
  'Eres un extractor OCR de documentos venezolanos. Lee la imagen o PDF que se ' +
  'te entrega y devuelve EXCLUSIVAMENTE un JSON con los campos pedidos. ' +
  'Si un campo no es legible o no aparece, usa null. NUNCA inventes datos. ' +
  'Devuelve fechas en formato YYYY-MM-DD. Responde en espanol.';

/**
 * Ejecuta el OCR sobre un archivo guardado por multer.
 *
 * @param {string} filePath  Ruta absoluta al archivo subido.
 * @param {string} mimetype  MIME del archivo.
 * @param {string} docType   cedula | licencia | certificado | rif.
 * @returns {Promise<object>} Objeto plano con los campos extraidos.
 */
async function extract(filePath, mimetype, docType) {
  if (!SCHEMAS[docType]) {
    throw new Error(`Tipo de documento no soportado por Gemini: ${docType}`);
  }

  if (!SUPPORTED_MIME.has(mimetype)) {
    throw new Error(
      `Formato ${mimetype} no soportado por Gemini OCR. Usa JPG, PNG, WebP o PDF.`
    );
  }

  const buffer = await fs.readFile(filePath);
  const base64 = buffer.toString('base64');

  const ai = getClient();
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  const startedAt = Date.now();
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          { text: PROMPTS[docType] },
          { inlineData: { mimeType: mimetype, data: base64 } },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: SCHEMAS[docType],
      temperature: 0.1,
    },
  });

  const elapsedMs = Date.now() - startedAt;
  const rawText = (response && response.text) ? response.text : '';

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    throw new Error(
      `Gemini devolvio JSON invalido: ${err.message}. Texto: ${rawText.slice(0, 200)}`
    );
  }

  // Normalizacion de campo `anio` -> `año` para mantener compatibilidad
  // con el catalogo existente del frontend (`certificado.año`).
  if (docType === 'certificado' && parsed && parsed.anio !== undefined) {
    parsed['año'] = parsed.anio;
    delete parsed.anio;
  }

  return {
    fields: parsed,
    meta: {
      provider: 'gemini',
      model,
      elapsedMs,
    },
  };
}

module.exports = { extract, SUPPORTED_MIME };
