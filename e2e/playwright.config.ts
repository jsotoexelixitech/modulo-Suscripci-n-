import { defineConfig, devices } from '@playwright/test';
import * as path from 'node:path';

/**
 * Configuración Playwright — Suscripción RCV
 *
 * Modo de ejecución:
 *   npm run qa:test          → corre toda la suite y genera capturas/videos/traces
 *   npm run qa:report        → además genera el ACTA-DE-PRUEBAS.pdf
 *   npm run qa:codegen       → graba un nuevo caso interactivamente
 *
 * Variables de entorno relevantes:
 *   E2E_BASE_URL     URL del front (default http://localhost:5180)
 *   E2E_API_URL      URL de la API (default http://localhost:3001)
 *   EMIT_REAL=1      Permite que el test final ejecute createEmissionAuto real
 *                    (DESACTIVADO por defecto para no llenar QA de pólizas basura)
 *   USE_REAL_APIS=1  Usa APIs reales La Mundial/Meritop/SyPago (default: sí)
 */
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5180';

export default defineConfig({
  testDir: path.resolve(__dirname, 'tests'),
  outputDir: path.resolve(__dirname, '..', 'qa-evidence', 'test-results'),

  timeout: 60_000,
  expect: { timeout: 10_000 },

  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,

  reporter: [
    ['list'],
    ['json',  { outputFile: path.resolve(__dirname, '..', 'qa-evidence', 'results.json') }],
    ['html',  { outputFolder: path.resolve(__dirname, '..', 'qa-evidence', 'playwright-report'), open: 'never' }],
  ],

  use: {
    baseURL: BASE_URL,
    locale: 'es-VE',
    timezoneId: 'America/Caracas',
    viewport: { width: 1366, height: 820 },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,

    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // El backend Express + el frontend Vite se levantan automáticamente.
  // Si ya están corriendo (pm2 dev), reusamos en vez de duplicar.
  webServer: [
    {
      command: 'npm run dev --prefix server',
      url: 'http://localhost:3001/api/health',
      reuseExistingServer: true,
      stdout: 'ignore',
      stderr: 'pipe',
      timeout: 60_000,
    },
    {
      command: 'npm run dev --prefix frontend',
      url: BASE_URL,
      reuseExistingServer: true,
      stdout: 'ignore',
      stderr: 'pipe',
      timeout: 60_000,
    },
  ],
});
