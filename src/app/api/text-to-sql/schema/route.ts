import { NextRequest, NextResponse } from 'next/server';
import { getSchemaForDisplay, loadSchemaFromCSV, getAllowedTables } from '@/lib/text-to-sql-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/text-to-sql/schema
 * Retorna el esquema de la base de datos disponible para consultas
 */
export async function GET(req: NextRequest) {
    try {
        // Check for detailed view
        const detailed = req.nextUrl.searchParams.get('detailed') === 'true';

        if (detailed) {
            // Return full schema for allowed tables
            const tables = await loadSchemaFromCSV();
            const allowedTables = getAllowedTables(tables);

            return NextResponse.json({
                tables: allowedTables.map(t => ({
                    schema: t.schemaName,
                    name: t.tableName,
                    fullName: `${t.schemaName}.${t.tableName}`,
                    columns: t.columns.map(c => ({
                        name: c.name,
                        dataType: c.dataType,
                        maxLength: c.maxLength,
                        precision: c.precision,
                        scale: c.scale,
                        isNullable: c.isNullable,
                        isIdentity: c.isIdentity,
                        isPrimaryKey: c.isPrimaryKey
                    }))
                })),
                relationships: [
                    {
                        from: 'Transacciones.BaseCol',
                        to: 'Articulos.Base',
                        type: 'many-to-one',
                        note: 'Código base del producto'
                    },
                    {
                        from: 'UltimaCompra.BaseArticulo',
                        to: 'Articulos.IdArticulo',
                        type: 'many-to-one',
                        note: 'Usar Articulos.Base para relacionar con Transacciones.BaseCol'
                    },
                    {
                        from: 'MovStockTotalResumen.IdArticulo',
                        to: 'Articulos.IdArticulo',
                        type: 'many-to-one',
                        note: 'Usar Articulos.Base para relacionar con Transacciones.BaseCol'
                    },
                    {
                        from: 'Transacciones.IdDeposito',
                        to: 'Tiendas.IdTienda',
                        type: 'many-to-one'
                    }
                ],
                notes: [
                    'Los costos en UltimaCompra no incluyen IVA (multiplicar por 1.22)',
                    'BaseCol son los primeros 13 caracteres del IdArticulo',
                    'Stock debe obtenerse SIEMPRE de MovStockTotalResumen'
                ]
            });
        }

        // Return simplified schema for display
        const schema = await getSchemaForDisplay();

        return NextResponse.json({
            allowedTables: schema.allowedTables,
            totalTablesInDatabase: schema.totalTables,
            allowedCount: schema.allowedTables.length,
            usage: 'Use POST /api/text-to-sql/ask to query these tables with natural language',
            examples: [
                'Ventas totales por marca en los últimos 30 días',
                'Top 10 productos más vendidos',
                'Stock actual por tienda',
                'Margen promedio por categoría'
            ]
        });

    } catch (error) {
        console.error('Error in schema endpoint:', error);
        return NextResponse.json(
            { 
                error: 'Error al obtener esquema',
                details: error instanceof Error ? error.message : 'Error desconocido'
            },
            { status: 500 }
        );
    }
}
