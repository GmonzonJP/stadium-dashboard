/**
 * Servicio para cálculo de clusters y ritmo de cluster
 * Un cluster agrupa productos por: categoría, género, marca, banda de precio
 */

import { executeQuery } from '@/lib/db';
import { Cluster, PriceBand } from '@/types/price-actions';
import { getPriceBandsForCategory, getGlobalPriceBands } from './config-service';
import { getPriceBand } from './price-band-utils';
import sql from 'mssql';
import { safeDivide } from '@/lib/calculation-utils';

/**
 * Identifica el cluster de un producto
 */
export async function identifyCluster(params: {
    idClase: number;
    idGenero: number;
    idMarca: number;
    precio: number;
    categoriaId?: number;
}): Promise<Cluster> {
    const bands = params.categoriaId
        ? await getPriceBandsForCategory(params.categoriaId)
        : await getGlobalPriceBands();

    const priceBand = getPriceBand(params.precio, bands);

    // Obtener descripciones desde la base de datos
    const descQuery = `
        SELECT DISTINCT
            MAX(A.IdClase) as IdClase,
            MAX(A.DescripcionClase) as DescripcionClase,
            MAX(A.IdGenero) as IdGenero,
            MAX(A.DescripcionGenero) as DescripcionGenero,
            MAX(A.IdMarca) as IdMarca,
            MAX(A.DescripcionMarca) as DescripcionMarca
        FROM Articulos A
        WHERE A.IdClase = @idClase
        AND A.IdGenero = @idGenero
        AND A.IdMarca = @idMarca
    `;

    const descResult = await executeQuery(descQuery, [
        { name: 'idClase', type: sql.Int, value: params.idClase },
        { name: 'idGenero', type: sql.Int, value: params.idGenero },
        { name: 'idMarca', type: sql.Int, value: params.idMarca }
    ]);

    const row = descResult.recordset[0] || {};

    return {
        idClase: params.idClase,
        descripcionClase: row.DescripcionClase || '',
        idGenero: params.idGenero,
        descripcionGenero: row.DescripcionGenero || '',
        idMarca: params.idMarca,
        descripcionMarca: row.DescripcionMarca || '',
        priceBand
    };
}

/**
 * Calcula el ritmo promedio del cluster (promedio ponderado)
 * Ponderación: por unidades vendidas o por días en venta
 */
export async function calculateClusterRitmo(params: {
    cluster: Cluster;
    fechaInicioVentana: string; // Fecha de inicio de la ventana de cálculo
    fechaFinVentana: string; // Fecha de fin de la ventana
    ponderacion: 'unidades' | 'dias'; // Método de ponderación
}): Promise<number> {
    const { cluster, fechaInicioVentana, fechaFinVentana, ponderacion } = params;

    // Obtener bandas de precio para parsear el priceBand
    const bands = await getGlobalPriceBands();
    const bandMatch = cluster.priceBand.match(/^(\d+)-(\d+)$/);
    let minPrice = 0;
    let maxPrice = 999999;

    if (bandMatch) {
        minPrice = parseInt(bandMatch[1], 10);
        maxPrice = parseInt(bandMatch[2], 10);
    }

    // Query para obtener ritmos de todos los SKUs del cluster
    const ritmoQuery = `
        SELECT 
            T.BaseCol,
            SUM(T.Cantidad) as unidades_vendidas,
            COUNT(DISTINCT CAST(T.Fecha as DATE)) as dias_con_venta,
            MIN(T.Fecha) as primera_venta,
            MAX(T.Fecha) as ultima_venta
        FROM Transacciones T
        INNER JOIN Articulos A ON A.Base = T.BaseCol
        LEFT JOIN ArticuloPrecio AP ON AP.baseCol = T.BaseCol
        WHERE T.IdClase = @idClase
        AND T.idGenero = @idGenero
        AND T.IdMarca = @idMarca
        AND T.Fecha >= @fechaInicio
        AND T.Fecha <= @fechaFin
        AND T.Cantidad > 0
        AND (
            AP.Precio IS NULL 
            OR (AP.Precio >= @minPrice AND AP.Precio <= @maxPrice)
            OR (T.Precio / NULLIF(T.Cantidad, 0) >= @minPrice AND T.Precio / NULLIF(T.Cantidad, 0) <= @maxPrice)
        )
        GROUP BY T.BaseCol
        HAVING SUM(T.Cantidad) > 0
    `;

    const ritmoResult = await executeQuery(ritmoQuery, [
        { name: 'idClase', type: sql.Int, value: cluster.idClase },
        { name: 'idGenero', type: sql.Int, value: cluster.idGenero },
        { name: 'idMarca', type: sql.Int, value: cluster.idMarca },
        { name: 'fechaInicio', type: sql.DateTime, value: fechaInicioVentana },
        { name: 'fechaFin', type: sql.DateTime, value: fechaFinVentana },
        { name: 'minPrice', type: sql.Decimal(18, 2), value: minPrice },
        { name: 'maxPrice', type: sql.Decimal(18, 2), value: maxPrice }
    ]);

    if (ritmoResult.recordset.length === 0) {
        return 0; // No hay datos del cluster
    }

    const fechaInicio = new Date(fechaInicioVentana);
    const fechaFin = new Date(fechaFinVentana);
    const diasVentana = Math.max(1, Math.ceil((fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24)));

    // Calcular ritmo por SKU y ponderar
    let totalPonderado = 0;
    let totalPeso = 0;

    for (const row of ritmoResult.recordset) {
        const unidades = Number(row.unidades_vendidas) || 0;
        const diasConVenta = Number(row.dias_con_venta) || 1;
        
        // Ritmo del SKU = unidades / días de ventana
        const ritmoSKU = safeDivide(unidades, diasVentana, 0) || 0;

        if (ritmoSKU > 0) {
            let peso: number;
            if (ponderacion === 'unidades') {
                peso = unidades; // Ponderar por unidades vendidas
            } else {
                peso = diasConVenta; // Ponderar por días con venta
            }

            totalPonderado += ritmoSKU * peso;
            totalPeso += peso;
        }
    }

    if (totalPeso === 0) {
        return 0;
    }

    return totalPonderado / totalPeso;
}

/**
 * Obtiene todos los SKUs de un cluster (para análisis)
 */
export async function getClusterSKUs(cluster: Cluster): Promise<string[]> {
    const bands = await getGlobalPriceBands();
    const bandMatch = cluster.priceBand.match(/^(\d+)-(\d+)$/);
    let minPrice = 0;
    let maxPrice = 999999;

    if (bandMatch) {
        minPrice = parseInt(bandMatch[1], 10);
        maxPrice = parseInt(bandMatch[2], 10);
    }

    const query = `
        SELECT DISTINCT T.BaseCol
        FROM Transacciones T
        INNER JOIN Articulos A ON A.Base = T.BaseCol
        LEFT JOIN ArticuloPrecio AP ON AP.baseCol = T.BaseCol
        WHERE T.IdClase = @idClase
        AND T.idGenero = @idGenero
        AND T.IdMarca = @idMarca
        AND (
            AP.Precio IS NULL 
            OR (AP.Precio >= @minPrice AND AP.Precio <= @maxPrice)
        )
    `;

    const result = await executeQuery(query, [
        { name: 'idClase', type: sql.Int, value: cluster.idClase },
        { name: 'idGenero', type: sql.Int, value: cluster.idGenero },
        { name: 'idMarca', type: sql.Int, value: cluster.idMarca },
        { name: 'minPrice', type: sql.Decimal(18, 2), value: minPrice },
        { name: 'maxPrice', type: sql.Decimal(18, 2), value: maxPrice }
    ]);

    return result.recordset.map((row: any) => row.BaseCol);
}
