# Stadium Dashboard - Documentación Técnica

## Índice

### Arquitectura
- [Visión General](./architecture/overview.md) - Stack tecnológico y estructura del proyecto
- [Patrones de Diseño](./architecture/patterns.md) - Patrones arquitectónicos utilizados
- [Flujo de Datos](./architecture/data-flow.md) - Cómo fluyen los datos en la aplicación

### API Reference
- [Endpoints](./api/endpoints.md) - Documentación de todos los endpoints REST
- [Autenticación](./api/authentication.md) - Sistema de autenticación JWT
- [Text-to-SQL](./api/text-to-sql.md) - API de consultas en lenguaje natural

### Funcionalidades
- [Dashboard Principal](./features/dashboard.md) - Métricas y KPIs
- [Price Actions](./features/price-actions.md) - Módulo de gestión de precios
- [Recompra](./features/recompra.md) - Sistema de análisis de reposición
- [StadiumGPT](./features/stadiumgpt.md) - Asistente de IA integrado
- [Sell-Out](./features/sell-out.md) - Análisis de rotación de productos

### Infraestructura
- [Servidor de Producción](./infrastructure/production.md) - Configuración del servidor
- [Base de Datos](./infrastructure/database.md) - Esquema y tablas
- [Ollama (LLM)](./infrastructure/ollama.md) - Configuración del modelo de IA
- [CI/CD Pipeline](./infrastructure/ci-cd.md) - GitHub Actions, deploy, rollback

### Testing
- [Guía de Testing](./testing/README.md) - Jest, Playwright, estructura de tests

### Decisiones de Diseño (ADR)
- [ADR-001: Autenticación JWT](./decisions/adr-001-jwt-auth.md)
- [ADR-002: Conexión SQL Server](./decisions/adr-002-sql-server.md)
- [ADR-003: Text-to-SQL Security](./decisions/adr-003-text-to-sql-security.md)
- [ADR-004: Price Actions Architecture](./decisions/adr-004-price-actions.md)
- [ADR-005: LLM Local con Ollama](./decisions/adr-005-ollama-llm.md)

---

## Quick Start

```bash
# Desarrollo
npm install
npm run dev

# Producción con Docker
docker compose -f docker-compose.prod.yml up -d --build

# Tests
npm run test
npm run test:e2e
```

## Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js 14, React 18, TypeScript, TailwindCSS |
| Backend | Next.js API Routes, Node.js 18 |
| Base de Datos | SQL Server (AnySys) |
| IA | Ollama (Qwen 2.5 72B) |
| Autenticación | JWT + Bcrypt + HttpOnly Cookies |
| Gráficos | ECharts |
| Deploy | Docker, PM2, Nginx |

## Versión Actual

- **Versión:** 2.1.0
- **Fecha:** Enero 2026
- **URL Producción:** http://179.27.76.130/
