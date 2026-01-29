import { NextRequest, NextResponse } from 'next/server';
import { validateSQL } from '@/lib/text-to-sql-service';
import { logSQLValidation } from '@/lib/audit-logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/text-to-sql/validate-sql
 * Valida una consulta SQL sin ejecutarla
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { sql, userId } = body;

        if (!sql || typeof sql !== 'string') {
            return NextResponse.json(
                { error: 'Se requiere el campo "sql"' },
                { status: 400 }
            );
        }

        const validation = validateSQL(sql);

        // Log validation
        await logSQLValidation({
            sql,
            isValid: validation.isValid,
            errors: validation.errors,
            warnings: validation.warnings,
            userId
        });

        return NextResponse.json({
            isValid: validation.isValid,
            errors: validation.errors,
            warnings: validation.warnings,
            sanitizedSQL: validation.sanitizedSQL,
            rules: {
                onlySELECT: 'Solo se permiten consultas SELECT',
                maxRows: 'Límite máximo de 1000 filas (default 500)',
                timeout: 'Timeout de 15 segundos',
                noComments: 'Los comentarios SQL son removidos',
                noMultipleStatements: 'Solo una sentencia permitida'
            }
        });

    } catch (error) {
        console.error('Error in validate-sql endpoint:', error);
        return NextResponse.json(
            { 
                error: 'Error al validar SQL',
                details: error instanceof Error ? error.message : 'Error desconocido'
            },
            { status: 500 }
        );
    }
}
