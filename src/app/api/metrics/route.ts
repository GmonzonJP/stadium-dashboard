import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { buildDashboardQuery } from '@/lib/query-builder';
import { FilterParams } from '@/types';

export async function POST(req: NextRequest) {
    try {
        const filters: FilterParams = await req.json();

        // Basic validation
        if (!filters.startDate || !filters.endDate) {
            return NextResponse.json({ error: 'Missing date range' }, { status: 400 });
        }

        const startDate = new Date(filters.startDate);
        const endDate = new Date(filters.endDate);
        const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        // Calculate previous period for comparison (same duration, ending before current start)
        const prevEndDateObj = new Date(startDate);
        prevEndDateObj.setDate(prevEndDateObj.getDate() - 1);

        const prevStartDateObj = new Date(prevEndDateObj);
        prevStartDateObj.setDate(prevStartDateObj.getDate() - durationDays + 1);

        const prevStartDate = prevStartDateObj.toISOString().split('T')[0];
        const prevEndDate = prevEndDateObj.toISOString().split('T')[0];

        // Calculate Last Year (LY) period based on comparison mode
        // '52weeks' = 364 days ago (same day of week), 'calendar' = same date -1 year
        const comparisonMode = filters.comparisonMode || '52weeks';

        let lyStartDate: string;
        let lyEndDate: string;

        if (comparisonMode === '52weeks') {
            // 52 weeks = 364 days
            const lyStartDateObj = new Date(startDate);
            lyStartDateObj.setDate(lyStartDateObj.getDate() - 364);
            lyStartDate = lyStartDateObj.toISOString().split('T')[0];

            const lyEndDateObj = new Date(endDate);
            lyEndDateObj.setDate(lyEndDateObj.getDate() - 364);
            lyEndDate = lyEndDateObj.toISOString().split('T')[0];
        } else {
            // Calendar mode: same dates but -1 year
            const lyStartDateObj = new Date(startDate);
            lyStartDateObj.setFullYear(lyStartDateObj.getFullYear() - 1);
            lyStartDate = lyStartDateObj.toISOString().split('T')[0];

            const lyEndDateObj = new Date(endDate);
            lyEndDateObj.setFullYear(lyEndDateObj.getFullYear() - 1);
            lyEndDate = lyEndDateObj.toISOString().split('T')[0];
        }

        // Calculate YTD dates (start of year to today, ignoring period filter)
        const today = new Date();
        const ytdStartDate = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
        const ytdEndDate = today.toISOString().split('T')[0];

        // Calculate YTD Last Year
        const ytdLyStartDate = new Date(today.getFullYear() - 1, 0, 1).toISOString().split('T')[0];
        const ytdLyEndDate = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate()).toISOString().split('T')[0];

        // Query for current period metrics
        // IMPORTANTE: JOIN con Articulos para obtener Base correcto (NO SUBSTRING)
        const metricsSQL = `
            SELECT 
                SUM(T.Cantidad) as units,
                CAST(SUM(T.Precio) as decimal(18,2)) as sales,
                CAST(SUM(CAST(T.Cantidad as decimal(18,2)) * (1.22 * ISNULL(UC.ultimoCosto, 0))) as decimal(18,2)) as costoVenta
            FROM Transacciones T
            LEFT JOIN (
                SELECT A.Base as BaseCol, MAX(UC.UltimoCosto) as ultimoCosto 
                FROM UltimaCompra UC
                INNER JOIN Articulos A ON A.IdArticulo = UC.BaseArticulo
                GROUP BY A.Base
            ) UC ON UC.BaseCol = T.BaseCol
            {WHERE}
        `;

        // Query for stock from MovStockTotalResumen
        // IMPORTANTE: JOIN con Articulos para filtrar por IdMarca (NO SUBSTRING)
        let stockSQL = `
            SELECT SUM(MS.TotalStock) as stock
            FROM MovStockTotalResumen MS
            INNER JOIN Articulos A ON A.IdArticulo = MS.IdArticulo
            WHERE 1=1
        `;
        
        if (filters.brands?.length) {
            // Filtrar por IdMarca de la tabla Articulos
            const brandIds = filters.brands.map((b: number) => Number(b)).join(',');
            stockSQL += ` AND A.IdMarca IN (${brandIds})`;
        }

        // Build queries for all periods
        const currentQuery = buildDashboardQuery(metricsSQL, filters);
        const prevQuery = buildDashboardQuery(metricsSQL, { ...filters, startDate: prevStartDate, endDate: prevEndDate });
        const lyQuery = buildDashboardQuery(metricsSQL, { ...filters, startDate: lyStartDate, endDate: lyEndDate });
        
        // YTD queries ignore period filter but keep other filters
        const ytdFilters = { ...filters, startDate: ytdStartDate, endDate: ytdEndDate };
        const ytdQuery = buildDashboardQuery(metricsSQL, ytdFilters);
        
        const ytdLyFilters = { ...filters, startDate: ytdLyStartDate, endDate: ytdLyEndDate };
        const ytdLyQuery = buildDashboardQuery(metricsSQL, ytdLyFilters);

        const [currentResult, prevResult, lyResult, ytdResult, ytdLyResult, stockResult] = await Promise.all([
            executeQuery(currentQuery),
            executeQuery(prevQuery),
            executeQuery(lyQuery),
            executeQuery(ytdQuery),
            executeQuery(ytdLyQuery),
            executeQuery(stockSQL)
        ]);

        const current = currentResult.recordset[0] || { units: 0, sales: 0, costoVenta: 0 };
        const prev = prevResult.recordset[0] || { units: 0, sales: 0, costoVenta: 0 };
        const ly = lyResult.recordset[0] || { units: 0, sales: 0, costoVenta: 0 };
        const ytd = ytdResult.recordset[0] || { units: 0, sales: 0, costoVenta: 0 };
        const ytdLy = ytdLyResult.recordset[0] || { units: 0, sales: 0, costoVenta: 0 };
        const stock = stockResult.recordset[0]?.stock || 0;

        // Calculate Margen = (Venta / Costo) - 1, expresado en %
        const calculateMargin = (sales: number, cost: number) =>
            cost > 0 ? ((sales - cost) / cost) * 100 : null;

        // Calculate Markup = (Precio - Costo) / Costo * 100
        const calculateMarkup = (sales: number, cost: number) => 
            cost > 0 ? ((sales - cost) / cost) * 100 : null;

        const currentMargin = calculateMargin(current.sales, current.costoVenta);
        const currentMarkup = calculateMarkup(current.sales, current.costoVenta);
        const prevMargin = calculateMargin(prev.sales, prev.costoVenta);
        const prevMarkup = calculateMarkup(prev.sales, prev.costoVenta);
        const lyMargin = calculateMargin(ly.sales, ly.costoVenta);
        const lyMarkup = calculateMarkup(ly.sales, ly.costoVenta);
        const ytdMargin = calculateMargin(ytd.sales, ytd.costoVenta);
        const ytdMarkup = calculateMarkup(ytd.sales, ytd.costoVenta);
        const ytdLyMargin = calculateMargin(ytdLy.sales, ytdLy.costoVenta);
        const ytdLyMarkup = calculateMarkup(ytdLy.sales, ytdLy.costoVenta);

        // Calculate variations
        const calculateVariation = (current: number, previous: number) => 
            previous > 0 ? ((current - previous) / previous) * 100 : null;

        return NextResponse.json({
            // Current period metrics
            current: {
                units: current.units || 0,
                sales: current.sales || 0,
                cost: current.costoVenta || 0,
                margin: currentMargin,
                markup: currentMarkup
            },
            // Previous period (same duration, before current)
            previous: {
                units: prev.units || 0,
                sales: prev.sales || 0,
                cost: prev.costoVenta || 0,
                margin: prevMargin,
                markup: prevMarkup
            },
            // Last Year (LY) - same dates but -1 year
            lastYear: {
                units: ly.units || 0,
                sales: ly.sales || 0,
                cost: ly.costoVenta || 0,
                margin: lyMargin,
                markup: lyMarkup,
                hasData: (ly.units || 0) > 0 || (ly.sales || 0) > 0
            },
            // Year to Date (YTD) - ignores period filter
            ytd: {
                units: ytd.units || 0,
                sales: ytd.sales || 0,
                cost: ytd.costoVenta || 0,
                margin: ytdMargin,
                markup: ytdMarkup
            },
            // YTD Last Year
            ytdLastYear: {
                units: ytdLy.units || 0,
                sales: ytdLy.sales || 0,
                cost: ytdLy.costoVenta || 0,
                margin: ytdLyMargin,
                markup: ytdLyMarkup,
                hasData: (ytdLy.units || 0) > 0 || (ytdLy.sales || 0) > 0
            },
            stock: stock,
            // Growth vs previous period
            growth: {
                units: calculateVariation(current.units, prev.units),
                sales: calculateVariation(current.sales, prev.sales),
                margin: prevMargin !== null && currentMargin !== null ? calculateVariation(currentMargin, prevMargin) : null,
                markup: prevMarkup !== null && currentMarkup !== null ? calculateVariation(currentMarkup, prevMarkup) : null
            },
            // Growth vs Last Year
            growthLY: {
                units: ly.units > 0 ? calculateVariation(current.units, ly.units) : null,
                sales: ly.sales > 0 ? calculateVariation(current.sales, ly.sales) : null,
                margin: lyMargin !== null && currentMargin !== null ? calculateVariation(currentMargin, lyMargin) : null,
                markup: lyMarkup !== null && currentMarkup !== null ? calculateVariation(currentMarkup, lyMarkup) : null
            },
            // Growth YTD vs YTD LY
            growthYTD: {
                units: ytdLy.units > 0 ? calculateVariation(ytd.units, ytdLy.units) : null,
                sales: ytdLy.sales > 0 ? calculateVariation(ytd.sales, ytdLy.sales) : null,
                margin: ytdLyMargin !== null && ytdMargin !== null ? calculateVariation(ytdMargin, ytdLyMargin) : null,
                markup: ytdLyMarkup !== null && ytdMarkup !== null ? calculateVariation(ytdMarkup, ytdLyMarkup) : null
            }
        });

    } catch (error) {
        console.error('API Error in metrics route:', error);
        return NextResponse.json({ 
            error: 'Internal Server Error', 
            details: error instanceof Error ? error.message : String(error) 
        }, { status: 500 });
    }
}
