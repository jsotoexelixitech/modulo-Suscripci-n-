import { test, type Page, type TestInfo } from '@playwright/test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * Helper que envuelve `test.step` con captura de screenshot y registro
 * de metadatos para el ACTA-DE-PRUEBAS.pdf.
 *
 * El PDF se construye después de la ejecución leyendo los archivos JSON
 * que esta función escribe (uno por caso) en `qa-evidence/manifest/`.
 */

const EVIDENCE_ROOT = path.resolve(__dirname, '..', '..', 'qa-evidence');
const SCREENSHOT_ROOT = path.join(EVIDENCE_ROOT, 'screenshots');
const MANIFEST_ROOT = path.join(EVIDENCE_ROOT, 'manifest');

interface ManifestEntry {
  testId: string;
  title: string;
  description: string;
  startedAt: string;
  steps: ManifestStep[];
}

interface ManifestStep {
  order: number;
  name: string;
  description: string;
  screenshot: string;
  takenAt: string;
}

const inMemoryManifests = new Map<string, ManifestEntry>();

function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export interface CaseInfo {
  /** ID único del caso, ej: "TC-03" */
  id: string;
  /** Título humano del caso */
  title: string;
  /** Descripción breve mostrada en el ACTA */
  description?: string;
  /** Severidad: critical | high | medium | low */
  severity?: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Registra el caso al inicio del test. Devuelve helpers que se deben
 * usar dentro del propio test.
 */
export function defineCase(info: CaseInfo, _testInfo: TestInfo) {
  const entry: ManifestEntry = {
    testId: info.id,
    title: info.title,
    description: info.description ?? '',
    startedAt: new Date().toISOString(),
    steps: [],
  };
  inMemoryManifests.set(info.id, entry);

  let order = 0;

  /** Ejecuta un paso del test, captura screenshot y lo registra en el manifest. */
  async function step(name: string, page: Page, fn: () => Promise<void>): Promise<void> {
    return test.step(name, async () => {
      await fn();
      order += 1;
      await captureScreenshot(info.id, order, name, page);
    });
  }

  /** Captura sin envolver en step (cuando ya estamos dentro de uno). */
  async function capture(name: string, page: Page): Promise<void> {
    order += 1;
    await captureScreenshot(info.id, order, name, page);
  }

  return { step, capture };
}

async function captureScreenshot(
  caseId: string,
  order: number,
  name: string,
  page: Page,
): Promise<void> {
  const dir = path.join(SCREENSHOT_ROOT, caseId);
  await ensureDir(dir);
  const filename = `${String(order).padStart(2, '0')}.${slug(name)}.png`;
  const fullPath = path.join(dir, filename);

  await page.screenshot({ path: fullPath, fullPage: true, animations: 'disabled' });

  const entry = inMemoryManifests.get(caseId);
  if (entry) {
    entry.steps.push({
      order,
      name,
      description: name,
      screenshot: path.relative(EVIDENCE_ROOT, fullPath).replace(/\\/g, '/'),
      takenAt: new Date().toISOString(),
    });
    await ensureDir(MANIFEST_ROOT);
    await fs.writeFile(
      path.join(MANIFEST_ROOT, `${caseId}.json`),
      JSON.stringify(entry, null, 2),
      'utf8',
    );
  }
}
