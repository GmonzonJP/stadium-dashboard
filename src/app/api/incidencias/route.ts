import { NextRequest, NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';
import {
  detectarAlertasReabastecimiento,
  alertasAIncidencias,
  StockPorDeposito,
} from '@/lib/reabastecimiento-detector';
import {
  clasificarProductoCompleto,
  getClavos,
} from '@/lib/producto-classifier';
import {
  Incidencia,
  IncidenciasResponse,
  TipoIncidencia,
  DEPOSITOS_CONFIG,
  UMBRALES,
  ProductoParaClasificar,
  IncidenciaClavo,
} from '@/types/sell-out';

export async function POST(request: NextRequest) {
  try {
    const pool = await getDbConnection();
    const incidencias: Incidencia[] = [];

    // =============================================
    // 1. DETECTAR ERRORES DE REABASTECIMIENTO
    // =============================================
    const reabastecimientoQuery = `
      WITH StockPorDeposito AS (
        SELECT
          LEFT(M.IdArticulo, LEN(M.IdArticulo) - 2) as BaseCol,
          M.idDeposito,
          SUM(M.TotalStock) as StockTotal
        FROM MovStockTotalResumen M
        GROUP BY LEFT(M.IdArticulo, LEN(M.IdArticulo) - 2), M.idDeposito
      ),
      ProductoInfo AS (
        SELECT DISTINCT
          T.BaseCol,
          T.DescripcionMarca,
          T.DescripcionArticulo as DescripcionCorta
        FROM Transacciones T
        WHERE T.Fecha >= DATEADD(YEAR, -1, GETDATE())
      ),
      UltimaVentaPorTienda AS (
        SELECT
          T.BaseCol,
          T.IdDeposito,
          MAX(T.Fecha) as UltimaVentaFecha
        FROM Transacciones T
        WHERE T.Cantidad > 0
        GROUP BY T.BaseCol, T.IdDeposito
      )
      SELECT
        SPD.BaseCol,
        PI.DescripcionMarca,
        PI.DescripcionCorta as DescripcionProducto,
        SPD.idDeposito,
        T.Descripcion as NombreDeposito,
        SPD.StockTotal,
        UVT.UltimaVentaFecha,
        DATEDIFF(DAY, UVT.UltimaVentaFecha, GETDATE()) as DiasSinVenta
      FROM StockPorDeposito SPD
      JOIN ProductoInfo PI ON SPD.BaseCol = PI.BaseCol
      LEFT JOIN Tiendas T ON SPD.idDeposito = T.IdTienda
      LEFT JOIN UltimaVentaPorTienda UVT ON SPD.BaseCol = UVT.BaseCol AND SPD.idDeposito = UVT.IdDeposito
      ORDER BY SPD.BaseCol, SPD.idDeposito
    `;

    const reabastecimientoResult = await pool.request().query(reabastecimientoQuery);

    const stockPorDeposito: StockPorDeposito[] = reabastecimientoResult.recordset.map((row: any) => ({
      BaseCol: row.BaseCol,
      descripcionProducto: row.DescripcionProducto || row.BaseCol,
      descripcionMarca: row.DescripcionMarca || '',
      idDeposito: row.idDeposito,
      nombreDeposito: row.NombreDeposito || `Depósito ${row.idDeposito}`,
      stockTotal: row.StockTotal || 0,
      ultimaVentaFecha: row.UltimaVentaFecha,
      diasDesdeUltimaVenta: row.DiasSinVenta,
    }));

    const alertasReabastecimiento = detectarAlertasReabastecimiento(stockPorDeposito);
    const incidenciasReabastecimiento = alertasAIncidencias(alertasReabastecimiento);
    incidencias.push(...incidenciasReabastecimiento);

    // =============================================
    // 2. DETECTAR CLAVOS (>365 días para vender)
    // =============================================
    const clavosQuery = `
      WITH ProductoVentas AS (
        SELECT
          T.BaseCol,
          MAX(T.DescripcionMarca) as DescripcionMarca,
          MAX(T.DescripcionArticulo) as DescripcionCorta,
          SUM(T.Cantidad) as UnidadesVendidas,
          MIN(T.Fecha) as PrimeraVentaFecha
        FROM Transacciones T
        WHERE T.Cantidad > 0
          AND T.Fecha >= DATEADD(YEAR, -1, GETDATE())
        GROUP BY T.BaseCol
      ),
      ProductoStock AS (
        SELECT
          LEFT(M.IdArticulo, LEN(M.IdArticulo) - 2) as BaseCol,
          SUM(M.TotalStock) as StockTotal
        FROM MovStockTotalResumen M
        WHERE M.TotalStock > 0
          AND M.idDeposito NOT IN (${DEPOSITOS_CONFIG.outlet.join(',')})
        GROUP BY LEFT(M.IdArticulo, LEN(M.IdArticulo) - 2)
      ),
      UltimaCompraInfo AS (
        SELECT
          UC.BaseArticulo as BaseCol,
          UC.FechaUltimaCompra,
          UC.UltimoCosto
        FROM UltimaCompra UC
      ),
      PrimeraVentaDesdeCompra AS (
        SELECT
          T.BaseCol,
          MIN(T.Fecha) as PrimeraVentaDesdeUltimaCompra
        FROM Transacciones T
        JOIN UltimaCompra UC ON T.BaseCol = UC.BaseArticulo
        WHERE T.Fecha >= UC.FechaUltimaCompra
          AND T.Cantidad > 0
        GROUP BY T.BaseCol
      )
      SELECT
        PV.BaseCol,
        PV.DescripcionMarca,
        PV.DescripcionCorta,
        PV.UnidadesVendidas,
        PS.StockTotal,
        UCI.UltimoCosto,
        DATEDIFF(DAY, PVDC.PrimeraVentaDesdeUltimaCompra, GETDATE()) as DiasDesde1raVenta
      FROM ProductoVentas PV
      JOIN ProductoStock PS ON PV.BaseCol = PS.BaseCol
      LEFT JOIN UltimaCompraInfo UCI ON PV.BaseCol = UCI.BaseCol
      LEFT JOIN PrimeraVentaDesdeCompra PVDC ON PV.BaseCol = PVDC.BaseCol
      WHERE PS.StockTotal >= ${UMBRALES.stockMinimoLiquidacion}
    `;

    const clavosResult = await pool.request().query(clavosQuery);

    for (const row of clavosResult.recordset) {
      const producto: ProductoParaClasificar = {
        BaseCol: row.BaseCol,
        DescripcionMarca: row.DescripcionMarca,
        marca: row.DescripcionMarca,
        stockActual: row.StockTotal || 0,
        unidadesVendidas: row.UnidadesVendidas || 0,
        diasDesde1raVentaUltimaCompra: row.DiasDesde1raVenta || 0,
        fechaPrimeraVentaUltimaCompra: null,
        fechaUltimaCompra: null,
      };

      const clasificado = clasificarProductoCompleto(producto);

      if (clasificado.estado === 'CLAVO') {
        const diasParaVender = clasificado.diasParaVenderStock || 999;
        const valorInventario = (row.StockTotal || 0) * (row.UltimoCosto || 0);

        const datos: IncidenciaClavo = {
          BaseCol: row.BaseCol,
          descripcionProducto: `${row.DescripcionMarca} - ${row.DescripcionCorta || row.BaseCol}`,
          stockActual: row.StockTotal,
          diasSinMovimiento: Math.round(diasParaVender),
          valorInventario,
          sugerenciaLiquidacion: {
            descuentoSugerido: diasParaVender > 500 ? 50 : 30,
            precioLiquidacion: (row.UltimoCosto || 0) * (diasParaVender > 500 ? 1.2 : 1.5),
          },
        };

        incidencias.push({
          id: `CLAVO-${row.BaseCol}-${Date.now()}`,
          tipo: 'CLAVO_DETECTADO',
          titulo: `Clavo detectado: ${row.DescripcionMarca}`,
          mensaje: `${row.DescripcionCorta || row.BaseCol} tiene ${row.StockTotal} unidades que tardarían ${Math.round(diasParaVender)} días en venderse. Valor del inventario: $${Math.round(valorInventario).toLocaleString()}`,
          severidad: diasParaVender > 500 ? 'critica' : 'alta',
          fechaDeteccion: new Date(),
          estado: 'PENDIENTE',
          datos,
          accionSugerida: {
            tipo: 'LIQUIDAR',
            descripcion: `Liquidar con ${datos.sugerenciaLiquidacion.descuentoSugerido}% de descuento`,
            parametros: {
              descuento: datos.sugerenciaLiquidacion.descuentoSugerido,
              precioSugerido: datos.sugerenciaLiquidacion.precioLiquidacion,
            },
          },
        });
      }
    }

    // Ordenar por severidad
    const severidadOrder = { critica: 0, alta: 1, media: 2, baja: 3 };
    incidencias.sort((a, b) => severidadOrder[a.severidad] - severidadOrder[b.severidad]);

    // Generar resumen
    const resumen = {
      total: incidencias.length,
      pendientes: incidencias.filter(i => i.estado === 'PENDIENTE').length,
      porTipo: incidencias.reduce((acc, i) => {
        acc[i.tipo] = (acc[i.tipo] || 0) + 1;
        return acc;
      }, {} as Record<TipoIncidencia, number>),
      porSeveridad: incidencias.reduce((acc, i) => {
        acc[i.severidad] = (acc[i.severidad] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    const response: IncidenciasResponse = {
      incidencias,
      resumen,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error en API incidencias:', error);
    return NextResponse.json(
      { error: 'Error al obtener incidencias', details: String(error) },
      { status: 500 }
    );
  }
}
