/**
 * Tipos TypeScript para el módulo Price Actions
 */

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

export interface PriceBand {
    min: number;
    max: number;
}

export interface PriceActionsConfig {
    id?: number;
    configKey: string;
    configValue: string;
    configType: 'string' | 'number' | 'json';
    description?: string;
    category?: 'price_band' | 'threshold' | 'cycle' | 'elasticity';
    createdAt?: Date;
    updatedAt?: Date;
}

// ============================================================================
// CLUSTER Y RITMOS
// ============================================================================

export interface Cluster {
    idClase: number;
    descripcionClase: string;
    idGenero: number;
    descripcionGenero: string;
    idMarca: number;
    descripcionMarca: string;
    priceBand: string; // Ej: "0-1490", "1491-1790", etc.
    temporada?: string;
}

export interface VelocityMetrics {
    ritmoActual: number; // unidades/día en últimos N días
    ritmoBase: number; // unidades/día desde inicio de ciclo
    indiceDesaceleracion: number; // ritmo_actual / ritmo_base
    ritmoCluster: number; // promedio ponderado del cluster
    indiceRitmo: number; // ritmo_actual / ritmo_cluster
}

export interface StockMetrics {
    stockOnHand: number;
    stockPendiente: number;
    stockTotal: number;
    diasStock: number | null; // stock_total / venta_diaria
    diasDesdeInicio: number;
    diasRestantesCiclo: number | null;
}

// ============================================================================
// WATCHLIST
// ============================================================================

export type WatchlistReason = 'Early' | 'Desacelera' | 'Sobrestock' | 'Sin tracción';

export interface WatchlistItem {
    baseCol: string;
    descripcion: string;
    descripcionCorta: string;
    categoria: string;
    idClase: number;
    marca: string;
    idMarca: number;
    genero: string;
    idGenero: number;
    priceBand: string;
    precioActual: number;
    precioActualFecha?: string;
    costo: number;
    costoFecha?: string;
    stockTotal: number;
    stockPorTienda?: Array<{ idDeposito: number; descripcion: string; stock: number }>;
    unidadesUltimos7: number;
    unidadesUltimos14: number;
    unidadesUltimos28: number;
    ritmoActual: number;
    ritmoCluster: number;
    indiceRitmo: number;
    indiceDesaceleracion: number;
    diasStock: number | null;
    diasDesdeInicio: number;
    diasRestantesCiclo: number | null;
    motivo: WatchlistReason[];
    score: number; // 0-100
    cluster: Cluster;
}

export interface WatchlistFilters {
    stores?: number[];
    categories?: number[];
    brands?: number[];
    genders?: number[];
    priceBands?: string[];
    severidad?: 'critico' | 'bajo' | 'normal' | 'all';
    motivo?: WatchlistReason[];
    search?: string;
}

export interface WatchlistResponse {
    items: WatchlistItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

// ============================================================================
// SIMULADOR
// ============================================================================

export interface ElasticityInfo {
    value: number; // Elasticidad calculada
    confidence: 'alta' | 'media' | 'baja';
    observations: number; // Cantidad de observaciones usadas
    method: 'cluster' | 'categoria' | 'fallback';
    warning?: string;
}

export interface PriceSimulationInput {
    baseCol: string;
    precioActual: number;
    precioPropuesto: number;
    horizonteDias: number; // default: dias_restantes_ciclo
    elasticidad?: number; // opcional, si no se proporciona se calcula
}

export interface PriceSimulationResult {
    baseCol: string;
    precioActual: number;
    precioPropuesto: number;
    deltaPrecioPorcentaje: number;
    elasticidad: ElasticityInfo;
    ritmoActual: number;
    ritmoProyectado: number;
    unidadesProyectadas: number;
    unidadesProyectadasCap: number; // min(unidades_proyectadas, stock_total)
    ingresoProyectado: number;
    costo: number;
    margenUnitario: number;
    margenTotal: number;
    costoCastigo: number;
    sellOutProyectadoPorcentaje: number;
    stockTotal: number;
    horizonteDias: number;
    warnings: string[];
    breakEvenPrecio?: number; // Precio mínimo para margen objetivo (si se configura)
}

// ============================================================================
// PROPUESTAS
// ============================================================================

export type ProposalStatus = 'pendiente' | 'aprobado' | 'descartado';
export type ProposalMotivo = 'Early' | 'Desacelera' | 'Sobrestock' | 'Sin tracción' | 'Otro';

export interface PriceChangeProposal {
    id?: number;
    baseCol: string;
    descripcion?: string;
    precioActual: number;
    precioPropuesto: number;
    precioAntes?: number;              // Precio "antes" para promociones (puede diferir de precioActual)
    usarPrecioAntesAhora: boolean;     // Flag para modo antes/ahora
    motivo: ProposalMotivo;
    notas?: string;
    estado: ProposalStatus;
    sellOutProyectado?: number;
    margenTotalProyectado?: number;
    costoCastigo?: number;
    confianzaElasticidad?: 'alta' | 'media' | 'baja';
    usuarioId?: number;
    usuarioNombre?: string;
    createdAt?: Date;
    updatedAt?: Date;
    aprobadoPor?: string;
    aprobadoAt?: Date;
    // Datos adicionales para UI
    descripcionCorta?: string;
    categoria?: string;
    marca?: string;
}

export interface ProposalHistory {
    id?: number;
    proposalId: number;
    campo: string;
    valorAnterior: string | null;
    valorNuevo: string | null;
    usuario: string;
    accion: 'created' | 'updated' | 'approved' | 'rejected' | 'deleted';
    createdAt?: Date;
}

export interface ProposalFilters {
    estado?: ProposalStatus[];
    motivo?: ProposalMotivo[];
    usuarioId?: number;
    fechaDesde?: string;
    fechaHasta?: string;
    search?: string;
}

export interface ProposalsResponse {
    proposals: PriceChangeProposal[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

// ============================================================================
// EXPORTACIÓN
// ============================================================================

export interface ExportData {
    fecha: string;
    usuario: string;
    resumenEjecutivo: string;
    propuestas: Array<{
        sku: string;
        descripcion: string;
        precioActual: number;
        precioNuevo: number;
        cambioPorcentaje: number;
        motivo: string;
        impactoMargen: number;
        sellOutEsperado: number;
        costoCastigo: number;
    }>;
}

// ============================================================================
// JOBS ASÍNCRONOS
// ============================================================================

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type JobType = 'watchlist' | 'simulation' | 'export';

export interface WatchlistJobParameters {
    filters: WatchlistFilters;
    fechaDesde?: string;
    fechaHasta?: string;
    ritmoVentanaDias?: number;
    cycleDays?: number;
}

export interface WatchlistJobResultSummary {
    totalItems: number;
    criticalCount: number;
    lowCount: number;
    normalCount: number;
    averageScore: number;
    topMotivos: Array<{ motivo: WatchlistReason; count: number }>;
}

export interface WatchlistJob {
    id: string;
    jobType: JobType;
    status: JobStatus;
    progress: number; // 0-100
    currentStep: string | null;
    totalItems: number;
    processedItems: number;
    parameters: WatchlistJobParameters;
    resultData?: WatchlistResponse;
    resultSummary?: WatchlistJobResultSummary;
    errorMessage?: string;
    createdBy?: string;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    cancelledAt?: Date;
}

export interface JobStatusResponse {
    id: string;
    status: JobStatus;
    progress: number;
    currentStep: string | null;
    totalItems: number;
    processedItems: number;
    errorMessage?: string;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    elapsedSeconds?: number;
}

export interface StartJobResponse {
    jobId: string;
    status: JobStatus;
    message: string;
}
