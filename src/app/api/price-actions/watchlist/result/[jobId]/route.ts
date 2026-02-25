import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { WatchlistResponse, WatchlistJobResultSummary } from '@/types/price-actions';
import sql from 'mssql';

// Columnas válidas para ordenamiento
type SortColumn = 'score' | 'baseCol' | 'categoria' | 'marca' | 'precioActual' | 'costoProm' |
    'stockTotal' | 'ritmoActual' | 'indiceRitmo' | 'diasStock' | 'motivo';

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

        // Parámetros de ordenamiento
        const sortColumn = (searchParams.get('sortColumn') as SortColumn) || 'score';
        const sortDirection = searchParams.get('sortDirection') === 'asc' ? 'asc' : 'desc';

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

        // Ordenar TODOS los items antes de paginar
        const allItems = resultData.items || [];

        // Ordenar según los parámetros
        const sortedItems = [...allItems].sort((a: any, b: any) => {
            let aVal: any;
            let bVal: any;

            switch (sortColumn) {
                case 'score':
                    aVal = a.score || 0;
                    bVal = b.score || 0;
                    break;
                case 'baseCol':
                    aVal = (a.baseCol || '').toLowerCase();
                    bVal = (b.baseCol || '').toLowerCase();
                    break;
                case 'categoria':
                    aVal = (a.categoria || '').toLowerCase();
                    bVal = (b.categoria || '').toLowerCase();
                    break;
                case 'marca':
                    aVal = (a.marca || '').toLowerCase();
                    bVal = (b.marca || '').toLowerCase();
                    break;
                case 'precioActual':
                    aVal = a.precioActual || 0;
                    bVal = b.precioActual || 0;
                    break;
                case 'costoProm':
                    aVal = a.costo || 0;
                    bVal = b.costo || 0;
                    break;
                case 'stockTotal':
                    aVal = a.stockTotal || 0;
                    bVal = b.stockTotal || 0;
                    break;
                case 'ritmoActual':
                    aVal = a.ritmoActual || 0;
                    bVal = b.ritmoActual || 0;
                    break;
                case 'indiceRitmo':
                    aVal = a.indiceRitmo || 0;
                    bVal = b.indiceRitmo || 0;
                    break;
                case 'diasStock':
                    aVal = a.diasStock ?? 999999;
                    bVal = b.diasStock ?? 999999;
                    break;
                case 'motivo':
                    aVal = Array.isArray(a.motivo) ? a.motivo[0] || '' : '';
                    bVal = Array.isArray(b.motivo) ? b.motivo[0] || '' : '';
                    break;
                default:
                    aVal = a.score || 0;
                    bVal = b.score || 0;
            }

            if (typeof aVal === 'string' && typeof bVal === 'string') {
                return sortDirection === 'asc' ? aVal.localeCompare(bVal, 'es') : bVal.localeCompare(aVal, 'es');
            }
            return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        });

        // Aplicar paginación a los items ordenados
        const total = sortedItems.length;
        const totalPages = Math.ceil(total / pageSize);
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedItems = sortedItems.slice(startIndex, endIndex);

        const response: WatchlistResponse & { summary?: WatchlistJobResultSummary; completedAt?: Date; sorting?: { column: string; direction: string } } = {
            items: paginatedItems,
            total,
            page,
            pageSize,
            totalPages,
            summary: resultSummary || undefined,
            completedAt: job.CompletedAt,
            sorting: {
                column: sortColumn,
                direction: sortDirection
            }
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
