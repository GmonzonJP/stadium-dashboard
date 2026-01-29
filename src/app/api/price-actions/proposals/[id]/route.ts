import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { PriceChangeProposal } from '@/types/price-actions';
import sql from 'mssql';

// GET: Obtener propuesta por ID
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = parseInt(params.id);
        if (isNaN(id)) {
            return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
        }

        const query = `SELECT * FROM PriceChangeProposals WHERE Id = @id`;
        const result = await executeQuery(query, [
            { name: 'id', type: sql.Int, value: id }
        ]);

        if (result.recordset.length === 0) {
            return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 });
        }

        const row = result.recordset[0];
        const proposal: PriceChangeProposal = {
            id: row.Id,
            baseCol: row.BaseCol,
            descripcion: row.Descripcion,
            precioActual: Number(row.PrecioActual),
            precioPropuesto: Number(row.PrecioPropuesto),
            precioAntes: row.PrecioAntes ? Number(row.PrecioAntes) : undefined,
            usarPrecioAntesAhora: Boolean(row.UsarPrecioAntesAhora),
            motivo: row.Motivo,
            notas: row.Notas,
            estado: row.Estado,
            sellOutProyectado: row.SellOutProyectado ? Number(row.SellOutProyectado) : undefined,
            margenTotalProyectado: row.MargenTotalProyectado ? Number(row.MargenTotalProyectado) : undefined,
            costoCastigo: row.CostoCastigo ? Number(row.CostoCastigo) : undefined,
            confianzaElasticidad: row.ConfianzaElasticidad,
            usuarioId: row.UsuarioId,
            usuarioNombre: row.UsuarioNombre,
            createdAt: row.CreatedAt,
            updatedAt: row.UpdatedAt,
            aprobadoPor: row.AprobadoPor,
            aprobadoAt: row.AprobadoAt
        };

        return NextResponse.json(proposal);

    } catch (error) {
        console.error('Error obteniendo propuesta:', error);
        return NextResponse.json(
            { error: 'Error al obtener propuesta', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}

// PUT: Actualizar propuesta
export async function PUT(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = parseInt(params.id);
        if (isNaN(id)) {
            return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
        }

        const body = await req.json();
        const updates: Partial<PriceChangeProposal> = body;

        // Obtener propuesta actual para comparar cambios
        const currentQuery = `SELECT * FROM PriceChangeProposals WHERE Id = @id`;
        const currentResult = await executeQuery(currentQuery, [
            { name: 'id', type: sql.Int, value: id }
        ]);

        if (currentResult.recordset.length === 0) {
            return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 });
        }

        const current = currentResult.recordset[0];
        const usuario = body.usuario || 'Sistema';

        // Construir query de actualización dinámicamente
        const updateFields: string[] = [];
        const updateParams: any[] = [];

        if (updates.precioPropuesto !== undefined) {
            updateFields.push('PrecioPropuesto = @precioPropuesto');
            updateParams.push({ name: 'precioPropuesto', type: sql.Decimal(18, 2), value: updates.precioPropuesto });
        }

        if (updates.notas !== undefined) {
            updateFields.push('Notas = @notas');
            updateParams.push({ name: 'notas', type: sql.NVarChar(sql.MAX), value: updates.notas || null });
        }

        if (updates.estado !== undefined) {
            updateFields.push('Estado = @estado');
            updateParams.push({ name: 'estado', type: sql.NVarChar(20), value: updates.estado });
            
            if (updates.estado === 'aprobado') {
                updateFields.push('AprobadoPor = @aprobadoPor');
                updateFields.push('AprobadoAt = GETDATE()');
                updateParams.push({ name: 'aprobadoPor', type: sql.NVarChar(100), value: usuario });
            }
        }

        if (updateFields.length === 0) {
            return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 });
        }

        updateFields.push('UpdatedAt = GETDATE()');
        updateParams.push({ name: 'id', type: sql.Int, value: id });

        const updateQuery = `
            UPDATE PriceChangeProposals
            SET ${updateFields.join(', ')}
            WHERE Id = @id
        `;

        await executeQuery(updateQuery, updateParams);

        // Registrar cambios en historial
        if (updates.precioPropuesto !== undefined && Number(current.PrecioPropuesto) !== updates.precioPropuesto) {
            await executeQuery(`
                INSERT INTO PriceChangeHistory (ProposalId, Campo, ValorAnterior, ValorNuevo, Usuario, Accion)
                VALUES (@proposalId, 'PrecioPropuesto', @valorAnterior, @valorNuevo, @usuario, 'updated')
            `, [
                { name: 'proposalId', type: sql.Int, value: id },
                { name: 'valorAnterior', type: sql.NVarChar(100), value: String(current.PrecioPropuesto) },
                { name: 'valorNuevo', type: sql.NVarChar(100), value: String(updates.precioPropuesto) },
                { name: 'usuario', type: sql.NVarChar(100), value: usuario }
            ]);
        }

        if (updates.estado !== undefined && current.Estado !== updates.estado) {
            await executeQuery(`
                INSERT INTO PriceChangeHistory (ProposalId, Campo, ValorAnterior, ValorNuevo, Usuario, Accion)
                VALUES (@proposalId, 'Estado', @valorAnterior, @valorNuevo, @usuario, @accion)
            `, [
                { name: 'proposalId', type: sql.Int, value: id },
                { name: 'valorAnterior', type: sql.NVarChar(100), value: current.Estado },
                { name: 'valorNuevo', type: sql.NVarChar(100), value: updates.estado },
                { name: 'usuario', type: sql.NVarChar(100), value: usuario },
                { name: 'accion', type: sql.NVarChar(50), value: updates.estado === 'aprobado' ? 'approved' : updates.estado === 'descartado' ? 'rejected' : 'updated' }
            ]);
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error actualizando propuesta:', error);
        return NextResponse.json(
            { error: 'Error al actualizar propuesta', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}

// DELETE: Eliminar propuesta
export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = parseInt(params.id);
        if (isNaN(id)) {
            return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
        }

        const body = await req.json().catch(() => ({}));
        const usuario = body.usuario || 'Sistema';

        // Registrar en historial antes de eliminar
        await executeQuery(`
            INSERT INTO PriceChangeHistory (ProposalId, Campo, ValorAnterior, ValorNuevo, Usuario, Accion)
            VALUES (@proposalId, 'deleted', NULL, NULL, @usuario, 'deleted')
        `, [
            { name: 'proposalId', type: sql.Int, value: id },
            { name: 'usuario', type: sql.NVarChar(100), value: usuario }
        ]);

        // Eliminar propuesta
        await executeQuery(`DELETE FROM PriceChangeProposals WHERE Id = @id`, [
            { name: 'id', type: sql.Int, value: id }
        ]);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error eliminando propuesta:', error);
        return NextResponse.json(
            { error: 'Error al eliminar propuesta', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
