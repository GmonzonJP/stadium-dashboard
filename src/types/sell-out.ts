// ============================================
// TIPOS PARA ANÁLISIS SELL OUT Y CLASIFICACIÓN DE PRODUCTOS
// ============================================

// Configuración de depósitos
export const DEPOSITOS_CONFIG = {
  central: [99, 999],
  outlet: [31, 32],
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
} as const;

// ============================================
// TIPOS DE ESTADO DE PRODUCTO
// ============================================

export type ProductoEstado = 'FAST_MOVER' | 'OK' | 'SLOW_MOVER' | 'CLAVO' | 'SIN_DATOS';

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
    descripcion: 'Termina antes del plazo esperado',
  },
  OK: {
    label: 'OK',
    color: 'blue',
    icon: 'CheckCircle',
    descripcion: 'En ritmo esperado',
  },
  SLOW_MOVER: {
    label: 'Slow',
    color: 'amber',
    icon: 'Turtle',
    descripcion: 'Excede el plazo de venta (180 días)',
  },
  CLAVO: {
    label: 'Burn',
    color: 'red',
    icon: 'Flame',
    descripcion: 'Excede 1 año, hay que liquidar',
  },
  SIN_DATOS: {
    label: '?',
    color: 'gray',
    icon: 'HelpCircle',
    descripcion: 'Sin datos suficientes para clasificar',
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
}

export interface ProductoClasificado extends ProductoParaClasificar {
  paresPorDia: number | null;
  diasParaVenderStock: number | null;
  diasCompraEsperados: number;
  diasRestantesEsperados: number;
  estado: ProductoEstado;
  statusInfo: ProductStatusInfo;
  esSaldo: boolean; // stock < 30
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
  estado: ProductoEstado;
  statusInfo: ProductStatusInfo;
  esSaldo: boolean;
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
