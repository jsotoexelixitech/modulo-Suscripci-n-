import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class ValrepService {
  private readonly logger = new Logger(ValrepService.name);

  private get baseUrl(): string {
    return (process.env.LAMUNDIAL_BASE_URL ?? 'https://qaapisys2000.lamundialdeseguros.com').replace(/\/$/, '');
  }

  private get timeout(): number {
    return parseInt(process.env.LAMUNDIAL_TIMEOUT_MS ?? '15000', 10);
  }

  private authHeaders() {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (process.env.LAMUNDIAL_APIKEY) h['apikey'] = process.env.LAMUNDIAL_APIKEY;
    return h;
  }

  private async proxyPost(path: string, body: Record<string, any> = {}) {
    const { data } = await axios.post(`${this.baseUrl}${path}`, body, {
      headers: this.authHeaders(),
      timeout: this.timeout,
    });
    return data;
  }

  async getStates() {
    const data = await this.proxyPost('/api/v1/valrep/state');
    const items: any[] = data?.data?.state ?? [];
    return items.map((s: any) => ({ code: s.cestado, label: s.xdescripcion_l }));
  }

  async getCities(cestado?: number) {
    const body = cestado ? { cestado } : {};
    const data = await this.proxyPost('/api/v1/valrep/city', body);
    const items: any[] = data?.data?.city ?? data?.data?.state ?? [];
    return {
      cestado: cestado ?? null,
      items: items.map((c: any) => ({ code: c.cciudad, label: c.xdescripcion_l })),
    };
  }

  async getList(domain: string) {
    const ALLOWED = ['SEXO', 'EDOCIVIL', 'PARENTESCOS', 'FRECUENCIAS', 'MATIPCANAL'];
    if (!ALLOWED.includes(domain)) {
      throw Object.assign(new Error(`Dominio no permitido: ${domain}`), { httpStatus: 400 });
    }

    const data = await this.proxyPost('/api/v1/valrep/getLists', {
      cdominio: domain,
      xtipo_orden: 'ASC',
    });

    const raw =
      data?.data?.listas ??
      data?.data?.list ??
      data?.data?.items ??
      data?.data ??
      [];

    const items = (Array.isArray(raw) ? raw : [])
      .map((i: any) => {
        const code = i?.cvalor ?? i?.citem ?? i?.codigo ?? i?.cdominio_item ?? '';
        const label = i?.xdescripcion ?? i?.xitem ?? i?.descripcion ?? i?.xdescripcion_l ?? '';
        return { code: String(code), label: String(label) };
      })
      .filter((it: any) => it.code !== '' && it.label !== '');

    return { domain, items };
  }
}
