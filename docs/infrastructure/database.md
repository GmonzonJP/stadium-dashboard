# Base de Datos

## Información General

| Atributo | Valor |
|----------|-------|
| **Servidor** | 10.120.0.19 |
| **Motor** | SQL Server 2016+ |
| **Database** | anysys |
| **Puerto** | 1433 |
| **Conexión** | Encriptada (TLS) |

## Tablas Principales

### Tablas de Transacciones

#### dbo.Transacciones
Tabla principal de ventas/transacciones.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | int | ID único |
| fecha | datetime | Fecha de transacción |
| idTienda | int | FK a Tiendas |
| baseColor | varchar(50) | Identificador de producto |
| unidades | int | Cantidad vendida |
| venta | decimal | Importe de venta |
| costo | decimal | Costo del producto |
| idMarca | int | FK a Marcas |
| idClase | int | FK a Clases/Categorías |
| idGenero | int | FK a Géneros |
| idProveedor | int | FK a Proveedores |

**Nota:** No usar `stockSKU` ni `stockBaseColor` de esta tabla para stock.

#### dbo.UltimaCompra
Costos de última compra por producto.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| baseColor | varchar(50) | Identificador de producto |
| costoUltimo | decimal | Costo de última compra |
| fechaUltimaCompra | datetime | Fecha de última compra |

### Tablas de Inventario

#### dbo.MovStockTotalResumen
**Fuente de verdad para stock.**

| Columna | Tipo | Descripción |
|---------|------|-------------|
| baseColor | varchar(50) | Identificador de producto |
| idTienda | int | FK a Tiendas |
| stockActual | int | Stock actual |
| talla | varchar(20) | Talla/tamaño |

### Tablas de Catálogo

#### dbo.Articulos
Catálogo de productos.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | int | ID único |
| codigo | varchar(50) | Código interno |
| descripcion | nvarchar(255) | Nombre del producto |
| idMarca | int | FK a Marcas |
| idClase | int | FK a Clases |
| idGenero | int | FK a Géneros |
| idProveedor | int | FK a Proveedores |

#### dbo.Colores
Catálogo de colores/variantes.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| baseColor | varchar(50) | Identificador único |
| color | nvarchar(100) | Nombre del color |
| imagen | varchar(255) | URL de imagen |

#### dbo.Tiendas
Catálogo de tiendas/puntos de venta.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | int | ID único |
| nombre | nvarchar(100) | Nombre de tienda |
| codigo | varchar(20) | Código interno |
| activa | bit | Si está activa |

#### dbo.ArticuloPrecio
Precios de lista por producto.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| baseColor | varchar(50) | Identificador de producto |
| precioLista | decimal | Precio de venta sugerido |
| fechaVigencia | datetime | Fecha desde vigencia |

### Tablas de Aplicación

#### dbo.dashboard_users
Usuarios del sistema Stadium Dashboard.

```sql
CREATE TABLE dashboard_users (
  Id INT IDENTITY PRIMARY KEY,
  Usuario NVARCHAR(50) UNIQUE NOT NULL,
  PasswordHash NVARCHAR(255) NOT NULL,
  Nombre NVARCHAR(100),
  Email NVARCHAR(100),
  Rol NVARCHAR(20) DEFAULT 'usuario',
  Activo BIT DEFAULT 1,
  UltimoAcceso DATETIME,
  RecordarSesion BIT DEFAULT 0,
  FechaCreacion DATETIME DEFAULT GETDATE()
);
```

#### dbo.price_actions_config
Configuración del módulo Price Actions.

```sql
CREATE TABLE price_actions_config (
  Id INT IDENTITY PRIMARY KEY,
  Clave NVARCHAR(100) UNIQUE NOT NULL,
  Valor NVARCHAR(MAX),
  Tipo NVARCHAR(20) DEFAULT 'string', -- string, number, json
  Descripcion NVARCHAR(255),
  FechaModificacion DATETIME DEFAULT GETDATE()
);
```

#### dbo.price_actions_jobs
Jobs de procesamiento de watchlist.

```sql
CREATE TABLE price_actions_jobs (
  Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  Status NVARCHAR(20) DEFAULT 'pending', -- pending, running, completed, failed, cancelled
  Progress INT DEFAULT 0,
  Filtros NVARCHAR(MAX), -- JSON
  Resultados NVARCHAR(MAX), -- JSON
  Resumen NVARCHAR(MAX), -- JSON
  Error NVARCHAR(MAX),
  FechaInicio DATETIME DEFAULT GETDATE(),
  FechaFin DATETIME,
  UsuarioId INT
);
```

#### dbo.price_actions_proposals
Propuestas de cambio de precio.

```sql
CREATE TABLE price_actions_proposals (
  Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  BaseColor VARCHAR(50) NOT NULL,
  PrecioActual DECIMAL(18,2),
  PrecioPropuesto DECIMAL(18,2),
  Justificacion NVARCHAR(MAX),
  Status NVARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
  UsuarioCreador INT,
  UsuarioAprobador INT,
  FechaCreacion DATETIME DEFAULT GETDATE(),
  FechaResolucion DATETIME
);
```

## Stored Procedures

### sp_GetPriceActionsWatchlist
Obtiene candidatos para la watchlist de Price Actions.

**Parámetros:**
- `@startDate` (datetime, opcional)
- `@endDate` (datetime, opcional)
- `@ventanaRitmo` (int, default 14)
- `@cicloDias` (int, default 90)
- `@marcas` (varchar, comma-separated)
- `@categorias` (varchar)
- `@generos` (varchar)
- `@tiendas` (varchar)
- `@busqueda` (varchar)

**Retorna:**
- baseColor, articulo, marca, categoria, genero
- unidadesVendidas, diasConVenta, stockTotal
- ritmoActual, ritmoCluster, indiceRitmo
- diasDesdeInicio, fechaInicioVenta

## Índices Recomendados

```sql
-- Transacciones
CREATE INDEX IX_Transacciones_Fecha ON Transacciones(fecha);
CREATE INDEX IX_Transacciones_BaseColor ON Transacciones(baseColor);
CREATE INDEX IX_Transacciones_Tienda ON Transacciones(idTienda);

-- MovStockTotalResumen
CREATE INDEX IX_Stock_BaseColor ON MovStockTotalResumen(baseColor);

-- Búsquedas compuestas
CREATE INDEX IX_Trans_Fecha_Marca ON Transacciones(fecha, idMarca);
CREATE INDEX IX_Trans_BaseColor_Fecha ON Transacciones(baseColor, fecha);
```

## Conexión desde la Aplicación

**Archivo:** `src/lib/db.ts`

```typescript
import sql from 'mssql';

const config: sql.config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER!,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: true,
    trustServerCertificate: true,
    instanceName: process.env.DB_INSTANCE
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  connectionTimeout: 30000,
  requestTimeout: 60000
};
```

## Tablas Permitidas para Text-to-SQL

Por seguridad, solo estas tablas son accesibles via consultas de lenguaje natural:

1. `Transacciones` - Ventas
2. `UltimaCompra` - Costos
3. `ArticuloPrecio` - Precios
4. `MovStockTotalResumen` - Stock
5. `Tiendas` - Catálogo tiendas
6. `Articulos` - Catálogo productos
7. `Colores` - Catálogo colores

## Notas Importantes

1. **Stock**: Siempre usar `MovStockTotalResumen`, no campos de stock en `Transacciones`

2. **BaseColor**: Es el identificador único de producto (código base + color)

3. **Fechas**: Usar formato ISO (YYYY-MM-DD) en queries

4. **Nulls**: Muchas columnas pueden ser NULL, usar COALESCE/ISNULL

5. **Performance**: Queries de análisis pueden tardar, usar TOP y filtros de fecha
