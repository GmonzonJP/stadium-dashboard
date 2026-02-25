/**
 * Servicio para cálculo de elasticidad precio-demanda
 * Calcula elasticidad por cluster usando histórico de precios y ventas
 */

import { executeQuery } from '@/lib/db';
import { ElasticityInfo, Cluster } from '@/types/price-actions';
import { getThresholds, getGlobalPriceBands } from './config-service';
import sql from 'mssql';

const MIN_OBSERVATIONS_HIGH_CONFIDENCE = 20;
const MIN_OBSERVATIONS_MEDIUM_CONFIDENCE = 10;

/**
 * Calcula la elasticidad de precio para un cluster
 * Elasticidad = % cambio en cantidad / % cambio en precio
 * Normalmente negativa (aumento de precio → disminución de cantidad)
 */
export async function calculateClusterElasticity(params: {
    cluster: Cluster;
    mesesHistoricos?: number; // Cuántos meses de histórico usar (default: 6)
}): Promise<ElasticityInfo> {
    const { cluster, mesesHistoricos = 6 } = params;

    // Obtener bandas de precio
    const bands = await getGlobalPriceBands();
    const bandMatch = cluster.priceBand.match(/^(\d+)-(\d+)$/);
    let minPrice = 0;
    let maxPrice = 999999;

    if (bandMatch) {
        minPrice = parseInt(bandMatch[1], 10);
        maxPrice = parseInt(bandMatch[2], 10);
    }

    // Fecha de inicio (N meses atrás)
    const fechaFin = new Date();
    const fechaInicio = new Date();
    fechaInicio.setMonth(fechaInicio.getMonth() - mesesHistoricos);

    // Query para obtener variaciones de precio y cantidad por SKU del cluster
    // Agrupamos por períodos (meses) para tener múltiples observaciones
    const elasticityQuery = `
        WITH PrecioVentasPorMes AS (
            SELECT 
                T.BaseCol,
                FORMAT(T.Fecha, 'yyyy-MM') as mes,
                DATEPART(YEAR, T.Fecha) as year,
                DATEPART(MONTH, T.Fecha) as month,
                -- Precio promedio del mes (usar PrecioLista de Articulos si existe, sino calcular de transacciones)
                COALESCE(
                    MAX(ART_PVP.PVP),
                    CAST(SUM(T.Precio) / NULLIF(SUM(T.Cantidad), 0) as DECIMAL(18,2))
                ) as precio_promedio,
                SUM(T.Cantidad) as unidades_vendidas
            FROM Transacciones T
            INNER JOIN Articulos A ON A.Base = T.BaseCol
            LEFT JOIN (
                SELECT Base as BaseCol, MAX(PrecioLista) as PVP
                FROM Articulos
                WHERE PrecioLista > 0
                GROUP BY Base
            ) ART_PVP ON ART_PVP.BaseCol = T.BaseCol
            WHERE T.IdClase = @idClase
            AND T.idGenero = @idGenero
            AND T.IdMarca = @idMarca
            AND T.Fecha >= @fechaInicio
            AND T.Fecha <= @fechaFin
            AND T.Cantidad > 0
            AND (
                ART_PVP.PVP IS NULL
                OR (ART_PVP.PVP >= @minPrice AND ART_PVP.PVP <= @maxPrice)
                OR (T.Precio / NULLIF(T.Cantidad, 0) >= @minPrice AND T.Precio / NULLIF(T.Cantidad, 0) <= @maxPrice)
            )
            GROUP BY T.BaseCol, FORMAT(T.Fecha, 'yyyy-MM'), DATEPART(YEAR, T.Fecha), DATEPART(MONTH, T.Fecha)
            HAVING SUM(T.Cantidad) > 0
        ),
        VariacionesPorSKU AS (
            SELECT 
                BaseCol,
                mes,
                precio_promedio,
                unidades_vendidas,
                LAG(precio_promedio) OVER (PARTITION BY BaseCol ORDER BY year, month) as precio_anterior,
                LAG(unidades_vendidas) OVER (PARTITION BY BaseCol ORDER BY year, month) as unidades_anterior
            FROM PrecioVentasPorMes
        )
        SELECT 
            BaseCol,
            mes,
            precio_promedio,
            unidades_vendidas,
            precio_anterior,
            unidades_anterior,
            CASE 
                WHEN precio_anterior > 0 AND unidades_anterior > 0
                THEN (precio_promedio - precio_anterior) / precio_anterior
                ELSE NULL
            END as delta_precio_pct,
            CASE 
                WHEN precio_anterior > 0 AND unidades_anterior > 0
                THEN (unidades_vendidas - unidades_anterior) / unidades_anterior
                ELSE NULL
            END as delta_cantidad_pct
        FROM VariacionesPorSKU
        WHERE precio_anterior IS NOT NULL
        AND unidades_anterior IS NOT NULL
        AND precio_anterior > 0
        AND unidades_anterior > 0
        ORDER BY BaseCol, mes
    `;

    try {
        const result = await executeQuery(elasticityQuery, [
            { name: 'idClase', type: sql.Int, value: cluster.idClase },
            { name: 'idGenero', type: sql.Int, value: cluster.idGenero },
            { name: 'idMarca', type: sql.Int, value: cluster.idMarca },
            { name: 'fechaInicio', type: sql.DateTime, value: fechaInicio.toISOString().split('T')[0] },
            { name: 'fechaFin', type: sql.DateTime, value: fechaFin.toISOString().split('T')[0] },
            { name: 'minPrice', type: sql.Decimal(18, 2), value: minPrice },
            { name: 'maxPrice', type: sql.Decimal(18, 2), value: maxPrice }
        ]);

        const observations = result.recordset.filter((row: any) => 
            row.delta_precio_pct != null && 
            row.delta_cantidad_pct != null &&
            Math.abs(Number(row.delta_precio_pct)) > 0.01 // Al menos 1% de cambio
        );

        if (observations.length < MIN_OBSERVATIONS_MEDIUM_CONFIDENCE) {
            // No hay suficientes datos, usar fallback
            const thresholds = await getThresholds();
            return {
                value: thresholds.elasticityFallback,
                confidence: 'baja',
                observations: observations.length,
                method: 'fallback',
                warning: `Datos insuficientes para calcular elasticidad (${observations.length} observaciones). Usando valor conservador.`
            };
        }

        // Calcular elasticidad usando regresión simple (log-log o lineal)
        // Elasticidad = promedio(delta_cantidad_pct / delta_precio_pct)
        // Pero solo cuando delta_precio_pct != 0
        const elasticities: number[] = [];
        
        for (const obs of observations) {
            const deltaPrecio = Number(obs.delta_precio_pct);
            const deltaCantidad = Number(obs.delta_cantidad_pct);
            
            if (Math.abs(deltaPrecio) > 0.001) { // Evitar división por casi cero
                const elasticity = deltaCantidad / deltaPrecio;
                // Filtrar valores extremos (probablemente errores de datos)
                if (elasticity >= -5 && elasticity <= 1) {
                    elasticities.push(elasticity);
                }
            }
        }

        if (elasticities.length === 0) {
            const thresholds = await getThresholds();
            return {
                value: thresholds.elasticityFallback,
                confidence: 'baja',
                observations: 0,
                method: 'fallback',
                warning: 'No se pudieron calcular elasticidades válidas. Usando valor conservador.'
            };
        }

        // Promedio de elasticidades (mediana sería más robusta pero promedio es más simple)
        const avgElasticity = elasticities.reduce((sum, e) => sum + e, 0) / elasticities.length;

        // Determinar confianza
        let confidence: 'alta' | 'media' | 'baja';
        if (elasticities.length >= MIN_OBSERVATIONS_HIGH_CONFIDENCE) {
            confidence = 'alta';
        } else if (elasticities.length >= MIN_OBSERVATIONS_MEDIUM_CONFIDENCE) {
            confidence = 'media';
        } else {
            confidence = 'baja';
        }

        return {
            value: avgElasticity,
            confidence,
            observations: elasticities.length,
            method: 'cluster'
        };

    } catch (error) {
        console.error('Error calculando elasticidad:', error);
        const thresholds = await getThresholds();
        return {
            value: thresholds.elasticityFallback,
            confidence: 'baja',
            observations: 0,
            method: 'fallback',
            warning: `Error al calcular elasticidad: ${error instanceof Error ? error.message : 'Error desconocido'}`
        };
    }
}

/**
 * Calcula elasticidad por categoría (fallback si no hay datos del cluster)
 */
export async function calculateCategoryElasticity(
    categoriaId: number,
    mesesHistoricos: number = 6
): Promise<ElasticityInfo> {
    // Similar a calculateClusterElasticity pero agrupando solo por categoría
    // Implementación simplificada - usar mismo método pero sin filtros de género/marca/price band
    // Por ahora retornar fallback, se puede implementar después si es necesario
    const thresholds = await getThresholds();
    return {
        value: thresholds.elasticityFallback,
        confidence: 'baja',
        observations: 0,
        method: 'categoria',
        warning: 'Elasticidad por categoría no implementada aún. Usando valor conservador.'
    };
}
