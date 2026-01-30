# API Reference - Endpoints

## Resumen

| Categoría | Endpoints | Descripción |
|-----------|-----------|-------------|
| Auth | 3 | Autenticación y sesión |
| Metrics | 3 | KPIs del dashboard |
| Products | 3 | Análisis y detalle de productos |
| Price Actions | 10 | Gestión de precios |
| Text-to-SQL | 3 | Consultas en lenguaje natural |
| Incidencias | 2 | Alertas y acciones |
| Otros | 7 | Filtros, chat, recompra, etc. |

**Total: 31 endpoints**

---

## Autenticación

### POST /api/auth/login

Inicia sesión de usuario.

**Request:**
```json
{
  "usuario": "string",
  "password": "string",
  "rememberMe": "boolean (opcional)"
}
```

**Response 200:**
```json
{
  "user": {
    "id": 1,
    "usuario": "admin",
    "nombre": "Administrador",
    "rol": "admin"
  }
}
```

**Response 401:**
```json
{
  "error": "Usuario o contraseña incorrectos"
}
```

**Cookies:** `auth_token` (HttpOnly, maxAge: 7-30 días)

---

### POST /api/auth/logout

Cierra sesión del usuario.

**Response 200:**
```json
{
  "message": "Sesión cerrada"
}
```

**Cookies:** Elimina `auth_token`

---

### GET /api/auth/me

Obtiene el usuario autenticado actual.

**Response 200:**
```json
{
  "user": {
    "id": 1,
    "usuario": "admin",
    "nombre": "Administrador",
    "rol": "admin"
  }
}
```

**Response 401:**
```json
{
  "error": "No autenticado"
}
```

---

## Métricas

### GET /api/metrics

Obtiene métricas principales del dashboard.

**Query Parameters:**
| Param | Tipo | Descripción |
|-------|------|-------------|
| startDate | string | Fecha inicio (YYYY-MM-DD) |
| endDate | string | Fecha fin (YYYY-MM-DD) |
| stores | string | IDs de tiendas (comma-separated) |
| brands | string | IDs de marcas (comma-separated) |
| categories | string | Categorías |
| genders | string | Géneros |
| suppliers | string | Proveedores |
| comparisonMode | string | '52weeks' \| 'calendar' |

**Response 200:**
```json
{
  "current": {
    "unidades": 163035,
    "ventas": 224200000,
    "costo": 131200000,
    "margen": 41.44,
    "markup": 70.76
  },
  "previous": {
    "unidades": 132500,
    "ventas": 189000000,
    "costo": 115000000,
    "margen": 39.15,
    "markup": 64.35
  },
  "variation": {
    "unidades": 23.04,
    "ventas": 18.62,
    "margen": 5.85
  },
  "ytd": {
    "ventas": 150200000,
    "unidades": 110368,
    "margen": 38.78
  },
  "stockEstimado": 1020069
}
```

---

### GET /api/metrics/comparison

Obtiene datos para gráfico comparativo.

**Query Parameters:** (mismos que /api/metrics)

**Response 200:**
```json
{
  "labels": ["Sem 1", "Sem 2", "..."],
  "current": [12000, 15000, "..."],
  "previous": [11000, 13500, "..."]
}
```

---

### GET /api/metrics/details

Obtiene métricas desglosadas por dimensión.

**Query Parameters adicionales:**
| Param | Tipo | Descripción |
|-------|------|-------------|
| groupBy | string | 'store' \| 'brand' \| 'gender' \| 'category' |

**Response 200:**
```json
{
  "data": [
    {
      "id": "1",
      "name": "Tienda Centro",
      "unidades": 5000,
      "ventas": 7500000,
      "variation": 12.5
    }
  ]
}
```

---

## Productos

### GET /api/products/analysis

Obtiene tabla de análisis de productos.

**Query Parameters:** (mismos que métricas + paginación)

**Response 200:**
```json
{
  "products": [
    {
      "baseColor": "001.123456789",
      "articulo": "Zapatilla Running",
      "marca": "Nike",
      "unidades": 637,
      "stock": 691,
      "costo": 2357,
      "pvp": 3698,
      "asp": 3339,
      "ventas": 2126627,
      "margen": 29.4,
      "markup": 41.6,
      "ultimaCompra": "2025-12-15",
      "diasStock": 34,
      "parDia": 28.55,
      "semaforo": "green"
    }
  ],
  "total": 150,
  "page": 1,
  "pageSize": 50
}
```

---

### GET /api/product/[id]

Obtiene detalle completo de un producto.

**URL Params:**
- `id`: BaseColor del producto (ej: "001.123456789")

**Response 200:**
```json
{
  "product": {
    "baseColor": "001.123456789",
    "articulo": "Zapatilla Running",
    "descripcion": "Nike Air Max 90",
    "marca": "Nike",
    "categoria": "Calzado",
    "genero": "Masculino",
    "imagen": "http://...",
    "unidades": 637,
    "unidadesCompradas": 1200,
    "percentVendido": 53.08,
    "stock": 691,
    "ventas": 2126627,
    "margen": 29.4,
    "markup": 41.6,
    "tallas": [
      { "talla": "40", "stock": 50, "ventas": 120 }
    ],
    "coloresRelacionados": [
      { "baseColor": "001.123456790", "color": "Azul", "imagen": "..." }
    ],
    "topTiendas": [
      { "tienda": "Centro", "unidades": 150, "ventas": 500000 }
    ]
  }
}
```

---

### GET /api/product-image/[baseCol]

Proxy para obtener imagen de producto.

**Response:** Image binary (JPEG/PNG)

---

## Price Actions

### GET /api/price-actions/proposals

Lista propuestas de cambio de precio.

**Response 200:**
```json
{
  "proposals": [
    {
      "id": "uuid",
      "sku": "001.123456789",
      "precioActual": 3698,
      "precioPropuesto": 2999,
      "status": "pending",
      "createdAt": "2026-01-28T10:00:00Z"
    }
  ]
}
```

---

### POST /api/price-actions/proposals

Crea nueva propuesta de precio.

**Request:**
```json
{
  "sku": "001.123456789",
  "precioPropuesto": 2999,
  "justificacion": "Producto slow-mover"
}
```

---

### POST /api/price-actions/simulator

Simula impacto de cambio de precio.

**Request:**
```json
{
  "sku": "001.123456789",
  "precioNuevo": 2999,
  "horizonteDias": 90,
  "elasticidadManual": null
}
```

**Response 200:**
```json
{
  "projection": {
    "precioActual": 3698,
    "precioPropuesto": 2999,
    "variacionPrecio": -18.9,
    "ritmoActual": 2.5,
    "ritmoProyectado": 3.8,
    "unidadesProyectadas": 342,
    "ingresoProyectado": 1025658,
    "margenProyectado": 285420,
    "costoDelCastigo": 239058,
    "sellOutProyectado": 49.5
  },
  "warnings": [
    "Margen proyectado menor al mínimo aceptable"
  ],
  "breakeven": 2850,
  "elasticidad": {
    "valor": -1.2,
    "confianza": "media",
    "fuente": "cluster"
  }
}
```

---

### GET /api/price-actions/watchlist

Obtiene configuración de watchlist.

---

### POST /api/price-actions/watchlist/start

Inicia cálculo de watchlist.

**Request:**
```json
{
  "ventanaRitmo": 14,
  "cicloDias": 90,
  "filters": {
    "brands": ["1", "2"],
    "categories": ["Calzado"]
  }
}
```

**Response 200:**
```json
{
  "jobId": "uuid",
  "status": "running"
}
```

---

### GET /api/price-actions/watchlist/status/[jobId]

Obtiene progreso del job.

**Response 200:**
```json
{
  "status": "running",
  "progress": 65
}
```

---

### GET /api/price-actions/watchlist/result/[jobId]

Obtiene resultados del análisis.

**Response 200:**
```json
{
  "items": [
    {
      "sku": "001.123456789",
      "articulo": "Zapatilla Running",
      "score": 85,
      "motivos": ["Desacelera", "Sobrestock"],
      "indiceRitmo": 0.45,
      "diasStock": 120,
      "diasRestantes": 45
    }
  ],
  "summary": {
    "total": 150,
    "criticos": 25,
    "bajos": 45,
    "normales": 80,
    "scorePromedio": 42
  }
}
```

---

### DELETE /api/price-actions/watchlist/cancel/[jobId]

Cancela job en ejecución.

---

### GET /api/price-actions/export/excel

Exporta watchlist a Excel.

---

### GET /api/price-actions/export/pdf

Exporta watchlist a PDF.

---

## Text-to-SQL

### GET /api/text-to-sql/schema

Obtiene esquema de BD disponible.

**Response 200:**
```json
{
  "tables": [
    {
      "name": "Transacciones",
      "columns": [
        { "name": "fecha", "type": "datetime" },
        { "name": "unidades", "type": "int" }
      ]
    }
  ]
}
```

---

### POST /api/text-to-sql/ask

Ejecuta consulta en lenguaje natural.

**Request:**
```json
{
  "question": "¿Cuánto vendió Nike en enero?",
  "context": {
    "startDate": "2026-01-01",
    "endDate": "2026-01-31"
  }
}
```

**Response 200:**
```json
{
  "sql": "SELECT SUM(venta) as total FROM Transacciones WHERE marca = 'Nike' AND fecha BETWEEN '2026-01-01' AND '2026-01-31'",
  "data": [{ "total": 15000000 }],
  "explanation": "El total de ventas de Nike en enero fue $15,000,000",
  "rowCount": 1
}
```

**Response 400:**
```json
{
  "error": "Query no permitida",
  "reason": "Contiene palabra prohibida: DELETE"
}
```

---

### POST /api/text-to-sql/validate-sql

Valida SQL sin ejecutar.

**Request:**
```json
{
  "sql": "SELECT * FROM Transacciones"
}
```

**Response 200:**
```json
{
  "valid": true,
  "warnings": []
}
```

---

## Incidencias

### GET /api/incidencias

Lista incidencias activas.

**Response 200:**
```json
{
  "incidencias": [
    {
      "id": "uuid",
      "tipo": "reabastecimiento",
      "severidad": "alta",
      "producto": "001.123456789",
      "descripcion": "Stock 0 en tienda, hay en central",
      "createdAt": "2026-01-28T10:00:00Z"
    }
  ]
}
```

---

### PUT /api/incidencias/[id]/action

Actualiza estado de incidencia.

**Request:**
```json
{
  "action": "approve" | "ignore",
  "comentario": "Opcional"
}
```

---

## Otros Endpoints

### GET /api/filters

Obtiene opciones de filtros disponibles.

**Response 200:**
```json
{
  "stores": [{ "id": "1", "name": "Centro" }],
  "brands": [{ "id": "1", "name": "Nike" }],
  "categories": ["Calzado", "Ropa"],
  "genders": ["Masculino", "Femenino"],
  "suppliers": [{ "id": "1", "name": "Proveedor A" }]
}
```

---

### GET /api/chat

Endpoint de StadiumGPT (streaming).

**Query Parameters:**
- `message`: Mensaje del usuario
- `context`: Contexto adicional (JSON)

**Response:** Server-Sent Events (streaming)

---

### POST /api/recompra

Calcula análisis de recompra.

---

### GET /api/sell-out

Obtiene análisis de sell-out.

---

### POST /api/users

CRUD de usuarios (solo admin).

---

### GET /api/users/[id]

Obtiene usuario específico.

---

### POST /api/validation/deposito-tienda

Valida mapeo depósito-tienda.
