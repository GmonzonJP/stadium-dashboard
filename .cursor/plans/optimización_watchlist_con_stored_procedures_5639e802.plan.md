# Plan: Optimización Watchlist con Stored Procedures + Proceso Asíncrono

## Objetivo
Mover los cálculos complejos a la base de datos usando stored procedures y crear un sistema de jobs asíncronos donde el usuario dispara el proceso manualmente y puede ver el progreso en tiempo real.

## Ventajas del Enfoque Asíncrono

1. **Control del usuario**: Decide cuándo ejecutar el cálculo pesado
2. **No bloquea UI**: La interfaz sigue responsive
3. **Visibilidad**: Usuario ve progreso (ej: "Procesando 45/200 productos...")
4. **Cancelación**: Puede cancelar si es necesario
5. **Reutilización**: Resultados se pueden cachear

## Estructura Propuesta

### 1. Tabla de Jobs

#### `PriceActionsJobs`
- `Id` (PK)
- `JobType` ('watchlist', 'simulation', etc.)
- `Status` ('pending', 'running', 'completed', 'failed', 'cancelled')
- `Progress` (0-100)
- `CurrentStep` (string descriptivo: "Procesando productos...")
- `TotalItems` (total de items a procesar)
- `ProcessedItems` (items procesados hasta ahora)
- `Filters` (JSON con filtros aplicados)
- `ResultData` (JSON con resultados cuando complete)
- `ErrorMessage` (si falla)
- `CreatedAt`, `StartedAt`, `CompletedAt`
- `CreatedBy` (usuario que inició)

### 2. Stored Procedures

#### `sp_GetPriceActionsWatchlist`
- **Parámetros**: Filtros, paginación
- **Retorna**: Tabla completa con todos los cálculos
- **Lógica**: Todo el cálculo en SQL (una sola query optimizada)

#### `sp_GetPriceActionsWatchlistAsync` (Opcional - si queremos progreso desde SQL)
- Similar pero con capacidad de reportar progreso
- Usa tabla temporal para ir guardando resultados parciales

### 3. Endpoints API

#### `POST /api/price-actions/watchlist/start`
- Recibe filtros
- Crea job en BD (status: 'pending')
- Inicia proceso asíncrono (no bloquea)
- Retorna `jobId`

#### `GET /api/price-actions/watchlist/status/[jobId]`
- Consulta estado del job
- Retorna: `{ status, progress, currentStep, totalItems, processedItems, resultData?, errorMessage? }`

#### `POST /api/price-actions/watchlist/cancel/[jobId]`
- Cancela job en ejecución
- Actualiza status a 'cancelled'

#### `GET /api/price-actions/watchlist/result/[jobId]`
- Obtiene resultados cuando status = 'completed'
- Retorna datos paginados

### 4. Componente UI

#### `WatchlistTable` (modificado)
- Botón "Calcular Watchlist" prominente
- Modal/panel de progreso con:
  - Barra de progreso (0-100%)
  - Texto descriptivo ("Procesando producto 45 de 200...")
  - Tiempo transcurrido
  - Botón "Cancelar"
- Cuando complete, muestra resultados
- Opción de guardar/exportar resultados

## Flujo de Usuario

1. Usuario entra a Watchlist → Ve botón "Calcular Watchlist"
2. Usuario hace clic → Se abre modal de progreso
3. Backend crea job y lo ejecuta en background
4. Frontend hace polling cada 1-2 segundos a `/status/[jobId]`
5. Modal muestra progreso en tiempo real
6. Cuando complete → Modal se cierra, tabla se llena con resultados
7. Resultados se pueden cachear (mostrar "Última actualización: hace X minutos")

## Implementación Técnica

### Opción A: Proceso en Node.js con actualización de BD
- Job se ejecuta en Node.js (async)
- Actualiza tabla `PriceActionsJobs` con progreso
- Frontend hace polling

### Opción B: Stored Procedure con tabla temporal
- SP se ejecuta y va guardando resultados parciales en tabla temporal
- Node.js consulta progreso desde tabla temporal
- Más eficiente pero más complejo

**Recomendación**: Opción A (más simple, suficiente para este caso)

## Archivos a Crear/Modificar

### Nuevos
1. `scripts/create-price-actions-jobs-table.sql` - Tabla de jobs
2. `scripts/create-price-actions-watchlist-sp.sql` - Stored procedure optimizado
3. `src/app/api/price-actions/watchlist/start/route.ts` - Iniciar job
4. `src/app/api/price-actions/watchlist/status/[jobId]/route.ts` - Consultar estado
5. `src/app/api/price-actions/watchlist/cancel/[jobId]/route.ts` - Cancelar
6. `src/app/api/price-actions/watchlist/result/[jobId]/route.ts` - Obtener resultados
7. `src/components/price-actions/WatchlistProgressModal.tsx` - Modal de progreso
8. `src/lib/price-actions/watchlist-job-processor.ts` - Lógica del proceso asíncrono

### Modificar
1. `src/components/price-actions/WatchlistTable.tsx` - Agregar botón y modal
2. `src/types/price-actions.ts` - Agregar tipos para jobs

## Detalles de Implementación

### Proceso Asíncrono
```typescript
// Ejecutar en background (no bloquear request)
async function processWatchlistJob(jobId: string, filters: WatchlistFilters) {
  // 1. Actualizar status a 'running'
  // 2. Obtener productos (query optimizada)
  // 3. Procesar en batches
  // 4. Actualizar progreso cada batch
  // 5. Guardar resultados en ResultData (JSON)
  // 6. Actualizar status a 'completed'
}
```

### Polling en Frontend
```typescript
// Polling cada 1.5 segundos
useEffect(() => {
  if (!jobId) return;
  const interval = setInterval(async () => {
    const status = await fetch(`/api/price-actions/watchlist/status/${jobId}`);
    // Actualizar UI con progreso
  }, 1500);
  return () => clearInterval(interval);
}, [jobId]);
```

## Ventajas Adicionales

- **Cache**: Resultados se pueden guardar y reutilizar
- **Historial**: Ver jobs anteriores
- **Debugging**: Logs de qué productos se procesaron
- **Performance**: Usuario puede hacer otras cosas mientras procesa

## Consideraciones

- Timeout: Si job tarda > 10 minutos, considerar timeout
- Limpieza: Jobs antiguos (> 24h) se pueden limpiar
- Límites: Máximo 1 job por usuario a la vez (opcional)
