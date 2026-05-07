/**
 * Orquesta la ejecución de los tests unitarios (backend + frontend) y guarda
 * un `test-summary.json` en cada `coverage/` con el conteo de suites/tests.
 *
 * Esto le permite al `generate-acta.ts` incluir secciones de unit tests en
 * el ACTA-DE-PRUEBAS.pdf consolidada sin depender de logs textuales.
 *
 * Salidas:
 *   server/coverage/coverage-summary.json   (ya lo escribe Jest)
 *   server/coverage/test-summary.json       (lo escribimos aquí)
 *   frontend/coverage/coverage-summary.json (lo escribe Vitest)
 *   frontend/coverage/test-summary.json     (lo escribimos aquí)
 *
 * Uso: npx tsx e2e/reporting/run-unit-suites.ts
 */
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');

function ensureDir(d: string): void {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

interface JestResultJson {
  numTotalTestSuites: number;
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  numPendingTests: number;
  startTime: number;
  testResults?: { endTime?: number }[];
}

interface VitestResultJson {
  numTotalTestSuites: number;
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  startTime: number;
}

function runBackend(): void {
  console.log('\n=== Backend Jest ===');
  const tmpJson = path.join(ROOT, 'server', 'coverage', 'jest-result.json');
  ensureDir(path.dirname(tmpJson));
  try {
    execSync(
      `npx jest --coverage --json --outputFile="${tmpJson}"`,
      { cwd: path.join(ROOT, 'server'), stdio: 'inherit', shell: 'powershell.exe' },
    );
  } catch (err) {
    // Aún si fallan tests queremos guardar el summary
    console.warn('[unit-runner] Jest devolvió error (no fatal):', (err as Error).message.split('\n')[0]);
  }
  if (fs.existsSync(tmpJson)) {
    const j = JSON.parse(fs.readFileSync(tmpJson, 'utf8')) as JestResultJson;
    const summary = {
      numTotalTestSuites: j.numTotalTestSuites,
      numTotalTests: j.numTotalTests,
      numPassedTests: j.numPassedTests,
      numFailedTests: j.numFailedTests,
      numPendingTests: j.numPendingTests,
      durationMs: (j.testResults?.reduce((a, r) => Math.max(a, r.endTime ?? 0), 0) ?? 0) - (j.startTime ?? 0),
    };
    fs.writeFileSync(
      path.join(ROOT, 'server', 'coverage', 'test-summary.json'),
      JSON.stringify(summary, null, 2),
      'utf8',
    );
    console.log(`[unit-runner] backend test-summary.json escrito (${summary.numTotalTests} tests)`);
  }
}

function runFrontend(): void {
  console.log('\n=== Frontend Vitest ===');
  const tmpJson = path.join(ROOT, 'frontend', 'coverage', 'vitest-result.json');
  ensureDir(path.dirname(tmpJson));
  try {
    execSync(
      `npx vitest run --coverage --reporter=json --outputFile="${tmpJson}"`,
      { cwd: path.join(ROOT, 'frontend'), stdio: 'inherit', shell: 'powershell.exe' },
    );
  } catch (err) {
    console.warn('[unit-runner] Vitest devolvió error (no fatal):', (err as Error).message.split('\n')[0]);
  }
  if (fs.existsSync(tmpJson)) {
    const v = JSON.parse(fs.readFileSync(tmpJson, 'utf8')) as VitestResultJson;
    const summary = {
      numTotalTestSuites: v.numTotalTestSuites,
      numTotalTests: v.numTotalTests,
      numPassedTests: v.numPassedTests,
      numFailedTests: v.numFailedTests,
      durationMs: 0,
    };
    fs.writeFileSync(
      path.join(ROOT, 'frontend', 'coverage', 'test-summary.json'),
      JSON.stringify(summary, null, 2),
      'utf8',
    );
    console.log(`[unit-runner] frontend test-summary.json escrito (${summary.numTotalTests} tests)`);
  }
}

runBackend();
runFrontend();
console.log('\n[unit-runner] OK — listos para generate-acta.ts');
