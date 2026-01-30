# ADR-004: Arquitectura del Módulo Price Actions

## Estado
Aceptado

## Contexto
Se necesita un sistema para:
- Identificar productos que necesitan acción de precio (slow-movers)
- Simular el impacto de cambios de precio
- Priorizar qué productos atender primero
- Calcular elasticidad precio-demanda

El sistema debe ser configurable y manejar grandes volúmenes de SKUs.

## Decisión
Implementar arquitectura modular con 8 servicios especializados.

### Estructura:
```
src/lib/price-actions/
├── config-service.ts        # Configuración centralizada
├── price-band-utils.ts      # Utilidades de bandas de precio
├── cluster-service.ts       # Identificación de clusters
├── velocity-calculator.ts   # Cálculo de ritmos
├── elasticity-service.ts    # Cálculo de elasticidad
├── watchlist-scorer.ts      # Scoring de priorización
├── price-simulator.ts       # Simulación de impacto
└── watchlist-job-processor.ts  # Procesamiento asíncrono
```

### Flujo de Datos:
```
1. Usuario inicia análisis
   ↓
2. Job Processor ejecuta en background
   ↓
3. Para cada SKU:
   a. Cluster Service → Identificar grupo de competencia
   b. Velocity Calculator → Calcular ritmo de venta
   c. Watchlist Scorer → Asignar score de prioridad
   d. Determinar motivos de inclusión
   ↓
4. Ordenar por score y retornar resultados
   ↓
5. Usuario selecciona productos para simular
   ↓
6. Price Simulator:
   a. Elasticity Service → Calcular elasticidad
   b. Proyectar impacto financiero
   c. Generar warnings
```

## Decisiones de Diseño Específicas

### 1. Clusters Dinámicos
**Decisión**: Definir cluster como `{idClase, idGenero, idMarca, priceBand}`

**Razón**: Productos compiten con otros de misma categoría, género, marca y rango de precio similar.

### 2. Elasticidad de 3 Niveles
**Decisión**: Jerarquía de fuentes para elasticidad:
1. Input manual del usuario (más confiable)
2. Cálculo histórico del cluster (datos reales)
3. Fallback global conservador (-1.0)

**Razón**: No siempre hay datos suficientes para calcular elasticidad estadísticamente significativa.

### 3. Score Multi-Componente
**Decisión**: Score 0-100 compuesto por:
- Índice de ritmo (0-40 puntos)
- Días de stock vs ciclo (0-30 puntos)
- Margen unitario (0-20 puntos)
- Stock total (0-10 puntos)

**Razón**: Balancear urgencia (ritmo) con impacto financiero (margen, stock).

### 4. Procesamiento Asíncrono
**Decisión**: Jobs en background con polling de estado.

**Razón**: Análisis de miles de SKUs puede tomar minutos, no bloquear UI.

### 5. 4 Motivos de Inclusión
**Decisión**: Categorizar productos como:
- **Early**: Fracaso temprano (≥10 días, índice<0.7)
- **Desacelera**: Ritmo cayendo significativamente
- **Sobrestock**: Días de stock > días restantes
- **Sin tracción**: 0 ventas en últimos 14 días

**Razón**: Diferentes motivos requieren diferentes acciones.

## Alternativas Consideradas

### 1. Monolito único
- **Contra**: Archivo de 2000+ líneas
- **Contra**: Difícil de testear y mantener

### 2. Microservicios separados
- **Contra**: Overkill para este caso
- **Contra**: Complejidad de deployment

### 3. Cola de mensajes (RabbitMQ, etc.)
- **Pro**: Mejor manejo de jobs
- **Contra**: Infraestructura adicional
- **Decisión**: Polling simple es suficiente para volúmenes actuales

## Consecuencias

### Positivas
- Cada módulo tiene responsabilidad clara
- Fácil de testear unitariamente
- Configuración centralizada permite ajustes sin código
- Procesamiento asíncrono no bloquea UI

### Negativas
- Más archivos que mantener
- Dependencias entre módulos
- Polling no es tan eficiente como WebSockets

## Configuración

Todas las constantes en BD (`price_actions_config`):
```typescript
// Thresholds
indice_ritmo_critico: 0.6
indice_ritmo_bajo: 0.9
indice_desaceleracion: 0.7

// Tiempos
cycle_days_default: 90
early_days_threshold: 10
ritmo_ventana_dias: 14

// Bandas de precio (ejemplo)
price_bands_global: [
  { min: 0, max: 500 },
  { min: 500, max: 1000 },
  { min: 1000, max: 2000 },
  { min: 2000, max: 4000 },
  { min: 4000, max: 8000 },
  { min: 8000, max: Infinity }
]
```

## Fórmulas Clave

### Índice de Ritmo
```
indiceRitmo = ritmoActual / ritmoCluster
```
- < 1.0: vendiendo menos que el cluster
- = 1.0: vendiendo igual al cluster
- > 1.0: vendiendo más que el cluster

### Elasticidad
```
elasticidad = Δ%cantidad / Δ%precio
```
- Típicamente negativa (precio sube → cantidad baja)
- Rango normal: -0.5 a -2.0

### Proyección de Ventas
```
ritmoNuevo = ritmoActual × (1 + elasticidad × Δ%precio)
unidadesProyectadas = min(ritmoNuevo × horizonteDías, stockTotal)
```

## Extensibilidad

El diseño permite agregar:
- Nuevos motivos de inclusión
- Nuevas fuentes de elasticidad
- Diferentes métodos de scoring
- Configuraciones por categoría
