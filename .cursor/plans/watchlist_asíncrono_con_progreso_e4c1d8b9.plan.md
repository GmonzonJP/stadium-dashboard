# Plan: Watchlist Asíncrono con Progreso + Parámetros Configurables

## Objetivo
Implementar sistema de jobs asíncronos para watchlist donde:
1. El director configura parámetros (período, marcas, categorías, etc.) antes de iniciar
2. El usuario dispara el cálculo manualmente
3. Ve el progreso en tiempo real
4. Los cálculos se ejecutan en stored procedures SQL para máximo rendimiento

## Parámetros Configurables

### Período de Análisis
- **Fecha Desde**: Inicio del período para calcular ritmo base y métricas
- **Fecha Hasta**: Fin del período (default: hoy)
- **Ventana Ritmo Actual**: Días para calcular ritmo actual (default: 14, calculable desde fechas)

### Filtros de Productos
- **Marcas**: Selección múltiple (ya existe, mejorar UI)
- **Categorías**: Selección múltiple (ya existe)
- **Géneros**: Selección múltiple (ya existe)
- **Tiendas**: Selección múltiple (ya existe)
- **Bandas de Precio**: Filtro opcional

### Configuración de Cálculo
- **Ciclo de Venta**: Días del ciclo (default: 90, configurable por categoría)
- **Thresholds**: Usar valores de configuración o permitir override

## Arquitectura

### 1. Base de Datos
- **Tabla `PriceActionsJobs`**: Tracking de jobs con progreso y parámetros
  - Campos adicionales: `Parameters` (JSON con filtros y fechas)
- **Stored Procedure `sp_GetPriceActionsWatchlist`**: 
  - Parámetros: `@FechaDesde`, `@FechaHasta`, `@RitmoVentanaDias`, filtros
  - Cálculo optimizado en SQL

### 2. Backend (APIs)
- `POST /api/price-actions/watchlist/start` 
  - Body: `{ filters, fechaDesde, fechaHasta, ritmoVentanaDias?, ... }`
  - Crea job, retorna jobId
- `GET /api/price-actions/watchlist/status/[jobId]` - Consulta progreso
- `POST /api/price-actions/watchlist/cancel/[jobId]` - Cancela job
- `GET /api/price-actions/watchlist/result/[jobId]` - Obtiene resultados

### 3. Frontend

#### Panel de Configuración (`WatchlistConfigPanel`)
- Modal/drawer que se abre antes de iniciar cálculo
- Secciones:
  1. **Período de Análisis**
     - DateRangePicker (reutilizar componente existente)
     - Input opcional: "Ventana para ritmo actual (días)"
  2. **Filtros de Productos**
     - Botones para abrir FilterPanel de marcas, categorías, géneros, tiendas
     - Tags mostrando selecciones activas
  3. **Configuración Avanzada** (colapsable)
     - Ciclo de venta (días)
     - Override de thresholds (opcional)
- Botones: "Cancelar", "Calcular Watchlist"

#### Modal de Progreso (`WatchlistProgressModal`)
- Barra de progreso (0-100%)
- Texto descriptivo: "Procesando producto 45 de 200..."
- Tiempo transcurrido
- Botón "Cancelar"
- Se cierra automáticamente al completar

#### `WatchlistTable` (modificado)
- Botón prominente "Calcular Watchlist" que abre `WatchlistConfigPanel`
- Cuando hay resultados, muestra tabla
- Badge: "Última actualización: hace X minutos" (si hay cache)

## Flujo de Usuario

1. Usuario entra a Watchlist → Ve botón "Calcular Watchlist"
2. Usuario hace clic → Se abre `WatchlistConfigPanel`
3. Director configura:
   - Selecciona período (ej: "Últimos 30 días" o fechas específicas)
   - Selecciona marcas/categorías/géneros/tiendas
   - (Opcional) Ajusta configuración avanzada
4. Director hace clic en "Calcular Watchlist"
5. Panel se cierra, se abre `WatchlistProgressModal`
6. Backend crea job con parámetros y lo ejecuta en background
7. Frontend hace polling cada 1.5s a `/status/[jobId]`
8. Modal muestra progreso en tiempo real
9. Cuando complete → Modal se cierra, tabla se llena con resultados
10. Resultados se cachean (mostrar "Última actualización: hace X minutos")

## Cambios en Tipos

### `WatchlistFilters` (extendido)
```typescript
export interface WatchlistFilters {
    // Filtros existentes
    stores?: number[];
    categories?: number[];
    brands?: number[];
    genders?: number[];
    priceBands?: string[];
    severidad?: 'critico' | 'bajo' | 'normal' | 'all';
    motivo?: WatchlistReason[];
    search?: string;
    
    // Nuevos: Período de análisis
    fechaDesde?: string; // ISO date string
    fechaHasta?: string; // ISO date string
    ritmoVentanaDias?: number; // Opcional, se calcula desde fechas si no se proporciona
}
```

### `WatchlistJob`
```typescript
export interface WatchlistJob {
    id: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    progress: number; // 0-100
    currentStep: string;
    totalItems: number;
    processedItems: number;
    filters: WatchlistFilters;
    resultData?: WatchlistResponse;
    errorMessage?: string;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    createdBy?: string;
}
```

## Modificaciones en SQL

### Query en `watchlist/route.ts` (actual)
- Actualmente usa `DATEADD(DAY, -7/14/28, GETDATE())` hardcoded
- Cambiar a usar `@FechaDesde` y `@FechaHasta` como parámetros
- `ritmoVentanaDias` se calcula desde fechas si no se proporciona

### Stored Procedure
```sql
CREATE PROCEDURE sp_GetPriceActionsWatchlist
    @FechaDesde DATE,
    @FechaHasta DATE,
    @RitmoVentanaDias INT,
    @IdMarcas NVARCHAR(MAX) = NULL, -- JSON array o comma-separated
    @IdCategorias NVARCHAR(MAX) = NULL,
    @IdGeneros NVARCHAR(MAX) = NULL,
    @IdTiendas NVARCHAR(MAX) = NULL
AS
BEGIN
    -- Query optimizada usando parámetros
    -- Retorna tabla con todos los cálculos
END
```

## Archivos a Crear/Modificar

### Nuevos
1. `scripts/create-price-actions-jobs-table.sql` - Tabla de jobs
2. `scripts/create-price-actions-watchlist-sp.sql` - Stored procedure
3. `src/app/api/price-actions/watchlist/start/route.ts` - Iniciar job
4. `src/app/api/price-actions/watchlist/status/[jobId]/route.ts` - Estado
5. `src/app/api/price-actions/watchlist/cancel/[jobId]/route.ts` - Cancelar
6. `src/app/api/price-actions/watchlist/result/[jobId]/route.ts` - Resultados
7. `src/lib/price-actions/watchlist-job-processor.ts` - Proceso asíncrono
8. `src/components/price-actions/WatchlistConfigPanel.tsx` - Panel de configuración
9. `src/components/price-actions/WatchlistProgressModal.tsx` - Modal de progreso

### Modificar
1. `src/types/price-actions.ts` - Agregar tipos para jobs y extender WatchlistFilters
2. `src/components/price-actions/WatchlistTable.tsx` - Botón y modal
3. `src/app/api/price-actions/watchlist/route.ts` - Usar parámetros de fecha

## Detalles de Implementación

### Cálculo de `ritmoVentanaDias`
- Si se proporciona `fechaDesde` y `fechaHasta`:
  - `ritmoVentanaDias = días entre fechaDesde y fechaHasta` (máx 30 días)
- Si no se proporciona pero hay `ritmoVentanaDias` explícito: usar ese
- Default: 14 días (desde configuración)

### Validación de Parámetros
- `fechaDesde` <= `fechaHasta`
- `fechaHasta` <= hoy
- `ritmoVentanaDias` entre 7 y 90 días
- Al menos un filtro debe estar seleccionado (marcas, categorías, etc.)

### Cache de Resultados
- Guardar resultados en `PriceActionsJobs.ResultData` (JSON)
- Mostrar timestamp de última actualización
- Permitir "Recalcular" para forzar nuevo cálculo

## Ventajas

- **Control total**: Director elige exactamente qué analizar
- **Flexibilidad**: Períodos personalizados, no solo "últimos 14 días"
- **Transparencia**: Ve progreso en tiempo real
- **Performance**: Cálculos en SQL, no bloquea UI
- **Reutilización**: Resultados cacheados, puede revisar sin recalcular
