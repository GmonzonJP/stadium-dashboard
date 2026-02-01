// ============================================
// CLASIFICADOR DE PRODUCTOS: Fast/OK/Slow/Burn
// ============================================
// Lógica de negocio para clasificar productos según su velocidad de venta
// respecto a los días de compra esperados.

import {
  ProductoParaClasificar,
  ProductoClasificado,
  ProductoEstado,
  SalesPerformance,
  StockStatus,
  ProductStatusInfo,
  StockStatusInfo,
  PRODUCT_STATUS_CONFIG,
  STOCK_STATUS_CONFIG,
  DIAS_COMPRA_POR_MARCA,
  UMBRALES,
  getSemanaCiclo,
} from '@/types/sell-out';

/**
 * Obtiene los días de compra esperados según la marca
 * Adidas = 90 días (quarter), resto = 180 días
 */
export function getDiasCompraEsperados(marca: string): number {
  const marcaNormalizada = marca?.trim().toLowerCase() || '';

  for (const [key, dias] of Object.entries(DIAS_COMPRA_POR_MARCA)) {
    if (key.toLowerCase() === marcaNormalizada) {
      return dias;
    }
  }

  return DIAS_COMPRA_POR_MARCA['default'];
}

/**
 * Calcula los pares vendidos por día
 */
export function calcularParesPorDia(
  unidadesVendidas: number,
  diasDesde1raVenta: number
): number | null {
  if (diasDesde1raVenta <= 0 || unidadesVendidas < 0) {
    return null;
  }
  return unidadesVendidas / diasDesde1raVenta;
}

/**
 * Calcula cuántos días se necesitan para vender el stock actual
 * al ritmo actual de ventas
 */
export function calcularDiasParaVenderStock(
  stockActual: number,
  paresPorDia: number | null
): number | null {
  if (paresPorDia === null || paresPorDia <= 0 || stockActual < 0) {
    return null;
  }
  return stockActual / paresPorDia;
}

// ============================================
// NUEVA LÓGICA BASADA EN SEMANAS
// ============================================

/**
 * Calcula las ventas promedio semanales
 */
export function calcularVentasPromedioSemanal(
  unidadesVendidas: number,
  diasTranscurridos: number
): number | null {
  if (diasTranscurridos <= 0 || unidadesVendidas < 0) {
    return null;
  }
  const semanasTranscurridas = diasTranscurridos / 7;
  if (semanasTranscurridas <= 0) return null;
  return unidadesVendidas / semanasTranscurridas;
}

/**
 * Calcula cuántas semanas se necesitan para agotar el stock actual
 * WeeksToClear = StockActual / VentasPromedioSemanales
 */
export function calcularWeeksToClear(
  stockActual: number,
  ventasPromedioSemanal: number | null
): number | null {
  if (ventasPromedioSemanal === null || ventasPromedioSemanal <= 0 || stockActual < 0) {
    return null;
  }
  return stockActual / ventasPromedioSemanal;
}

/**
 * Calcula cuántas semanas quedan hasta el fin de la temporada/ciclo
 * WeeksRemaining = SemanaCiclo - SemanasTranscurridas
 */
export function calcularWeeksRemaining(
  diasTranscurridos: number,
  semanaCicloMarca: number
): number {
  const semanasTranscurridas = diasTranscurridos / 7;
  return Math.max(0, semanaCicloMarca - semanasTranscurridas);
}

/**
 * Obtiene la información completa de estado de stock
 */
export function getStockStatusInfo(status: StockStatus): StockStatusInfo {
  return {
    status,
    ...STOCK_STATUS_CONFIG[status],
  };
}

/**
 * Clasifica el estado de stock de un producto (Dimensión B)
 * - ACTIVO: stock >= 30 Y weeksRemaining > 0
 * - SALDO_BAJO_STOCK: stock < 30 unidades
 * - SALDO_ARRASTRE: stock >= 30 Y weeksRemaining <= 0 (fuera de temporada)
 */
export function clasificarEstadoStock(
  stockActual: number,
  weeksRemaining: number
): StockStatus {
  // Saldo por bajo stock: menos de 30 unidades
  if (stockActual < UMBRALES.stockMinimoLiquidacion) {
    return 'SALDO_BAJO_STOCK';
  }
  // Saldo por arrastre: fuera de temporada pero con stock relevante
  if (weeksRemaining <= 0) {
    return 'SALDO_ARRASTRE';
  }
  // Stock activo normal
  return 'ACTIVO';
}

/**
 * Clasificación de desempeño de venta (Dimensión A)
 *
 * Lógica simplificada basada en días de stock (más intuitiva para usuarios):
 * - FAST_MOVER: Venderá en < 60 días (2 meses)
 * - OK: Venderá en 60-120 días (2-4 meses)
 * - SLOW_MOVER: Venderá en 120-180 días (4-6 meses)
 * - CLAVO: Venderá en > 180 días (más de 6 meses) o sin ventas
 * - SIN_DATOS: Menos de 3 semanas de historial
 */
export function clasificarDesempenoVenta(
  stockActual: number,
  unidadesVendidas: number,
  diasTranscurridos: number,
  marca: string
): SalesPerformance {
  // Validaciones básicas
  if (stockActual <= 0) {
    return 'SIN_DATOS'; // Sin stock, nada que clasificar
  }

  const semanasTranscurridas = diasTranscurridos / 7;

  // Si no hay suficientes semanas de data, no clasificar
  if (semanasTranscurridas < UMBRALES.semanasMinimosData) {
    return 'SIN_DATOS';
  }

  // Si no hay ventas después de 3+ semanas, es CLAVO
  if (unidadesVendidas <= 0) {
    return 'CLAVO';
  }

  // Calcular días para vender el stock (más intuitivo que semanas)
  const paresPorDia = unidadesVendidas / diasTranscurridos;
  const diasParaVenderStock = paresPorDia > 0 ? stockActual / paresPorDia : null;

  if (diasParaVenderStock === null) {
    return 'SIN_DATOS';
  }

  // Clasificación basada en días de stock (umbrales absolutos)
  // Estos valores son más intuitivos para el usuario
  if (diasParaVenderStock < 60) {
    return 'FAST_MOVER'; // Venderá en menos de 2 meses
  } else if (diasParaVenderStock < 120) {
    return 'OK'; // Venderá en 2-4 meses
  } else if (diasParaVenderStock < 180) {
    return 'SLOW_MOVER'; // Venderá en 4-6 meses
  } else {
    return 'CLAVO'; // Más de 6 meses para vender
  }
}

/**
 * Clasifica un producto según su velocidad de venta
 * NUEVA LÓGICA: Usa semanas (WeeksToClear vs WeeksRemaining)
 *
 * Clasificación:
 * - SIN_DATOS: menos de 3 semanas de historial
 * - FAST_MOVER: WeeksToClear < WeeksRemaining × 0.5 (termina mucho antes)
 * - OK: WeeksToClear ≤ WeeksRemaining (en tiempo)
 * - SLOW_MOVER: WeeksToClear > WeeksRemaining (recuperable con promoción)
 * - CLAVO: WeeksToClear >= WeeksRemaining × 2 (no alcanzará sell-out)
 */
export function clasificarProducto(
  producto: ProductoParaClasificar
): ProductoEstado {
  const { stockActual, unidadesVendidas, diasDesde1raVentaUltimaCompra, marca } = producto;

  // Usar la nueva función de clasificación basada en semanas
  return clasificarDesempenoVenta(
    stockActual,
    unidadesVendidas,
    diasDesde1raVentaUltimaCompra,
    marca
  );
}

/**
 * Obtiene la información completa de estado para un producto
 */
export function getProductStatusInfo(estado: ProductoEstado): ProductStatusInfo {
  return {
    estado,
    ...PRODUCT_STATUS_CONFIG[estado],
  };
}

/**
 * Determina si un producto es "saldo" (stock < 30 unidades por BaseCol)
 */
export function esSaldo(stockTotal: number): boolean {
  return stockTotal < UMBRALES.stockMinimoLiquidacion;
}

/**
 * Clasificación completa de un producto con todos los datos calculados
 * Ahora incluye ambas dimensiones: Desempeño de Venta + Estado de Stock
 */
export function clasificarProductoCompleto(
  producto: ProductoParaClasificar
): ProductoClasificado {
  const { stockActual, unidadesVendidas, diasDesde1raVentaUltimaCompra, marca } = producto;

  // Métricas legacy (días)
  const diasCompraEsperados = getDiasCompraEsperados(marca);
  const paresPorDia = calcularParesPorDia(unidadesVendidas, diasDesde1raVentaUltimaCompra);
  const diasParaVenderStock = calcularDiasParaVenderStock(stockActual, paresPorDia);
  const diasRestantesEsperados = Math.max(0, diasCompraEsperados - diasDesde1raVentaUltimaCompra);

  // Métricas nuevas (semanas)
  const semanaCiclo = getSemanaCiclo(marca);
  const semanasTranscurridas = diasDesde1raVentaUltimaCompra / 7;
  const ventasPromedioSemanal = calcularVentasPromedioSemanal(unidadesVendidas, diasDesde1raVentaUltimaCompra);
  const weeksToClear = calcularWeeksToClear(stockActual, ventasPromedioSemanal);
  const weeksRemaining = calcularWeeksRemaining(diasDesde1raVentaUltimaCompra, semanaCiclo);

  // Dimensión A: Desempeño de Venta (nueva lógica basada en semanas)
  const salesPerformance = clasificarDesempenoVenta(
    stockActual,
    unidadesVendidas,
    diasDesde1raVentaUltimaCompra,
    marca
  );
  const statusInfo = getProductStatusInfo(salesPerformance);

  // Dimensión B: Estado de Stock
  const stockStatus = clasificarEstadoStock(stockActual, weeksRemaining);
  const stockStatusInfo = getStockStatusInfo(stockStatus);

  // Legacy: esSaldo se mantiene para compatibilidad
  const productoEsSaldo = esSaldo(stockActual);

  return {
    ...producto,
    // Métricas legacy (días)
    paresPorDia,
    diasParaVenderStock,
    diasCompraEsperados,
    diasRestantesEsperados,

    // Métricas nuevas (semanas)
    weeksToClear,
    weeksRemaining,
    ventasPromedioSemanal,
    semanasTranscurridas,

    // Dimensión A: Desempeño de Venta
    estado: salesPerformance, // alias para retrocompatibilidad
    salesPerformance,
    statusInfo,

    // Dimensión B: Estado de Stock
    stockStatus,
    stockStatusInfo,

    // Legacy
    esSaldo: productoEsSaldo,
  };
}

/**
 * Clasifica múltiples productos y retorna estadísticas
 */
export function clasificarProductos(
  productos: ProductoParaClasificar[]
): {
  clasificados: ProductoClasificado[];
  estadisticas: {
    total: number;
    fastMovers: number;
    ok: number;
    slowMovers: number;
    clavos: number;
    sinDatos: number;
    saldos: number;
  };
} {
  const clasificados = productos.map(clasificarProductoCompleto);

  const estadisticas = {
    total: clasificados.length,
    fastMovers: clasificados.filter(p => p.estado === 'FAST_MOVER').length,
    ok: clasificados.filter(p => p.estado === 'OK').length,
    slowMovers: clasificados.filter(p => p.estado === 'SLOW_MOVER').length,
    clavos: clasificados.filter(p => p.estado === 'CLAVO').length,
    sinDatos: clasificados.filter(p => p.estado === 'SIN_DATOS').length,
    saldos: clasificados.filter(p => p.esSaldo).length,
  };

  return { clasificados, estadisticas };
}

/**
 * Filtra productos por estado
 */
export function filtrarPorEstado(
  productos: ProductoClasificado[],
  estados: ProductoEstado[]
): ProductoClasificado[] {
  return productos.filter(p => estados.includes(p.estado));
}

/**
 * Obtiene solo los slow movers (incluye SLOW_MOVER y CLAVO)
 */
export function getSlowMovers(
  productos: ProductoClasificado[]
): ProductoClasificado[] {
  return filtrarPorEstado(productos, ['SLOW_MOVER', 'CLAVO']);
}

/**
 * Obtiene solo los clavos (para liquidación urgente)
 */
export function getClavos(
  productos: ProductoClasificado[]
): ProductoClasificado[] {
  return filtrarPorEstado(productos, ['CLAVO']);
}

/**
 * Calcula el valor de inventario de los slow movers
 */
export function calcularValorInventarioSlowMovers(
  productos: ProductoClasificado[],
  costosPorProducto: Record<string, number>
): number {
  const slowMovers = getSlowMovers(productos);

  return slowMovers.reduce((total, producto) => {
    const costo = costosPorProducto[producto.BaseCol] || 0;
    return total + (producto.stockActual * costo);
  }, 0);
}

/**
 * Ordena productos por prioridad de atención
 * 1. Clavos (más urgente)
 * 2. Slow Movers con más stock
 * 3. Slow Movers con menos stock
 */
export function ordenarPorPrioridad(
  productos: ProductoClasificado[]
): ProductoClasificado[] {
  return [...productos].sort((a, b) => {
    // Primero por estado (CLAVO > SLOW_MOVER > resto)
    const prioridadEstado: Record<ProductoEstado, number> = {
      CLAVO: 0,
      SLOW_MOVER: 1,
      SIN_DATOS: 2,
      OK: 3,
      FAST_MOVER: 4,
    };

    const diffEstado = prioridadEstado[a.estado] - prioridadEstado[b.estado];
    if (diffEstado !== 0) return diffEstado;

    // Luego por días para vender (más días = más urgente)
    const diasA = a.diasParaVenderStock ?? 0;
    const diasB = b.diasParaVenderStock ?? 0;
    if (diasA !== diasB) return diasB - diasA;

    // Finalmente por stock (más stock = más urgente)
    return b.stockActual - a.stockActual;
  });
}
