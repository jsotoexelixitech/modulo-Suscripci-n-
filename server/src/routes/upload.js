const express = require('express');
const fs = require('fs/promises');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const { verifyMobilePayment } = require('../services/meritop/meritopClient');
const sypagoClient = require('../services/sypago/sypagoClient');

/**
 * Convierte HEIC/HEIF o cualquier imagen grande a JPEG ≤2048px.
 * Devuelve { filePath, mimetype } ya normalizados para Gemini.
 */
/**
 * Normaliza cualquier imagen recibida para OCR:
 * - Máximo 1600 px en el lado más largo (suficiente para leer texto)
 * - JPEG calidad 82 % → documentos quedan ~200-500 KB
 * - Convierte HEIC/HEIF/PNG/WebP → JPEG
 * - Aplica rotación EXIF automática (fotos tomadas en vertical/horizontal)
 * - PDFs pasan sin cambios
 */
async function normalizeImage(filePath, mimetype) {
  const HEIC_TYPES = ['image/heic', 'image/heif'];
  const IMAGE_TYPES = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', ...HEIC_TYPES,
  ];
  if (!IMAGE_TYPES.includes(mimetype)) return { filePath, mimetype };

  const jpegPath = filePath.replace(/(\.[^.]+)?$/, '_norm.jpg');

  await sharp(filePath)
    .rotate()                                                   // orientación EXIF
    .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: { r: 255, g: 255, b: 255 } })       // fondo blanco (PNG transparente)
    .jpeg({ quality: 82, mozjpeg: true })                       // mozjpeg = mejor compresión sin artefactos
    .toFile(jpegPath);

  // Borrar original si ya no sirve
  if (filePath !== jpegPath) {
    await fs.unlink(filePath).catch(() => {});
  }

  return { filePath: jpegPath, mimetype: 'image/jpeg' };
}
const { validateDocument, runOcr, VALID_DOC_TYPES } = require('../services/documentService');
const policyService = require('../services/lamundial/policyService');
const {
  getInmaAnios, getInmaMarcas, getInmaModelos, getInmaVersiones,
} = require('../services/lamundial/lamundialClient');

const router = express.Router();

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
    'image/heic', 'image/heif',   // iOS galería (foto HEIC)
    'application/pdf',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}. Usa JPG, PNG, HEIC o PDF.`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB (iPhone fotos originales)
});

/**
 * POST /api/documents/upload
 * Accepts a single document, validates and simulates OCR.
 */
router.post('/documents/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se recibió ningún archivo.' });
    }

    const { docType } = req.body;
    if (!docType) {
      return res.status(400).json({ success: false, message: 'El campo docType es requerido.' });
    }

    if (!VALID_DOC_TYPES.includes(docType)) {
      return res.status(400).json({ success: false, message: `Tipo de documento invalido: ${docType}` });
    }

    // Normalizar imagen (HEIC → JPEG, redimensionar si > 2048px)
    const normalized = await normalizeImage(req.file.path, req.file.mimetype);
    const normalizedFile = {
      ...req.file,
      path: normalized.filePath,
      mimetype: normalized.mimetype,
    };

    const validation = validateDocument(normalizedFile, docType);
    if (!validation.valid) {
      return res.status(422).json({ success: false, message: validation.message });
    }

    const ocrResult = await runOcr(normalizedFile, docType);

    // Si Gemini detecto que el documento subido NO corresponde al slot,
    // borramos el archivo y devolvemos un 422 con detalle accionable.
    if (ocrResult.mismatch) {
      try {
        await fs.unlink(req.file.path);
      } catch (_) {
        // Si no se pudo borrar, lo dejamos pasar; el GC del FS lo limpiara.
      }

      return res.status(422).json({
        success: false,
        code: 'DOC_TYPE_MISMATCH',
        message: ocrResult.mismatch.message,
        expected: ocrResult.mismatch.expected,
        detected: ocrResult.mismatch.detected,
        expectedLabel: ocrResult.mismatch.expectedLabel,
        detectedLabel: ocrResult.mismatch.detectedLabel,
        ocrProvider: ocrResult.provider,
        ...(ocrResult.meta ? { ocrMeta: ocrResult.meta } : {}),
      });
    }

    return res.status(200).json({
      success: true,
      message: ocrResult.ocrFailed
        ? 'Archivo recibido. No pudimos leer los datos automaticamente.'
        : 'Documento procesado exitosamente.',
      docType,
      file: {
        id: uuidv4(),
        name: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
        url: `/files/${req.file.filename}`,
      },
      ocr: ocrResult.fields,
      ocrProvider: ocrResult.provider,
      ...(ocrResult.ocrFailed ? { ocrFailed: true } : {}),
      ...(ocrResult.meta ? { ocrMeta: ocrResult.meta } : {}),
      ...(ocrResult.error ? { ocrError: ocrResult.error } : {}),
    });
  } catch (err) {
    console.error('Error processing document:', err);
    return res.status(500).json({ success: false, message: 'Error interno del servidor.' });
  }
});

// ── Catálogo INMA ─────────────────────────────────────────────────────────────

/**
 * GET /api/catalogo/anios
 * Devuelve { min: number, max: number }
 */
router.get('/catalogo/anios', async (req, res) => {
  try {
    const result = await getInmaAnios();
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(502).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/catalogo/marcas?fano=2020
 * Devuelve [{ cmarca, xmarca }]
 */
router.get('/catalogo/marcas', async (req, res) => {
  const fano = parseInt(req.query.fano, 10);
  if (!fano) return res.status(400).json({ success: false, message: 'fano requerido' });
  try {
    const data = await getInmaMarcas(fano);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(502).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/catalogo/modelos?fano=2020&cmarca=074
 * Devuelve [{ cmodelo, xmodelo }]
 */
router.get('/catalogo/modelos', async (req, res) => {
  const fano   = parseInt(req.query.fano, 10);
  const cmarca = req.query.cmarca;
  if (!fano || !cmarca) {
    return res.status(400).json({ success: false, message: 'fano y cmarca requeridos' });
  }
  try {
    const data = await getInmaModelos(fano, cmarca);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(502).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/catalogo/versiones?fano=2020&cmarca=074&cmodelo=005
 * Devuelve [{ cversion, xversion }]
 */
router.get('/catalogo/versiones', async (req, res) => {
  const fano    = parseInt(req.query.fano, 10);
  const cmarca  = req.query.cmarca;
  const cmodelo = req.query.cmodelo;
  if (!fano || !cmarca || !cmodelo) {
    return res.status(400).json({ success: false, message: 'fano, cmarca y cmodelo requeridos' });
  }
  try {
    const data = await getInmaVersiones(fano, cmarca, cmodelo);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(502).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/catalogo/resolver?fano=2020&marca=Toyota&modelo=Corolla
 * Resuelve texto libre → { cmarca, cmodelo, versiones[], fallback }
 * Usado por el frontend para auto-resolver datos del OCR.
 */
router.get('/catalogo/resolver', async (req, res) => {
  const fano   = parseInt(req.query.fano, 10);
  const marca  = (req.query.marca  || '').trim();
  const modelo = (req.query.modelo || '').trim();

  if (!fano || !marca) {
    return res.status(400).json({ success: false, message: 'fano y marca requeridos' });
  }

  function norm(s) {
    return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  }

  try {
    // 1. Marcas
    const marcas = await getInmaMarcas(fano);
    const normMarca = norm(marca);
    const marcaMatch = marcas.find(m => norm(m.xmarca) === normMarca)
      ?? marcas.find(m => norm(m.xmarca).includes(normMarca) || normMarca.includes(norm(m.xmarca)));

    if (!marcaMatch) {
      return res.json({ success: false, fallback: true, message: `Marca "${marca}" no encontrada en catálogo INMA` });
    }

    // 2. Modelos
    const modelos = await getInmaModelos(fano, marcaMatch.cmarca);
    const normModelo = norm(modelo);
    const modeloMatch = modelo
      ? (modelos.find(m => norm(m.xmodelo) === normModelo)
        ?? modelos.find(m => norm(m.xmodelo).includes(normModelo) || normModelo.includes(norm(m.xmodelo))))
      : null;
    const resolvedModelo = modeloMatch ?? modelos[0];

    if (!resolvedModelo) {
      return res.json({
        success: true, fallback: true,
        cmarca: marcaMatch.cmarca, xmarca: marcaMatch.xmarca,
        message: 'Marca resuelta pero sin modelos disponibles',
      });
    }

    // 3. Versiones
    const versiones = await getInmaVersiones(fano, marcaMatch.cmarca, resolvedModelo.cmodelo);

    return res.json({
      success: true,
      fallback: !modeloMatch,
      cmarca:  marcaMatch.cmarca,
      xmarca:  marcaMatch.xmarca,
      cmodelo: resolvedModelo.cmodelo,
      xmodelo: resolvedModelo.xmodelo,
      versiones,
    });
  } catch (err) {
    return res.status(502).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/policies/quote
 * Cotiza la prima del vehiculo contra La Mundial sin emitir.
 * Body esperado: { state: { vehicle: {...}, ... }, plan?: 'RCVBAS' }
 */
router.post('/policies/quote', async (req, res) => {
  try {
    const { state, plan } = req.body || {};
    if (!state || !state.vehicle) {
      return res.status(400).json({ success: false, code: 'MISSING_STATE', message: 'state.vehicle requerido.' });
    }
    const result = await policyService.quote(state, { plan });
    return res.status(200).json({
      success: true,
      mprima: result.mprima,
      mprimaext: result.mprimaext,
      ptasa: result.ptasa,
      metadata: result.metadata,
    });
  } catch (err) {
    return sendPolicyError(res, err, 'quote');
  }
});

/**
 * POST /api/policies/emit
 * Cotiza y emite la poliza contra La Mundial.
 *
 * Acepta dos formas de body para compatibilidad:
 *   1. NUEVO: { state: <wizardState completo>, plan?: 'RCVBAS', frecuencia?: 'A' }
 *   2. LEGACY: { tomador, plan, payment }  -> mock simple para back-compat.
 *
 * Devuelve `policy` con cnpoliza, cnrecibo, urlpoliza, recibo, internalPolicyId,
 * y montos de la cotizacion.
 */
router.post('/policies/emit', async (req, res) => {
  try {
    const { state, plan, frecuencia } = req.body || {};

    if (!state || !state.vehicle || !state.tomador) {
      // Compatibilidad con el shape viejo: si no hay `state`, devolvemos
      // un mock para no romper integraciones legacy.
      const { tomador, plan: legacyPlan, payment } = req.body || {};
      if (!tomador || !legacyPlan || !payment) {
        return res.status(400).json({
          success: false,
          code: 'MISSING_STATE',
          message: 'Datos incompletos. Envia { state: <wizardState> }.',
        });
      }
      const policyNumber = `LM-2026-${String(Math.floor(100000 + Math.random() * 899999))}`;
      return res.status(201).json({
        success: true,
        message: 'Poliza emitida (modo legacy/mock).',
        policy: {
          number: policyNumber,
          cnpoliza: policyNumber,
          cnrecibo: '',
          urlpoliza: '',
          internalPolicyId: `LEGACY-${Date.now()}`,
          holder: `${tomador.nombre} ${tomador.apellido}`,
          plan: legacyPlan.name,
          price: legacyPlan.price,
          emittedAt: new Date().toISOString(),
        },
      });
    }

    const result = await policyService.quoteAndEmit(state, { plan, frecuencia });

    return res.status(201).json({
      success: true,
      message: 'Poliza emitida exitosamente.',
      policy: {
        number: result.cnpoliza, // alias para compat con front antiguo
        cnpoliza: result.cnpoliza,
        cnrecibo: result.cnrecibo,
        urlpoliza: result.urlpoliza,
        ncuota: result.ncuota,
        internalPolicyId: result.internalPolicyId,
        emittedAt: result.emittedAt,
        quote: result.quote,
        metadata: result.metadata,
      },
    });
  } catch (err) {
    return sendPolicyError(res, err, 'emit');
  }
});

/**
 * Mapea los PolicyError del orquestador a respuestas HTTP consistentes.
 */
function sendPolicyError(res, err, stage) {
  const code = err.code || 'POLICY_ERROR';
  const httpStatus = err.httpStatus || 502;
  const isOurError = err.name === 'PolicyError' || code.startsWith('LAMUNDIAL_') || code === 'INVALID_PAYLOAD';

  if (!isOurError) {
    console.error(`[policy/${stage}] uncaught error`, err);
    return res.status(500).json({
      success: false,
      code: 'INTERNAL',
      message: 'Error interno emitiendo poliza.',
    });
  }

  console.warn(`[policy/${stage}] ${code} ${httpStatus} ${err.message}`);
  return res.status(httpStatus).json({
    success: false,
    code,
    message: err.message,
    ...(err.details ? { details: err.details } : {}),
    ...(err.internalPolicyId ? { internalPolicyId: err.internalPolicyId } : {}),
    stage,
  });
}

// ──────────────────────────────────────────────────────────────────────────
//  POST /api/payments/verify-mobile  — Verificación de Pago Móvil (Meritop)
// ──────────────────────────────────────────────────────────────────────────
/**
 * Body:
 *   sourcePhoneNumber  string   Teléfono de origen (ej. "04121234567")
 *   bankCode           string   Código de banco (ej. "0172")
 *   amount             number   Monto en Bs (decimal)
 *   paidOn             string   ISO 8601 datetime (ej. "2025-12-02T13:30:00")
 *
 * Response 200:
 *   { success, isVerified, reference, verifiedAmount, verifiedOn, message }
 */
router.post('/payments/verify-mobile', async (req, res) => {
  const { sourcePhoneNumber, bankCode, amount, paidOn } = req.body || {};

  // ── Validación de campos requeridos ──────────────────────────────────
  const missing = [];
  if (!sourcePhoneNumber) missing.push('sourcePhoneNumber');
  if (!bankCode)           missing.push('bankCode');
  if (amount == null)      missing.push('amount');
  if (!paidOn)             missing.push('paidOn');

  if (missing.length > 0) {
    return res.status(400).json({
      success : false,
      code    : 'MERITOP_MISSING_FIELDS',
      message : `Faltan campos requeridos: ${missing.join(', ')}`,
      missing,
    });
  }

  // ── Validaciones de formato ───────────────────────────────────────────
  const phoneRe = /^(0|\+?58)4\d{9}$|^04\d{9}$/;
  if (!phoneRe.test(String(sourcePhoneNumber).replace(/\s/g, ''))) {
    return res.status(400).json({
      success : false,
      code    : 'MERITOP_INVALID_PHONE',
      message : 'Número de teléfono inválido. Formato esperado: 04XXXXXXXXX',
    });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({
      success : false,
      code    : 'MERITOP_INVALID_AMOUNT',
      message : 'El monto debe ser un número positivo.',
    });
  }

  if (isNaN(Date.parse(paidOn))) {
    return res.status(400).json({
      success : false,
      code    : 'MERITOP_INVALID_DATE',
      message : 'Fecha de pago inválida. Usa formato ISO 8601 (ej. 2025-12-02T13:30:00).',
    });
  }

  // ── Llamada al servicio Meritop ───────────────────────────────────────
  try {
    const result = await verifyMobilePayment({
      sourcePhoneNumber : String(sourcePhoneNumber).replace(/\s/g, ''),
      bankCode          : String(bankCode).trim(),
      amount            : parsedAmount,
      paidOn            : paidOn,
    });

    return res.status(200).json({
      success        : true,
      isVerified     : result.isVerified,
      reference      : result.reference,
      verifiedAmount : result.verifiedAmount,
      verifiedOn     : result.verifiedOn,
      message        : result.message,
      code           : result.code,
    });
  } catch (err) {
    const code    = err.code  || 'MERITOP_ERROR';
    const message = err.message || 'Error verificando el pago móvil.';

    // Errores de red / configuración → 503
    if (['MERITOP_CONNECTION_ERROR', 'MERITOP_MISSING_APIKEY', 'MERITOP_DISABLED'].includes(code)) {
      return res.status(503).json({ success: false, code, message });
    }

    // Errores de autenticación → 502
    if (['MERITOP_INVALID_APIKEY', 'MERITOP_IP_NOT_ALLOWED', 'MERITOP_AUTH_ERROR'].includes(code)) {
      return res.status(502).json({ success: false, code, message });
    }

    // Errores de negocio (B001, B002, etc.) → 422
    return res.status(422).json({
      success  : false,
      code,
      baCode   : err.baCode   || null,
      baMessage: err.baMessage || null,
      message,
    });
  }
});

// ──────────────────────────────────────────────────────────────────────────
//  SyPago — Débito OTP (pago bancario con clave de un solo uso)
// ──────────────────────────────────────────────────────────────────────────

/**
 * POST /api/payments/otp/request
 * Paso 1: solicita que el banco del cliente le envíe la OTP por SMS/Push/Email.
 *
 * Body:
 *   documentType    string  Tipo de doc del deudor (V, E, J, G, P)
 *   documentNumber  string  Número de doc (sin separadores)
 *   debtorBankCode  string  Código del banco del deudor (ej. "0102")
 *   debtorPhone     string  Teléfono del deudor (ej. "04141234567")
 *   amount          number  Monto en Bs
 */
router.post('/payments/otp/request', async (req, res) => {
  const { documentType, documentNumber, debtorBankCode, debtorPhone, amount } = req.body || {};

  const missing = [];
  if (!documentType)   missing.push('documentType');
  if (!documentNumber) missing.push('documentNumber');
  if (!debtorBankCode) missing.push('debtorBankCode');
  if (!debtorPhone)    missing.push('debtorPhone');
  if (amount == null)  missing.push('amount');

  if (missing.length > 0) {
    return res.status(400).json({
      success: false, code: 'SYPAGO_MISSING_FIELDS',
      message: `Faltan campos: ${missing.join(', ')}`, missing,
    });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({
      success: false, code: 'SYPAGO_INVALID_AMOUNT',
      message: 'El monto debe ser un número positivo.',
    });
  }

  const phoneRe = /^04\d{9}$/;
  if (!phoneRe.test(String(debtorPhone).replace(/\s/g, ''))) {
    return res.status(400).json({
      success: false, code: 'SYPAGO_INVALID_PHONE',
      message: 'Teléfono inválido. Formato esperado: 04XXXXXXXXX',
    });
  }

  try {
    const result = await sypagoClient.requestOtp({
      documentType, documentNumber: String(documentNumber).trim(),
      debtorBankCode, debtorPhone: String(debtorPhone).replace(/\s/g, ''),
      amount: parsedAmount,
    });
    return res.status(200).json({ success: true, message: result?.message || 'OTP enviada al cliente.' });
  } catch (err) {
    return _sendSypagoError(res, err, 'otp/request');
  }
});

/**
 * POST /api/payments/otp/confirm
 * Paso 2: envía la OTP + datos completos para ejecutar el débito.
 *
 * Body: { documentType, documentNumber, debtorBankCode, debtorPhone,
 *         debtorName, amount, otp, concept? }
 *
 * Response 200: { transaction_id, operation_secret }
 */
router.post('/payments/otp/confirm', async (req, res) => {
  const {
    documentType, documentNumber, debtorBankCode, debtorPhone,
    debtorName, amount, otp, concept,
  } = req.body || {};

  const missing = [];
  if (!documentType)   missing.push('documentType');
  if (!documentNumber) missing.push('documentNumber');
  if (!debtorBankCode) missing.push('debtorBankCode');
  if (!debtorPhone)    missing.push('debtorPhone');
  if (!debtorName)     missing.push('debtorName');
  if (amount == null)  missing.push('amount');
  if (!otp)            missing.push('otp');

  if (missing.length > 0) {
    return res.status(400).json({
      success: false, code: 'SYPAGO_MISSING_FIELDS',
      message: `Faltan campos: ${missing.join(', ')}`, missing,
    });
  }

  try {
    const result = await sypagoClient.confirmOtp({
      documentType,
      documentNumber: String(documentNumber).trim(),
      debtorBankCode,
      debtorPhone   : String(debtorPhone).replace(/\s/g, ''),
      debtorName    : String(debtorName).trim(),
      amount        : parseFloat(amount),
      otp           : String(otp).trim(),
      concept,
    });
    return res.status(200).json({
      success          : true,
      message          : 'Transacción iniciada.',
      transaction_id   : result.transaction_id,
      operation_secret : result.operation_secret,
      mock             : result.mock || false,
    });
  } catch (err) {
    return _sendSypagoError(res, err, 'otp/confirm');
  }
});

/**
 * GET /api/payments/otp/status/:transactionId
 * Consulta el estado de una transacción ya enviada (polling).
 */
router.get('/payments/otp/status/:transactionId', async (req, res) => {
  const { transactionId } = req.params;
  if (!transactionId) {
    return res.status(400).json({ success: false, message: 'transactionId requerido.' });
  }
  try {
    const result = await sypagoClient.getTransactionStatus(transactionId);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    return _sendSypagoError(res, err, 'otp/status');
  }
});

function _sendSypagoError(res, err, stage) {
  const code    = err.code    || 'SYPAGO_ERROR';
  const message = err.message || 'Error con SyPago.';

  if (['SYPAGO_CONNECTION_ERROR', 'SYPAGO_MISSING_TOKEN'].includes(code)) {
    return res.status(503).json({ success: false, code, message, stage });
  }
  if (code === 'SYPAGO_AUTH_ERROR') {
    return res.status(502).json({ success: false, code, message, stage });
  }
  return res.status(err.httpStatus || 422).json({
    success: false, code, message,
    sypagoCode: err.sypagoCode || null,
    stage,
  });
}

// Multer error handler
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, message: 'El archivo supera el límite de 25 MB.' });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
});

module.exports = router;
