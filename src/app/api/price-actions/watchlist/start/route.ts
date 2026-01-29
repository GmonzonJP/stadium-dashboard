import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { WatchlistFilters, WatchlistJobParameters, StartJobResponse } from '@/types/price-actions';
import sql from 'mssql';
import { processWatchlistJob } from '@/lib/price-actions/watchlist-job-processor';

/**
 * POST /api/price-actions/watchlist/start
 * Inicia un job asíncrono para calcular la watchlist
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const filters: WatchlistFilters = body.filters || {};
        const fechaDesde: string | undefined = body.fechaDesde;
        const fechaHasta: string | undefined = body.fechaHasta;
        const ritmoVentanaDias: number = body.ritmoVentanaDias || 14;
        const cycleDays: number = body.cycleDays || 90;
        const createdBy: string | undefined = body.createdBy;

        // Validar parámetros
        if (fechaDesde && fechaHasta) {
            const desde = new Date(fechaDesde);
            const hasta = new Date(fechaHasta);
            if (desde > hasta) {
                return NextResponse.json(
                    { error: 'fechaDesde debe ser anterior a fechaHasta' },
                    { status: 400 }
                );
            }
        }

        // Crear job en la base de datos
        const parameters: WatchlistJobParameters = {
            filters,
            fechaDesde,
            fechaHasta,
            ritmoVentanaDias,
            cycleDays
        };

        const result = await executeQuery(
            `INSERT INTO PriceActionsJobs 
             (JobType, Status, Progress, CurrentStep, TotalItems, ProcessedItems, Parameters, CreatedBy, CreatedAt)
             OUTPUT INSERTED.Id
             VALUES ('watchlist', 'pending', 0, 'Iniciando...', 0, 0, @parameters, @createdBy, GETDATE())`,
            [
                { name: 'parameters', type: sql.NVarChar(sql.MAX), value: JSON.stringify(parameters) },
                { name: 'createdBy', type: sql.NVarChar(100), value: createdBy || null }
            ]
        );

        const jobId = result.recordset[0].Id;

        // Iniciar el proceso en background (no esperamos a que termine)
        // Usamos setImmediate para que el proceso se ejecute en el siguiente tick del event loop
        setImmediate(() => {
            processWatchlistJob(jobId, parameters).catch(error => {
                console.error(`Error processing job ${jobId}:`, error);
            });
        });

        const response: StartJobResponse = {
            jobId,
            status: 'pending',
            message: 'Job iniciado exitosamente'
        };

        return NextResponse.json(response);

    } catch (error) {
        console.error('Error starting watchlist job:', error);
        return NextResponse.json(
            { error: 'Error al iniciar el job', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
