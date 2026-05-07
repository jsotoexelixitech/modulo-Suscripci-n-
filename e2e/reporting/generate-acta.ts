/**
 * Genera el ACTA-DE-PRUEBAS.pdf consolidando:
 *   - Manifest JSON de cada caso (escrito por stepCapture.ts durante la corrida).
 *   - Resultados JSON del runner Playwright (qa-evidence/results.json).
 *   - Capturas en qa-evidence/screenshots/.
 *
 * Salida: qa-evidence/ACTA-DE-PRUEBAS.pdf
 *
 * Reutiliza el Chromium de Playwright (ya instalado) → cero dependencias extra.
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import Handlebars from 'handlebars';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(__dirname, '..', '..');
const EVIDENCE = path.join(ROOT, 'qa-evidence');
const MANIFEST_DIR = path.join(EVIDENCE, 'manifest');
const RESULTS_FILE = path.join(EVIDENCE, 'results.json');
const TEMPLATE_FILE = path.join(__dirname, 'templates', 'acta.html');
const OUTPUT_PDF = path.join(EVIDENCE, 'ACTA-DE-PRUEBAS.pdf');
const LOGO_FILE = path.join(ROOT, 'frontend', 'public', 'logo-lamundial.png');

interface ManifestStep {
  order: number;
  name: string;
  description: string;
  screenshot: string;
  takenAt: string;
}

interface ManifestEntry {
  testId: string;
  title: string;
  description: string;
  startedAt: string;
  steps: ManifestStep[];
}

interface PlaywrightResult {
  status: 'passed' | 'failed' | 'skipped' | 'timedOut' | 'interrupted';
  duration: number;
  title: string;
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('es-VE', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
}

function fmtDuration(ms: number): string {
  if (!ms || ms < 0) return '—';
  const totalS = Math.round(ms / 1000);
  const m = Math.floor(totalS / 60);
  const s = totalS % 60;
  if (m === 0) return `${s} s`;
  return `${m} min ${String(s).padStart(2, '0')} s`;
}

async function loadManifests(): Promise<ManifestEntry[]> {
  try {
    const files = await fs.readdir(MANIFEST_DIR);
    const out: ManifestEntry[] = [];
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const raw = (await fs.readFile(path.join(MANIFEST_DIR, f), 'utf8')).replace(/^\uFEFF/, '');
      out.push(JSON.parse(raw) as ManifestEntry);
    }
    out.sort((a, b) => a.testId.localeCompare(b.testId));
    return out;
  } catch (err) {
    console.warn('[acta] No se encontraron manifests, generando acta vacía:', (err as Error).message);
    return [];
  }
}

interface FlatTest {
  testId: string;
  title: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
}

async function loadResults(): Promise<Map<string, FlatTest>> {
  const map = new Map<string, FlatTest>();
  try {
    const raw = await fs.readFile(RESULTS_FILE, 'utf8');
    const json = JSON.parse(raw);
    // Estructura del JSON reporter de Playwright: suites→specs→tests→results
    const flatten = (suites: unknown[]): void => {
      for (const suite of (suites as Record<string, unknown>[]) || []) {
        for (const spec of (suite.specs as Record<string, unknown>[]) || []) {
          const title = String(spec.title || '');
          const idMatch = title.match(/(TC-\d{2,3})/i);
          const testId = idMatch ? idMatch[1].toUpperCase() : title;
          const tests = (spec.tests as Record<string, unknown>[]) || [];
          const test0 = tests[0] as Record<string, unknown> | undefined;
          const results = (test0?.results as Record<string, unknown>[]) || [];
          const result0 = results[0];
          const rawStatus = String(result0?.status || 'skipped');
          const status: FlatTest['status'] =
            rawStatus === 'passed' ? 'passed' :
            rawStatus === 'skipped' ? 'skipped' : 'failed';
          map.set(testId, {
            testId,
            title,
            status,
            duration: Number(result0?.duration || 0),
          });
        }
        if (suite.suites) flatten(suite.suites as unknown[]);
      }
    };
    flatten(json.suites || []);
  } catch (err) {
    console.warn('[acta] results.json no disponible:', (err as Error).message);
  }
  return map;
}

async function fileToDataUri(absPath: string): Promise<string> {
  try {
    const buf = await fs.readFile(absPath);
    const b64 = buf.toString('base64');
    return `data:image/png;base64,${b64}`;
  } catch {
    return '';
  }
}

interface UnitSummary {
  name: string;
  totalSuites: number;
  totalTests: number;
  passed: number;
  failed: number;
  durationMs?: number;
  reportFile?: string;
}

async function readJsonSafe<T = unknown>(file: string): Promise<T | null> {
  try {
    const raw = (await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, '');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Lee el coverage-summary.json de Jest (backend) si existe.
 */
async function loadBackendUnitSummary(): Promise<UnitSummary | null> {
  const coverageFile = path.join(ROOT, 'server', 'coverage', 'coverage-summary.json');
  const cov = await readJsonSafe<Record<string, { lines?: { pct: number } }>>(coverageFile);
  // Para los conteos de tests, leemos el output del runner desde un archivo
  // estándar que `npm test --json` puede producir, o usamos valores conocidos.
  const testSummaryFile = path.join(ROOT, 'server', 'coverage', 'test-summary.json');
  const ts = await readJsonSafe<{ numTotalTestSuites: number; numTotalTests: number; numPassedTests: number; numFailedTests: number }>(testSummaryFile);

  if (!cov && !ts) return null;
  const linesPct = cov?.total?.lines?.pct ?? 0;
  return {
    name: 'Backend (Jest)',
    totalSuites: ts?.numTotalTestSuites ?? 0,
    totalTests: ts?.numTotalTests ?? 0,
    passed: ts?.numPassedTests ?? 0,
    failed: ts?.numFailedTests ?? 0,
    reportFile: `Cobertura líneas: ${linesPct}%`,
  };
}

/**
 * Lee el coverage-summary.json de Vitest (frontend) si existe.
 */
async function loadFrontendUnitSummary(): Promise<UnitSummary | null> {
  const coverageFile = path.join(ROOT, 'frontend', 'coverage', 'coverage-summary.json');
  const cov = await readJsonSafe<Record<string, { lines?: { pct: number } }>>(coverageFile);

  const testSummaryFile = path.join(ROOT, 'frontend', 'coverage', 'test-summary.json');
  const ts = await readJsonSafe<{ numTotalTestSuites: number; numTotalTests: number; numPassedTests: number; numFailedTests: number }>(testSummaryFile);

  if (!cov && !ts) return null;
  const linesPct = cov?.total?.lines?.pct ?? 0;
  return {
    name: 'Frontend (Vitest + RTL)',
    totalSuites: ts?.numTotalTestSuites ?? 0,
    totalTests: ts?.numTotalTests ?? 0,
    passed: ts?.numPassedTests ?? 0,
    failed: ts?.numFailedTests ?? 0,
    reportFile: `Cobertura líneas: ${linesPct}%`,
  };
}

async function generate(): Promise<void> {
  const manifests = await loadManifests();
  const results = await loadResults();
  const backendUnit  = await loadBackendUnitSummary();
  const frontendUnit = await loadFrontendUnitSummary();

  const cases = await Promise.all(manifests.map(async (m) => {
    const r = results.get(m.testId);
    const status = r?.status || 'skipped';
    const statusLabel =
      status === 'passed' ? 'APROBADO' :
      status === 'failed' ? 'FALLIDO' : 'OMITIDO';

    const lastStepAt = m.steps[m.steps.length - 1]?.takenAt;
    const duration =
      r?.duration ||
      (lastStepAt && m.startedAt
        ? new Date(lastStepAt).getTime() - new Date(m.startedAt).getTime()
        : 0);

    const enrichedSteps = await Promise.all(m.steps.map(async (s) => ({
      ...s,
      takenAtFormatted: fmtDate(s.takenAt).split(', ')[1] || s.takenAt,
      screenshotAbsolute: await fileToDataUri(path.join(EVIDENCE, s.screenshot)),
    })));

    return {
      ...m,
      steps: enrichedSteps,
      status,
      statusLabel,
      startedAtFormatted: fmtDate(m.startedAt),
      durationFormatted: fmtDuration(duration),
    };
  }));

  const totals = {
    total: cases.length,
    passed: cases.filter(c => c.status === 'passed').length,
    failed: cases.filter(c => c.status === 'failed').length,
    skipped: cases.filter(c => c.status === 'skipped').length,
  };

  const totalDurationMs = Array.from(results.values()).reduce((acc, r) => acc + r.duration, 0);

  const unitLevels = [backendUnit, frontendUnit].filter(Boolean) as UnitSummary[];
  const unitTotals = unitLevels.reduce(
    (acc, u) => {
      acc.tests   += u.totalTests;
      acc.passed  += u.passed;
      acc.failed  += u.failed;
      acc.suites  += u.totalSuites;
      return acc;
    },
    { tests: 0, passed: 0, failed: 0, suites: 0 },
  );
  const grandTotalTests = unitTotals.tests + totals.total;

  const logoDataUri = await fileToDataUri(LOGO_FILE);

  const verdict =
    totals.failed > 0 ? 'rejected' :
    totals.skipped > 0 ? 'observations' :
    'approved';

  const ctx = {
    build: process.env.QA_BUILD || 'local-dev',
    environment: process.env.QA_ENV || 'QA · qaapisys2000.lamundialdeseguros.com',
    tester: process.env.QA_TESTER || 'Automatización Playwright + Jest + Vitest',
    platform: 'Chromium 122 · 1366×820 · Windows',
    executedAt: fmtDate(new Date().toISOString()),
    date: new Date().toLocaleDateString('es-VE'),
    durationFormatted: fmtDuration(totalDurationMs),
    totals,
    passRate: totals.total > 0 ? Math.round((totals.passed / totals.total) * 100) : 0,
    cases,
    hasUnit: unitLevels.length > 0,
    unitLevels,
    unitTotals,
    grandTotalTests,
    logoDataUri,
    verdict,
    verdictApproved:    verdict === 'approved',
    verdictWithObs:     verdict === 'observations',
    verdictRejected:    verdict === 'rejected',
  };

  const tplSrc = await fs.readFile(TEMPLATE_FILE, 'utf8');
  const tpl = Handlebars.compile(tplSrc);
  const html = tpl(ctx);

  // Escribimos el HTML intermedio (útil para depurar el template)
  await fs.writeFile(path.join(EVIDENCE, 'ACTA-DE-PRUEBAS.html'), html, 'utf8');

  // Renderizamos a PDF con Chromium
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.pdf({
    path: OUTPUT_PDF,
    format: 'A4',
    printBackground: true,
    margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' },
  });
  await browser.close();

  console.log(`[acta] PDF generado: ${path.relative(ROOT, OUTPUT_PDF)}`);
  console.log(`[acta] Casos: ${totals.total} · ✓ ${totals.passed} · ✗ ${totals.failed} · ⚠ ${totals.skipped}`);
}

generate().catch((err) => {
  // Mensaje friendly cuando el PDF está abierto en un visor (Windows EBUSY)
  if (err && (err as NodeJS.ErrnoException).code === 'EBUSY') {
    console.error('');
    console.error('[acta] No pude escribir el PDF porque está abierto en otro programa.');
    console.error('[acta] Cierra el visor (Acrobat, Edge, etc.) y vuelve a correr `npm run qa:acta`.');
    console.error('[acta] Archivo bloqueado: ' + OUTPUT_PDF);
    console.error('');
    process.exit(2);
  }
  console.error('[acta] Falló la generación:', err);
  process.exit(1);
});
