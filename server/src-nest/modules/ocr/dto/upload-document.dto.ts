import { ApiProperty } from '@nestjs/swagger';

export class UploadDocumentDto {
  @ApiProperty({
    enum: ['cedula', 'licencia', 'certificado', 'rif'],
    description: 'Tipo de documento a analizar',
    example: 'cedula',
  })
  docType: 'cedula' | 'licencia' | 'certificado' | 'rif';
}
