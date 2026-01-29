import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { buildDashboardQuery } from '@/lib/query-builder';
import { FilterParams } from '@/types';

// Calcula las fechas del año anterior
function getPreviousYearDates(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setFullYear(start.getFullYear() - 1);
    end.setFullYear(end.getFullYear() - 1);
    return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
    };
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const filters: FilterParams = body.filters;
        const groupBy: string = body.groupBy;
        const metricTitle: string = body.metricTitle || '';
        const includeComparison: boolean = body.includeComparison ?? false;

        if (!filters.startDate || !filters.endDate) {
            return NextResponse.json({ error: 'Missing date range' }, { status: 400 });
        }

        // Si es Stock Estimado, usar query de MovStockTotalResumen (sin comparativo histórico)
        if (metricTitle === 'Stock Estimado') {
            return handleStockDetails(filters, groupBy);
        }

        let selectClause = '';
        let groupByClause = '';
        let orderByClause = 'ORDER BY sales DESC';
        let joinClause = '';

        switch (groupBy) {
            case 'stores':
                selectClause = 'T.IdDeposito as id, TI.Descripcion as label';
                groupByClause = 'T.IdDeposito, TI.Descripcion';
                joinClause = 'INNER JOIN Tiendas TI ON TI.IdTienda = T.IdDeposito';
                break;
            case 'brands':
                selectClause = 'T.IdMarca as id, T.DescripcionMarca as label';
                groupByClause = 'T.IdMarca, T.DescripcionMarca';
                break;
            case 'genders':
                selectClause = 'T.idGenero as id, T.DescripcionGenero as label';
                groupByClause = 'T.idGenero, T.DescripcionGenero';
                break;
            case 'sections':
                selectClause = 'T.IdSeccion as id, T.DescripcionSeccion as label';
                groupByClause = 'T.IdSeccion, T.DescripcionSeccion';
                break;
            case 'categories':
                selectClause = 'T.idClase as id, T.DescripcionClase as label';
                groupByClause = 'T.idClase, T.DescripcionClase';
                break;
            case 'products':
                selectClause = 'T.BaseCol as id, AR.descripcionCorta as label';
                groupByClause = 'T.BaseCol, AR.descripcionCorta';
                joinClause = `INNER JOIN (
                    SELECT base as BaseCol, MAX(descripcionCorta) as descripcionCorta 
                    FROM Articulos 
                    GROUP BY base
                ) AR ON AR.BaseCol = T.BaseCol`;
                break;
            case 'price':
                // Note: Price ranges are a bit more complex, simple bucketing for now
                selectClause = `
                    CASE 
                        WHEN T.Precio < 1000 THEN 'Under $1000'
                        WHEN T.Precio >= 1000 AND T.Precio < 3000 THEN '$1000 - $3000'
                        WHEN T.Precio >= 3000 AND T.Precio < 5000 THEN '$3000 - $5000'
                        ELSE 'Over $5000'
                    END as label
                `;
                groupByClause = `
                    CASE 
                        WHEN T.Precio < 1000 THEN 'Under $1000'
                        WHEN T.Precio >= 1000 AND T.Precio < 3000 THEN '$1000 - $3000'
                        WHEN T.Precio >= 3000 AND T.Precio < 5000 THEN '$3000 - $5000'
                        ELSE 'Over $5000'
                    END
                `;
                break;
            case 'hour':
                selectClause = 'DATEPART(HOUR, T.Fecha) as label';
                groupByClause = 'DATEPART(HOUR, T.Fecha)';
                orderByClause = 'ORDER BY label ASC';
                break;
            default: // Ver Todo (Summary) or invalid
                selectClause = "'Total' as label";
                groupByClause = "";
        }

        // Query actual
        const baseSQL = `
            SELECT
                ${selectClause},
                SUM(T.Cantidad) as units,
                SUM(T.Precio) as sales,
                CAST(AVG((T.Precio / NULLIF((T.Costo * 1.22), 0)) - 1) * 100 as decimal(10,2)) as utility
            FROM Transacciones T
            ${joinClause}
            {WHERE}
            ${groupByClause ? 'GROUP BY ' + groupByClause : ''}
            ${orderByClause}
        `;

        const finalQuery = buildDashboardQuery(baseSQL, filters, {
            tableAlias: 'T',
            searchColumns: ['T.DescripcionMarca', 'T.BaseCol']
        });

        console.log('DEBUG: Groups Query:', finalQuery);

        const result = await executeQuery(finalQuery);
        let data: any[] = [...result.recordset];

        // Si se solicitan comparativos, obtener datos del año anterior
        if (includeComparison) {
            const prevDates = getPreviousYearDates(filters.startDate, filters.endDate);
            const prevFilters = { ...filters, startDate: prevDates.startDate, endDate: prevDates.endDate };

            const prevQuery = buildDashboardQuery(baseSQL, prevFilters, {
                tableAlias: 'T',
                searchColumns: ['T.DescripcionMarca', 'T.BaseCol']
            });

            console.log('DEBUG: Prev Year Query:', prevQuery);

            const prevResult = await executeQuery(prevQuery);
            const prevData = prevResult.recordset;

            // Crear mapa de datos anteriores por label
            const prevMap = new Map<string, any>();
            for (const row of prevData) {
                prevMap.set(row.label, row);
            }

            // Combinar datos actuales con anteriores
            data = data.map((row: any) => {
                const prev = prevMap.get(row.label);
                return {
                    ...row,
                    unitsAnterior: prev?.units || 0,
                    salesAnterior: prev?.sales || 0
                };
            });
        }

        return NextResponse.json(data);

    } catch (error) {
        console.error('API Error in metrics details:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

/**
 * Manejar detalles de Stock desde MovStockTotalResumen
 */
async function handleStockDetails(filters: FilterParams, groupBy: string) {
    try {
        let selectClause = '';
        let groupByClause = '';
        let joinClause = '';
        let whereClause = 'WHERE MS.TotalStock > 0';

        // Si hay filtro de marcas, agregarlo
        if (filters.brands?.length) {
            const brandIds = filters.brands.map((b: number) => Number(b)).join(',');
            whereClause += ` AND A.IdMarca IN (${brandIds})`;
        }

        switch (groupBy) {
            case 'stores':
                selectClause = 'MS.IdDeposito as id, TI.Descripcion as label';
                groupByClause = 'MS.IdDeposito, TI.Descripcion';
                joinClause = `
                    INNER JOIN Articulos A ON A.IdArticulo = MS.IdArticulo
                    LEFT JOIN Tiendas TI ON TI.IdTienda = MS.IdDeposito
                `;
                break;
            case 'brands':
                selectClause = 'A.IdMarca as id, A.DescripcionMarca as label';
                groupByClause = 'A.IdMarca, A.DescripcionMarca';
                joinClause = 'INNER JOIN Articulos A ON A.IdArticulo = MS.IdArticulo';
                break;
            case 'genders':
                selectClause = 'A.IdGenero as id, A.DescripcionGenero as label';
                groupByClause = 'A.IdGenero, A.DescripcionGenero';
                joinClause = 'INNER JOIN Articulos A ON A.IdArticulo = MS.IdArticulo';
                break;
            case 'sections':
                selectClause = 'A.IdSeccion as id, A.DescripcionSeccion as label';
                groupByClause = 'A.IdSeccion, A.DescripcionSeccion';
                joinClause = 'INNER JOIN Articulos A ON A.IdArticulo = MS.IdArticulo';
                break;
            case 'categories':
                selectClause = 'A.IdClase as id, A.DescripcionClase as label';
                groupByClause = 'A.IdClase, A.DescripcionClase';
                joinClause = 'INNER JOIN Articulos A ON A.IdArticulo = MS.IdArticulo';
                break;
            case 'products':
                selectClause = 'A.Base as id, A.DescripcionCorta as label';
                groupByClause = 'A.Base, A.DescripcionCorta';
                joinClause = 'INNER JOIN Articulos A ON A.IdArticulo = MS.IdArticulo';
                break;
            default: // Ver Todo (Summary)
                selectClause = "'Total' as label";
                groupByClause = "";
                joinClause = 'INNER JOIN Articulos A ON A.IdArticulo = MS.IdArticulo';
        }

        const stockSQL = `
            SELECT 
                ${selectClause},
                SUM(MS.TotalStock) as units,
                0 as sales,
                0 as utility
            FROM MovStockTotalResumen MS
            ${joinClause}
            ${whereClause}
            ${groupByClause ? 'GROUP BY ' + groupByClause : ''}
            ORDER BY units DESC
        `;

        console.log('DEBUG: Stock Groups Query:', stockSQL);

        const result = await executeQuery(stockSQL);
        return NextResponse.json(result.recordset);

    } catch (error) {
        console.error('API Error in stock details:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
