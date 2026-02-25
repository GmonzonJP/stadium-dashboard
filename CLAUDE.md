# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Stadium Dashboard is a retail analytics platform for a sports retail company. It provides sales KPIs, product analysis, price optimization (Price Actions), AI-assisted queries (StadiumGPT), and inventory management tools. The application is primarily in Spanish.

## Commands

```bash
# Development
npm run dev              # Start dev server on localhost:3000

# Build & Production
npm run build            # Production build
npm start                # Start production server

# Testing
npm run test             # Run Jest unit tests
npm run test:watch       # Jest in watch mode
npm run test:coverage    # Jest with coverage report
npm run test:e2e         # Run Playwright E2E tests
npm run test:e2e:headed  # Playwright with visible browser

# Linting
npm run lint             # ESLint
```

## Architecture

**Stack:** Next.js 14 (App Router), React 18, TypeScript, TailwindCSS, SQL Server, Ollama LLM

### Directory Structure
- `src/app/` - Pages and API routes (App Router)
- `src/app/api/` - 31 API endpoints
- `src/components/` - React components (use `'use client'` directive when needed)
- `src/context/` - React Context providers (AuthContext, FilterContext, ThemeContext)
- `src/lib/` - Business logic and services
- `src/types/` - TypeScript type definitions
- `src/middleware.ts` - JWT auth middleware

### Key Modules

**Price Actions** (`src/lib/price-actions/`, `src/components/price-actions/`)
- Watchlist: identifies products needing price intervention based on velocity, stock, and deceleration
- Simulator: projects revenue/margin impact of price changes using elasticity
- Proposals: queue for managing pending price changes

**LLM Integration** (`src/lib/llm-service.ts`, `src/lib/text-to-sql-service.ts`)
- Uses Ollama with Qwen 2.5 model
- Text-to-SQL with whitelist table validation and forbidden keyword blocking

### Data Layer

- SQL Server via `mssql` package with connection pooling
- Database connection singleton in `src/lib/db.ts`
- Always use parameterized queries via `executeQuery()` to prevent SQL injection

### Authentication

- JWT tokens stored in HttpOnly cookies (`stadium-auth-token`)
- Middleware validates token structure; full verification in API routes
- Roles: admin, usuario, viewer

## Code Patterns

- Use `@/*` import alias for `src/*` paths
- Server Components by default; add `'use client'` only when client-side interactivity is needed
- Charts use ECharts library
- Use `lucide-react` for icons
- Animations with `framer-motion`

## Testing

- Unit tests in `src/__tests__/` (Jest + React Testing Library)
- E2E tests in `e2e/` directory (Playwright)
- Coverage threshold: 50% minimum for branches, functions, lines, statements

## Environment Variables

Required in `.env.local`:
- `DB_USER`, `DB_PASSWORD`, `DB_SERVER`, `DB_DATABASE` - SQL Server connection
- `OLLAMA_BASE_URL`, `OLLAMA_MODEL` - LLM configuration
- `JWT_SECRET` - Authentication secret (min 32 chars)
