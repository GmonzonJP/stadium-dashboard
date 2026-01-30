# Arquitectura - Visión General

## Stack Tecnológico

Stadium Dashboard es una aplicación Next.js 14 full-stack con arquitectura de 3 capas.

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENTE (Browser)                       │
│  React 18 + TypeScript + TailwindCSS + ECharts              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    SERVIDOR (Next.js 14)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  App Router  │  │  API Routes  │  │  Middleware  │       │
│  │   (pages)    │  │  (handlers)  │  │   (auth)     │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                              │                               │
│  ┌──────────────────────────────────────────────────┐       │
│  │                    /lib/                          │       │
│  │  db.ts | auth.ts | llm-service.ts | ...          │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌──────────────────┐ ┌──────────────┐ ┌──────────────────┐
│   SQL Server     │ │   Ollama     │ │  Image Server    │
│   (AnySys DB)    │ │  (LLM local) │ │  (10.108.0.19)   │
│   10.120.0.19    │ │  :11434      │ │  /Imagenes/      │
└──────────────────┘ └──────────────┘ └──────────────────┘
```

## Estructura del Proyecto

```
stadium-dashboard/
├── src/
│   ├── app/                    # Next.js 14 App Router
│   │   ├── api/               # API Routes (31 endpoints)
│   │   ├── chat/              # Página StadiumGPT
│   │   ├── login/             # Página de autenticación
│   │   ├── price-actions/     # Gestión de precios
│   │   ├── producto/[id]/     # Detalle de producto
│   │   ├── recompra/          # Análisis de reposición
│   │   ├── sell-out/          # Análisis de rotación
│   │   ├── layout.tsx         # Layout raíz
│   │   ├── page.tsx           # Dashboard principal
│   │   └── globals.css        # Estilos globales
│   │
│   ├── components/            # Componentes React (41)
│   │   ├── price-actions/     # Componentes de Price Actions
│   │   ├── ProductDetail/     # Componentes de detalle producto
│   │   └── [componentes]      # Componentes generales
│   │
│   ├── context/               # React Context (3)
│   │   ├── AuthContext.tsx    # Estado de autenticación
│   │   ├── FilterContext.tsx  # Estado de filtros globales
│   │   └── ThemeContext.tsx   # Tema dark/light
│   │
│   ├── lib/                   # Lógica de negocio (24 módulos)
│   │   ├── price-actions/     # Módulo de Price Actions (8)
│   │   ├── db.ts              # Conexión SQL Server
│   │   ├── auth.ts            # Autenticación JWT
│   │   ├── llm-service.ts     # Cliente Ollama
│   │   └── [utilidades]       # Cálculos, queries, etc.
│   │
│   ├── types/                 # Definiciones TypeScript
│   │   ├── index.ts           # Tipos generales
│   │   ├── price-actions.ts   # Tipos de Price Actions
│   │   └── sell-out.ts        # Tipos de Sell-Out
│   │
│   └── middleware.ts          # Middleware de autenticación
│
├── docs/                      # Documentación técnica
├── scripts/                   # Scripts de utilidad (34)
├── nginx/                     # Configuración Nginx
├── public/                    # Assets estáticos
│
├── package.json               # Dependencias
├── next.config.mjs            # Configuración Next.js
├── tsconfig.json              # Configuración TypeScript
├── tailwind.config.ts         # Configuración Tailwind
├── Dockerfile                 # Build de producción
└── docker-compose.prod.yml    # Orquestación Docker
```

## Estadísticas del Código

| Métrica | Valor |
|---------|-------|
| Archivos TypeScript/TSX | 100 |
| Líneas de código | ~7,000 |
| Componentes React | 41 |
| API Endpoints | 31 |
| Módulos lib/ | 24 |
| Páginas | 7 |
| Contextos | 3 |

## Dependencias Principales

```json
{
  "next": "14.2.0",
  "react": "^18",
  "typescript": "^5",
  "tailwindcss": "^3.4.19",
  "echarts": "^6.0.0",
  "mssql": "^12.2.0",
  "jsonwebtoken": "^9.0.3",
  "bcryptjs": "^3.0.3",
  "framer-motion": "^12.26.2",
  "lucide-react": "^0.562.0"
}
```

## Capas de la Aplicación

### 1. Capa de Presentación (`/app`, `/components`)
- Server Components por defecto (Next.js 14)
- Client Components explícitos con `'use client'`
- Contextos para estado global (Auth, Filters, Theme)
- TailwindCSS para estilos
- ECharts para gráficos

### 2. Capa de API (`/app/api`)
- Route Handlers de Next.js
- Validación de entrada
- Manejo de errores centralizado
- Autenticación via middleware

### 3. Capa de Servicios (`/lib`)
- Lógica de negocio pura
- Acceso a datos
- Integración con servicios externos (Ollama)
- Cálculos y utilidades

### 4. Capa de Datos
- SQL Server (AnySys) via `mssql`
- Pool de conexiones singleton
- Queries parametrizadas

## Seguridad

- **Autenticación:** JWT con cookies HttpOnly
- **Autorización:** Roles (admin, usuario, viewer)
- **SQL Injection:** Queries parametrizadas
- **Text-to-SQL:** Whitelist de tablas + forbidden keywords
- **XSS:** Escape automático de React
- **CSRF:** SameSite cookies
