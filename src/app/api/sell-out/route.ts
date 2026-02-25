import { NextRequest, NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';
import { buildDashboardQuery } from '@/lib/query-builder';
import {
  clasificarProductoCompleto,
  clasificarProductos,
  getDiasCompraEsperados,
} from '@/lib/producto-classifier';
import {
  SellOutByBrand,
  SellOutByProduct,
  SellOutResponse,
  ProductoParaClasificar,
  DEPOSITOS_CONFIG,
} from '@/types/sell-out';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { startDate, endDate, stores, brands, categories, genders, suppliers, groupBy } = body;

    const pool = await getDbConnection();

    // Query principal para obtener productos con métricas
    // IMPORTANTE: UltimaCompra.BaseArticulo es IdArticulo (con talle),
    // necesitamos JOIN con Articulos para obtener el Base correcto
    // NOTA: Excluimos tiendas web (701, 702, 704) del cálculo de sellout
    const webStoreIds = DEPOSITOS_CONFIG.web.join(',');
    const baseQuery = `
      WITH ProductoVentas AS (
        SELECT
          T.BaseCol,
          T.IdMarca,
          MAX(T.DescripcionMarca) as DescripcionMarca,
          MAX(T.DescripcionArticulo) as DescripcionCorta,
          SUM(T.Cantidad) as UnidadesVendidas,
          SUM(T.PRECIO) as VentaTotal,
          MAX(T.Fecha) as UltimaVentaFecha,
          MIN(T.Fecha) as PrimeraVentaFecha,
          MAX(T.PRECIO / NULLIF(T.Cantidad, 0)) as MaxPrecioUnitario
        FROM Transacciones T
        WHERE T.Cantidad > 0
          AND T.IdDeposito NOT IN (${webStoreIds})
        {WHERE_CLAUSE}
        GROUP BY T.BaseCol, T.IdMarca
      ),
      ProductoStock AS (
        SELECT
          A.Base as BaseCol,
          SUM(M.TotalStock) as StockTotal
        FROM MovStockTotalResumen M
        INNER JOIN Articulos A ON A.IdArticulo = M.IdArticulo
        WHERE M.TotalStock > 0
        GROUP BY A.Base
      ),
      UltimaCompraInfo AS (
        -- JOIN con Articulos para obtener Base correcto (no usar BaseArticulo directamente)
        SELECT
          BaseCol,
          MAX(FechaUltimaCompra) as FechaUltimaCompra,
          SUM(CantidadUltimaCompra) as CantidadUltimaCompra,
          MAX(UltimoCosto) as UltimoCosto
        FROM (
          SELECT
            A.Base as BaseCol,
            UC.FechaUltimaCompra,
            UC.CantidadUltimaCompra,
            UC.UltimoCosto
          FROM UltimaCompra UC
          INNER JOIN Articulos A ON A.IdArticulo = UC.BaseArticulo
          WHERE UC.FechaUltimaCompra IS NOT NULL
        ) AS UCJoined
        GROUP BY BaseCol
      ),
      PrimeraVentaDesdeCompra AS (
        -- JOIN con Articulos para obtener Base correcto
        -- Excluye ventas web para cálculo de sellout
        SELECT
          T.BaseCol,
          MIN(T.Fecha) as PrimeraVentaDesdeUltimaCompra
        FROM Transacciones T
        INNER JOIN (
          SELECT A.Base as BaseCol, MAX(UC.FechaUltimaCompra) as FechaUltimaCompra
          FROM UltimaCompra UC
          INNER JOIN Articulos A ON A.IdArticulo = UC.BaseArticulo
          GROUP BY A.Base
        ) UCI ON T.BaseCol = UCI.BaseCol
        WHERE T.Fecha >= UCI.FechaUltimaCompra
          AND T.Cantidad > 0
          AND T.IdDeposito NOT IN (${webStoreIds})
        GROUP BY T.BaseCol
      ),
      VentasDesdeCompra AS (
        -- Unidades vendidas desde la última compra (para clasificación de estacionales)
        -- Excluye ventas web
        SELECT
          T.BaseCol,
          SUM(T.Cantidad) as UnidadesDesdeCompra
        FROM Transacciones T
        INNER JOIN (
          SELECT A.Base as BaseCol, MAX(UC.FechaUltimaCompra) as FechaUltimaCompra
          FROM UltimaCompra UC
          INNER JOIN Articulos A ON A.IdArticulo = UC.BaseArticulo
          GROUP BY A.Base
        ) UCI ON T.BaseCol = UCI.BaseCol
        WHERE T.Fecha >= UCI.FechaUltimaCompra
          AND T.Cantidad > 0
          AND T.IdDeposito NOT IN (${webStoreIds})
        GROUP BY T.BaseCol
      ),
      Ventas180Dias AS (
        -- Unidades vendidas en últimos 180 días (para clasificación de carryover)
        -- Excluye ventas web
        SELECT
          T.BaseCol,
          SUM(T.Cantidad) as Unidades180Dias
        FROM Transacciones T
        WHERE T.Fecha >= DATEADD(DAY, -180, GETDATE())
          AND T.Cantidad > 0
          AND T.IdDeposito NOT IN (${webStoreIds})
        GROUP BY T.BaseCol
      )
      ,
      PrecioVenta AS (
        SELECT
          Base as BaseCol,
          MAX(PrecioLista) as PVP
        FROM Articulos
        WHERE PrecioLista > 0
        GROUP BY Base
      ),
      PrimeraVentaGlobal AS (
        -- Primera venta del producto en toda la historia (para detectar carryover)
        -- Excluye ventas web
        SELECT
          T.BaseCol,
          MIN(T.Fecha) as PrimeraVentaGlobal
        FROM Transacciones T
        WHERE T.Cantidad > 0
          AND T.IdDeposito NOT IN (${webStoreIds})
        GROUP BY T.BaseCol
      )
      SELECT
        PV.BaseCol,
        PV.IdMarca,
        PV.DescripcionMarca,
        PV.DescripcionCorta,
        PV.UnidadesVendidas,
        PV.VentaTotal,
        COALESCE(PS.StockTotal, 0) as StockTotal,
        DATEDIFF(DAY, PV.UltimaVentaFecha, GETDATE()) as DiasSinVenta,
        UCI.FechaUltimaCompra,
        UCI.UltimoCosto,
        PVDC.PrimeraVentaDesdeUltimaCompra,
        DATEDIFF(DAY, PVDC.PrimeraVentaDesdeUltimaCompra, GETDATE()) as DiasDesde1raVentaUltimaCompra,
        DATEDIFF(DAY, UCI.FechaUltimaCompra, GETDATE()) as DiasDesdeUltimaCompra,
        COALESCE(VDC.UnidadesDesdeCompra, PV.UnidadesVendidas) as UnidadesDesdeCompra,
        COALESCE(V180.Unidades180Dias, PV.UnidadesVendidas) as Unidades180Dias,
        COALESCE(PRV.PVP, PV.MaxPrecioUnitario) as PVP,
        PVG.PrimeraVentaGlobal,
        -- Carryover: si la primera venta global es anterior a la última compra
        CASE
          WHEN PVG.PrimeraVentaGlobal < UCI.FechaUltimaCompra THEN 1
          ELSE 0
        END as EsCarryover
      FROM ProductoVentas PV
      LEFT JOIN ProductoStock PS ON PV.BaseCol = PS.BaseCol
      LEFT JOIN UltimaCompraInfo UCI ON PV.BaseCol = UCI.BaseCol
      LEFT JOIN PrimeraVentaDesdeCompra PVDC ON PV.BaseCol = PVDC.BaseCol
      LEFT JOIN VentasDesdeCompra VDC ON PV.BaseCol = VDC.BaseCol
      LEFT JOIN Ventas180Dias V180 ON PV.BaseCol = V180.BaseCol
      LEFT JOIN PrecioVenta PRV ON PV.BaseCol = PRV.BaseCol
      LEFT JOIN PrimeraVentaGlobal PVG ON PV.BaseCol = PVG.BaseCol
      ORDER BY PV.VentaTotal DESC
    `;

    // Build AND conditions for filters (to append to existing WHERE clause)
    // IMPORTANT: Date filters intentionally excluded — sell-out classification
    // evaluates each product from its última compra date, independent of date range.
    const andClauses: string[] = [];
    if (stores?.length) andClauses.push(`T.IdDeposito IN (${stores.join(',')})`);
    if (brands?.length) andClauses.push(`T.IdMarca IN (${brands.join(',')})`);
    if (categories?.length) andClauses.push(`T.IdClase IN (${categories.join(',')})`);
    if (genders?.length) andClauses.push(`T.idGenero IN (${genders.join(',')})`);
    if (suppliers?.length) {
      const formattedSuppliers = suppliers.map((s: any) => typeof s === 'string' ? `'${s}'` : s);
      andClauses.push(`T.idProveedor IN (${formattedSuppliers.join(',')})`);
    }

    const whereClause = andClauses.length > 0 ? ` AND ${andClauses.join(' AND ')}` : '';
    const query = baseQuery.replace('{WHERE_CLAUSE}', whereClause);

    const result = await pool.request().query(query);
    const rawProducts = result.recordset;

    // Clasificar productos:
    // - CARRYOVER (venden todo el año): usar últimos 180 días
    // - ESTACIONALES (nuevos después de compra): usar días desde última compra
    const VENTANA_CARRYOVER = 180;

    const productosParaClasificar: ProductoParaClasificar[] = rawProducts.map((row: any) => {
      const esCarryover = row.EsCarryover === 1;
      const stockActual = row.StockTotal || 0;
      const esSaldoProducto = stockActual > 0 && stockActual < 30;

      // Para carryover CON stock relevante: usar 180 días
      // Para carryover SALDO (stock < 30): usar desde última compra
      //   → Porque la baja velocidad reciente se debe a que ya no hay stock, no a que no vende
      // Para estacionales: usar días desde última compra
      let unidadesParaClasificar: number;
      let diasParaClasificar: number;

      if (esCarryover && !esSaldoProducto) {
        // Carryover con stock relevante: ventana de 180 días
        unidadesParaClasificar = row.Unidades180Dias || row.UnidadesVendidas || 0;
        diasParaClasificar = VENTANA_CARRYOVER;
      } else {
        // Estacional O carryover-saldo: desde última compra
        unidadesParaClasificar = row.UnidadesDesdeCompra || row.UnidadesVendidas || 0;
        diasParaClasificar = row.DiasDesdeUltimaCompra || row.DiasDesde1raVentaUltimaCompra || 0;
      }

      return {
        BaseCol: row.BaseCol,
        DescripcionMarca: row.DescripcionMarca,
        marca: row.DescripcionMarca,
        stockActual: row.StockTotal || 0,
        unidadesVendidas: unidadesParaClasificar,
        diasDesde1raVentaUltimaCompra: diasParaClasificar,
        fechaPrimeraVentaUltimaCompra: row.PrimeraVentaDesdeUltimaCompra,
        fechaUltimaCompra: row.FechaUltimaCompra,
        // Campos adicionales para el response
        esCarryover,
      };
    });

    const { clasificados, estadisticas } = clasificarProductos(productosParaClasificar);

    // Mapear a formato de respuesta
    const byProduct: SellOutByProduct[] = clasificados.map((p, idx) => {
      const raw = rawProducts[idx];
      const productoClasificado = productosParaClasificar[idx];
      return {
        BaseCol: p.BaseCol,
        descripcionMarca: p.DescripcionMarca || p.marca || '',
        descripcionCorta: raw.DescripcionCorta || '',
        unidadesVendidas: raw.UnidadesVendidas || 0,
        ventaTotal: raw.VentaTotal || 0,
        stockTotal: p.stockActual,
        paresPorDia: p.paresPorDia,
        diasStock: p.diasParaVenderStock,
        diasSinVenta: raw.DiasSinVenta || 0,
        rotacion: p.unidadesVendidas > 0 && p.stockActual > 0
          ? (p.unidadesVendidas / (p.unidadesVendidas + p.stockActual)) * 100
          : null,
        // Dimensión A: Desempeño de Venta
        estado: p.estado,
        salesPerformance: p.salesPerformance,
        statusInfo: p.statusInfo,
        // Dimensión B: Estado de Stock
        stockStatus: p.stockStatus,
        stockStatusInfo: p.stockStatusInfo,
        // Métricas de semanas
        weeksToClear: p.weeksToClear,
        weeksRemaining: p.weeksRemaining,
        ventasPromedioSemanal: p.ventasPromedioSemanal,
        // Tipo de producto
        esCarryover: productoClasificado.esCarryover || false,
        primeraVentaGlobal: raw.PrimeraVentaGlobal || null,
        // Nuevos campos
        fechaUltimaCompra: raw.FechaUltimaCompra || null,
        cantidadUltimaCompra: raw.CantidadUltimaCompra || null,
        margen: (() => {
          const asp = raw.UnidadesVendidas > 0 ? raw.VentaTotal / raw.UnidadesVendidas : null;
          const costo = raw.UltimoCosto || null;
          if (asp && costo && costo > 0) return ((asp - costo) / costo) * 100;
          return null;
        })(),
        // Legacy
        esSaldo: p.esSaldo,
        pvp: raw.PVP || null,
        ultimoCosto: raw.UltimoCosto || null,
      };
    });

    // Agrupar por marca
    const marcasMap = new Map<number, SellOutByBrand>();

    for (const product of byProduct) {
      const raw = rawProducts.find((r: any) => r.BaseCol === product.BaseCol);
      const idMarca = raw?.IdMarca || 0;

      if (!marcasMap.has(idMarca)) {
        marcasMap.set(idMarca, {
          idMarca,
          descripcionMarca: product.descripcionMarca,
          totalUnidades: 0,
          totalVenta: 0,
          totalStock: 0,
          cantidadProductos: 0,
          cantidadFastMovers: 0,
          cantidadOK: 0,
          cantidadSlowMovers: 0,
          cantidadClavos: 0,
          porcentajeSlowMovers: 0,
          rotacionPromedio: 0,
        });
      }

      const marca = marcasMap.get(idMarca)!;
      marca.totalUnidades += product.unidadesVendidas;
      marca.totalVenta += product.ventaTotal;
      marca.totalStock += product.stockTotal;
      marca.cantidadProductos++;

      if (product.estado === 'FAST_MOVER') marca.cantidadFastMovers++;
      if (product.estado === 'OK') marca.cantidadOK++;
      if (product.estado === 'SLOW_MOVER') marca.cantidadSlowMovers++;
      if (product.estado === 'CLAVO') marca.cantidadClavos++;
    }

    // Calcular promedios por marca
    const byBrand: SellOutByBrand[] = Array.from(marcasMap.values()).map(marca => ({
      ...marca,
      porcentajeSlowMovers: marca.cantidadProductos > 0
        ? ((marca.cantidadSlowMovers + marca.cantidadClavos) / marca.cantidadProductos) * 100
        : 0,
      rotacionPromedio: marca.totalUnidades > 0 && marca.totalStock > 0
        ? (marca.totalUnidades / (marca.totalUnidades + marca.totalStock)) * 100
        : 0,
    }));

    // Ordenar por venta total
    byBrand.sort((a, b) => b.totalVenta - a.totalVenta);

    // Calcular valor de inventario
    const valorSlowMovers = byProduct
      .filter(p => p.estado === 'SLOW_MOVER' || p.estado === 'CLAVO')
      .reduce((sum, p) => {
        const raw = rawProducts.find((r: any) => r.BaseCol === p.BaseCol);
        const costo = raw?.UltimoCosto || 0;
        return sum + (p.stockTotal * costo);
      }, 0);

    const valorClavos = byProduct
      .filter(p => p.estado === 'CLAVO')
      .reduce((sum, p) => {
        const raw = rawProducts.find((r: any) => r.BaseCol === p.BaseCol);
        const costo = raw?.UltimoCosto || 0;
        return sum + (p.stockTotal * costo);
      }, 0);

    const response: SellOutResponse = {
      byBrand,
      byProduct,
      resumen: {
        totalProductos: estadisticas.total,
        totalFastMovers: estadisticas.fastMovers,
        totalOK: estadisticas.ok,
        totalSlowMovers: estadisticas.slowMovers,
        totalClavos: estadisticas.clavos,
        totalSaldos: estadisticas.saldos,
        valorInventarioSlowMovers: valorSlowMovers,
        valorInventarioClavos: valorClavos,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error en API sell-out:', error);
    return NextResponse.json(
      { error: 'Error al procesar análisis de sell-out', details: String(error) },
      { status: 500 }
    );
  }
}
