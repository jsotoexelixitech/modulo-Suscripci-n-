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
 * Campo de validacion compartido por todos los esquemas.
 * Gemini SIEMPRE debe identificar el tipo de documento real en la imagen,
 * independientemente del slot donde se subio.
 *
 * Headers oficiales que la IA debe reconocer:
 *   - cedula:      "REPUBLICA BOLIVARIANA DE VENEZUELA" + "CEDULA DE IDENTIDAD"
 *   - licencia:    "Licencia para Conducir" + INTT
 *   - certificado: "CERTIFICADO DE CIRCULACION" + INTT  (incluye TITULO de propiedad)
 *   - rif:         "REGISTRO UNICO DE INFORMACION FISCAL" + SENIAT
 */
const DOC_TYPE_PROP = {
  type: Type.STRING,
  enum: ['cedula', 'licencia', 'certificado', 'rif', 'desconocido'],
  description:
    'Tipo de documento DETECTADO en la imagen, INDEPENDIENTE de lo que se haya pedido. ' +
    'Devuelve "cedula" si la imagen muestra "CEDULA DE IDENTIDAD". ' +
    'Devuelve "licencia" si dice "Licencia para Conducir" (INTT). ' +
    'Devuelve "certificado" si dice "CERTIFICADO DE CIRCULACION" o "TITULO DE PROPIEDAD" (INTT). ' +
    'Devuelve "rif" si dice "REGISTRO UNICO DE INFORMACION FISCAL" (SENIAT). ' +
    'Devuelve "desconocido" si no es ninguno de los anteriores.',
};

/**
 * Esquemas de respuesta por tipo de documento.
 * Mantienen los mismos nombres de campo que el frontend ya consume,
 * para no romper el contrato actual.
 */
const SCHEMAS = {
  cedula: {
    type: Type.OBJECT,
    properties: {
      documentoTipo: DOC_TYPE_PROP,
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
      estadoCivil: {
        type: Type.STRING,
        enum: ['Soltero(a)', 'Casado(a)', 'Divorciado(a)', 'Viudo(a)'],
        description:
          'Estado civil del titular. La cedula venezolana lo trae con codigo: ' +
          'S=Soltero(a), C=Casado(a), D=Divorciado(a), V=Viudo(a). ' +
          'Devuelve siempre el valor expandido entre parentesis (ej. "Soltero(a)").',
      },
    },
    required: ['documentoTipo'],
  },

  licencia: {
    type: Type.OBJECT,
    properties: {
      documentoTipo: DOC_TYPE_PROP,
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
    required: ['documentoTipo'],
  },

  certificado: {
    type: Type.OBJECT,
    properties: {
      documentoTipo: DOC_TYPE_PROP,
      placa: {
        type: Type.STRING,
        description: 'Placa del vehiculo, sin espacios ni guiones',
      },
      marca: { type: Type.STRING, description: 'Marca o fabricante del vehiculo' },
      modelo: { type: Type.STRING, description: 'Modelo del vehiculo' },
      anio: {
        type: Type.STRING,
        description: 'Ano del vehiculo (YYYY) en cuatro digitos',
      },
      serial: {
        type: Type.STRING,
        description: 'Serial de carroceria (VIN) o serial del motor',
      },
      color: {
        type: Type.STRING,
        description:
          'Color principal de la carroceria del vehiculo tal como aparece en el documento ' +
          '(ej: "Blanco", "Negro", "Rojo", "Plata", "Azul", "Gris", "Beige"). ' +
          'Capitaliza la primera letra. Busca etiquetas como "COLOR", "Color de carroceria" ' +
          'o similares dentro del CERTIFICADO DE CIRCULACION o TITULO DE PROPIEDAD. ' +
          'Si aparecen dos colores separados por "/", devuelve el primero. ' +
          'Si realmente no aparece ningun color en el documento, devuelve null.',
      },
    },
    required: ['documentoTipo'],
  },

  rif: {
    type: Type.OBJECT,
    properties: {
      documentoTipo: DOC_TYPE_PROP,
      rif: {
        type: Type.STRING,
        description: 'RIF en formato J-XXXXXXXX-X o V-XXXXXXX-X',
      },
      razonSocial: {
        type: Type.STRING,
        description: 'Razon social o nombre completo del contribuyente',
      },
    },
    required: ['documentoTipo'],
  },
};

const VALIDATION_PREAMBLE =
  'PASO 1 (OBLIGATORIO): Identifica el HEADER del documento y devuelve documentoTipo: ' +
  '"cedula" si ves "CEDULA DE IDENTIDAD" sobre tricolor venezolano; ' +
  '"licencia" si ves "Licencia para Conducir" del INTT; ' +
  '"certificado" si ves "CERTIFICADO DE CIRCULACION" o "TITULO DE PROPIEDAD" del INTT; ' +
  '"rif" si ves "REGISTRO UNICO DE INFORMACION FISCAL" del SENIAT; ' +
  '"desconocido" en cualquier otro caso. ' +
  'PASO 2: Si y SOLO SI documentoTipo coincide con el tipo solicitado, extrae los demas campos. ' +
  'Si NO coincide, devuelve solamente documentoTipo y deja el resto en null. ' +
  'NUNCA inventes datos para forzar el tipo solicitado. ';

const PROMPTS = {
  cedula:
    VALIDATION_PREAMBLE +
    'Tipo solicitado: CEDULA DE IDENTIDAD VENEZOLANA. ' +
    'Si la persona aparece como "VENEZOLANO" usa tipoDoc="V"; si dice "EXTRANJERO" usa "E". ' +
    'El campo identificacion debe contener solo digitos. ' +
    'Para estadoCivil: la cedula muestra una letra (S, C, D, V); ' +
    'mapea S->"Soltero(a)", C->"Casado(a)", D->"Divorciado(a)", V->"Viudo(a)".',
  licencia:
    VALIDATION_PREAMBLE +
    'Tipo solicitado: LICENCIA DE CONDUCIR VENEZOLANA (INTT). ' +
    'Pon especial atencion a la fecha de vencimiento y al grado o categoria.',
  certificado:
    VALIDATION_PREAMBLE +
    'Tipo solicitado: CERTIFICADO DE CIRCULACION (RUST) o TITULO DE PROPIEDAD del vehiculo (INTT). ' +
    'La placa debe ir sin espacios ni guiones. El ano en cuatro digitos. ' +
    'NO OLVIDES extraer el COLOR de la carroceria: aparece etiquetado como "COLOR" o ' +
    '"COLOR DE LA CARROCERIA" en el cuerpo del documento. Devuelvelo capitalizado ' +
    '(ej. "Blanco", "Negro", "Rojo", "Plata"). Si aparecen dos colores con "/", usa el primero.',
  rif:
    VALIDATION_PREAMBLE +
    'Tipo solicitado: REGISTRO UNICO DE INFORMACION FISCAL (RIF) venezolano (SENIAT). ' +
    'Mantiene el formato canonico con guiones (ej. J-12345678-9).',
};

const SYSTEM_INSTRUCTION =
  'Eres un extractor OCR estricto de documentos venezolanos oficiales. ' +
  'SIEMPRE empiezas verificando el header del documento (titulo y emisor) ' +
  'para determinar `documentoTipo`. Devuelve EXCLUSIVAMENTE un JSON con ' +
  'los campos pedidos. Si un campo no es legible o no aparece, usa null. ' +
  'NUNCA inventes datos. NUNCA fuerces datos cuando el documento no coincide ' +
  'con el tipo solicitado. Devuelve fechas en formato YYYY-MM-DD. Responde en espanol.';

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
