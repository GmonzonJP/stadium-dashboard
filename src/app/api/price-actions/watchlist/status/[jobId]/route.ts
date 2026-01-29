import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { JobStatusResponse } from '@/types/price-actions';
import sql from 'mssql';

/**
 * GET /api/price-actions/watchlist/status/[jobId]
 * Consulta el estado de un job de watchlist
 */
export async function GET(
    req: NextRequest,
    { params }: { params: { jobId: string } }
) {
    try {
        const { jobId } = params;

        if (!jobId) {
            return NextResponse.json(
                { error: 'jobId es requerido' },
                { status: 400 }
            );
        }

        const result = await executeQuery(
            `SELECT 
                Id,
                Status,
                Progress,
                CurrentStep,
                TotalItems,
                ProcessedItems,
                ErrorMessage,
                CreatedAt,
                StartedAt,
                CompletedAt
             FROM PriceActionsJobs 
             WHERE Id = @jobId`,
            [{ name: 'jobId', type: sql.UniqueIdentifier, value: jobId }]
        );

        if (result.recordset.length === 0) {
            return NextResponse.json(
                { error: 'Job no encontrado' },
                { status: 404 }
            );
        }

        const job = result.recordset[0];
        
        // Calcular tiempo transcurrido
        let elapsedSeconds: number | undefined;
        if (job.StartedAt) {
            const startTime = new Date(job.StartedAt).getTime();
            const endTime = job.CompletedAt 
                ? new Date(job.CompletedAt).getTime() 
                : Date.now();
            elapsedSeconds = Math.round((endTime - startTime) / 1000);
        }

        const response: JobStatusResponse = {
            id: job.Id,
            status: job.Status,
            progress: job.Progress,
            currentStep: job.CurrentStep,
            totalItems: job.TotalItems,
            processedItems: job.ProcessedItems,
            errorMessage: job.ErrorMessage,
            createdAt: job.CreatedAt,
            startedAt: job.StartedAt,
            completedAt: job.CompletedAt,
            elapsedSeconds
        };

        return NextResponse.json(response);

    } catch (error) {
        console.error('Error getting job status:', error);
        return NextResponse.json(
            { error: 'Error al obtener estado del job', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
