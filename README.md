# Stadium Dashboard

Dashboard de análisis de datos para retail deportivo con asistente de IA integrado (StadiumGPT).

[![Version](https://img.shields.io/badge/version-2.1.0-blue.svg)](./docs/legacy/RELEASE-NOTES.md)
[![Node](https://img.shields.io/badge/node-18+-green.svg)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org)

## Características

- **Dashboard de Ventas**: KPIs principales, métricas YTD, comparaciones año anterior
- **Análisis de Productos**: Tabla con ASP, margen, markup, días de stock, semáforo
- **Price Actions**: Simulador de precios y watchlist de productos
- **StadiumGPT**: Asistente de IA para análisis en lenguaje natural
- **Text-to-SQL**: Consultas ad-hoc seguras sobre SQL Server
- **Análisis de Recompra**: Herramienta para decisiones de inventario
- **Sell-Out**: Clasificación de productos por rotación

## Quick Start

### Desarrollo

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales

# Iniciar servidor de desarrollo
npm run dev
```

### Producción

```bash
# Con Docker
docker compose -f docker-compose.prod.yml up -d --build

# Con PM2
npm run build
pm2 start ecosystem.config.js
```

## Documentación

📚 **[Documentación Completa](./docs/README.md)**

| Documento | Descripción |
|-----------|-------------|
| [Arquitectura](./docs/architecture/overview.md) | Stack tecnológico y estructura |
| [API Reference](./docs/api/endpoints.md) | Documentación de endpoints |
| [Autenticación](./docs/api/authentication.md) | Sistema JWT |
| [Infraestructura](./docs/infrastructure/production.md) | Configuración del servidor |
| [Base de Datos](./docs/infrastructure/database.md) | Esquema y tablas |

### Decisiones de Diseño (ADR)

- [ADR-001: JWT Auth](./docs/decisions/adr-001-jwt-auth.md)
- [ADR-002: SQL Server](./docs/decisions/adr-002-sql-server.md)
- [ADR-003: Text-to-SQL Security](./docs/decisions/adr-003-text-to-sql-security.md)
- [ADR-004: Price Actions](./docs/decisions/adr-004-price-actions.md)
- [ADR-005: Ollama LLM](./docs/decisions/adr-005-ollama-llm.md)

## Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js 14, React 18, TypeScript, TailwindCSS |
| Backend | Next.js API Routes, Node.js 18 |
| Base de Datos | SQL Server |
| IA | Ollama (Qwen 2.5 72B) |
| Gráficos | ECharts |
| Deploy | Docker, PM2, Nginx |

## Estructura del Proyecto

```
stadium-dashboard/
├── src/
│   ├── app/           # Next.js App Router (páginas y API)
│   ├── components/    # Componentes React
│   ├── context/       # React Context (Auth, Filters, Theme)
│   ├── lib/           # Lógica de negocio
│   └── types/         # Definiciones TypeScript
├── docs/              # Documentación técnica
├── scripts/           # Scripts de utilidad
├── nginx/             # Configuración Nginx
└── public/            # Assets estáticos
```

## Testing

```bash
# Unit tests (Jest)
npm run test

# E2E tests (Playwright)
npm run test:e2e

# Coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

📖 Ver [docs/testing/README.md](./docs/testing/README.md) para guía completa.

## CI/CD

El proyecto usa GitHub Actions para automatización completa:

| Workflow | Trigger | Descripción |
|----------|---------|-------------|
| CI | Push/PR | Lint, tests, build |
| Deploy | Push to main | Deploy automático con backup |
| Release | Tag v* | Crear release con changelog |

**Rollback:** Si el deploy falla, automáticamente restaura la versión anterior.

```bash
# Crear release
npm version patch  # o minor, major
git push origin main --tags
```

📖 Ver [docs/infrastructure/ci-cd.md](./docs/infrastructure/ci-cd.md) para configuración de secrets.

## Scripts Disponibles

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm start` | Iniciar producción |
| `npm run lint` | Ejecutar ESLint |
| `npm run test` | Ejecutar tests |
| `npm run test:e2e` | Tests E2E con Playwright |

## Requisitos

- Node.js 18+
- SQL Server 2016+
- Ollama (para StadiumGPT)

## Variables de Entorno

```env
# Database
DB_USER=sa
DB_PASSWORD=***
DB_SERVER=10.120.0.19
DB_DATABASE=anysys

# Ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:72b

# JWT
JWT_SECRET=<openssl rand -base64 32>

# App
NODE_ENV=production
```

## Soporte

- **Documentación**: [/docs](./docs/)
- **Email**: soporte@stadium.com

## Licencia

Propiedad de Stadium. Uso interno únicamente.
