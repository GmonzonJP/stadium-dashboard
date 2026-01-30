# Patrones de Diseño

## Patrones Arquitectónicos

### 1. Singleton Pattern - Conexión a Base de Datos

**Ubicación:** `src/lib/db.ts`

```typescript
let pool: sql.ConnectionPool | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool) return pool;
  pool = await new sql.ConnectionPool(config).connect();
  return pool;
}
```

**Decisión:** Un solo pool de conexiones reutilizable para toda la aplicación. Evita crear conexiones en cada request.

### 2. Context Pattern - Estado Global React

**Ubicación:** `src/context/`

```typescript
// AuthContext.tsx
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState<User | null>(null);
  // ...
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be within AuthProvider');
  return context;
}
```

**Decisión:** Tres contextos separados (Auth, Filters, Theme) para evitar re-renders innecesarios.

### 3. Factory Pattern - Generación de Queries

**Ubicación:** `src/lib/query-builder.ts`, `src/lib/sql-generator.ts`

```typescript
export function buildProductQuery(filters: FilterParams): string {
  let query = 'SELECT * FROM Products WHERE 1=1';

  if (filters.brands?.length) {
    query += ` AND brandId IN (${filters.brands.join(',')})`;
  }
  // ... más condiciones

  return query;
}
```

**Decisión:** Queries dinámicas construidas programáticamente según filtros activos.

### 4. Strategy Pattern - Cálculo de Elasticidad

**Ubicación:** `src/lib/price-actions/elasticity-service.ts`

```typescript
// 3 estrategias en orden de prioridad:
// 1. Input manual del usuario
// 2. Cálculo histórico del cluster
// 3. Fallback conservador global

const elasticity =
  manualElasticity ??
  await calculateClusterElasticity(cluster) ??
  config.elasticity_fallback;
```

**Decisión:** Jerarquía clara de fuentes de datos con fallbacks seguros.

### 5. Observer Pattern - Notificaciones de Estado

**Ubicación:** `src/components/NotificationsMenu.tsx`

```typescript
useEffect(() => {
  const fetchAlerts = async () => {
    const response = await fetch('/api/insights/stock-alerts');
    setAlerts(await response.json());
  };

  fetchAlerts();
  const interval = setInterval(fetchAlerts, 60000); // Polling cada minuto

  return () => clearInterval(interval);
}, []);
```

**Decisión:** Polling periódico para alertas (WebSockets considerado pero descartado por complejidad).

### 6. Middleware Pattern - Autenticación

**Ubicación:** `src/middleware.ts`

```typescript
export async function middleware(request: NextRequest) {
  // Rutas públicas: permitir
  if (PUBLIC_ROUTES.includes(pathname)) {
    return NextResponse.next();
  }

  // Verificar token
  const token = request.cookies.get('auth_token');
  if (!token || !isValidTokenStructure(token.value)) {
    return redirectToLogin(request);
  }

  return NextResponse.next();
}
```

**Decisión:** Verificación ligera en middleware (estructura), verificación completa en API handlers (firma).

## Patrones de Código

### Safe Division - Cálculos Seguros

**Ubicación:** `src/lib/calculation-utils.ts`

```typescript
export function safeDivide(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
  defaultValue: number | null = null
): number | null {
  if (numerator == null || denominator == null || denominator === 0) {
    return defaultValue;
  }
  return numerator / denominator;
}
```

**Uso consistente:**
```typescript
const asp = safeDivide(ventas, unidades);
const margen = safeDivide(precio - costo, precio);
const diasStock = safeDivide(stock, ritmo);
```

### Error Boundary - Manejo de Errores

```typescript
// En API handlers
try {
  const result = await executeQuery();
  return NextResponse.json(result);
} catch (error) {
  console.error('Error:', error);
  return NextResponse.json(
    { error: 'Error interno del servidor' },
    { status: 500 }
  );
}
```

**Decisión:** Errores genéricos al cliente, detalles solo en logs.

### Defensive Coding - Validación de Entrada

```typescript
// En API de login
if (!usuario || typeof usuario !== 'string') {
  return NextResponse.json(
    { error: 'Usuario requerido' },
    { status: 400 }
  );
}

if (!password || typeof password !== 'string') {
  return NextResponse.json(
    { error: 'Contraseña requerida' },
    { status: 400 }
  );
}
```

### Batch Processing - Procesamiento en Lotes

**Ubicación:** `src/lib/price-actions/watchlist-job-processor.ts`

```typescript
const BATCH_SIZE = 50;

for (let i = 0; i < items.length; i += BATCH_SIZE) {
  const batch = items.slice(i, i + BATCH_SIZE);

  // Procesar batch
  for (const item of batch) {
    processItem(item);
  }

  // Actualizar progreso
  updateProgress(Math.floor((i / items.length) * 100));
}
```

**Decisión:** Evita memory leaks en listas grandes.

## Principios SOLID Aplicados

### Single Responsibility
- `db.ts` solo maneja conexión
- `auth.ts` solo maneja tokens
- `calculation-utils.ts` solo tiene funciones de cálculo

### Open/Closed
- Configuración extensible via BD (config-service.ts)
- Nuevas bandas de precio sin cambiar código

### Liskov Substitution
- Todos los API handlers siguen la misma interfaz (Request → Response)

### Interface Segregation
- Contextos separados (Auth, Filter, Theme)
- Tipos específicos por módulo (price-actions.ts, sell-out.ts)

### Dependency Inversion
- Servicios dependen de abstracciones (getPool, not ConnectionPool)
- Configuración inyectada desde BD/ENV

## Anti-Patterns Evitados

### ❌ God Object
- NO: Un único archivo con toda la lógica
- SÍ: Módulos especializados en `/lib/`

### ❌ Magic Numbers
- NO: `if (score < 0.6)`
- SÍ: `if (score < config.indice_ritmo_critico)`

### ❌ Callback Hell
- NO: Callbacks anidados
- SÍ: async/await consistente

### ❌ Premature Optimization
- NO: Cache complejo sin necesidad
- SÍ: Pool de conexiones donde tiene sentido
