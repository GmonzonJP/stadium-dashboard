import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { WatchlistItem, WatchlistFilters, WatchlistResponse } from '@/types/price-actions';
import { getThresholds, getGlobalPriceBands } from '@/lib/price-actions/config-service';
import { getPriceBand } from '@/lib/price-actions/price-band-utils';
import { identifyCluster, calculateClusterRitmo } from '@/lib/price-actions/cluster-service';
import { calculateVelocityMetrics, calculateStockMetrics } from '@/lib/price-actions/velocity-calculator';
import { determineWatchlistReasons, calculateWatchlistScore } from '@/lib/price-actions/watchlist-scorer';
import sql from 'mssql';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const filters: WatchlistFilters = body.filters || {};
        const page = Math.max(1, Number(body.page) || 1);
        const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(body.pageSize) || DEFAULT_PAGE_SIZE));

        // Obtener configuración
        const thresholds = await getThresholds();
        const bands = await getGlobalPriceBands();
        const ritmoVentanaDias = thresholds.ritmoVentanaDias;

        // Calcular fechas
        const hoy = new Date();
        const fechaFinVentanaStr = hoy.toISOString().split('T')[0];
        const fechaInicioVentana = new Date(hoy);
        fechaInicioVentana.setDate(fechaInicioVentana.getDate() - ritmoVentanaDias);
        const fechaInicioVentanaStr = fechaInicioVentana.toISOString().split('T')[0];

        // Query base para obtener productos con métricas necesarias
        // Necesitamos: ventas últimos 7/14/28 días, primera venta, precio, costo, stock
        const baseQuery = `
            WITH VentasPorPeriodo AS (
                SELECT 
                    T.BaseCol,
                    -- Unidades últimos 7 días
                    SUM(CASE WHEN T.Fecha >= DATEADD(DAY, -7, GETDATE()) THEN T.Cantidad ELSE 0 END) as unidades_7,
                    -- Unidades últimos 14 días
                    SUM(CASE WHEN T.Fecha >= DATEADD(DAY, -14, GETDATE()) THEN T.Cantidad ELSE 0 END) as unidades_14,
                    -- Unidades últimos 28 días
                    SUM(CASE WHEN T.Fecha >= DATEADD(DAY, -28, GETDATE()) THEN T.Cantidad ELSE 0 END) as unidades_28,
                    -- Unidades desde primera venta
                    SUM(T.Cantidad) as unidades_desde_inicio,
                    -- Primera venta
                    MIN(T.Fecha) as primera_venta,
                    -- Última venta
                    MAX(T.Fecha) as ultima_venta
                FROM Transacciones T
                WHERE T.Cantidad > 0
                GROUP BY T.BaseCol
            ),
            ProductosBase AS (
                SELECT DISTINCT
                    T.BaseCol,
                    MAX(T.DescripcionMarca) as DescripcionMarca,
                    MAX(T.DescripcionArticulo) as Descripcion,
                    MAX(AR.DescripcionCorta) as DescripcionCorta,
                    MAX(T.IdClase) as IdClase,
                    MAX(T.DescripcionClase) as DescripcionClase,
                    MAX(T.IdMarca) as IdMarca,
                    MAX(T.idGenero) as IdGenero,
                    MAX(T.DescripcionGenero) as DescripcionGenero,
                    -- Precio actual (PVP o precio de última transacción)
                    COALESCE(MAX(AP.Precio), MAX(T.Precio / NULLIF(T.Cantidad, 0))) as precio_actual,
                    -- Costo (último costo con IVA)
                    MAX(UC.ultimoCosto) * 1.22 as costo,
                    -- Fecha última compra
                    MAX(UC.FechaUltimaCompra) as fecha_ultima_compra
                FROM Transacciones T
                LEFT JOIN (
                    SELECT Base, MAX(DescripcionCorta) as DescripcionCorta
                    FROM Articulos
                    GROUP BY Base
                ) AR ON AR.Base = T.BaseCol
                LEFT JOIN (
                    SELECT 
                        A.Base as BaseCol,
                        MAX(UC.UltimoCosto) as ultimoCosto,
                        MAX(UC.FechaUltimaCompra) as FechaUltimaCompra
                    FROM UltimaCompra UC
                    INNER JOIN Articulos A ON A.IdArticulo = UC.BaseArticulo
                    WHERE UC.UltimoCosto IS NOT NULL AND UC.UltimoCosto > 0
                    GROUP BY A.Base
                ) UC ON UC.BaseCol = T.BaseCol
                LEFT JOIN (
                    SELECT baseCol as BaseCol, MAX(Precio) as Precio
                    FROM ArticuloPrecio
                    GROUP BY baseCol
                ) AP ON AP.BaseCol = T.BaseCol
                WHERE 1=1
                ${filters.stores?.length ? `AND T.IdDeposito IN (${filters.stores.join(',')})` : ''}
                ${filters.categories?.length ? `AND T.IdClase IN (${filters.categories.join(',')})` : ''}
                ${filters.brands?.length ? `AND T.IdMarca IN (${filters.brands.join(',')})` : ''}
                ${filters.genders?.length ? `AND T.idGenero IN (${filters.genders.join(',')})` : ''}
                ${filters.search ? `AND (T.BaseCol LIKE '%${filters.search}%' OR T.DescripcionArticulo LIKE '%${filters.search}%' OR AR.DescripcionCorta LIKE '%${filters.search}%')` : ''}
                GROUP BY T.BaseCol
            ),
            StockPorProducto AS (
                SELECT 
                    A.Base as BaseCol,
                    SUM(MS.TotalStock) as stock_on_hand,
                    SUM(CASE WHEN MS.Pendientes > 0 THEN MS.Pendientes ELSE 0 END) as stock_pendiente,
                    SUM(MS.TotalStock) + SUM(CASE WHEN MS.Pendientes > 0 THEN MS.Pendientes ELSE 0 END) as stock_total
                FROM MovStockTotalResumen MS
                INNER JOIN Articulos A ON A.IdArticulo = MS.IdArticulo
                WHERE MS.TotalStock > 0 OR ISNULL(MS.Pendientes, 0) > 0
                ${filters.brands?.length ? `AND A.IdMarca IN (${filters.brands.join(',')})` : ''}
                GROUP BY A.Base
            )
            SELECT 
                PB.BaseCol,
                PB.Descripcion,
                PB.DescripcionCorta,
                PB.DescripcionClase as categoria,
                PB.IdClase,
                PB.DescripcionMarca as marca,
                PB.IdMarca,
                PB.DescripcionGenero as genero,
                PB.IdGenero,
                PB.precio_actual,
                PB.costo,
                PB.fecha_ultima_compra,
                ISNULL(VP.unidades_7, 0) as unidades_7,
                ISNULL(VP.unidades_14, 0) as unidades_14,
                ISNULL(VP.unidades_28, 0) as unidades_28,
                ISNULL(VP.unidades_desde_inicio, 0) as unidades_desde_inicio,
                VP.primera_venta,
                ISNULL(ST.stock_on_hand, 0) as stock_on_hand,
                ISNULL(ST.stock_pendiente, 0) as stock_pendiente,
                ISNULL(ST.stock_total, 0) as stock_total
            FROM ProductosBase PB
            LEFT JOIN VentasPorPeriodo VP ON VP.BaseCol = PB.BaseCol
            LEFT JOIN StockPorProducto ST ON ST.BaseCol = PB.BaseCol
            WHERE ISNULL(ST.stock_total, 0) > 0
            ORDER BY PB.BaseCol
        `;

        const result = await executeQuery(baseQuery);
        const productos = result.recordset;

        // Limitar cantidad de productos a procesar inicialmente (para evitar timeouts)
        const MAX_PRODUCTOS_INICIALES = 200;
        const productosLimitados = productos.slice(0, MAX_PRODUCTOS_INICIALES);

        // Optimización: Agrupar productos por cluster para calcular ritmo una sola vez por cluster
        const clusterCache = new Map<string, { cluster: any; ritmoCluster: number }>();
        
        // Función helper para obtener o calcular ritmo de cluster
        const getClusterRitmo = async (idClase: number, idGenero: number, idMarca: number, precio: number): Promise<number> => {
            // Usar banda de precio aproximada para agrupar clusters similares
            const precioBand = Math.floor(precio / 500) * 500;
            const clusterKey = `${idClase}-${idGenero}-${idMarca}-${precioBand}`;
            
            if (clusterCache.has(clusterKey)) {
                return clusterCache.get(clusterKey)!.ritmoCluster;
            }

            // Identificar cluster
            const cluster = await identifyCluster({
                idClase,
                idGenero,
                idMarca,
                precio,
                categoriaId: idClase
            });

            // Calcular ritmo del cluster (puede ser lento, pero se cachea)
            const ritmoCluster = await calculateClusterRitmo({
                cluster,
                fechaInicioVentana: fechaInicioVentanaStr,
                fechaFinVentana: fechaFinVentanaStr,
                ponderacion: 'unidades'
            });

            clusterCache.set(clusterKey, { cluster, ritmoCluster });
            return ritmoCluster;
        };

        // Procesar productos en lotes para mejor performance
        const watchlistItems: WatchlistItem[] = [];
        const BATCH_SIZE = 20; // Aumentar tamaño de batch

        for (let i = 0; i < productosLimitados.length; i += BATCH_SIZE) {
            const batch = productosLimitados.slice(i, i + BATCH_SIZE);
            
            // Procesar batch en paralelo
            const batchPromises = batch.map(async (row) => {
                const baseCol = row.BaseCol;
                const precioActual = Number(row.precio_actual) || 0;
                const costo = Number(row.costo) || 0;
                const stockTotal = Number(row.stock_total) || 0;
                const stockOnHand = Number(row.stock_on_hand) || 0;
                const stockPendiente = Number(row.stock_pendiente) || 0;

                // Calcular días desde inicio
                const primeraVenta = row.primera_venta ? new Date(row.primera_venta) : null;
                const diasDesdeInicio = primeraVenta
                    ? Math.max(1, Math.ceil((hoy.getTime() - primeraVenta.getTime()) / (1000 * 60 * 60 * 24)))
                    : 0;

                // Obtener ciclo (por defecto o por categoría)
                const cicloTotalDias = 90; // TODO: obtener de configuración por categoría

                // Obtener ritmo del cluster (con cache)
                const ritmoCluster = await getClusterRitmo(
                    Number(row.IdClase),
                    Number(row.IdGenero),
                    Number(row.IdMarca),
                    precioActual
                );

                // Obtener cluster del cache
                const clusterKey = `${Number(row.IdClase)}-${Number(row.IdGenero)}-${Number(row.IdMarca)}-${Math.floor(precioActual / 500) * 500}`;
                const clusterData = clusterCache.get(clusterKey);
                const cluster = clusterData?.cluster || await identifyCluster({
                    idClase: Number(row.IdClase),
                    idGenero: Number(row.IdGenero),
                    idMarca: Number(row.IdMarca),
                    precio: precioActual,
                    categoriaId: Number(row.IdClase)
                });

                // Calcular métricas de velocidad
                const unidadesUltimos14 = Number(row.unidades_14) || 0;
                const unidadesDesdeInicio = Number(row.unidades_desde_inicio) || 0;

                const velocityMetrics = calculateVelocityMetrics({
                    unidadesUltimosNDias: unidadesUltimos14,
                    diasVentana: ritmoVentanaDias,
                    unidadesDesdeInicio,
                    diasDesdeInicio,
                    ritmoCluster
                });

                // Calcular métricas de stock
                const ventaDiaria = velocityMetrics.ritmoActual;
                const stockMetrics = calculateStockMetrics({
                    stockOnHand,
                    stockPendiente,
                    ventaDiaria,
                    diasDesdeInicio,
                    cicloTotalDias
                });

                // Determinar motivos
                const motivos = determineWatchlistReasons({
                    diasDesdeInicio,
                    indiceRitmo: velocityMetrics.indiceRitmo,
                    ritmoActual: velocityMetrics.ritmoActual,
                    ritmoCluster: velocityMetrics.ritmoCluster,
                    indiceDesaceleracion: velocityMetrics.indiceDesaceleracion,
                    stockTotal,
                    diasStock: stockMetrics.diasStock,
                    diasRestantesCiclo: stockMetrics.diasRestantesCiclo,
                    unidadesUltimos14
                }, thresholds);

                // Si no tiene motivos, no incluir en watchlist
                if (motivos.length === 0) {
                    return null;
                }

                // Crear item de watchlist
                const item: WatchlistItem = {
                    baseCol,
                    descripcion: row.Descripcion || '',
                    descripcionCorta: row.DescripcionCorta || '',
                    categoria: row.categoria || '',
                    idClase: Number(row.IdClase),
                    marca: row.marca || '',
                    idMarca: Number(row.IdMarca),
                    genero: row.genero || '',
                    idGenero: Number(row.IdGenero),
                    priceBand: cluster.priceBand,
                    precioActual,
                    costo,
                    stockTotal,
                    unidadesUltimos7: Number(row.unidades_7) || 0,
                    unidadesUltimos14,
                    unidadesUltimos28: Number(row.unidades_28) || 0,
                    ritmoActual: velocityMetrics.ritmoActual,
                    ritmoCluster: velocityMetrics.ritmoCluster,
                    indiceRitmo: velocityMetrics.indiceRitmo,
                    indiceDesaceleracion: velocityMetrics.indiceDesaceleracion,
                    diasStock: stockMetrics.diasStock,
                    diasDesdeInicio,
                    diasRestantesCiclo: stockMetrics.diasRestantesCiclo,
                    motivo: motivos,
                    score: 0, // Se calculará después
                    cluster
                };

                // Calcular score (sin await adicional, ya tenemos thresholds)
                const scoreResult = await calculateWatchlistScore(item);
                item.score = scoreResult.score;

                return item;
            });

            const batchResults = await Promise.all(batchPromises);
            watchlistItems.push(...batchResults.filter(item => item !== null) as WatchlistItem[]);
        }

        // Aplicar filtros adicionales
        let filteredItems = watchlistItems;
        if (filters.severidad) {
            const thresholds = await getThresholds();
            filteredItems = filteredItems.filter(item => {
                if (filters.severidad === 'all') return true;
                if (filters.severidad === 'critico') return item.indiceRitmo < thresholds.indiceRitmoCritico;
                if (filters.severidad === 'bajo') return item.indiceRitmo < thresholds.indiceRitmoBajo && item.indiceRitmo >= thresholds.indiceRitmoCritico;
                if (filters.severidad === 'normal') return item.indiceRitmo >= thresholds.indiceRitmoBajo;
                return true;
            });
        }

        if (filters.motivo?.length) {
            filteredItems = filteredItems.filter(item =>
                item.motivo.some(m => filters.motivo!.includes(m))
            );
        }

        if (filters.priceBands?.length) {
            filteredItems = filteredItems.filter(item =>
                filters.priceBands!.includes(item.priceBand)
            );
        }

        // Ordenar por score descendente
        filteredItems.sort((a, b) => b.score - a.score);

        // Paginación
        const total = filteredItems.length;
        const totalPages = Math.ceil(total / pageSize);
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedItems = filteredItems.slice(startIndex, endIndex);

        const response: WatchlistResponse = {
            items: paginatedItems,
            total,
            page,
            pageSize,
            totalPages
        };

        return NextResponse.json(response);

    } catch (error) {
        console.error('Error en watchlist API:', error);
        return NextResponse.json(
            { error: 'Error al obtener watchlist', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
