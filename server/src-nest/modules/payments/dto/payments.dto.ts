import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VerifyMobilePaymentDto {
  @ApiProperty({ example: '04121234567', description: 'Teléfono origen (04XXXXXXXXX)' })
  sourcePhoneNumber: string;

  @ApiProperty({ example: '0172', description: 'Código de banco venezolano' })
  bankCode: string;

  @ApiProperty({ example: 198114.5, description: 'Monto en Bs' })
  amount: number;

  @ApiProperty({ example: '2026-05-11T13:30:00', description: 'Fecha/hora del pago (ISO 8601)' })
  paidOn: string;
}

export class OtpRequestDto {
  @ApiProperty({ example: 'V', enum: ['V', 'E', 'J', 'G', 'P'] })
  documentType: string;

  @ApiProperty({ example: '18456329' })
  documentNumber: string;

  @ApiProperty({ example: '0102', description: 'Código banco del deudor' })
  debtorBankCode: string;

  @ApiProperty({ example: '04141234567' })
  debtorPhone: string;

  @ApiProperty({ example: 198114.5 })
  amount: number;
}

export class OtpConfirmDto {
  @ApiProperty({ example: 'V' })
  documentType: string;

  @ApiProperty({ example: '18456329' })
  documentNumber: string;

  @ApiProperty({ example: '0102' })
  debtorBankCode: string;

  @ApiProperty({ example: '04141234567' })
  debtorPhone: string;

  @ApiProperty({ example: 'Maria Fernandez' })
  debtorName: string;

  @ApiProperty({ example: 198114.5 })
  amount: number;

  @ApiProperty({ example: '123456', description: 'OTP de 6 dígitos enviada al cliente' })
  otp: string;

  @ApiPropertyOptional({ example: 'Pago póliza RCV', description: 'Concepto del débito' })
  concept?: string;
}
