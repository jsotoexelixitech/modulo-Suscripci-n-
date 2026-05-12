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

  /**
   * Resuelve texto libre (ej. marca/modelo de OCR) contra el catálogo INMA.
   * Devuelve { cmarca, xmarca, cmodelo?, xmodelo?, versiones[], fallback }.
   */
  async resolveVehicle(fano: number, marca: string, modelo: string) {
    const norm = (s: string) =>
      String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

    const marcas: { cmarca: string; xmarca: string }[] = await lamundialClient.getInmaMarcas(fano);
    const normMarca = norm(marca);
    const marcaMatch =
      marcas.find((m) => norm(m.xmarca) === normMarca) ??
      marcas.find((m) => norm(m.xmarca).includes(normMarca) || normMarca.includes(norm(m.xmarca)));

    if (!marcaMatch) {
      return { success: false, fallback: true, message: `Marca "${marca}" no encontrada en catálogo INMA` };
    }

    const modelos: { cmodelo: string; xmodelo: string }[] = await lamundialClient.getInmaModelos(fano, marcaMatch.cmarca);
    const normModelo = norm(modelo);
    const modeloMatch = modelo
      ? (modelos.find((m) => norm(m.xmodelo) === normModelo) ??
        modelos.find((m) => norm(m.xmodelo).includes(normModelo) || normModelo.includes(norm(m.xmodelo))))
      : undefined;
    const resolvedModelo = modeloMatch ?? modelos[0];

    if (!resolvedModelo) {
      return {
        success: true,
        fallback: true,
        cmarca: marcaMatch.cmarca,
        xmarca: marcaMatch.xmarca,
        message: 'Marca resuelta pero sin modelos disponibles',
      };
    }

    const versiones = await lamundialClient.getInmaVersiones(fano, marcaMatch.cmarca, resolvedModelo.cmodelo);

    return {
      success: true,
      fallback: !modeloMatch,
      cmarca: marcaMatch.cmarca,
      xmarca: marcaMatch.xmarca,
      cmodelo: resolvedModelo.cmodelo,
      xmodelo: resolvedModelo.xmodelo,
      versiones,
    };
  }
}
