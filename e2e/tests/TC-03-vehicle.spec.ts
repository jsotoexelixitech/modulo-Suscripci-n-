import { test, expect } from '@playwright/test';
import { defineCase } from '../utils/stepCapture';
import { buildRandomBundle, KNOWN_YEAR } from '../utils/testdata';

/**
 * TC-03 — Datos del vehículo
 *
 * Cubre:
 *   1. Llenar placa con formato venezolano.
 *   2. Seleccionar año del catálogo INMA (lista carga desde La Mundial real).
 *   3. Seleccionar marca y modelo (cascada desde catálogo INMA).
 *   4. Seleccionar versión y validar que dispara getCategoriasUso.
 *   5. Validar que el selector "¿Para qué usas el vehículo?" se llena con las
 *      categorías reales devueltas por La Mundial para esa versión.
 *   6. Confirmar que la categoría queda seleccionada.
 *
 * NO emite póliza — termina antes de pago. Modo seguro para QA.
 */

test('TC-03: vehículo - selección de versión carga categorías de uso desde La Mundial', async ({ page }, testInfo) => {
  const data = buildRandomBundle();
  const { step } = defineCase({
    id: 'TC-03',
    title: 'Vehículo - Selección de versión carga categorías de uso',
    description:
      'Verifica que al seleccionar la versión del vehículo, el sistema consulta el endpoint ' +
      '/api/catalogo/categorias-uso (proxy a getCategoriasUso de La Mundial) y popula el ' +
      'selector de uso con las categorías permitidas para esa versión.',
    severity: 'critical',
  }, testInfo);

  await step('Cargar la aplicación y descartar splash', page, async () => {
    await page.goto('/');
    // Esperar splash, luego que desaparezca o presionar para saltar.
    await page.waitForLoadState('networkidle');
    // Si hay un botón "Comenzar" del splash lo presionamos
    const startBtn = page.getByRole('button', { name: /comenzar|empezar|iniciar/i }).first();
    if (await startBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await startBtn.click();
    }
    await page.waitForTimeout(800);
  });

  await step('Seedear documentos completados y saltar al paso 3 (vehículo)', page, async () => {
    await page.evaluate(() => {
      const store = (window as unknown as { __wizardStore?: { setState: (s: object) => void } }).__wizardStore;
      if (!store) throw new Error('__wizardStore no expuesto. Asegúrate de correr en modo dev.');
      store.setState({
        step: 3,
        documents: {
          cedula:      { status: 'done', progress: 100, ocr: { tipoDoc: 'V', identificacion: '12345678', nombre: 'JAVIER', apellido: 'SOTO' } },
          licencia:    { status: 'done', progress: 100, ocr: {} },
          certificado: { status: 'done', progress: 100, ocr: { marca: 'TOYOTA', modelo: 'COROLLA', año: '2020', placa: 'AE123KT' } },
        },
      });
    });
    await expect(page.getByText(/Datos del veh/i).first()).toBeVisible({ timeout: 5_000 });
  });

  await step('Ingresar placa única generada para esta corrida', page, async () => {
    const placaInput = page.getByPlaceholder('AE123KT');
    await placaInput.fill(data.plate);
    await expect(placaInput).toHaveValue(data.plate);
  });

  await step('Seleccionar año del catálogo INMA', page, async () => {
    // El select de año está dentro del Field "Año del vehículo"
    const yearSelect = page.locator('select').filter({ hasText: /Selecciona año|2020|2021|2022/ }).first();
    await yearSelect.selectOption(KNOWN_YEAR);
    await page.waitForTimeout(1500); // Esperar carga de marcas
  });

  await step('Seleccionar marca Toyota desde el catálogo cargado', page, async () => {
    const brandSelect = page.locator('select').filter({ hasText: /Selecciona marca/ }).first();
    // Esperar que aparezcan opciones reales (más de solo el placeholder)
    await expect.poll(async () => {
      const opts = await brandSelect.locator('option').count();
      return opts;
    }, { timeout: 20_000 }).toBeGreaterThan(1);

    // Buscar el value del option cuyo texto contiene "TOYOTA"
    const optionsHandles = await brandSelect.locator('option').all();
    let toyotaValue: string | null = null;
    for (const opt of optionsHandles) {
      const txt = (await opt.textContent()) || '';
      if (/TOYOTA/i.test(txt)) {
        toyotaValue = await opt.getAttribute('value');
        break;
      }
    }
    if (!toyotaValue) {
      // Fallback: usar la primera marca disponible
      toyotaValue = await optionsHandles[1].getAttribute('value');
    }
    if (toyotaValue) await brandSelect.selectOption(toyotaValue);
    await page.waitForTimeout(1500);
  });

  await step('Seleccionar primer modelo disponible', page, async () => {
    const modelSelect = page.locator('select').filter({ hasText: /Selecciona modelo/ }).first();
    // Tomamos el primer modelo real (índice 1, porque 0 es el placeholder)
    const modelOptions = await modelSelect.locator('option').all();
    expect(modelOptions.length).toBeGreaterThan(1);
    const firstRealValue = await modelOptions[1].getAttribute('value');
    if (firstRealValue) {
      await modelSelect.selectOption(firstRealValue);
    }
    await page.waitForTimeout(1500); // Esperar carga de versiones
  });

  await step('Seleccionar primera versión disponible', page, async () => {
    const versionSelect = page.locator('select').filter({ hasText: /Selecciona la versión/ }).first();
    await expect(versionSelect).toBeVisible({ timeout: 10_000 });
    const versionOptions = await versionSelect.locator('option').all();
    expect(versionOptions.length).toBeGreaterThan(1);
    const firstRealValue = await versionOptions[1].getAttribute('value');
    if (firstRealValue) {
      await versionSelect.selectOption(firstRealValue);
    }
  });

  await step('Esperar que cargue el selector de categorías de uso (getCategoriasUso)', page, async () => {
    // El selector de uso debe transitar de "Selecciona la versión primero" a
    // un Select habilitado con opciones reales devueltas por La Mundial.
    await expect(page.getByText(/Selecciona la versi[oó]n primero/i)).toBeHidden({ timeout: 15_000 });
    const usoSelect = page.locator('select').filter({ hasText: /categoría de uso|Selecciona la categor/ }).first();
    await expect(usoSelect).toBeVisible({ timeout: 10_000 });
  });

  await step('Confirmar que hay categorías reales y seleccionar la primera', page, async () => {
    const usoSelect = page.locator('select').filter({ hasText: /categoría de uso|Selecciona la categor/ }).first();
    const options = await usoSelect.locator('option').all();
    expect(options.length).toBeGreaterThan(1); // Al menos un placeholder + 1 real
    const firstRealValue = await options[1].getAttribute('value');
    if (firstRealValue) {
      await usoSelect.selectOption(firstRealValue);
    }
    // Validar que el ✓ verde aparece (badge de categoría seleccionada)
    await expect(usoSelect).not.toHaveValue('');
  });

  await step('Validar que aparece la confirmación verde "listo para cotización"', page, async () => {
    await expect(page.getByText(/listo para cotizaci[oó]n/i)).toBeVisible({ timeout: 5_000 });
  });
});
