/**
 * E2E Tests - Price Actions Module
 * @module e2e/price-actions
 */

import { test, expect } from '@playwright/test';

// Helper para autenticación
async function authenticateUser(page: any) {
  await page.context().addCookies([
    {
      name: 'auth_token',
      value: 'test-token',
      domain: 'localhost',
      path: '/',
    }
  ]);
}

test.describe('Price Actions - Watchlist', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(process.env.CI !== undefined && !process.env.TEST_DB_URL, 'Requires test database');
    await authenticateUser(page);
  });

  test('should navigate to Price Actions page', async ({ page }) => {
    await page.goto('/');

    // Click en menú Price Actions
    await page.getByRole('link', { name: /price actions/i }).click();

    await expect(page).toHaveURL(/\/price-actions/);
    await expect(page.getByRole('heading', { name: /price actions/i })).toBeVisible();
  });

  test('should show watchlist configuration', async ({ page }) => {
    await page.goto('/price-actions');

    // Verificar parámetros de configuración
    await expect(page.getByLabel(/ventana de ritmo/i)).toBeVisible();
    await expect(page.getByLabel(/ciclo.*días/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /calcular/i })).toBeVisible();
  });

  test('should start watchlist calculation', async ({ page }) => {
    await page.goto('/price-actions');

    // Configurar parámetros
    await page.getByLabel(/ventana de ritmo/i).fill('14');
    await page.getByLabel(/ciclo.*días/i).fill('90');

    // Iniciar cálculo
    await page.getByRole('button', { name: /calcular/i }).click();

    // Debe mostrar progreso
    await expect(page.getByTestId('calculation-progress')).toBeVisible({ timeout: 10000 });
  });

  test('should display watchlist results', async ({ page }) => {
    await page.goto('/price-actions');

    // Asumir que ya hay resultados (o esperar cálculo)
    await page.waitForSelector('[data-testid="watchlist-results"]', { timeout: 60000 });

    // Verificar tabla de resultados
    const resultsTable = page.getByTestId('watchlist-results');
    await expect(resultsTable).toBeVisible();

    // Verificar columnas
    await expect(page.getByRole('columnheader', { name: /artículo/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /score/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /motivos/i })).toBeVisible();
  });

  test('should filter watchlist by score', async ({ page }) => {
    await page.goto('/price-actions');
    await page.waitForSelector('[data-testid="watchlist-results"]', { timeout: 60000 });

    // Filtrar por score crítico
    await page.getByRole('button', { name: /críticos/i }).click();

    // Verificar que solo muestra críticos
    const rows = page.getByTestId('watchlist-row');
    const count = await rows.count();

    if (count > 0) {
      // Todos deben tener score >= 70 (crítico)
      const firstRowScore = await rows.first().getByTestId('score-value').textContent();
      expect(parseInt(firstRowScore!)).toBeGreaterThanOrEqual(70);
    }
  });

  test('should export watchlist to Excel', async ({ page }) => {
    await page.goto('/price-actions');
    await page.waitForSelector('[data-testid="watchlist-results"]', { timeout: 60000 });

    // Click en exportar
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /exportar.*excel/i }).click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/watchlist.*\.xlsx/i);
  });
});

test.describe('Price Actions - Simulator', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(process.env.CI !== undefined && !process.env.TEST_DB_URL, 'Requires test database');
    await authenticateUser(page);
    await page.goto('/price-actions');
  });

  test('should open simulator from watchlist item', async ({ page }) => {
    await page.waitForSelector('[data-testid="watchlist-results"]', { timeout: 60000 });

    // Click en primer item para simular
    await page.getByTestId('watchlist-row').first().getByRole('button', { name: /simular/i }).click();

    // Modal de simulador visible
    await expect(page.getByTestId('simulator-modal')).toBeVisible();
  });

  test('should calculate price projection', async ({ page }) => {
    await page.waitForSelector('[data-testid="watchlist-results"]', { timeout: 60000 });
    await page.getByTestId('watchlist-row').first().getByRole('button', { name: /simular/i }).click();

    // Ingresar nuevo precio
    const newPriceInput = page.getByLabel(/precio propuesto/i);
    await newPriceInput.clear();
    await newPriceInput.fill('2500');

    // Calcular
    await page.getByRole('button', { name: /calcular proyección/i }).click();

    // Verificar resultados
    await expect(page.getByTestId('projection-results')).toBeVisible();
    await expect(page.getByText(/unidades proyectadas/i)).toBeVisible();
    await expect(page.getByText(/ingreso proyectado/i)).toBeVisible();
  });

  test('should show warnings for risky price changes', async ({ page }) => {
    await page.waitForSelector('[data-testid="watchlist-results"]', { timeout: 60000 });
    await page.getByTestId('watchlist-row').first().getByRole('button', { name: /simular/i }).click();

    // Ingresar precio muy bajo
    const newPriceInput = page.getByLabel(/precio propuesto/i);
    await newPriceInput.clear();
    await newPriceInput.fill('100'); // Precio muy bajo

    await page.getByRole('button', { name: /calcular proyección/i }).click();

    // Debe mostrar advertencias
    await expect(page.getByTestId('projection-warnings')).toBeVisible();
  });

  test('should create proposal from simulator', async ({ page }) => {
    await page.waitForSelector('[data-testid="watchlist-results"]', { timeout: 60000 });
    await page.getByTestId('watchlist-row').first().getByRole('button', { name: /simular/i }).click();

    const newPriceInput = page.getByLabel(/precio propuesto/i);
    await newPriceInput.clear();
    await newPriceInput.fill('2500');

    await page.getByRole('button', { name: /calcular proyección/i }).click();
    await page.waitForSelector('[data-testid="projection-results"]');

    // Crear propuesta
    await page.getByRole('button', { name: /crear propuesta/i }).click();

    // Confirmación
    await expect(page.getByText(/propuesta creada/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Price Actions - Proposals', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(process.env.CI !== undefined && !process.env.TEST_DB_URL, 'Requires test database');
    await authenticateUser(page);
    await page.goto('/price-actions/proposals');
  });

  test('should display proposals list', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /propuestas/i })).toBeVisible();
    await expect(page.getByTestId('proposals-table')).toBeVisible();
  });

  test('should filter proposals by status', async ({ page }) => {
    // Filtrar por pendientes
    await page.getByRole('button', { name: /pendientes/i }).click();

    const rows = page.getByTestId('proposal-row');
    const count = await rows.count();

    if (count > 0) {
      // Todos deben estar pendientes
      const status = await rows.first().getByTestId('proposal-status').textContent();
      expect(status?.toLowerCase()).toContain('pending');
    }
  });

  test('should approve proposal (admin only)', async ({ page }) => {
    const proposalRow = page.getByTestId('proposal-row').first();

    if (await proposalRow.isVisible()) {
      await proposalRow.getByRole('button', { name: /aprobar/i }).click();

      // Confirmación
      await page.getByRole('button', { name: /confirmar/i }).click();

      await expect(page.getByText(/propuesta aprobada/i)).toBeVisible({ timeout: 5000 });
    }
  });
});
