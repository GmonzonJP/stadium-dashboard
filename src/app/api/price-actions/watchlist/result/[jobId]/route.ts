import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { WatchlistResponse, WatchlistJobResultSummary } from '@/types/price-actions';
import sql from 'mssql';

/**
 * GET /api/price-actions/watchlist/result/[jobId]
 * Obtiene los resultados de un job de watchlist completado
 */
export async function GET(
    req: NextRequest,
    { params }: { params: { jobId: string } }
) {
    try {
        const { jobId } = params;
        const { searchParams } = new URL(req.url);
        
        // Parámetros de paginación
        const page = Math.max(1, Number(searchParams.get('page')) || 1);
        const pageSize = Math.min(200, Math.max(1, Number(searchParams.get('pageSize')) || 50));

        if (!jobId) {
            return NextResponse.json(
                { error: 'jobId es requerido' },
                { status: 400 }
            );
        }

        // Obtener job
        const result = await executeQuery(
            `SELECT 
                Id,
                Status,
                ResultData,
                ResultSummary,
                ErrorMessage,
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

        // Verificar que el job esté completado
        if (job.Status !== 'completed') {
            return NextResponse.json(
                { 
                    error: 'Resultados no disponibles', 
                    reason: `El job está en estado: ${job.Status}`,
                    status: job.Status
                },
                { status: 400 }
            );
        }

        // Parsear resultados
        let resultData: WatchlistResponse | null = null;
        let resultSummary: WatchlistJobResultSummary | null = null;

        if (job.ResultData) {
            try {
                resultData = JSON.parse(job.ResultData);
            } catch (e) {
                console.error('Error parsing ResultData:', e);
            }
        }

        if (job.ResultSummary) {
            try {
                resultSummary = JSON.parse(job.ResultSummary);
            } catch (e) {
                console.error('Error parsing ResultSummary:', e);
            }
        }

        if (!resultData) {
            return NextResponse.json(
                { error: 'No hay datos de resultados disponibles' },
                { status: 500 }
            );
        }

        // Aplicar paginación a los items
        const allItems = resultData.items || [];
        const total = allItems.length;
        const totalPages = Math.ceil(total / pageSize);
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedItems = allItems.slice(startIndex, endIndex);

        const response: WatchlistResponse & { summary?: WatchlistJobResultSummary; completedAt?: Date } = {
            items: paginatedItems,
            total,
            page,
            pageSize,
            totalPages,
            summary: resultSummary || undefined,
            completedAt: job.CompletedAt
        };

        return NextResponse.json(response);

    } catch (error) {
        console.error('Error getting job results:', error);
        return NextResponse.json(
            { error: 'Error al obtener resultados', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
