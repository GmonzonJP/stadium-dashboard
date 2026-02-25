import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { buildDashboardQuery } from '@/lib/query-builder';
import { FilterParams } from '@/types';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const filters: FilterParams = body;

        if (!filters.startDate || !filters.endDate) {
            return NextResponse.json({ error: 'Missing date range' }, { status: 400 });
        }

        const diffDays = Math.max(1, Math.ceil((new Date(filters.endDate).getTime() - new Date(filters.startDate).getTime()) / (1000 * 60 * 60 * 24)));

        // Ensure brands are properly formatted as numbers
        const brandIds = filters.brands?.length 
            ? filters.brands.map(b => Number(b)).filter(b => !isNaN(b)) as number[]
            : [];

        if (brandIds.length > 0) {
            filters.brands = brandIds;
        }



        // Optimized query using CTEs for better performance
        // IMPORTANTE: Usamos JOINs con Articulos.Base para obtener código base correcto (NO SUBSTRING)
        const recompraSQL = `
      WITH UltimaCompraBase AS (
          SELECT A.Base as BaseCol, MAX(UC.UltimoCosto) as ultimoCosto 
          FROM UltimaCompra UC
          INNER JOIN Articulos A ON A.IdArticulo = UC.BaseArticulo
          GROUP BY A.Base
      ),
      StockBase AS (
          SELECT A.Base as BaseCol, SUM(MS.TotalStock) as stock
          FROM MovStockTotalResumen MS
          INNER JOIN Articulos A ON A.IdArticulo = MS.IdArticulo
          GROUP BY A.Base
      ),
      ArticulosBase AS (
          SELECT Base as BaseCol, MAX(descripcionCorta) as descripcionCorta 
          FROM Articulos 
          GROUP BY Base
      )
      SELECT 
        T.IdMarca, 
        T.DescripcionMarca, 
        MAX(T.idClase) as idClase,
        MAX(T.DescripcionClase) as DescripcionClase, 
        T.IdGenero, 
        T.DescripcionGenero, 
        T.BaseCol, 
        AR.descripcionCorta,
        ISNULL(MAX(UC.ultimoCosto), 0) as ultimoCosto, 
        ISNULL(MAX(STK.stock), 0) as stock, 
        SUM(T.Cantidad) as unidades,
        CAST(SUM(T.PRECIO) as decimal(18,2)) as Venta,  
        CAST(SUM(CAST(T.Cantidad as decimal(18,2)) * (1.22 * ISNULL(UC.ultimoCosto, 0))) as decimal(18,2)) as costoVenta,
        CAST(SUM(T.PRECIO) - SUM(CAST(T.Cantidad as decimal(18,2)) * (1.22 * ISNULL(UC.ultimoCosto, 0))) as decimal(18,2)) as margenBruto, 
        CAST(((SUM(T.PRECIO) / NULLIF(SUM(CAST(T.Cantidad as decimal(18,2)) * (1.22 * ISNULL(UC.ultimoCosto, 0))), 0)) - 1) * 100 as decimal(18,2)) as margen, 
        COALESCE(MAX(ART_PVP.PVP), MAX(T.PRECIO / NULLIF(T.Cantidad, 0))) as precioUnitarioLista,
        CAST(ISNULL(MAX(STK.stock), 0) / NULLIF((CAST(SUM(T.Cantidad) as decimal(18,2)) / NULLIF(${diffDays}, 0)), 0) as decimal(18,0)) as diasStock
      FROM Transacciones T
      INNER JOIN ArticulosBase AR ON AR.BaseCol = T.BaseCol
      LEFT JOIN UltimaCompraBase UC ON UC.BaseCol = T.BaseCol
      LEFT JOIN StockBase STK ON STK.BaseCol = T.BaseCol
      LEFT JOIN (
        SELECT Base as BaseCol, MAX(PrecioLista) as PVP
        FROM Articulos
        WHERE PrecioLista > 0
        GROUP BY Base
      ) ART_PVP ON ART_PVP.BaseCol = T.BaseCol
      {WHERE}
      GROUP BY T.IdGenero, T.DescripcionGenero, T.BaseCol, AR.descripcionCorta, T.IdMarca, T.DescripcionMarca
      HAVING SUM(T.Cantidad) > 0
    `;

        let finalQuery = buildDashboardQuery(recompraSQL, filters, {
            tableAlias: 'T',
            searchColumns: [
                'T.DescripcionMarca',
                'T.BaseCol',
                'AR.descripcionCorta',
                'T.DescripcionClase',
                'T.DescripcionGenero'
            ]
        });
        
        // Ensure brand filter is in WHERE clause if brands are specified
        if (brandIds.length > 0) {
            const brandFilterInWhere = `T.IdMarca IN (${brandIds.join(',')})`;
            if (!finalQuery.includes('T.IdMarca IN')) {
                finalQuery = finalQuery.replace(
                    /(WHERE\s+[^G]+?)(\s+GROUP BY)/i,
                    `$1 AND ${brandFilterInWhere}$2`
                );
            }
        }

        // Replace date placeholders
        finalQuery = finalQuery.replace(/@startDate/g, `'${filters.startDate}'`).replace(/@endDate/g, `'${filters.endDate}'`);

        // Execute query
        const result = await executeQuery(finalQuery);
        
        return NextResponse.json(result.recordset);

    } catch (error) {
        console.error('API Error in Recompra route:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}
