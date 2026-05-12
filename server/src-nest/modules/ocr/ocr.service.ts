import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharp = require('sharp');

// Importamos los servicios JS existentes — no los reescribimos
// eslint-disable-next-line @typescript-eslint/no-var-requires
const documentService = require('../../../src/services/documentService');

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  /**
   * Normaliza una imagen para OCR:
   * - HEIC/HEIF → JPEG
   * - Resize a 2000px máx (lado largo)
   * - Aplica rotación EXIF, contraste, sharpen para texto
   * - PDFs y formatos no soportados pasan sin cambios
   */
  private async normalizeImage(
    filePath: string,
    mimetype: string,
  ): Promise<{ filePath: string; mimetype: string }> {
    const IMAGE_TYPES = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
    ];
    if (!IMAGE_TYPES.includes(mimetype)) {
      return { filePath, mimetype };
    }

    const jpegPath = filePath.replace(/(\.[^.]+)?$/, '_norm.jpg');

    try {
      await sharp(filePath)
        .rotate()
        .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .normalise()
        .sharpen({ sigma: 0.6 })
        .jpeg({ quality: 90, mozjpeg: true, chromaSubsampling: '4:4:4' })
        .toFile(jpegPath);
    } catch (err: any) {
      this.logger.warn(`normalizeImage falló para ${filePath}: ${err.message}. Usando original.`);
      return { filePath, mimetype };
    }

    if (filePath !== jpegPath) {
      await fs.unlink(filePath).catch(() => {});
    }

    return { filePath: jpegPath, mimetype: 'image/jpeg' };
  }

  async processDocument(
    file: Express.Multer.File,
    docType: string,
  ): Promise<{
    provider: string;
    fields: Record<string, any>;
    meta?: any;
    mismatch?: any;
    ocrFailed?: boolean;
    error?: string;
    /** Path final del archivo (puede haber cambiado por normalizeImage). */
    finalPath: string;
    /** Nombre del archivo final guardado (basename, para construir /files/...). */
    finalFilename: string;
    /** Mimetype final. */
    finalMimetype: string;
  }> {
    if (!documentService.VALID_DOC_TYPES.includes(docType)) {
      throw new BadRequestException(`Tipo de documento inválido: ${docType}`);
    }

    // Normalizar HEIC → JPEG, redimensionar, etc.
    const normalized = await this.normalizeImage(file.path, file.mimetype);
    const normalizedFile = {
      ...file,
      path: normalized.filePath,
      mimetype: normalized.mimetype,
    };

    const validation = documentService.validateDocument(normalizedFile, docType);
    if (!validation.valid) {
      throw new BadRequestException(validation.message);
    }

    const result = await documentService.runOcr(normalizedFile, docType);

    const finalFilename = normalized.filePath.split(/[\\/]/).pop() ?? file.filename;

    return {
      ...result,
      finalPath: normalized.filePath,
      finalFilename,
      finalMimetype: normalized.mimetype,
    };
  }
}
