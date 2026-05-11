import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class QuoteDto {
  @ApiProperty({ description: 'Estado completo del wizard (vehicle, tomador, etc.)' })
  state: Record<string, any>;

  @ApiPropertyOptional({ enum: ['RCVBAS', 'RUSPAT'], default: 'RCVBAS' })
  plan?: 'RCVBAS' | 'RUSPAT';
}

export class EmitDto {
  @ApiProperty({ description: 'Estado completo del wizard' })
  state: Record<string, any>;

  @ApiPropertyOptional({ enum: ['RCVBAS', 'RUSPAT'], default: 'RCVBAS' })
  plan?: 'RCVBAS' | 'RUSPAT';

  @ApiPropertyOptional({ enum: ['A', 'S', 'C', 'T', 'M'], default: 'A' })
  frecuencia?: string;

  @ApiPropertyOptional({ description: 'Fecha de emisión YYYY-MM-DD (default: hoy)' })
  fechaEmision?: string;

  @ApiPropertyOptional({ description: 'ID interno de póliza (autogenerado si no se provee)' })
  internalPolicyId?: string;
}
