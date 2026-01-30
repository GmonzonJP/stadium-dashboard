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
          A.Base as BaseCol,
          MAX(UC.FechaUltimaCompra) as FechaUltimaCompra,
          SUM(UC.CantidadUltimaCompra) as CantidadUltimaCompra,
          MAX(UC.UltimoCosto) as UltimoCosto
        FROM UltimaCompra UC
        INNER JOIN Articulos A ON A.IdArticulo = UC.BaseArticulo
        WHERE UC.FechaUltimaCompra IS NOT NULL
        GROUP BY A.Base
      ),
      PrimeraVentaDesdeCompra AS (
        -- JOIN con Articulos para obtener Base correcto
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
        GROUP BY T.BaseCol
      )
      ,
      PrecioVenta AS (
        SELECT
          baseCol as BaseCol,
          MAX(Precio) as PVP
        FROM ArticuloPrecio
        GROUP BY baseCol
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
        COALESCE(PRV.PVP, PV.MaxPrecioUnitario) as PVP
      FROM ProductoVentas PV
      LEFT JOIN ProductoStock PS ON PV.BaseCol = PS.BaseCol
      LEFT JOIN UltimaCompraInfo UCI ON PV.BaseCol = UCI.BaseCol
      LEFT JOIN PrimeraVentaDesdeCompra PVDC ON PV.BaseCol = PVDC.BaseCol
      LEFT JOIN PrecioVenta PRV ON PV.BaseCol = PRV.BaseCol
      ORDER BY PV.VentaTotal DESC
    `;

    // Build AND conditions for filters (to append to existing WHERE clause)
    const andClauses: string[] = [];
    if (startDate) andClauses.push(`T.Fecha >= '${startDate}'`);
    if (endDate) andClauses.push(`T.Fecha <= '${endDate}'`);
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

    // Clasificar productos
    const productosParaClasificar: ProductoParaClasificar[] = rawProducts.map((row: any) => ({
      BaseCol: row.BaseCol,
      DescripcionMarca: row.DescripcionMarca,
      marca: row.DescripcionMarca,
      stockActual: row.StockTotal || 0,
      unidadesVendidas: row.UnidadesVendidas || 0,
      diasDesde1raVentaUltimaCompra: row.DiasDesde1raVentaUltimaCompra || 0,
      fechaPrimeraVentaUltimaCompra: row.PrimeraVentaDesdeUltimaCompra,
      fechaUltimaCompra: row.FechaUltimaCompra,
    }));

    const { clasificados, estadisticas } = clasificarProductos(productosParaClasificar);

    // Mapear a formato de respuesta
    const byProduct: SellOutByProduct[] = clasificados.map((p, idx) => {
      const raw = rawProducts[idx];
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
        estado: p.estado,
        statusInfo: p.statusInfo,
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
