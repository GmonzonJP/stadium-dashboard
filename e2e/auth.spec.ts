/**
 * E2E Tests - Autenticación
 * @module e2e/auth
 */

import { test, expect, type Page } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Limpiar cookies antes de cada test
    await page.context().clearCookies();
  });

  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/');

    // Debe redirigir a /login
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show login form', async ({ page }) => {
    await page.goto('/login');

    // Verificar elementos del formulario
    await expect(page.getByLabel(/usuario/i)).toBeVisible();
    await expect(page.getByLabel(/contraseña/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /iniciar sesión/i })).toBeVisible();
  });

  test('should show error on invalid credentials', async ({ page }) => {
    await page.goto('/login');

    // Intentar login con credenciales inválidas
    await page.getByLabel(/usuario/i).fill('invalid_user');
    await page.getByLabel(/contraseña/i).fill('wrong_password');
    await page.getByRole('button', { name: /iniciar sesión/i }).click();

    // Verificar mensaje de error
    await expect(page.getByText(/usuario o contraseña incorrectos/i)).toBeVisible();
  });

  test('should have remember me checkbox', async ({ page }) => {
    await page.goto('/login');

    const rememberCheckbox = page.getByLabel(/recordar/i);
    await expect(rememberCheckbox).toBeVisible();

    // Por defecto no debe estar marcado
    await expect(rememberCheckbox).not.toBeChecked();

    // Debe poder marcarse
    await rememberCheckbox.check();
    await expect(rememberCheckbox).toBeChecked();
  });
});

test.describe('Authenticated User Flow', () => {
  // Helper para hacer login
  async function login(page: Page, usuario = 'admin', password = 'test123') {
    await page.goto('/login');
    await page.getByLabel(/usuario/i).fill(usuario);
    await page.getByLabel(/contraseña/i).fill(password);
    await page.getByRole('button', { name: /iniciar sesión/i }).click();
  }

  test('should redirect to dashboard after successful login', async ({ page }) => {
    // Este test requiere un usuario de prueba configurado
    // En CI se puede usar una BD de prueba o mocks
    test.skip(process.env.CI !== undefined, 'Requires test database');

    await login(page);

    // Debe redirigir al dashboard
    await expect(page).toHaveURL('/');
    // Verificar elementos del dashboard
    await expect(page.getByText(/dashboard/i)).toBeVisible();
  });

  test('should show user menu when authenticated', async ({ page }) => {
    test.skip(process.env.CI !== undefined, 'Requires test database');

    await login(page);
    await page.goto('/');

    // Verificar que se muestra el menú de usuario
    await expect(page.getByTestId('user-menu')).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    test.skip(process.env.CI !== undefined, 'Requires test database');

    await login(page);
    await page.goto('/');

    // Click en logout
    await page.getByTestId('user-menu').click();
    await page.getByRole('button', { name: /cerrar sesión/i }).click();

    // Debe redirigir a login
    await expect(page).toHaveURL(/\/login/);

    // Intentar acceder al dashboard debe redirigir a login
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('API Authentication', () => {
  test('should return 401 for unauthenticated API requests', async ({ request }) => {
    const response = await request.get('/api/metrics');

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  test('should return 401 for invalid token', async ({ request }) => {
    const response = await request.get('/api/metrics', {
      headers: {
        Cookie: 'auth_token=invalid.token.here'
      }
    });

    expect(response.status()).toBe(401);
  });

  test('login endpoint should return user data', async ({ request }) => {
    // Este test requiere credenciales válidas
    test.skip(process.env.CI !== undefined, 'Requires test database');

    const response = await request.post('/api/auth/login', {
      data: {
        usuario: 'admin',
        password: 'test123'
      }
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.user).toBeDefined();
    expect(body.user.usuario).toBe('admin');

    // Verificar que se setea la cookie
    const cookies = response.headers()['set-cookie'];
    expect(cookies).toContain('auth_token');
  });

  test('logout endpoint should clear cookie', async ({ request }) => {
    const response = await request.post('/api/auth/logout');

    expect(response.status()).toBe(200);

    // La cookie debe ser eliminada
    const cookies = response.headers()['set-cookie'];
    expect(cookies).toMatch(/auth_token=;|max-age=0/i);
  });
});
