import { NextRequest, NextResponse } from 'next/server';
import { validateDepositoTiendaMapping, getCachedValidation } from '@/lib/deposito-tienda-validator';

export const dynamic = 'force-dynamic';

/**
 * GET /api/validation/deposito-tienda
 * Retorna el estado de la validación del mapeo Depósito → Tienda
 */
export async function GET(req: NextRequest) {
    try {
        // Check if force refresh is requested
        const searchParams = req.nextUrl.searchParams;
        const forceRefresh = searchParams.get('refresh') === 'true';

        const validation = await validateDepositoTiendaMapping(forceRefresh);

        return NextResponse.json({
            isValid: validation.isValid,
            totalDepositosChecked: validation.totalDepositosChecked,
            matchingDepositos: validation.matchingDepositos,
            missingMappings: validation.missingMappings,
            warning: validation.warning,
            validatedAt: validation.validatedAt.toISOString(),
            mode: validation.mode
        });

    } catch (error) {
        console.error('Error in deposito-tienda validation endpoint:', error);
        return NextResponse.json(
            { 
                error: 'Error al validar mapeo', 
                details: error instanceof Error ? error.message : 'Error desconocido'
            },
            { status: 500 }
        );
    }
}
