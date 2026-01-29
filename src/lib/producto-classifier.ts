// ============================================
// CLASIFICADOR DE PRODUCTOS: Fast/OK/Slow/Burn
// ============================================
// Lógica de negocio para clasificar productos según su velocidad de venta
// respecto a los días de compra esperados.

import {
  ProductoParaClasificar,
  ProductoClasificado,
  ProductoEstado,
  ProductStatusInfo,
  PRODUCT_STATUS_CONFIG,
  DIAS_COMPRA_POR_MARCA,
  UMBRALES,
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

/**
 * Clasifica un producto según su velocidad de venta
 *
 * Fórmula:
 * - diasRestantesEsperados = diasCompraEsperados - diasTranscurridos
 * - diasParaVenderStock = stockActual / paresPorDia
 *
 * Clasificación:
 * - FAST_MOVER: diasParaVender < diasRestantes * 0.5 (termina mucho antes)
 * - OK: diasParaVender <= diasRestantes (en tiempo)
 * - SLOW_MOVER: diasParaVender > diasRestantes pero <= 365
 * - CLAVO: diasParaVender > 365 días
 */
export function clasificarProducto(
  producto: ProductoParaClasificar
): ProductoEstado {
  const { stockActual, unidadesVendidas, diasDesde1raVentaUltimaCompra, marca } = producto;

  // Si no hay datos suficientes
  if (
    stockActual <= 0 ||
    unidadesVendidas <= 0 ||
    diasDesde1raVentaUltimaCompra <= 0
  ) {
    return 'SIN_DATOS';
  }

  const diasCompraEsperados = getDiasCompraEsperados(marca);
  const paresPorDia = calcularParesPorDia(unidadesVendidas, diasDesde1raVentaUltimaCompra);

  if (paresPorDia === null || paresPorDia <= 0) {
    return 'SIN_DATOS';
  }

  const diasParaVenderStock = calcularDiasParaVenderStock(stockActual, paresPorDia);

  if (diasParaVenderStock === null) {
    return 'SIN_DATOS';
  }

  const diasRestantesEsperados = Math.max(0, diasCompraEsperados - diasDesde1raVentaUltimaCompra);

  // CLAVO: Más de 1 año para vender
  if (diasParaVenderStock > UMBRALES.diasClavo) {
    return 'CLAVO';
  }

  // SLOW_MOVER: Excede el plazo pero menos de 1 año
  if (diasParaVenderStock > diasRestantesEsperados) {
    return 'SLOW_MOVER';
  }

  // FAST_MOVER: Termina mucho antes (menos de la mitad del tiempo restante)
  if (diasParaVenderStock < diasRestantesEsperados * 0.5 && diasRestantesEsperados > 0) {
    return 'FAST_MOVER';
  }

  // OK: En ritmo esperado
  return 'OK';
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
 */
export function clasificarProductoCompleto(
  producto: ProductoParaClasificar
): ProductoClasificado {
  const { stockActual, unidadesVendidas, diasDesde1raVentaUltimaCompra, marca } = producto;

  const diasCompraEsperados = getDiasCompraEsperados(marca);
  const paresPorDia = calcularParesPorDia(unidadesVendidas, diasDesde1raVentaUltimaCompra);
  const diasParaVenderStock = calcularDiasParaVenderStock(stockActual, paresPorDia);
  const diasRestantesEsperados = Math.max(0, diasCompraEsperados - diasDesde1raVentaUltimaCompra);

  const estado = clasificarProducto(producto);
  const statusInfo = getProductStatusInfo(estado);
  const productoEsSaldo = esSaldo(stockActual);

  return {
    ...producto,
    paresPorDia,
    diasParaVenderStock,
    diasCompraEsperados,
    diasRestantesEsperados,
    estado,
    statusInfo,
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
