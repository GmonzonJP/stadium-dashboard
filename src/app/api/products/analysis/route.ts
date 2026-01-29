import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { buildDashboardQuery } from '@/lib/query-builder';
import { FilterParams } from '@/types';
import {
    calculateASP,
    calculateDiasStockFromPeriod,
    calculateParesPorDia,
    calculateMargen,
    calculateMarkup,
    calculateSellThrough,
    safeDivide,
    toNumber
} from '@/lib/calculation-utils';
import { calculateSemaphoreFromData, getReposicionConfig } from '@/lib/reposicion-calculator';

// Pagination defaults
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const filters: FilterParams = body;
        const page = Math.max(1, Number(body.page) || 1);
        const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(body.pageSize) || DEFAULT_PAGE_SIZE));

        if (!filters.startDate || !filters.endDate) {
            return NextResponse.json({ error: 'Missing date range' }, { status: 400 });
        }

        const startDate = new Date(filters.startDate);
        const endDate = new Date(filters.endDate);
        const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        // Obtener configuración de reposición para calcular ventana
        const reposConfig = getReposicionConfig();
        const ventanaRitmoDias = reposConfig.ventanaRitmoDias;

        // Calcular fecha para la ventana del semáforo (N días antes de hoy)
        const hoy = new Date();
        const fechaInicioVentana = new Date(hoy);
        fechaInicioVentana.setDate(fechaInicioVentana.getDate() - ventanaRitmoDias);
        const fechaInicioVentanaStr = fechaInicioVentana.toISOString().split('T')[0];

        // Query principal para análisis de productos con datos para semáforo
        // IMPORTANTE: Usamos Articulos.Base para obtener el código base correcto
        // NO usamos SUBSTRING porque los códigos base pueden tener longitudes variables
        const analysisSQL = `
            SELECT 
                T.BaseCol,
                MAX(T.DescripcionMarca) as DescripcionMarca,
                MAX(T.DescripcionArticulo) as Descripcion,
                MAX(AR.DescripcionCorta) as DescripcionCorta,
                MAX(T.IdClase) as IdClase,
                MAX(T.idProveedor) as IdProveedor,
                -- Unidades vendidas (período filtrado)
                SUM(T.Cantidad) as unidades_vendidas,
                -- Venta Total ($) (período filtrado)
                CAST(SUM(T.Precio) as decimal(18,2)) as venta_total,
                -- Precio Promedio (ASP) = venta_total / unidades (calculado en SQL para precisión)
                CASE 
                    WHEN SUM(T.Cantidad) > 0 
                    THEN CAST(SUM(T.Precio) / SUM(T.Cantidad) as decimal(18,2))
                    ELSE NULL
                END as precio_promedio_asp,
                -- Último costo (con IVA)
                MAX(UC.ultimoCosto) * 1.22 as ultimo_costo,
                -- PVP (precio de lista o último precio de venta si no hay lista)
                COALESCE(MAX(AP.Precio), MAX(T.PRECIO / NULLIF(T.Cantidad, 0))) as pvp,
                -- Última compra (fecha)
                MAX(UC.FechaUltimaCompra) as ultima_compra_fecha,
                -- Cantidad última compra
                MAX(UC.CantidadUltimaCompra) as cantidad_ultima_compra,
                -- Unidades vendidas en ventana de N días (para semáforo)
                (
                    SELECT ISNULL(SUM(TV.Cantidad), 0)
                    FROM Transacciones TV
                    WHERE TV.BaseCol = T.BaseCol
                    AND TV.Fecha >= '${fechaInicioVentanaStr}'
                    AND TV.Cantidad > 0
                ) as unidades_ventana
            FROM Transacciones T
            LEFT JOIN (
                SELECT Base, MAX(DescripcionCorta) as DescripcionCorta
                FROM Articulos
                GROUP BY Base
            ) AR ON AR.Base = T.BaseCol
            LEFT JOIN (
                -- UltimaCompra: JOIN con Articulos para obtener Base correcto
                SELECT 
                    A.Base as BaseCol, 
                    MAX(UC.UltimoCosto) as ultimoCosto,
                    MAX(UC.FechaUltimaCompra) as FechaUltimaCompra,
                    SUM(UC.CantidadUltimaCompra) as CantidadUltimaCompra
                FROM UltimaCompra UC
                INNER JOIN Articulos A ON A.IdArticulo = UC.BaseArticulo
                WHERE UC.UltimoCosto IS NOT NULL AND UC.UltimoCosto > 0
                GROUP BY A.Base
            ) UC ON UC.BaseCol = T.BaseCol
            LEFT JOIN (
                -- ArticuloPrecio: baseCol ya es el código base
                SELECT 
                    baseCol as BaseCol,
                    MAX(Precio) as Precio
                FROM ArticuloPrecio
                GROUP BY baseCol
            ) AP ON AP.BaseCol = T.BaseCol
            {WHERE}
            GROUP BY T.BaseCol
            HAVING SUM(T.Cantidad) > 0
            ORDER BY venta_total DESC
        `;

        // Query para stock desde MovStockTotalResumen (fuente de verdad)
        // IMPORTANTE: JOIN con Articulos para obtener Base correcto (NO usar SUBSTRING)
        const stockSQL = `
            SELECT 
                A.Base as BaseCol,
                SUM(MS.TotalStock) as stock_on_hand,
                SUM(CASE WHEN MS.Pendientes > 0 THEN MS.Pendientes ELSE 0 END) as stock_pendiente,
                SUM(MS.TotalStock) + SUM(CASE WHEN MS.Pendientes > 0 THEN MS.Pendientes ELSE 0 END) as stock_total
            FROM MovStockTotalResumen MS
            INNER JOIN Articulos A ON A.IdArticulo = MS.IdArticulo
            WHERE MS.TotalStock > 0 OR ISNULL(MS.Pendientes, 0) > 0
            GROUP BY A.Base
        `;

        const analysisQuery = buildDashboardQuery(analysisSQL, filters, {
            tableAlias: 'T'
        });

        // Aplicar filtros de marca al stock si existen
        // Usamos Articulos.IdMarca para filtrar (NO SUBSTRING)
        let stockQuery = stockSQL;
        if (filters.brands?.length) {
            const brandIds = filters.brands.map((b: number) => Number(b)).join(',');
            stockQuery = stockSQL.replace(
                'WHERE MS.TotalStock', 
                `WHERE A.IdMarca IN (${brandIds}) AND (MS.TotalStock`
            ).replace('GROUP BY A.Base', ') GROUP BY A.Base');
        }

        const [analysisResult, stockResult] = await Promise.all([
            executeQuery(analysisQuery),
            executeQuery(stockQuery)
        ]);

        // Crear mapa de stock por BaseCol
        const stockMap = new Map<string, { stock_total: number; stock_pendiente: number; stock_on_hand: number }>();
        stockResult.recordset.forEach((row: any) => {
            stockMap.set(row.BaseCol, {
                stock_total: toNumber(row.stock_total) || 0,
                stock_pendiente: toNumber(row.stock_pendiente) || 0,
                stock_on_hand: toNumber(row.stock_on_hand) || 0
            });
        });

        // Calcular totales para paginación
        const totalProducts = analysisResult.recordset.length;
        const totalPages = Math.ceil(totalProducts / pageSize);
        const offset = (page - 1) * pageSize;

        // Paginar resultados
        const paginatedRecords = analysisResult.recordset.slice(offset, offset + pageSize);

        // Combinar datos y calcular métricas adicionales
        const products = paginatedRecords.map((row: any) => {
            const stock = stockMap.get(row.BaseCol) || { stock_total: 0, stock_pendiente: 0, stock_on_hand: 0 };
            const unidades = toNumber(row.unidades_vendidas) || 0;
            const ventaTotal = toNumber(row.venta_total) || 0;
            const costo = toNumber(row.ultimo_costo) || 0;
            const pvp = toNumber(row.pvp) || 0;
            const asp = toNumber(row.precio_promedio_asp);
            const unidadesVentana = toNumber(row.unidades_ventana) || 0;
            const ultimaCompraFecha = row.ultima_compra_fecha ? new Date(row.ultima_compra_fecha).toISOString().split('T')[0] : null;

            // Calcular días desde última compra
            let diasDesdeCompra = 0;
            if (ultimaCompraFecha) {
                const fechaUltimaCompra = new Date(ultimaCompraFecha);
                diasDesdeCompra = Math.floor((hoy.getTime() - fechaUltimaCompra.getTime()) / (1000 * 60 * 60 * 24));
            }

            // Calcular métricas con utilidades seguras
            const diasStock = calculateDiasStockFromPeriod(stock.stock_total, unidades, durationDays);
            const paresPorDia = calculateParesPorDia(unidades, durationDays);
            const margen = calculateMargen(asp, costo);
            const markup = calculateMarkup(asp, costo);
            const sellThrough = calculateSellThrough(unidades, stock.stock_total);

            // Calcular semáforo de reposición
            const semaphore = ultimaCompraFecha 
                ? calculateSemaphoreFromData(
                    stock.stock_total,
                    unidadesVentana,
                    diasDesdeCompra,
                    ultimaCompraFecha,
                    { ventanaRitmoDias }
                )
                : {
                    color: 'white' as const,
                    diasReales: null,
                    diasEsperados: null,
                    ritmoDiario: null,
                    unidades180: null,
                    diasDesdeCompra: null,
                    ventanaUsada: ventanaRitmoDias,
                    umbralUsado: reposConfig.umbralReposicionDias,
                    stockTotal: stock.stock_total,
                    ultimaCompraFecha: null,
                    explanation: 'Sin fecha de última compra'
                };

            return {
                BaseCol: row.BaseCol,
                DescripcionMarca: row.DescripcionMarca || '',
                Descripcion: row.Descripcion || '',
                DescripcionCorta: row.DescripcionCorta || '',
                IdClase: row.IdClase,
                IdProveedor: row.IdProveedor,
                // Métricas de ventas
                unidades_vendidas: unidades,
                venta_total: ventaTotal,
                precio_promedio_asp: asp,
                // Costos y precios
                ultimo_costo: costo || null,
                pvp: pvp || null,
                // Última compra
                ultima_compra_fecha: ultimaCompraFecha,
                cantidad_ultima_compra: toNumber(row.cantidad_ultima_compra) || null,
                dias_desde_compra: diasDesdeCompra || null,
                // Stock (desde MovStockTotalResumen)
                stock_total: stock.stock_total,
                stock_pendiente: stock.stock_pendiente,
                stock_on_hand: stock.stock_on_hand,
                // Métricas calculadas
                dias_stock: diasStock ? Math.round(diasStock) : null,
                pares_por_dia: paresPorDia ? Math.round(paresPorDia * 100) / 100 : null,
                margen: margen ? Math.round(margen * 100) / 100 : null,
                markup: markup ? Math.round(markup * 100) / 100 : null,
                sell_through: sellThrough ? Math.round(sellThrough * 100) / 100 : null,
                // Semáforo de reposición
                semaforo: {
                    color: semaphore.color,
                    diasReales: semaphore.diasReales,
                    diasEsperados: semaphore.diasEsperados,
                    ritmoDiario: semaphore.ritmoDiario,
                    explanation: semaphore.explanation
                },
                // Metadata
                duration_days: durationDays
            };
        });

        return NextResponse.json({
            products,
            pagination: {
                page,
                pageSize,
                total: totalProducts,
                totalPages,
                hasMore: page < totalPages
            },
            duration_days: durationDays,
            ventana_semaforo_dias: ventanaRitmoDias,
            meta: {
                stockSource: 'MovStockTotalResumen',
                aspFormula: 'venta_total / unidades',
                margenFormula: '(precio - costo) / precio * 100',
                markupFormula: '(precio - costo) / costo * 100'
            }
        });

    } catch (error) {
        console.error('API Error in products analysis:', error);
        return NextResponse.json({ 
            error: 'Internal Server Error', 
            details: error instanceof Error ? error.message : String(error) 
        }, { status: 500 });
    }
}
