# ADR-002: Conexión a SQL Server con Pool Singleton

## Estado
Aceptado

## Contexto
Stadium Dashboard necesita conectarse a SQL Server (base de datos AnySys existente) para:
- Consultar transacciones de ventas
- Obtener información de productos, tiendas, stock
- Ejecutar queries de análisis complejos

El servidor de BD está en la red interna (10.120.0.19).

## Decisión
Implementar conexión mediante la librería `mssql` con un pool de conexiones singleton.

### Configuración:
```typescript
const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
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

### Patrón Singleton:
```typescript
let pool: sql.ConnectionPool | null = null;

export async function getPool() {
  if (pool) return pool;
  pool = await new sql.ConnectionPool(config).connect();
  return pool;
}
```

## Alternativas Consideradas

### 1. Prisma ORM
- **Pro**: Type-safety, migraciones, relaciones
- **Contra**: No soporta bien BD existentes complejas
- **Contra**: Overhead de aprendizaje y configuración
- **Contra**: Menos control sobre queries SQL específicos

### 2. Drizzle ORM
- **Pro**: Más ligero que Prisma
- **Contra**: Mismo problema con BD legacy
- **Contra**: Menos maduro

### 3. Conexión directa (sin pool)
- **Pro**: Más simple
- **Contra**: Conexión nueva por cada request = lento
- **Contra**: Puede agotar conexiones del servidor

### 4. Tedious directo
- **Pro**: Librería base de mssql, más control
- **Contra**: API más verbosa
- **Contra**: No incluye pooling built-in

## Consecuencias

### Positivas
- Pool reutiliza conexiones (mejor performance)
- Singleton evita crear múltiples pools
- Timeouts configurables para queries largas
- Compatible con BD existente sin cambios

### Negativas
- Queries SQL escritas a mano (posible SQL injection si no se usa params)
- No hay validación de tipos en tiempo de compilación
- Dependencia de librería mssql

## Mitigaciones
- Usar queries parametrizadas siempre que sea posible
- Validar inputs antes de construir queries
- Logs de errores detallados

## Notas de Implementación

### Archivo principal:
- `src/lib/db.ts`

### Variables de entorno:
```env
DB_USER=sa
DB_PASSWORD=***
DB_SERVER=10.120.0.19
DB_DATABASE=anysys
DB_ENCRYPT=true
DB_INSTANCE=SQLEXPRESS  # Opcional
```

### Uso típico:
```typescript
import { getPool } from '@/lib/db';

const pool = await getPool();
const result = await pool.request()
  .input('param', sql.VarChar, value)
  .query('SELECT * FROM Table WHERE col = @param');
```

### Consideraciones de Performance:
- `requestTimeout: 60000` para queries de análisis pesadas
- `pool.max: 10` balance entre concurrencia y recursos
- `idleTimeoutMillis: 30000` libera conexiones inactivas
