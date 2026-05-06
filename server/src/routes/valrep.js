/**
 * /api/valrep — Proxy a los catálogos de La Mundial de Seguros.
 *
 * Endpoints expuestos:
 *   GET /api/valrep/state          → lista de estados
 *   GET /api/valrep/city           → lista de ciudades
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
    console.error('[valrep/state]', err.message);
    res.status(502).json({ ok: false, error: 'No se pudo obtener la lista de estados' });
  }
});

// GET /api/valrep/city?cestado=<codigo>
// Devuelve las ciudades del estado solicitado. Si no se pasa cestado se devuelven todas.
router.get('/city', async (req, res) => {
  const cestadoRaw = req.query.cestado ?? req.query.estado ?? '';
  const cestado = cestadoRaw ? parseInt(String(cestadoRaw), 10) : null;
  try {
    const body = cestado ? { cestado } : {};
    const data = await proxyPost('/api/v1/valrep/city', body);
    // La API devuelve la lista en data.data.city (también vista como state en algunas versiones)
    const items = data?.data?.city ?? data?.data?.state ?? [];
    res.json({
      ok: true,
      cestado: cestado ?? null,
      items: items.map((c) => ({ code: c.cciudad, label: c.xdescripcion_l })),
    });
  } catch (err) {
    console.error('[valrep/city]', err.message);
    res.status(502).json({ ok: false, error: 'No se pudo obtener la lista de ciudades' });
  }
});

// GET /api/valrep/list/:domain
// Dominios soportados: SEXO, EDOCIVIL, PARENTESCOS, FRECUENCIAS, MATIPCANAL
router.get('/list/:domain', async (req, res) => {
  const domain = (req.params.domain || '').toUpperCase();
  const ALLOWED = ['SEXO', 'EDOCIVIL', 'PARENTESCOS', 'FRECUENCIAS', 'MATIPCANAL'];
  if (!ALLOWED.includes(domain)) {
    return res.status(400).json({ ok: false, error: `Dominio no permitido: ${domain}` });
  }

  try {
    const data = await proxyPost('/api/v1/valrep/getLists', {
      cdominio     : domain,
      xtipo_orden  : 'ASC',
    });

    // La respuesta puede usar varias keys; normalizar
    const raw =
      data?.data?.listas   ??
      data?.data?.list     ??
      data?.data?.items    ??
      data?.data           ??   // a veces el array está directo
      [];

    const items = (Array.isArray(raw) ? raw : []).map((i) => ({
      code : i.citem     ?? i.codigo    ?? i.cdominio_item ?? String(i),
      label: i.xitem     ?? i.descripcion ?? i.xdescripcion ?? String(i),
    }));

    res.json({ ok: true, domain, items });
  } catch (err) {
    console.error(`[valrep/list/${domain}]`, err.message);
    res.status(502).json({ ok: false, error: `No se pudo obtener la lista ${domain}` });
  }
});

module.exports = router;
