/**
 * /api/valrep — Proxy a los catálogos de La Mundial de Seguros.
 *
 * Endpoints expuestos:
 *   GET /api/valrep/state          → lista de estados
 *   GET /api/valrep/city?cestado=N → ciudades del estado indicado
 *   GET /api/valrep/list/:domain   → lista genérica (SEXO, EDOCIVIL, PARENTESCOS, FRECUENCIAS, MATIPCANAL)
 */
const express = require('express');
const axios   = require('axios');

const router = express.Router();

const BASE_URL = (process.env.LAMUNDIAL_BASE_URL || 'https://qaapisys2000.lamundialdeseguros.com').replace(/\/$/, '');
const TIMEOUT  = parseInt(process.env.LAMUNDIAL_TIMEOUT_MS, 10) || 15_000;

function authHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (process.env.LAMUNDIAL_APIKEY) h['apikey'] = process.env.LAMUNDIAL_APIKEY;
  return h;
}

function logUpstreamError(tag, err) {
  // Loguea el detalle real para debug, sin romper el handler.
  const status = err?.response?.status;
  const body   = err?.response?.data;
  const url    = err?.config?.url;
  console.error(`[${tag}] upstream error`,
    JSON.stringify({
      message: err?.message,
      status,
      url,
      body: typeof body === 'string' ? body.slice(0, 500) : body,
    }),
  );
}

async function proxyPost(path, body = {}) {
  const { data } = await axios.post(
    `${BASE_URL}${path}`,
    body,
    { headers: authHeaders(), timeout: TIMEOUT },
  );
  return data;
}

// GET /api/valrep/state
router.get('/state', async (_req, res) => {
  try {
    const data = await proxyPost('/api/v1/valrep/state');
    const items = data?.data?.state ?? [];
    res.json({
      ok: true,
      items: items.map((s) => ({ code: s.cestado, label: s.xdescripcion_l })),
    });
  } catch (err) {
    logUpstreamError('valrep/state', err);
    res.status(502).json({
      ok: false,
      error: 'No se pudo obtener la lista de estados',
      detail: err?.response?.data || err?.message,
    });
  }
});

// GET /api/valrep/city?cestado=<codigo>
router.get('/city', async (req, res) => {
  const cestadoRaw = req.query.cestado ?? req.query.estado ?? '';
  const cestado    = cestadoRaw ? parseInt(String(cestadoRaw), 10) : null;
  try {
    const body = cestado ? { cestado } : {};
    const data = await proxyPost('/api/v1/valrep/city', body);
    const items = data?.data?.city ?? data?.data?.state ?? [];
    res.json({
      ok: true,
      cestado: cestado ?? null,
      items: items.map((c) => ({ code: c.cciudad, label: c.xdescripcion_l })),
    });
  } catch (err) {
    logUpstreamError('valrep/city', err);
    res.status(502).json({
      ok: false,
      error: 'No se pudo obtener la lista de ciudades',
      detail: err?.response?.data || err?.message,
    });
  }
});

// GET /api/valrep/list/:domain
router.get('/list/:domain', async (req, res) => {
  const domain = (req.params.domain || '').toUpperCase();
  const ALLOWED = ['SEXO', 'EDOCIVIL', 'PARENTESCOS', 'FRECUENCIAS', 'MATIPCANAL'];
  if (!ALLOWED.includes(domain)) {
    return res.status(400).json({ ok: false, error: `Dominio no permitido: ${domain}` });
  }

  try {
    const data = await proxyPost('/api/v1/valrep/getLists', {
      cdominio   : domain,
      xtipo_orden: 'ASC',
    });

    // La respuesta puede usar varias keys según el dominio.
    // Casos vistos:
    //   SEXO       -> data: [{ cvalor, xdescripcion }]
    //   EDOCIVIL   -> data: [{ cvalor, xdescripcion }]
    //   PARENTESCOS-> data: [{ cvalor, xdescripcion }] o data.listas/list/items
    const raw =
      data?.data?.listas ??
      data?.data?.list   ??
      data?.data?.items  ??
      data?.data         ??
      [];

    const items = (Array.isArray(raw) ? raw : []).map((i) => {
      const code  = i?.cvalor ?? i?.citem ?? i?.codigo ?? i?.cdominio_item ?? '';
      const label = i?.xdescripcion ?? i?.xitem ?? i?.descripcion ?? i?.xdescripcion_l ?? '';
      return { code: String(code), label: String(label) };
    }).filter((it) => it.code !== '' && it.label !== '');

    res.json({ ok: true, domain, items });
  } catch (err) {
    logUpstreamError(`valrep/list/${domain}`, err);
    res.status(502).json({
      ok: false,
      error: `No se pudo obtener la lista ${domain}`,
      detail: err?.response?.data || err?.message,
    });
  }
});

module.exports = router;
