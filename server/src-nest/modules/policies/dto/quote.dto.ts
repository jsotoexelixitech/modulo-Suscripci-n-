import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow, IsOptional, IsIn, IsString } from 'class-validator';

export class QuoteDto {
  // `@Allow()` permite que el ValidationPipe (whitelist:true) NO elimine este campo.
  // El objeto state es dinámico (vehicle, tomador, etc.) y no se valida aquí.
  @Allow()
  @ApiProperty({ description: 'Estado completo del wizard (vehicle, tomador, etc.)' })
  state: Record<string, any>;

  @IsOptional()
  @IsIn(['RCVBAS', 'RUSPAT'])
  @ApiPropertyOptional({ enum: ['RCVBAS', 'RUSPAT'], default: 'RCVBAS' })
  plan?: 'RCVBAS' | 'RUSPAT';
}

export class EmitDto {
  @Allow()
  @ApiProperty({ description: 'Estado completo del wizard' })
  state: Record<string, any>;

  @IsOptional()
  @IsIn(['RCVBAS', 'RUSPAT'])
  @ApiPropertyOptional({ enum: ['RCVBAS', 'RUSPAT'], default: 'RCVBAS' })
  plan?: 'RCVBAS' | 'RUSPAT';

  @IsOptional()
  @IsIn(['A', 'S', 'C', 'T', 'M'])
  @ApiPropertyOptional({ enum: ['A', 'S', 'C', 'T', 'M'], default: 'A' })
  frecuencia?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: 'Fecha de emisión YYYY-MM-DD (default: hoy)' })
  fechaEmision?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: 'ID interno de póliza (autogenerado si no se provee)' })
  internalPolicyId?: string;
}
