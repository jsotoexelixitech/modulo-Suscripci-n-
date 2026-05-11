import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Estado del servidor' })
  @ApiOkResponse({ description: 'Servidor activo', schema: { example: { status: 'ok' } } })
  getHealth() {
    return {
      status: 'ok',
      env: process.env.NODE_ENV ?? 'development',
      time: new Date().toISOString(),
    };
  }
}
