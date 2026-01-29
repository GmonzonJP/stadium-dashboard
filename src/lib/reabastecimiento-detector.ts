// ============================================
// DETECTOR DE ERRORES DE REABASTECIMIENTO
// ============================================
// Identifica productos que necesitan ser enviados desde Central a tiendas
// Condición: Stock en central > 0, stock en tienda = 0, última venta > 4 días

import {
  DEPOSITOS_CONFIG,
  UMBRALES,
  Incidencia,
  IncidenciaReabastecimiento,
} from '@/types/sell-out';

// ============================================
// TIPOS INTERNOS
// ============================================

export interface StockPorDeposito {
  BaseCol: string;
  descripcionProducto: string;
  descripcionMarca: string;
  idDeposito: number;
  nombreDeposito: string;
  stockTotal: number;
  ultimaVentaFecha: Date | null;
  diasDesdeUltimaVenta: number | null;
}

export interface AlertaReabastecimiento {
  BaseCol: string;
  descripcionProducto: string;
  descripcionMarca: string;
  stockCentral: number;
  tiendaId: number;
  tiendaNombre: string;
  stockTienda: number;
  diasDesdeUltimaVenta: number;
  severidad: 'media' | 'alta' | 'critica';
  cantidadSugerida: number;
}

// ============================================
// FUNCIONES DE DETECCIÓN
// ============================================

export function esCentral(idDeposito: number): boolean {
  return (DEPOSITOS_CONFIG.central as readonly number[]).includes(idDeposito);
}

export function esOutlet(idDeposito: number): boolean {
  return (DEPOSITOS_CONFIG.outlet as readonly number[]).includes(idDeposito);
}

export function esTiendaRegular(idDeposito: number): boolean {
  return !esCentral(idDeposito) && !esOutlet(idDeposito);
}

export function calcularSeveridad(
  diasDesdeUltimaVenta: number
): 'media' | 'alta' | 'critica' {
  if (diasDesdeUltimaVenta > 10) return 'critica';
  if (diasDesdeUltimaVenta > 7) return 'alta';
  return 'media';
}

export function calcularCantidadSugerida(
  stockCentral: number,
  ventasPromedioDiarias: number,
  diasReposicion: number = 30
): number {
  if (!ventasPromedioDiarias || ventasPromedioDiarias <= 0) {
    return Math.min(5, stockCentral);
  }
  const cantidadIdeal = Math.ceil(ventasPromedioDiarias * diasReposicion);
  return Math.min(cantidadIdeal, stockCentral);
}

export function detectarAlertasReabastecimiento(
  stockPorDeposito: StockPorDeposito[],
  ventasPromediosPorTienda?: Map<string, Map<number, number>>
): AlertaReabastecimiento[] {
  const alertas: AlertaReabastecimiento[] = [];
  const productosMap = new Map<string, StockPorDeposito[]>();

  for (const item of stockPorDeposito) {
    const existing = productosMap.get(item.BaseCol) || [];
    existing.push(item);
    productosMap.set(item.BaseCol, existing);
  }

  for (const [baseCol, depositos] of Array.from(productosMap.entries())) {
    const centrales = depositos.filter(d => esCentral(d.idDeposito));
    const stockCentral = centrales.reduce((sum, d) => sum + d.stockTotal, 0);
    if (stockCentral <= 0) continue;

    const tiendasConProblema = depositos.filter(d =>
      esTiendaRegular(d.idDeposito) &&
      d.stockTotal === 0 &&
      d.diasDesdeUltimaVenta !== null &&
      d.diasDesdeUltimaVenta > UMBRALES.diasAlertaReabastecimiento
    );

    for (const tienda of tiendasConProblema) {
      const ventasPromedio = ventasPromediosPorTienda?.get(baseCol)?.get(tienda.idDeposito) ?? 0;
      const cantidadSugerida = calcularCantidadSugerida(stockCentral, ventasPromedio);

      alertas.push({
        BaseCol: baseCol,
        descripcionProducto: tienda.descripcionProducto,
        descripcionMarca: tienda.descripcionMarca,
        stockCentral,
        tiendaId: tienda.idDeposito,
        tiendaNombre: tienda.nombreDeposito,
        stockTienda: 0,
        diasDesdeUltimaVenta: tienda.diasDesdeUltimaVenta!,
        severidad: calcularSeveridad(tienda.diasDesdeUltimaVenta!),
        cantidadSugerida,
      });
    }
  }

  return alertas.sort((a, b) => {
    const severidadOrder = { critica: 0, alta: 1, media: 2 };
    const diffSeveridad = severidadOrder[a.severidad] - severidadOrder[b.severidad];
    if (diffSeveridad !== 0) return diffSeveridad;
    return b.diasDesdeUltimaVenta - a.diasDesdeUltimaVenta;
  });
}

export function alertasAIncidencias(alertas: AlertaReabastecimiento[]): Incidencia[] {
  return alertas.map((alerta, index) => {
    const datos: IncidenciaReabastecimiento = {
      BaseCol: alerta.BaseCol,
      descripcionProducto: alerta.descripcionProducto,
      stockCentral: alerta.stockCentral,
      tiendaId: alerta.tiendaId,
      tiendaNombre: alerta.tiendaNombre,
      stockTienda: 0,
      diasDesdeUltimaVenta: alerta.diasDesdeUltimaVenta,
      cantidadSugerida: alerta.cantidadSugerida,
    };

    return {
      id: `REAB-${alerta.BaseCol}-${alerta.tiendaId}-${Date.now()}-${index}`,
      tipo: 'REABASTECIMIENTO' as const,
      titulo: `Reabastecimiento: ${alerta.descripcionMarca} en ${alerta.tiendaNombre}`,
      mensaje: `${alerta.descripcionProducto} tiene stock en Central (${alerta.stockCentral} un.) pero ${alerta.tiendaNombre} está en 0 y vendió hace ${alerta.diasDesdeUltimaVenta} días.`,
      severidad: alerta.severidad,
      fechaDeteccion: new Date(),
      estado: 'PENDIENTE' as const,
      datos,
      accionSugerida: {
        tipo: 'ENVIAR_STOCK',
        descripcion: `Enviar ${alerta.cantidadSugerida} unidades desde Central a ${alerta.tiendaNombre}`,
        parametros: {
          cantidad: alerta.cantidadSugerida,
          origen: 'Central',
          destino: alerta.tiendaNombre,
          destinoId: alerta.tiendaId,
        },
      },
    };
  });
}

export function detectarCeldasRojas(
  stockPorTallaTienda: Map<string, Map<number, number>>,
  stockCentralPorTalla: Map<string, number>
): Map<string, Set<number>> {
  const celdasRojas = new Map<string, Set<number>>();

  for (const [talla, tiendas] of Array.from(stockPorTallaTienda.entries())) {
    const stockEnCentral = stockCentralPorTalla.get(talla) ?? 0;
    if (stockEnCentral > 0) {
      const tiendasRojas = new Set<number>();
      for (const [tiendaId, stock] of Array.from(tiendas.entries())) {
        if (stock === 0 && esTiendaRegular(tiendaId)) {
          tiendasRojas.add(tiendaId);
        }
      }
      if (tiendasRojas.size > 0) {
        celdasRojas.set(talla, tiendasRojas);
      }
    }
  }
  return celdasRojas;
}

export function generarResumenAlertas(alertas: AlertaReabastecimiento[]) {
  const porSeveridad = { critica: 0, alta: 0, media: 0 };
  const porTienda = new Map<number, number>();
  const productosSet = new Set<string>();
  let stockPendienteEnvio = 0;

  for (const alerta of alertas) {
    porSeveridad[alerta.severidad]++;
    porTienda.set(alerta.tiendaId, (porTienda.get(alerta.tiendaId) ?? 0) + 1);
    productosSet.add(alerta.BaseCol);
    stockPendienteEnvio += alerta.cantidadSugerida;
  }

  return {
    totalAlertas: alertas.length,
    porSeveridad,
    porTienda,
    productosAfectados: productosSet.size,
    stockPendienteEnvio,
  };
}
