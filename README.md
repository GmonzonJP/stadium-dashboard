# Stadium Dashboard

Dashboard de análisis de datos para retail deportivo con asistente de IA integrado (StadiumGPT) y API Text-to-SQL.

## Características

- **Dashboard de Ventas**: KPIs principales, métricas YTD, comparaciones año anterior
- **Análisis de Productos**: Tabla completa con ASP, margen, markup, días de stock, semáforo de reposición
- **Filtros Avanzados**: Por tienda, marca, categoría, género, proveedor y período
- **Visualizaciones**: Gráficos de comparación con ECharts
- **StadiumGPT**: Asistente de IA para análisis de datos con lenguaje natural
- **API Text-to-SQL**: Consultas ad-hoc seguras sobre SQL Server
- **Análisis de Recompra**: Herramienta para decisiones de inventario
- **Alertas de Stock**: Notificaciones de productos con bajo stock
- **Definiciones**: Sección About con explicación de fórmulas y fuentes de datos

## Requisitos

- Node.js 18+
- SQL Server (Data Warehouse)
- Ollama (para StadiumGPT y Text-to-SQL) - **CPU-only, sin GPU requerida**

## Instalación

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

Crear archivo `.env.local` en la raíz del proyecto:

```env
# Database Configuration
DB_USER=sa
DB_PASSWORD=tu_password
DB_SERVER=10.120.0.19
DB_DATABASE=anysys
# DB_INSTANCE=nombre_instancia  # Opcional, si SQL Server usa instancia nombrada

# JWT Secret for Authentication
JWT_SECRET=tu_jwt_secret_seguro_de_al_menos_32_caracteres

# Ollama Configuration (StadiumGPT + Text-to-SQL)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:14b
# Modelo alternativo para SQL: sqlcoder:7b
```

### 3. Cargar el esquema de base de datos

El archivo `tablas anysys.csv` debe estar en la raíz del proyecto. Este archivo contiene el esquema de la base de datos y es usado por la API Text-to-SQL.

Formato esperado del CSV:
```csv
schema_name,table_name,column_order,column_name,data_type,max_length,precision,scale,is_nullable,is_identity,is_primary_key
dbo,Transacciones,1,Fecha,date,3,10,0,1,0,0
...
```

### 4. Configurar Ollama (StadiumGPT y Text-to-SQL)

#### Desarrollo Local

1. **Instalar Ollama**: https://ollama.com

2. **Iniciar el servidor Ollama**:
```bash
ollama serve
```

3. **Descargar modelos** (en otra terminal):
```bash
# Modelo principal para chat y análisis
ollama pull qwen2.5:14b

# Modelo alternativo especializado en SQL (opcional)
ollama pull sqlcoder:7b

# Opción más ligera si hay limitaciones de RAM
ollama pull llama3.2:3b
```

#### Producción (On Premise - Linux Server)

1. **Instalar Ollama en el servidor Linux**:
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

2. **Configurar como servicio systemd** (`/etc/systemd/system/ollama.service`):
```ini
[Unit]
Description=Ollama Server
After=network.target

[Service]
ExecStart=/usr/local/bin/ollama serve
Environment="OLLAMA_HOST=0.0.0.0"
Restart=always
User=ollama

[Install]
WantedBy=multi-user.target
```

3. **Habilitar y arrancar el servicio**:
```bash
sudo systemctl enable ollama
sudo systemctl start ollama
```

4. **Descargar modelo**:
```bash
ollama pull qwen2.5:14b
```

5. **Actualizar variable de entorno** en el servidor de la aplicación:
```env
OLLAMA_BASE_URL=http://IP_SERVIDOR_OLLAMA:11434
```

### 5. Iniciar el dashboard

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000) en el navegador.

---

## API Text-to-SQL

API interna para consultas ad-hoc seguras sobre SQL Server usando lenguaje natural.

### Endpoints

#### `GET /api/text-to-sql/schema`

Retorna el esquema de la base de datos disponible para consultas.

```bash
# Esquema simplificado
curl http://localhost:3000/api/text-to-sql/schema

# Esquema detallado con columnas
curl http://localhost:3000/api/text-to-sql/schema?detailed=true
```

#### `POST /api/text-to-sql/ask`

Procesa una pregunta en lenguaje natural y retorna resultados SQL.

```bash
curl -X POST http://localhost:3000/api/text-to-sql/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Top 10 productos más vendidos en enero",
    "filters": {
      "startDate": "2024-01-01",
      "endDate": "2024-01-31"
    },
    "mode": "table"
  }'
```

**Response:**
```json
{
  "sql": "SELECT TOP 10 ...",
  "result_preview": [...],
  "explanation": "Consulta generada para: ...",
  "meta": {
    "tables_used": ["dbo.Transacciones"],
    "execution_ms": 150,
    "rowcount": 10,
    "warnings": [],
    "query_limited": false
  }
}
```

#### `POST /api/text-to-sql/validate-sql`

Valida una consulta SQL sin ejecutarla.

```bash
curl -X POST http://localhost:3000/api/text-to-sql/validate-sql \
  -H "Content-Type: application/json" \
  -d '{
    "sql": "SELECT TOP 10 * FROM Transacciones"
  }'
```

### Guardrails de Seguridad

| Guardrail | Descripción |
|-----------|-------------|
| Solo SELECT | Bloquea INSERT, UPDATE, DELETE, DROP, ALTER, EXEC, xp_*, etc. |
| Límite de filas | TOP 500 por defecto, máximo 1000 |
| Timeout | 15 segundos máximo por query |
| Allowlist | Solo tablas permitidas (Transacciones, UltimaCompra, MovStockTotalResumen, etc.) |
| Rate Limit | 10 solicitudes por minuto por IP |
| Auditoría | Todas las consultas son logueadas en `logs/` |

### Tablas Permitidas

- `dbo.Transacciones` - Ventas y transacciones
- `dbo.UltimaCompra` - Costos de última compra
- `dbo.ArticuloPrecio` - Precios de lista
- `dbo.MovStockTotalResumen` - **Fuente de verdad para stock**
- `dbo.Tiendas` - Catálogo de tiendas
- `dbo.Articulos` - Catálogo de artículos
- `dbo.Colores` - Catálogo de colores

---

## Definiciones de KPIs

### Stock
- **Fuente de verdad**: `dbo.MovStockTotalResumen`
- **NO usar**: `Transacciones.stockSKU` ni `stockBaseColor`
- **Campos**: `TotalStock` (disponible), `Pendientes` (en tránsito)

### ASP (Average Selling Price)
```
ASP = Venta Total ($) / Unidades Vendidas
```
Precio promedio al que se vendieron los productos.

### Margen (%)
```
Margen = (Precio - Costo) / Precio × 100
```
Porcentaje de ganancia sobre el precio de venta.

### Markup (%)
```
Markup = (Precio - Costo) / Costo × 100
```
Porcentaje de recargo sobre el costo.

### Días de Stock
```
Días Stock = Stock Total / (Unidades Vendidas / Días del Período)
```
Estimación de cuántos días durará el stock al ritmo actual.

### YTD (Year To Date)
- **Período**: 1 de enero del año en curso hasta hoy
- **Importante**: Ignora el filtro de período pero respeta otros filtros (tienda, marca, etc.)

### Semáforo de Reposición
| Color | Significado | Condición |
|-------|-------------|-----------|
| 🔴 ROJO | Sobrestock | Días reales > Días esperados |
| 🟢 VERDE | Reponer | Días reales < 45 |
| ⚫ NEGRO | Normal | Stock dentro de parámetros |
| ⚪ BLANCO | Sin Info | Sin datos para calcular |

**Fórmula:**
- Ritmo diario = Unidades vendidas (180d) / 180
- Días reales = Stock actual / Ritmo diario
- Días esperados = 180 - Días desde última compra

---

## StadiumGPT

Asistente de IA para análisis de datos en lenguaje natural.

### Acceso

- **Página dedicada**: `/chat` (menú lateral)
- **Panel flotante**: Botón en esquina inferior derecha

### Ejemplos de Preguntas

- "¿Cuáles son los productos más vendidos este mes?"
- "¿Cómo van las ventas comparado con el año pasado?"
- "Muéstrame productos con stock bajo"
- "¿Qué marcas tienen mejor margen?"
- "Analiza las ventas de Adidas por tienda"

---

## Checklist de Performance

### Queries
- [x] TOP en todas las consultas (default 500, max 1000)
- [x] Timeout de 15s en Text-to-SQL, 60s en queries analíticas
- [x] Paginación server-side en tabla de productos
- [x] Índices recomendados: `Fecha`, `BaseCol`, `IdDeposito`, `IdMarca`

### Frontend
- [x] Paginación en tablas grandes (25 items por página)
- [x] Debounce en búsquedas (500ms)
- [x] Caché de validación Depósito→Tienda (24h)

### Seguridad
- [x] Solo SELECT en Text-to-SQL
- [x] Allowlist de tablas
- [x] Rate limiting (10 req/min)
- [x] Logs de auditoría
- [x] Sanitización de inputs

---

## Estructura del Proyecto

```
src/
├── app/
│   ├── api/
│   │   ├── chat/                    # API de StadiumGPT
│   │   ├── metrics/                 # APIs de métricas
│   │   ├── products/analysis/       # API de análisis de productos
│   │   ├── text-to-sql/             # API Text-to-SQL
│   │   │   ├── ask/                 # Procesar preguntas
│   │   │   ├── schema/              # Obtener esquema
│   │   │   └── validate-sql/        # Validar SQL
│   │   └── validation/              # Validaciones (Depósito→Tienda)
│   ├── chat/                        # Página de StadiumGPT
│   ├── recompra/                    # Página de análisis de recompra
│   └── page.tsx                     # Dashboard principal
├── components/
│   ├── ProductAnalysisTable.tsx     # Tabla de análisis de productos
│   ├── AboutDefinitions.tsx         # Modal de definiciones
│   ├── DepositoWarningBanner.tsx    # Banner de advertencia
│   ├── MetricCard.tsx               # Tarjetas de KPIs
│   └── ...
├── lib/
│   ├── llm-service.ts               # Cliente Ollama
│   ├── text-to-sql-service.ts       # Servicio Text-to-SQL
│   ├── calculation-utils.ts         # Utilidades de cálculo
│   ├── reposicion-calculator.ts     # Cálculo de semáforo
│   ├── deposito-tienda-validator.ts # Validador de mapeo
│   ├── audit-logger.ts              # Logger de auditoría
│   └── ...
└── ...

# Archivos importantes en raíz
├── tablas anysys.csv                # Esquema de BD para Text-to-SQL
├── logs/                            # Logs de auditoría (generados)
└── .env.local                       # Variables de entorno
```

---

## Despliegue On Premise

El proyecto funciona completamente on premise:

1. **Next.js**: `npm start` o Docker
2. **Ollama**: Servicio systemd en servidor Linux (CPU-only)
3. **SQL Server**: Data warehouse existente

### Docker

```bash
# Build
docker build -t stadium-dashboard .

# Run
docker run -p 3000:3000 \
  -e DB_SERVER=ip_servidor \
  -e DB_USER=usuario \
  -e DB_PASSWORD=password \
  -e DB_DATABASE=anysys \
  -e OLLAMA_BASE_URL=http://ip_ollama:11434 \
  -e JWT_SECRET=tu_jwt_secret \
  -v $(pwd)/logs:/app/logs \
  stadium-dashboard
```

---

## Licencia

Propiedad de Stadium. Uso interno únicamente.
