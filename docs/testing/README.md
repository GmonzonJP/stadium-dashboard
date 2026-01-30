# Testing - Stadium Dashboard

## Frameworks

| Tipo | Framework | Propósito |
|------|-----------|-----------|
| Unit | Jest | Tests de funciones, hooks, utils |
| Integration | Jest + React Testing Library | Tests de componentes |
| E2E | Playwright | Tests de flujos completos |

## Estructura

```
stadium-dashboard/
├── src/
│   └── __tests__/           # Unit & Integration tests
│       ├── lib/             # Tests de utilidades
│       │   ├── auth.test.ts
│       │   └── text-to-sql-security.test.ts
│       ├── components/      # Tests de componentes
│       │   └── KPICard.test.tsx
│       └── api/             # Tests de API routes
│
├── e2e/                     # E2E tests (Playwright)
│   ├── auth.spec.ts
│   ├── dashboard.spec.ts
│   └── price-actions.spec.ts
│
├── jest.config.js           # Configuración Jest
├── jest.setup.js            # Setup global (mocks)
└── playwright.config.ts     # Configuración Playwright
```

## Comandos

### Unit Tests (Jest)

```bash
# Ejecutar todos los tests
npm run test

# Watch mode (desarrollo)
npm run test:watch

# Con coverage
npm run test:coverage

# Archivo específico
npm run test -- auth.test.ts

# Pattern específico
npm run test -- --testPathPattern="security"
```

### E2E Tests (Playwright)

```bash
# Ejecutar todos
npm run test:e2e

# Con UI interactiva
npm run test:e2e:ui

# Modo headed (ver browser)
npm run test:e2e:headed

# Proyecto específico (browser)
npm run test:e2e -- --project=chromium

# Archivo específico
npm run test:e2e -- auth.spec.ts

# Test específico
npm run test:e2e -- -g "should redirect to login"
```

## Escribir Tests

### Unit Test (Jest)

```typescript
// src/__tests__/lib/ejemplo.test.ts
import { describe, it, expect, jest } from '@jest/globals';

describe('Mi Módulo', () => {
  it('debería hacer algo', () => {
    const resultado = miFuncion(input);
    expect(resultado).toBe(valorEsperado);
  });

  it('debería manejar errores', () => {
    expect(() => miFuncion(inputInvalido)).toThrow();
  });
});
```

### Component Test (React Testing Library)

```typescript
// src/__tests__/components/MiComponente.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import MiComponente from '@/components/MiComponente';

describe('MiComponente', () => {
  it('debería renderizar correctamente', () => {
    render(<MiComponente titulo="Test" />);

    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('debería responder a clicks', async () => {
    const onClickMock = jest.fn();
    render(<MiComponente onClick={onClickMock} />);

    fireEvent.click(screen.getByRole('button'));

    expect(onClickMock).toHaveBeenCalledTimes(1);
  });
});
```

### E2E Test (Playwright)

```typescript
// e2e/mi-feature.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Mi Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Setup común
    await page.goto('/mi-pagina');
  });

  test('debería completar el flujo', async ({ page }) => {
    // Interactuar
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByRole('button', { name: 'Enviar' }).click();

    // Verificar resultado
    await expect(page.getByText('Éxito')).toBeVisible();
  });

  test('debería validar errores', async ({ page }) => {
    await page.getByRole('button', { name: 'Enviar' }).click();

    await expect(page.getByText('Campo requerido')).toBeVisible();
  });
});
```

## Mocks

### Mock de Base de Datos

```typescript
jest.mock('@/lib/db', () => ({
  getPool: jest.fn(() => ({
    request: () => ({
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockResolvedValue({
        recordset: [/* datos mock */],
      }),
    }),
  })),
}));
```

### Mock de Fetch

```typescript
// En jest.setup.js ya está configurado globalmente
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ data: 'mock' }),
  })
);
```

### Mock de Next.js Navigation

```typescript
// Ya configurado en jest.setup.js
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/test',
  useSearchParams: () => new URLSearchParams(),
}));
```

## Coverage

### Generar Reporte

```bash
npm run test:coverage
```

### Ver Reporte

```bash
# Abrir en browser
open coverage/lcov-report/index.html
```

### Umbrales Recomendados

```javascript
// jest.config.js
coverageThreshold: {
  global: {
    branches: 70,
    functions: 70,
    lines: 70,
    statements: 70,
  },
},
```

## CI/CD Integration

Los tests se ejecutan automáticamente en cada push:

1. **Lint** - ESLint + TypeScript
2. **Unit Tests** - Jest con coverage
3. **E2E Tests** - Playwright (solo Chromium en CI)
4. **Build** - Verificar que compila

### Skip Tests en CI

Para tests que requieren BD real:

```typescript
test('requires database', async ({ page }) => {
  test.skip(process.env.CI !== undefined, 'Requires test database');
  // ...
});
```

## Best Practices

### Nombres Descriptivos

```typescript
// ✅ Bueno
it('should return 401 when token is expired', () => {});

// ❌ Malo
it('test auth', () => {});
```

### Arrange-Act-Assert

```typescript
it('should calculate total correctly', () => {
  // Arrange
  const items = [{ price: 100 }, { price: 50 }];

  // Act
  const total = calculateTotal(items);

  // Assert
  expect(total).toBe(150);
});
```

### Test Data Builders

```typescript
// test-utils/builders.ts
export function buildUser(overrides = {}) {
  return {
    id: 1,
    usuario: 'testuser',
    rol: 'usuario',
    ...overrides,
  };
}

// En tests
const admin = buildUser({ rol: 'admin' });
```

### No Testear Implementación

```typescript
// ✅ Testear comportamiento
expect(screen.getByText('Bienvenido')).toBeInTheDocument();

// ❌ Testear implementación
expect(component.state.isLoggedIn).toBe(true);
```

## Debugging

### Jest

```bash
# Verbose output
npm run test -- --verbose

# Run single test
npm run test -- -t "nombre del test"

# Debug con Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Playwright

```bash
# UI Mode (mejor para debug)
npm run test:e2e:ui

# Headed + slowmo
npx playwright test --headed --slow-mo 1000

# Generar trace
npx playwright test --trace on

# Ver trace
npx playwright show-trace trace.zip
```

### Screenshots en Failure

Playwright automáticamente toma screenshots cuando un test falla:

```
playwright-report/
├── index.html
└── data/
    └── screenshots/
```
