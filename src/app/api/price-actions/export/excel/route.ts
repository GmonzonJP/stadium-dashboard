import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import sql from 'mssql';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const estados = body.estado || ['pendiente', 'aprobado'];

        // Obtener propuestas
        const query = `
            SELECT 
                BaseCol, Descripcion, PrecioActual, PrecioPropuesto, Motivo,
                SellOutProyectado, MargenTotalProyectado, CostoCastigo,
                Estado, UsuarioNombre, CreatedAt
            FROM PriceChangeProposals
            WHERE Estado IN (${estados.map((e: string) => `'${e}'`).join(',')})
            ORDER BY CreatedAt DESC
        `;

        const result = await executeQuery(query);
        const proposals = result.recordset;

        // Generar CSV (formato compatible con Excel)
        const headers = [
            'SKU',
            'Descripción',
            'Precio Actual',
            'Precio Propuesto',
            '% Cambio',
            'Motivo',
            'Sell-out Proyectado (%)',
            'Margen Total Proyectado',
            'Costo del Castigo',
            'Estado',
            'Usuario',
            'Fecha Creación'
        ];

        const rows = proposals.map((p: any) => [
            p.BaseCol || '',
            p.Descripcion || '',
            Number(p.PrecioActual).toFixed(2),
            Number(p.PrecioPropuesto).toFixed(2),
            ((Number(p.PrecioPropuesto) - Number(p.PrecioActual)) / Number(p.PrecioActual) * 100).toFixed(2),
            p.Motivo || '',
            p.SellOutProyectado ? Number(p.SellOutProyectado).toFixed(2) : '',
            p.MargenTotalProyectado ? Number(p.MargenTotalProyectado).toFixed(2) : '',
            p.CostoCastigo ? Number(p.CostoCastigo).toFixed(2) : '',
            p.Estado || '',
            p.UsuarioNombre || '',
            p.CreatedAt ? new Date(p.CreatedAt).toLocaleDateString('es-UY') : ''
        ]);

        // Convertir a CSV
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        // Agregar BOM para Excel UTF-8
        const BOM = '\uFEFF';
        const csvWithBOM = BOM + csvContent;

        return new NextResponse(csvWithBOM, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="price-actions-${new Date().toISOString().split('T')[0]}.csv"`
            }
        });

    } catch (error) {
        console.error('Error exporting Excel:', error);
        return NextResponse.json(
            { error: 'Error al exportar Excel', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
