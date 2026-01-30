/**
 * E2E Tests - Dashboard
 * @module e2e/dashboard
 */

import { test, expect } from '@playwright/test';

// Helper para autenticación
async function authenticateUser(page: any) {
  // En tests reales, esto haría login
  // Por ahora simulamos con una cookie válida
  await page.context().addCookies([
    {
      name: 'auth_token',
      value: 'test-token', // En CI usaríamos un token de prueba
      domain: 'localhost',
      path: '/',
    }
  ]);
}

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    // Skip si no hay BD de prueba disponible
    test.skip(process.env.CI !== undefined && !process.env.TEST_DB_URL, 'Requires test database');
  });

  test('should display KPI cards', async ({ page }) => {
    await authenticateUser(page);
    await page.goto('/');

    // Verificar KPIs principales
    await expect(page.getByTestId('kpi-ventas')).toBeVisible();
    await expect(page.getByTestId('kpi-unidades')).toBeVisible();
    await expect(page.getByTestId('kpi-margen')).toBeVisible();
  });

  test('should have date range filter', async ({ page }) => {
    await authenticateUser(page);
    await page.goto('/');

    // Verificar selector de fechas
    const dateFilter = page.getByTestId('date-range-filter');
    await expect(dateFilter).toBeVisible();

    // Click para abrir
    await dateFilter.click();

    // Opciones predefinidas
    await expect(page.getByText(/hoy/i)).toBeVisible();
    await expect(page.getByText(/última semana/i)).toBeVisible();
    await expect(page.getByText(/último mes/i)).toBeVisible();
  });

  test('should have store filter', async ({ page }) => {
    await authenticateUser(page);
    await page.goto('/');

    const storeFilter = page.getByTestId('store-filter');
    await expect(storeFilter).toBeVisible();

    await storeFilter.click();

    // Debe mostrar opciones de tiendas
    await expect(page.getByRole('listbox')).toBeVisible();
  });

  test('should display comparison chart', async ({ page }) => {
    await authenticateUser(page);
    await page.goto('/');

    // Verificar gráfico de comparación
    const chart = page.getByTestId('comparison-chart');
    await expect(chart).toBeVisible();
  });

  test('should toggle comparison mode', async ({ page }) => {
    await authenticateUser(page);
    await page.goto('/');

    // Buscar toggle de modo de comparación
    const toggleButton = page.getByRole('button', { name: /52 semanas|año calendario/i });
    await expect(toggleButton).toBeVisible();

    // Click para cambiar modo
    await toggleButton.click();

    // Verificar que cambió
    await expect(page.getByText(/calendario|52 semanas/i)).toBeVisible();
  });
});

test.describe('Dashboard Filters', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(process.env.CI !== undefined && !process.env.TEST_DB_URL, 'Requires test database');
    await authenticateUser(page);
    await page.goto('/');
  });

  test('should filter by brand', async ({ page }) => {
    const brandFilter = page.getByTestId('brand-filter');
    await brandFilter.click();

    // Seleccionar una marca
    const firstBrand = page.getByRole('option').first();
    const brandName = await firstBrand.textContent();
    await firstBrand.click();

    // Verificar que el filtro se aplicó
    await expect(page.getByText(brandName!)).toBeVisible();
  });

  test('should clear all filters', async ({ page }) => {
    // Aplicar un filtro primero
    const brandFilter = page.getByTestId('brand-filter');
    await brandFilter.click();
    await page.getByRole('option').first().click();

    // Click en limpiar filtros
    const clearButton = page.getByRole('button', { name: /limpiar/i });
    await clearButton.click();

    // Verificar que se limpiaron
    await expect(brandFilter).toHaveText(/todas/i);
  });

  test('filters should update URL', async ({ page }) => {
    const brandFilter = page.getByTestId('brand-filter');
    await brandFilter.click();
    await page.getByRole('option').first().click();

    // URL debe contener el parámetro del filtro
    await expect(page).toHaveURL(/brands=/);
  });

  test('should restore filters from URL', async ({ page }) => {
    // Navegar con filtros en URL
    await page.goto('/?brands=1&startDate=2026-01-01&endDate=2026-01-31');

    // Verificar que los filtros se restauraron
    const brandFilter = page.getByTestId('brand-filter');
    await expect(brandFilter).not.toHaveText(/todas/i);
  });
});

test.describe('Dashboard Responsiveness', () => {
  test('should be responsive on mobile', async ({ page }) => {
    await authenticateUser(page);

    // Simular viewport móvil
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Verificar que el menú móvil existe
    await expect(page.getByTestId('mobile-menu-button')).toBeVisible();

    // KPIs deben ser visibles
    await expect(page.getByTestId('kpi-ventas')).toBeVisible();
  });

  test('should show sidebar on desktop', async ({ page }) => {
    await authenticateUser(page);

    // Viewport desktop
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Sidebar visible
    await expect(page.getByTestId('sidebar')).toBeVisible();
  });

  test('should hide sidebar on mobile', async ({ page }) => {
    await authenticateUser(page);

    // Viewport móvil
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Sidebar oculto por defecto
    await expect(page.getByTestId('sidebar')).not.toBeVisible();

    // Click en menú hamburguesa
    await page.getByTestId('mobile-menu-button').click();

    // Sidebar visible
    await expect(page.getByTestId('sidebar')).toBeVisible();
  });
});
