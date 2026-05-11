import { Injectable, Logger } from '@nestjs/common';

// Reutilizamos la lógica JS existente — altamente probada con La Mundial
// eslint-disable-next-line @typescript-eslint/no-var-requires
const policyService = require('../../../src/services/lamundial/policyService');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const lamundialClient = require('../../../src/services/lamundial/lamundialClient');

@Injectable()
export class PoliciesService {
  private readonly logger = new Logger(PoliciesService.name);

  async quote(state: Record<string, any>, overrides: Record<string, any> = {}) {
    this.logger.log(`Cotizando: placa=${state?.vehicle?.placa ?? '?'} plan=${overrides.plan ?? 'default'}`);
    return policyService.quote(state, overrides);
  }

  async emit(state: Record<string, any>, overrides: Record<string, any> = {}) {
    const placa = state?.vehicle?.placa ?? '?';
    this.logger.log(`Emitiendo: placa=${placa} plan=${overrides.plan ?? 'default'}`);
    return policyService.quoteAndEmit(state, overrides);
  }

  getMode(): string {
    return policyService.getMode();
  }

  // ── Catálogo INMA ──────────────────────────────────────────────────────────

  async getInmaAnios() {
    return lamundialClient.getInmaAnios();
  }

  async getInmaMarcas(fano: number) {
    return lamundialClient.getInmaMarcas(fano);
  }

  async getInmaModelos(fano: number, cmarca: string) {
    return lamundialClient.getInmaModelos(fano, cmarca);
  }

  async getInmaVersiones(fano: number, cmarca: string, cmodelo: string) {
    return lamundialClient.getInmaVersiones(fano, cmarca, cmodelo);
  }

  async getCategoriasUso(fano: number, cmarca: string, cmodelo: string, cversion: string) {
    return lamundialClient.getCategoriasUso({ fano, cmarca, cmodelo, cversion });
  }
}
