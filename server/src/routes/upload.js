const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { validateDocument, runOcr, VALID_DOC_TYPES } = require('../services/documentService');

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
  const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/svg+xml', 'application/pdf'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Solo JPG, PNG, SVG o PDF.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
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

    const validation = validateDocument(req.file, docType);
    if (!validation.valid) {
      return res.status(422).json({ success: false, message: validation.message });
    }

    const ocrResult = await runOcr(req.file, docType);

    return res.status(200).json({
      success: true,
      message: 'Documento procesado exitosamente.',
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
      ...(ocrResult.meta ? { ocrMeta: ocrResult.meta } : {}),
      ...(ocrResult.error ? { ocrFallbackReason: ocrResult.error } : {}),
    });
  } catch (err) {
    console.error('Error processing document:', err);
    return res.status(500).json({ success: false, message: 'Error interno del servidor.' });
  }
});

/**
 * POST /api/policies/emit
 * Receives final policy data and returns a policy number.
 */
router.post('/policies/emit', (req, res) => {
  const { tomador, plan, payment } = req.body;

  if (!tomador || !plan || !payment) {
    return res.status(400).json({ success: false, message: 'Datos incompletos para emitir la póliza.' });
  }

  const policyNumber = `LM-2026-${String(Math.floor(100000 + Math.random() * 899999))}`;
  const emittedAt = new Date().toISOString();

  return res.status(201).json({
    success: true,
    message: 'Póliza emitida exitosamente.',
    policy: {
      number: policyNumber,
      holder: `${tomador.nombre} ${tomador.apellido}`,
      plan: plan.name,
      price: plan.price,
      emittedAt,
    },
  });
});

// Multer error handler
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, message: 'El archivo supera el límite de 10 MB.' });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
});

module.exports = router;
