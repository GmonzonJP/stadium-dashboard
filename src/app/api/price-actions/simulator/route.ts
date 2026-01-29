import { NextRequest, NextResponse } from 'next/server';
import { PriceSimulationInput, PriceSimulationResult } from '@/types/price-actions';
import { calculateClusterElasticity } from '@/lib/price-actions/elasticity-service';
import { identifyCluster } from '@/lib/price-actions/cluster-service';
import { getThresholds } from '@/lib/price-actions/config-service';
import { executeQuery } from '@/lib/db';
import sql from 'mssql';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const input: PriceSimulationInput = body.input;

        if (!input.baseCol || !input.precioActual || !input.precioPropuesto) {
            return NextResponse.json(
                { error: 'Faltan parámetros requeridos: baseCol, precioActual, precioPropuesto' },
                { status: 400 }
            );
        }

        // Obtener datos del producto
        const productQuery = `
            SELECT 
                T.BaseCol,
                MAX(T.IdClase) as IdClase,
                MAX(T.idGenero) as IdGenero,
                MAX(T.IdMarca) as IdMarca,
                MAX(UC.ultimoCosto) * 1.22 as costo,
                -- Calcular ritmo actual (últimos 14 días)
                (
                    SELECT ISNULL(SUM(TV.Cantidad), 0) / 14.0
                    FROM Transacciones TV
                    WHERE TV.BaseCol = T.BaseCol
                    AND TV.Fecha >= DATEADD(DAY, -14, GETDATE())
                    AND TV.Cantidad > 0
                ) as ritmo_actual
            FROM Transacciones T
            LEFT JOIN (
                SELECT 
                    A.Base as BaseCol,
                    MAX(UC.UltimoCosto) as ultimoCosto
                FROM UltimaCompra UC
                INNER JOIN Articulos A ON A.IdArticulo = UC.BaseArticulo
                WHERE UC.UltimoCosto IS NOT NULL AND UC.UltimoCosto > 0
                GROUP BY A.Base
            ) UC ON UC.BaseCol = T.BaseCol
            WHERE T.BaseCol = @baseCol
            GROUP BY T.BaseCol
        `;

        const productResult = await executeQuery(productQuery, [
            { name: 'baseCol', type: sql.NVarChar(50), value: input.baseCol }
        ]);

        if (productResult.recordset.length === 0) {
            return NextResponse.json(
                { error: 'Producto no encontrado' },
                { status: 404 }
            );
        }

        const product = productResult.recordset[0];
        const costo = Number(product.costo) || 0;
        let ritmoActual = Number(product.ritmo_actual) || 0;
        
        // Si no hay ritmo calculado, calcular desde unidades últimos 14 días
        if (ritmoActual === 0) {
            const unidades14Query = `
                SELECT ISNULL(SUM(Cantidad), 0) / 14.0 as ritmo
                FROM Transacciones
                WHERE BaseCol = @baseCol
                AND Fecha >= DATEADD(DAY, -14, GETDATE())
                AND Cantidad > 0
            `;
            const ritmoResult = await executeQuery(unidades14Query, [
                { name: 'baseCol', type: sql.NVarChar(50), value: input.baseCol }
            ]);
            ritmoActual = Number(ritmoResult.recordset[0]?.ritmo) || 0;
        }

        // Obtener stock
        const stockQuery = `
            SELECT 
                SUM(MS.TotalStock) + SUM(CASE WHEN MS.Pendientes > 0 THEN MS.Pendientes ELSE 0 END) as stock_total
            FROM MovStockTotalResumen MS
            INNER JOIN Articulos A ON A.IdArticulo = MS.IdArticulo
            WHERE A.Base = @baseCol
        `;

        const stockResult = await executeQuery(stockQuery, [
            { name: 'baseCol', type: sql.NVarChar(50), value: input.baseCol }
        ]);

        const stockTotal = Number(stockResult.recordset[0]?.stock_total) || 0;

        // Calcular elasticidad
        const cluster = await identifyCluster({
            idClase: Number(product.IdClase),
            idGenero: Number(product.IdGenero),
            idMarca: Number(product.IdMarca),
            precio: input.precioActual,
            categoriaId: Number(product.IdClase)
        });

        const elasticity = await calculateClusterElasticity({ cluster });

        // Si no se proporciona horizonte, usar días restantes de ciclo (default 90)
        const horizonteDias = input.horizonteDias || 90;

        // Obtener ritmo del cluster para usar como fallback
        let ritmoCluster = 0;
        try {
            const clusterRitmoResult = await executeQuery(`
                SELECT AVG(ritmo) as ritmoCluster FROM (
                    SELECT 
                        T.BaseCol,
                        SUM(T.Cantidad) * 1.0 / 14 as ritmo
                    FROM Transacciones T
                    WHERE T.IdClase = @idClase
                    AND T.idGenero = @idGenero
                    AND T.Fecha >= DATEADD(DAY, -14, GETDATE())
                    AND T.Cantidad > 0
                    GROUP BY T.BaseCol
                ) sub
            `, [
                { name: 'idClase', type: sql.Int, value: Number(product.IdClase) },
                { name: 'idGenero', type: sql.Int, value: Number(product.IdGenero) }
            ]);
            ritmoCluster = Number(clusterRitmoResult.recordset[0]?.ritmoCluster) || 0;
        } catch (e) {
            console.error('Error calculando ritmo cluster:', e);
        }

        // Simular cambio de precio
        const deltaPrecioPorcentaje = (input.precioPropuesto - input.precioActual) / input.precioActual;
        
        // Si el ritmo actual es 0, usar una fracción del ritmo del cluster como baseline
        // La idea es que bajando el precio, un producto sin ventas podría empezar a vender
        // al menos una fracción de lo que vende el promedio de su cluster
        let ritmoBase = ritmoActual;
        let usandoRitmoCluster = false;
        
        if (ritmoActual === 0 && ritmoCluster > 0) {
            // Usar 30% del ritmo del cluster como baseline para productos sin tracción
            // Ajustado por el cambio de precio (si bajas mucho, podría vender más)
            const factorPrecio = deltaPrecioPorcentaje < 0 ? Math.min(1, Math.abs(deltaPrecioPorcentaje) * 2) : 0;
            ritmoBase = ritmoCluster * 0.3 * (0.5 + factorPrecio);
            usandoRitmoCluster = true;
        }
        
        const ritmoProyectado = Math.max(0, ritmoBase * (1 + elasticity.value * deltaPrecioPorcentaje));
        const unidadesProyectadas = ritmoProyectado * horizonteDias;
        const unidadesProyectadasCap = Math.min(unidadesProyectadas, stockTotal);
        const ingresoProyectado = unidadesProyectadasCap * input.precioPropuesto;
        const margenUnitario = input.precioPropuesto - costo;
        const margenTotal = unidadesProyectadasCap * margenUnitario;
        const costoCastigo = (input.precioActual - input.precioPropuesto) * unidadesProyectadasCap;
        const sellOutProyectadoPorcentaje = stockTotal > 0 ? (unidadesProyectadasCap / stockTotal) * 100 : 0;

        const warnings: string[] = [];
        if (usandoRitmoCluster) {
            warnings.push(`📊 Producto sin ventas recientes. Usando ${(ritmoCluster * 0.3).toFixed(2)} u/día (30% del cluster: ${ritmoCluster.toFixed(2)} u/día) como estimación base.`);
        }
        if (margenUnitario < 0) {
            warnings.push('⚠️ El margen unitario queda negativo con este precio');
        }
        if (elasticity.confidence === 'baja') {
            warnings.push(`⚠️ Elasticidad estimada con baja confianza (${elasticity.observations} observaciones)`);
        }
        if (sellOutProyectadoPorcentaje < 50 && stockTotal > 0 && !usandoRitmoCluster) {
            warnings.push(`⚠️ Sell-out proyectado bajo (${sellOutProyectadoPorcentaje.toFixed(1)}%)`);
        }

        const thresholds = await getThresholds();
        let breakEvenPrecio: number | undefined;
        if (thresholds.margenMinimoAceptable !== null && stockTotal > 0) {
            breakEvenPrecio = costo / (1 - thresholds.margenMinimoAceptable / 100);
        }

        const simulation: PriceSimulationResult = {
            baseCol: input.baseCol,
            precioActual: input.precioActual,
            precioPropuesto: input.precioPropuesto,
            deltaPrecioPorcentaje: deltaPrecioPorcentaje * 100,
            elasticidad: elasticity,
            ritmoActual,
            ritmoProyectado,
            unidadesProyectadas,
            unidadesProyectadasCap,
            ingresoProyectado,
            costo,
            margenUnitario,
            margenTotal,
            costoCastigo,
            sellOutProyectadoPorcentaje,
            stockTotal,
            horizonteDias,
            warnings,
            breakEvenPrecio
        };

        return NextResponse.json(simulation);

    } catch (error) {
        console.error('Error en simulator API:', error);
        return NextResponse.json(
            { error: 'Error al simular cambio de precio', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
