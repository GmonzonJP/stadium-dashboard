/**
 * Procesador de jobs asíncronos para Watchlist
 * Ejecuta el cálculo de watchlist usando stored procedures y actualiza el progreso
 */

import { executeQuery, getDbConnection } from '@/lib/db';
import { 
    WatchlistJobParameters, 
    WatchlistItem, 
    WatchlistResponse,
    WatchlistJobResultSummary,
    WatchlistReason
} from '@/types/price-actions';
import sql from 'mssql';

// Map para trackear jobs cancelados (evitar que sigan procesando)
const cancelledJobs = new Set<string>();

/**
 * Actualiza el progreso de un job en la base de datos
 */
async function updateJobProgress(
    jobId: string,
    progress: number,
    currentStep: string,
    processedItems?: number,
    totalItems?: number
): Promise<boolean> {
    try {
        // Verificar si el job fue cancelado
        if (cancelledJobs.has(jobId)) {
            return false;
        }

        const params: { name: string; type: any; value: any }[] = [
            { name: 'jobId', type: sql.UniqueIdentifier, value: jobId },
            { name: 'progress', type: sql.Int, value: Math.min(100, Math.max(0, progress)) },
            { name: 'currentStep', type: sql.NVarChar(500), value: currentStep }
        ];

        let query = `
            UPDATE PriceActionsJobs 
            SET Progress = @progress, CurrentStep = @currentStep`;

        if (processedItems !== undefined) {
            query += `, ProcessedItems = @processedItems`;
            params.push({ name: 'processedItems', type: sql.Int, value: processedItems });
        }

        if (totalItems !== undefined) {
            query += `, TotalItems = @totalItems`;
            params.push({ name: 'totalItems', type: sql.Int, value: totalItems });
        }

        query += ` WHERE Id = @jobId AND Status = 'running'`;

        const result = await executeQuery(query, params);
        
        // Si no se actualizó ningún registro, el job fue cancelado o terminó
        return result.rowsAffected[0] > 0;
    } catch (error) {
        console.error(`Error updating job progress for ${jobId}:`, error);
        return false;
    }
}

/**
 * Marca el job como iniciado (running)
 */
async function startJob(jobId: string): Promise<boolean> {
    try {
        const result = await executeQuery(
            `UPDATE PriceActionsJobs 
             SET Status = 'running', StartedAt = GETDATE(), CurrentStep = 'Consultando base de datos...'
             WHERE Id = @jobId AND Status = 'pending'`,
            [{ name: 'jobId', type: sql.UniqueIdentifier, value: jobId }]
        );
        return result.rowsAffected[0] > 0;
    } catch (error) {
        console.error(`Error starting job ${jobId}:`, error);
        return false;
    }
}

/**
 * Marca el job como completado
 */
async function completeJob(
    jobId: string,
    resultData: WatchlistResponse,
    resultSummary: WatchlistJobResultSummary
): Promise<void> {
    try {
        await executeQuery(
            `UPDATE PriceActionsJobs 
             SET Status = 'completed', 
                 Progress = 100,
                 CurrentStep = 'Completado',
                 ResultData = @resultData,
                 ResultSummary = @resultSummary,
                 CompletedAt = GETDATE()
             WHERE Id = @jobId`,
            [
                { name: 'jobId', type: sql.UniqueIdentifier, value: jobId },
                { name: 'resultData', type: sql.NVarChar(sql.MAX), value: JSON.stringify(resultData) },
                { name: 'resultSummary', type: sql.NVarChar(sql.MAX), value: JSON.stringify(resultSummary) }
            ]
        );
    } catch (error) {
        console.error(`Error completing job ${jobId}:`, error);
        throw error;
    }
}

/**
 * Marca el job como fallido
 */
async function failJob(jobId: string, errorMessage: string): Promise<void> {
    try {
        await executeQuery(
            `UPDATE PriceActionsJobs 
             SET Status = 'failed', 
                 CurrentStep = 'Error',
                 ErrorMessage = @errorMessage,
                 CompletedAt = GETDATE()
             WHERE Id = @jobId`,
            [
                { name: 'jobId', type: sql.UniqueIdentifier, value: jobId },
                { name: 'errorMessage', type: sql.NVarChar(sql.MAX), value: errorMessage }
            ]
        );
    } catch (error) {
        console.error(`Error failing job ${jobId}:`, error);
    }
}

/**
 * Verifica si el job fue cancelado
 */
async function isJobCancelled(jobId: string): Promise<boolean> {
    if (cancelledJobs.has(jobId)) {
        return true;
    }

    try {
        const result = await executeQuery(
            `SELECT Status FROM PriceActionsJobs WHERE Id = @jobId`,
            [{ name: 'jobId', type: sql.UniqueIdentifier, value: jobId }]
        );

        if (result.recordset.length > 0 && result.recordset[0].Status === 'cancelled') {
            cancelledJobs.add(jobId);
            return true;
        }

        return false;
    } catch (error) {
        return false;
    }
}

/**
 * Procesa un job de watchlist de forma asíncrona
 */
export async function processWatchlistJob(
    jobId: string,
    parameters: WatchlistJobParameters
): Promise<void> {
    console.log(`[Job ${jobId}] Iniciando procesamiento...`);

    try {
        // 1. Marcar como iniciado
        const started = await startJob(jobId);
        if (!started) {
            console.log(`[Job ${jobId}] No se pudo iniciar (ya está en otro estado)`);
            return;
        }

        // 2. Preparar parámetros para el stored procedure
        const { filters, fechaDesde, fechaHasta, ritmoVentanaDias = 14, cycleDays = 90 } = parameters;
        
        // Convertir arrays a strings comma-separated
        const idMarcas = filters.brands?.join(',') || null;
        const idCategorias = filters.categories?.join(',') || null;
        const idGeneros = filters.genders?.join(',') || null;
        const idTiendas = filters.stores?.join(',') || null;
        const searchTerm = filters.search || null;

        // 3. Actualizar progreso
        await updateJobProgress(jobId, 10, 'Ejecutando consulta de watchlist...');

        // Verificar cancelación
        if (await isJobCancelled(jobId)) {
            console.log(`[Job ${jobId}] Cancelado antes de ejecutar SP`);
            return;
        }

        // 4. Ejecutar stored procedure
        console.log(`[Job ${jobId}] Ejecutando sp_GetPriceActionsWatchlist...`);
        
        const spParams = [
            { name: 'FechaDesde', type: sql.Date, value: fechaDesde || null },
            { name: 'FechaHasta', type: sql.Date, value: fechaHasta || null },
            { name: 'RitmoVentanaDias', type: sql.Int, value: ritmoVentanaDias },
            { name: 'CycleDays', type: sql.Int, value: cycleDays },
            { name: 'IdMarcas', type: sql.NVarChar(sql.MAX), value: idMarcas },
            { name: 'IdCategorias', type: sql.NVarChar(sql.MAX), value: idCategorias },
            { name: 'IdGeneros', type: sql.NVarChar(sql.MAX), value: idGeneros },
            { name: 'IdTiendas', type: sql.NVarChar(sql.MAX), value: idTiendas },
            { name: 'SearchTerm', type: sql.NVarChar(200), value: searchTerm }
        ];

        const result = await executeQuery(
            `EXEC sp_GetPriceActionsWatchlist 
                @FechaDesde = @FechaDesde,
                @FechaHasta = @FechaHasta,
                @RitmoVentanaDias = @RitmoVentanaDias,
                @CycleDays = @CycleDays,
                @IdMarcas = @IdMarcas,
                @IdCategorias = @IdCategorias,
                @IdGeneros = @IdGeneros,
                @IdTiendas = @IdTiendas,
                @SearchTerm = @SearchTerm`,
            spParams
        );

        // Verificar cancelación
        if (await isJobCancelled(jobId)) {
            console.log(`[Job ${jobId}] Cancelado después de ejecutar SP`);
            return;
        }

        // 5. Procesar resultados
        await updateJobProgress(jobId, 50, 'Procesando resultados...');

        const rawItems = result.recordset;
        const totalItems = rawItems.length;

        console.log(`[Job ${jobId}] Encontrados ${totalItems} productos en watchlist`);

        await updateJobProgress(jobId, 60, `Procesando ${totalItems} productos...`, 0, totalItems);

        // 6. Transformar resultados a formato WatchlistItem
        const items: WatchlistItem[] = [];
        const batchSize = 50;

        for (let i = 0; i < rawItems.length; i += batchSize) {
            // Verificar cancelación cada batch
            if (await isJobCancelled(jobId)) {
                console.log(`[Job ${jobId}] Cancelado durante procesamiento`);
                return;
            }

            const batch = rawItems.slice(i, i + batchSize);
            
            for (const row of batch) {
                // Determinar motivos
                const motivos: WatchlistReason[] = [];
                if (row.MotivoEarly === 1) motivos.push('Early');
                if (row.MotivoDesacelera === 1) motivos.push('Desacelera');
                if (row.MotivoSobrestock === 1) motivos.push('Sobrestock');
                if (row.MotivoSinTraccion === 1) motivos.push('Sin tracción');

                const item: WatchlistItem = {
                    baseCol: row.BaseCol,
                    descripcion: row.Descripcion || '',
                    descripcionCorta: row.DescripcionCorta || '',
                    categoria: row.Categoria || '',
                    idClase: row.IdClase,
                    marca: row.Marca || '',
                    idMarca: row.IdMarca,
                    genero: row.Genero || '',
                    idGenero: row.IdGenero,
                    priceBand: row.PriceBand || '',
                    precioActual: Number(row.PrecioActual) || 0,
                    costo: Number(row.Costo) || 0,
                    stockTotal: Number(row.StockTotal) || 0,
                    unidadesUltimos7: Number(row.Unidades7) || 0,
                    unidadesUltimos14: Number(row.Unidades14) || 0,
                    unidadesUltimos28: Number(row.Unidades28) || 0,
                    ritmoActual: Number(row.RitmoActual) || 0,
                    ritmoCluster: Number(row.RitmoCluster) || 0,
                    indiceRitmo: Number(row.IndiceRitmo) || 0,
                    indiceDesaceleracion: Number(row.IndiceDesaceleracion) || 0,
                    diasStock: row.DiasStock !== null ? Number(row.DiasStock) : null,
                    diasDesdeInicio: Number(row.DiasDesdeInicio) || 0,
                    diasRestantesCiclo: row.DiasRestantesCiclo !== null ? Number(row.DiasRestantesCiclo) : null,
                    motivo: motivos,
                    score: Number(row.Score) || 0,
                    cluster: {
                        idClase: row.IdClase,
                        descripcionClase: row.Categoria || '',
                        idGenero: row.IdGenero,
                        descripcionGenero: row.Genero || '',
                        idMarca: row.IdMarca,
                        descripcionMarca: row.Marca || '',
                        priceBand: row.PriceBand || ''
                    }
                };

                items.push(item);
            }

            // Actualizar progreso
            const progress = 60 + Math.round((i + batchSize) / totalItems * 35);
            await updateJobProgress(
                jobId, 
                Math.min(95, progress), 
                `Procesando ${Math.min(i + batchSize, totalItems)} de ${totalItems} productos...`,
                Math.min(i + batchSize, totalItems)
            );
        }

        // 7. Calcular resumen
        await updateJobProgress(jobId, 96, 'Generando resumen...');

        const criticalCount = items.filter(item => item.indiceRitmo < 0.6).length;
        const lowCount = items.filter(item => item.indiceRitmo >= 0.6 && item.indiceRitmo < 0.9).length;
        const normalCount = items.filter(item => item.indiceRitmo >= 0.9).length;
        const averageScore = items.length > 0 
            ? items.reduce((sum, item) => sum + item.score, 0) / items.length 
            : 0;

        // Contar motivos
        const motivoCounts: Record<string, number> = {};
        items.forEach(item => {
            item.motivo.forEach(m => {
                motivoCounts[m] = (motivoCounts[m] || 0) + 1;
            });
        });

        const topMotivos = Object.entries(motivoCounts)
            .map(([motivo, count]) => ({ motivo: motivo as WatchlistReason, count }))
            .sort((a, b) => b.count - a.count);

        const resultSummary: WatchlistJobResultSummary = {
            totalItems: items.length,
            criticalCount,
            lowCount,
            normalCount,
            averageScore: Math.round(averageScore * 10) / 10,
            topMotivos
        };

        // 8. Ordenar por score descendente
        items.sort((a, b) => b.score - a.score);

        // 9. Crear respuesta final
        const response: WatchlistResponse = {
            items,
            total: items.length,
            page: 1,
            pageSize: items.length,
            totalPages: 1
        };

        // 10. Guardar resultados
        await updateJobProgress(jobId, 98, 'Guardando resultados...');
        await completeJob(jobId, response, resultSummary);

        console.log(`[Job ${jobId}] Completado exitosamente. ${items.length} items procesados.`);

    } catch (error) {
        console.error(`[Job ${jobId}] Error:`, error);
        await failJob(jobId, error instanceof Error ? error.message : String(error));
    } finally {
        // Limpiar de la lista de cancelados si estaba
        cancelledJobs.delete(jobId);
    }
}

/**
 * Marca un job como cancelado localmente (para detener el procesamiento)
 */
export function markJobAsCancelled(jobId: string): void {
    cancelledJobs.add(jobId);
}
