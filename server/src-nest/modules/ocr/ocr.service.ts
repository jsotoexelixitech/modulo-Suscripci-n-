import { Injectable, BadRequestException } from '@nestjs/common';

// Importamos los servicios JS existentes — no los reescribimos
// eslint-disable-next-line @typescript-eslint/no-var-requires
const documentService = require('../../../src/services/documentService');

@Injectable()
export class OcrService {
  async processDocument(
    file: Express.Multer.File,
    docType: string,
  ): Promise<{ provider: string; fields: Record<string, any>; meta?: any; mismatch?: any; ocrFailed?: boolean; error?: string }> {
    const validation = documentService.validateDocument(file, docType);
    if (!validation.valid) {
      throw new BadRequestException(validation.message);
    }

    if (!documentService.VALID_DOC_TYPES.includes(docType)) {
      throw new BadRequestException(`Tipo de documento inválido: ${docType}`);
    }

    return documentService.runOcr(file, docType);
  }
}
