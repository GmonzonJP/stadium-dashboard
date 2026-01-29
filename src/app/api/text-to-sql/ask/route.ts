import { NextRequest, NextResponse } from 'next/server';
import { 
    processTextToSQL, 
    validateSQL, 
    loadSchemaFromCSV, 
    retrieveRelevantTables,
    TextToSQLRequest 
} from '@/lib/text-to-sql-service';
import { logTextToSQLQuery, logTextToSQLError } from '@/lib/audit-logger';

export const dynamic = 'force-dynamic';

// Rate limiting simple (en memoria)
const requestTimes = new Map<string, number[]>();
const MAX_REQUESTS_PER_MINUTE = 10;

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    
    const times = requestTimes.get(ip) || [];
    const recentTimes = times.filter(t => now - t < windowMs);
    
    if (recentTimes.length >= MAX_REQUESTS_PER_MINUTE) {
        return false;
    }
    
    recentTimes.push(now);
    requestTimes.set(ip, recentTimes);
    return true;
}

/**
 * POST /api/text-to-sql/ask
 * Procesa una pregunta en lenguaje natural y retorna resultados SQL
 */
export async function POST(req: NextRequest) {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    
    try {
        // Rate limiting
        if (!checkRateLimit(ip)) {
            return NextResponse.json(
                { error: 'Demasiadas solicitudes. Intenta en un minuto.' },
                { status: 429 }
            );
        }

        const body = await req.json();
        const { question, filters, mode = 'table', userId } = body as TextToSQLRequest & { userId?: string };

        // Validate request
        if (!question || typeof question !== 'string') {
            return NextResponse.json(
                { error: 'Se requiere el campo "question"' },
                { status: 400 }
            );
        }

        if (question.length > 1000) {
            return NextResponse.json(
                { error: 'La pregunta es demasiado larga (máximo 1000 caracteres)' },
                { status: 400 }
            );
        }

        // Check for SQL injection attempts in the question
        const suspiciousPatterns = /DROP|DELETE|INSERT|UPDATE|ALTER|EXEC|xp_|sp_|TRUNCATE/i;
        if (suspiciousPatterns.test(question)) {
            await logTextToSQLError({
                question,
                error: 'Posible intento de SQL injection en la pregunta',
                userId,
                ip
            });
            return NextResponse.json(
                { error: 'Pregunta inválida' },
                { status: 400 }
            );
        }

        // Process the question
        const result = await processTextToSQL({
            question,
            filters,
            mode
        });

        // Log successful query
        await logTextToSQLQuery({
            question,
            sql: result.sql,
            executionMs: result.meta.executionMs,
            rowCount: result.meta.rowCount,
            tablesUsed: result.meta.tablesUsed,
            warnings: result.meta.warnings,
            filters,
            userId,
            ip
        });

        return NextResponse.json({
            sql: result.sql,
            result_preview: result.resultPreview,
            explanation: result.explanation,
            meta: result.meta
        });

    } catch (error) {
        console.error('Error in ask endpoint:', error);

        // Log error
        await logTextToSQLError({
            error: error instanceof Error ? error.message : 'Error desconocido',
            ip
        });

        return NextResponse.json(
            { 
                error: 'Error procesando la pregunta',
                details: error instanceof Error ? error.message : 'Error desconocido'
            },
            { status: 500 }
        );
    }
}

/**
 * GET /api/text-to-sql/ask
 * Retorna información sobre cómo usar el endpoint
 */
export async function GET(req: NextRequest) {
    return NextResponse.json({
        description: 'Endpoint Text-to-SQL para consultas en lenguaje natural',
        method: 'POST',
        body: {
            question: {
                type: 'string',
                required: true,
                description: 'Pregunta en lenguaje natural sobre los datos',
                example: '¿Cuáles son las ventas totales por marca en el último mes?'
            },
            filters: {
                type: 'object',
                required: false,
                description: 'Filtros a aplicar a la consulta',
                properties: {
                    startDate: 'Fecha inicio (YYYY-MM-DD)',
                    endDate: 'Fecha fin (YYYY-MM-DD)',
                    tiendas: 'Array de IDs de tiendas',
                    marcas: 'Array de IDs de marcas'
                }
            },
            mode: {
                type: 'string',
                required: false,
                default: 'table',
                enum: ['table', 'summary'],
                description: 'Modo de respuesta: "table" retorna hasta 500 filas, "summary" retorna hasta 10'
            }
        },
        response: {
            sql: 'Query SQL generada',
            result_preview: 'Datos resultantes',
            explanation: 'Explicación de la consulta',
            meta: {
                tables_used: 'Tablas utilizadas',
                execution_ms: 'Tiempo de ejecución en ms',
                rowcount: 'Cantidad de filas',
                warnings: 'Advertencias si las hay',
                query_limited: 'Si los resultados fueron limitados'
            }
        },
        guardrails: {
            onlySelect: 'Solo se permiten consultas SELECT',
            rowLimit: 'Máximo 500 filas por defecto (1000 máximo)',
            timeout: '15 segundos de timeout',
            rateLimit: '10 solicitudes por minuto',
            auditLogging: 'Todas las consultas son registradas'
        },
        examples: [
            {
                question: 'Top 10 productos más vendidos',
                filters: { startDate: '2024-01-01', endDate: '2024-01-31' }
            },
            {
                question: 'Ventas totales por tienda',
                filters: { marcas: [1, 2, 3] }
            },
            {
                question: 'Stock actual por marca',
                mode: 'summary'
            }
        ]
    });
}
