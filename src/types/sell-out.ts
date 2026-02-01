// ============================================
// TIPOS PARA ANÁLISIS SELL OUT Y CLASIFICACIÓN DE PRODUCTOS
// ============================================

// Configuración de depósitos
export const DEPOSITOS_CONFIG = {
  central: [99, 999],
  outlet: [31, 32, 117, 131, 940], // STADIUM117, STADIUM131-SALDOS, OUTLET_Fuera_Temporada_940
  web: [701, 702, 704], // Tiendas WEB - NO MOSTRAR STOCK
  ocultar: [91, 802, 900, 902, 903], // Z_No_Disponible91, Venta X Mayor_802, DETALLES_900, RECLAMO_902, DESCARTE_903
} as const;

// Días de compra esperados por marca
export const DIAS_COMPRA_POR_MARCA: Record<string, number> = {
  'Adidas': 90,  // Quarter
  'default': 180, // Estándar
};

// Umbrales de clasificación
export const UMBRALES = {
  diasSlowMover: 180,    // Excede plazo estándar
  diasClavo: 365,        // Más de 1 año
  stockMinimoLiquidacion: 30, // <30 por BaseCol = SALDO
  diasAlertaReabastecimiento: 4, // Sin venta en tienda >4 días
  semanasMinimosData: 3, // Mínimo 3 semanas de data para clasificar desempeño
  factorRecuperable: 2,  // SLOW si WeeksToClear < WeeksRemaining * 2, sino CLAVO
} as const;

// ============================================
// VENTANA COMERCIAL POR MARCA (para calcular WeeksRemaining)
// ============================================

export interface VentanaComercial {
  marca: string;
  weeksTotal: number; // Semanas totales de la temporada
  descripcion: string;
}

// Semanas de ciclo de venta por marca
export const SEMANAS_CICLO_POR_MARCA: Record<string, number> = {
  'Adidas': 13,    // Quarter (13 semanas)
  'default': 26,   // Semestre (26 semanas)
};

export function getSemanaCiclo(marca: string): number {
  return SEMANAS_CICLO_POR_MARCA[marca] || SEMANAS_CICLO_POR_MARCA['default'];
}

// ============================================
// TIPOS DE ESTADO DE PRODUCTO (DOS DIMENSIONES)
// ============================================

// Dimensión A: Desempeño de Venta (basado en WeeksToClear vs WeeksRemaining)
export type SalesPerformance = 'FAST_MOVER' | 'OK' | 'SLOW_MOVER' | 'CLAVO' | 'SIN_DATOS';

// Alias para retrocompatibilidad
export type ProductoEstado = SalesPerformance;

// Dimensión B: Estado de Stock
export type StockStatus = 'ACTIVO' | 'SALDO_BAJO_STOCK' | 'SALDO_ARRASTRE';

export interface ProductStatusInfo {
  estado: ProductoEstado;
  label: string;
  color: 'emerald' | 'blue' | 'amber' | 'red' | 'gray';
  icon: 'Rocket' | 'CheckCircle' | 'Turtle' | 'Flame' | 'HelpCircle';
  descripcion: string;
}

export const PRODUCT_STATUS_CONFIG: Record<ProductoEstado, Omit<ProductStatusInfo, 'estado'>> = {
  FAST_MOVER: {
    label: 'Fast',
    color: 'emerald',
    icon: 'Rocket',
    descripcion: 'Vende antes de lo esperado. Sin acción requerida.',
  },
  OK: {
    label: 'OK',
    color: 'blue',
    icon: 'CheckCircle',
    descripcion: 'Dentro del ritmo esperado. Monitorear.',
  },
  SLOW_MOVER: {
    label: 'Slow',
    color: 'amber',
    icon: 'Turtle',
    descripcion: 'Por debajo del ritmo esperado. Considerar promoción.',
  },
  CLAVO: {
    label: 'Burn',
    color: 'red',
    icon: 'Flame',
    descripcion: 'No alcanzará sell-out en la temporada. Requiere liquidación.',
  },
  SIN_DATOS: {
    label: '?',
    color: 'gray',
    icon: 'HelpCircle',
    descripcion: 'Menos de 3 semanas de datos para clasificar.',
  },
};

// Configuración visual para Estado de Stock (Dimensión B)
export interface StockStatusInfo {
  status: StockStatus;
  label: string;
  color: 'blue' | 'purple' | 'orange';
  icon: 'Package' | 'Archive' | 'AlertTriangle';
  descripcion: string;
}

export const STOCK_STATUS_CONFIG: Record<StockStatus, Omit<StockStatusInfo, 'status'>> = {
  ACTIVO: {
    label: 'Activo',
    color: 'blue',
    icon: 'Package',
    descripcion: 'Stock normal en circulación',
  },
  SALDO_BAJO_STOCK: {
    label: 'Saldo',
    color: 'purple',
    icon: 'Archive',
    descripcion: 'Stock residual (<30 unidades)',
  },
  SALDO_ARRASTRE: {
    label: 'Arrastre',
    color: 'orange',
    icon: 'AlertTriangle',
    descripcion: 'Fuera de temporada con stock relevante. Evaluar descuento.',
  },
};

// ============================================
// DATOS DE PRODUCTO PARA CLASIFICACIÓN
// ============================================

export interface ProductoParaClasificar {
  BaseCol: string;
  DescripcionMarca?: string;
  marca: string;
  stockActual: number;
  unidadesVendidas: number;
  diasDesde1raVentaUltimaCompra: number;
  fechaPrimeraVentaUltimaCompra?: Date | null;
  fechaUltimaCompra?: Date | null;
  // Carryover: producto con ventas antes de la última compra (se vende todo el año)
  esCarryover?: boolean;
}

export interface ProductoClasificado extends ProductoParaClasificar {
  // Métricas calculadas (días - legacy)
  paresPorDia: number | null;
  diasParaVenderStock: number | null;
  diasCompraEsperados: number;
  diasRestantesEsperados: number;

  // Métricas calculadas (semanas - nueva lógica)
  weeksToClear: number | null;    // Semanas para agotar stock
  weeksRemaining: number;         // Semanas hasta fin de temporada
  ventasPromedioSemanal: number | null; // Ventas promedio por semana
  semanasTranscurridas: number;   // Semanas desde primera venta

  // Dimensión A: Desempeño de Venta
  estado: ProductoEstado; // alias de salesPerformance para retrocompatibilidad
  salesPerformance: SalesPerformance;
  statusInfo: ProductStatusInfo;

  // Dimensión B: Estado de Stock
  stockStatus: StockStatus;
  stockStatusInfo: StockStatusInfo;

  // Legacy - mantener para compatibilidad
  esSaldo: boolean; // stock < 30 (ahora usar stockStatus === 'SALDO_BAJO_STOCK')
}

// ============================================
// SELL OUT POR MARCA
// ============================================

export interface SellOutByBrand {
  idMarca: number;
  descripcionMarca: string;
  totalUnidades: number;
  totalVenta: number;
  totalStock: number;
  cantidadProductos: number;
  cantidadFastMovers: number;
  cantidadOK: number;
  cantidadSlowMovers: number;
  cantidadClavos: number;
  porcentajeSlowMovers: number;
  rotacionPromedio: number;
}

export interface SellOutByProduct {
  BaseCol: string;
  descripcionMarca: string;
  descripcionCorta: string;
  unidadesVendidas: number;
  ventaTotal: number;
  stockTotal: number;
  paresPorDia: number | null;
  diasStock: number | null;
  diasSinVenta: number;
  rotacion: number | null;

  // Dimensión A: Desempeño de Venta
  estado: ProductoEstado;
  salesPerformance: SalesPerformance;
  statusInfo: ProductStatusInfo;

  // Dimensión B: Estado de Stock
  stockStatus: StockStatus;
  stockStatusInfo: StockStatusInfo;

  // Métricas de semanas (nueva lógica)
  weeksToClear: number | null;
  weeksRemaining: number;
  ventasPromedioSemanal: number | null;

  // Tipo de producto
  esCarryover?: boolean;        // Producto que se vende todo el año
  primeraVentaGlobal?: Date | string | null; // Primera venta en toda la historia

  // Legacy
  esSaldo: boolean;
  pvp: number | null;
  ultimoCosto: number | null;
}

// ============================================
// INCIDENCIAS PARA EL DIRECTOR
// ============================================

export type TipoIncidencia = 'REABASTECIMIENTO' | 'SLOW_MOVER_CRITICO' | 'CLAVO_DETECTADO' | 'STOCK_DESBALANCEADO';

export type EstadoIncidencia = 'PENDIENTE' | 'APROBADA' | 'IGNORADA' | 'IMPLEMENTADA';

export interface Incidencia {
  id: string;
  tipo: TipoIncidencia;
  titulo: string;
  mensaje: string;
  severidad: 'baja' | 'media' | 'alta' | 'critica';
  fechaDeteccion: Date;
  estado: EstadoIncidencia;
  // Datos específicos según tipo
  datos: IncidenciaReabastecimiento | IncidenciaSlowMover | IncidenciaClavo;
  // Acción sugerida
  accionSugerida?: {
    tipo: string;
    descripcion: string;
    parametros?: Record<string, unknown>;
  };
  // Tracking
  procesadaPor?: string;
  fechaProcesada?: Date;
  comentario?: string;
}

export interface IncidenciaReabastecimiento {
  BaseCol: string;
  descripcionProducto: string;
  stockCentral: number;
  tiendaId: number;
  tiendaNombre: string;
  stockTienda: number; // siempre 0 para este tipo
  diasDesdeUltimaVenta: number;
  cantidadSugerida: number;
}

export interface IncidenciaSlowMover {
  BaseCol: string;
  descripcionProducto: string;
  stockActual: number;
  paresPorDia: number;
  diasParaVender: number;
  diasExcedido: number;
}

export interface IncidenciaClavo {
  BaseCol: string;
  descripcionProducto: string;
  stockActual: number;
  diasSinMovimiento: number;
  valorInventario: number;
  sugerenciaLiquidacion: {
    descuentoSugerido: number;
    precioLiquidacion: number;
  };
}

// ============================================
// RESPUESTAS DE API
// ============================================

export interface SellOutResponse {
  byBrand: SellOutByBrand[];
  byProduct: SellOutByProduct[];
  resumen: {
    totalProductos: number;
    totalFastMovers: number;
    totalOK: number;
    totalSlowMovers: number;
    totalClavos: number;
    totalSaldos: number;
    valorInventarioSlowMovers: number;
    valorInventarioClavos: number;
  };
}

export interface IncidenciasResponse {
  incidencias: Incidencia[];
  resumen: {
    total: number;
    pendientes: number;
    porTipo: Record<TipoIncidencia, number>;
    porSeveridad: Record<string, number>;
  };
}

// ============================================
// DATOS COMPARATIVOS PARA TABLAS
// ============================================

export interface DatoComparativo {
  actual: number;
  anterior: number;
  variacion: number; // porcentaje
  esPositivo: boolean;
}

export interface FilaTablaComparativa {
  id: string | number;
  etiqueta: string;
  unidades: DatoComparativo;
  ventas: DatoComparativo;
  participacion?: number;
}

// ============================================
// TABLA UNIFICADA STOCK + VENTAS POR TALLA
// ============================================

export interface TallaDato {
  talla: string;
  stock: number;
  ventas: number;
}

export interface FilaTallaUnificada {
  tiendaId: number;
  tiendaNombre: string;
  esCentral: boolean;
  esOutlet: boolean;
  tallas: Record<string, { stock: number; ventas: number }>;
  totalStock: number;
  totalVentas: number;
  // Para alertas de reabastecimiento
  alertasReabastecimiento: string[]; // tallas con stock 0 y hay stock en central
}

export interface TablaUnificadaTallasData {
  tallas: string[]; // Lista ordenada de tallas
  stockPorTienda: FilaTallaUnificada[];
  ventasPorTienda: FilaTallaUnificada[];
  totalesStock: Record<string, number>;
  totalesVentas: Record<string, number>;
  stockCentral: Record<string, number>; // Para detectar alertas
}
