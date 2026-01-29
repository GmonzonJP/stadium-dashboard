import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import sql from 'mssql';

/**
 * POST /api/price-actions/watchlist/cancel/[jobId]
 * Cancela un job de watchlist en ejecución
 */
export async function POST(
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

        // Intentar cancelar el job
        const result = await executeQuery(
            `UPDATE PriceActionsJobs 
             SET Status = 'cancelled', 
                 CurrentStep = 'Cancelado por usuario',
                 CancelledAt = GETDATE()
             OUTPUT INSERTED.Id, INSERTED.Status
             WHERE Id = @jobId AND Status IN ('pending', 'running')`,
            [{ name: 'jobId', type: sql.UniqueIdentifier, value: jobId }]
        );

        if (result.recordset.length === 0) {
            // Verificar si el job existe
            const checkResult = await executeQuery(
                `SELECT Status FROM PriceActionsJobs WHERE Id = @jobId`,
                [{ name: 'jobId', type: sql.UniqueIdentifier, value: jobId }]
            );

            if (checkResult.recordset.length === 0) {
                return NextResponse.json(
                    { error: 'Job no encontrado' },
                    { status: 404 }
                );
            }

            const currentStatus = checkResult.recordset[0].Status;
            return NextResponse.json(
                { 
                    error: 'No se puede cancelar el job', 
                    reason: `El job ya está en estado: ${currentStatus}` 
                },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            jobId,
            message: 'Job cancelado exitosamente'
        });

    } catch (error) {
        console.error('Error cancelling job:', error);
        return NextResponse.json(
            { error: 'Error al cancelar el job', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
