import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { PriceChangeProposal, ProposalFilters, ProposalsResponse } from '@/types/price-actions';
import sql from 'mssql';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

// GET: Listar propuestas
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const page = Math.max(1, Number(searchParams.get('page')) || 1);
        const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(searchParams.get('pageSize')) || DEFAULT_PAGE_SIZE));
        const estado = searchParams.get('estado');
        const motivo = searchParams.get('motivo');
        const search = searchParams.get('search');

        let whereClauses: string[] = [];
        const params: any[] = [];

        if (estado) {
            whereClauses.push('Estado = @estado');
            params.push({ name: 'estado', type: sql.NVarChar(20), value: estado });
        }

        if (motivo) {
            whereClauses.push('Motivo = @motivo');
            params.push({ name: 'motivo', type: sql.NVarChar(100), value: motivo });
        }

        if (search) {
            whereClauses.push('(BaseCol LIKE @search OR Descripcion LIKE @search)');
            params.push({ name: 'search', type: sql.NVarChar(500), value: `%${search}%` });
        }

        const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // Contar total
        const countQuery = `SELECT COUNT(*) as total FROM PriceChangeProposals ${whereClause}`;
        const countResult = await executeQuery(countQuery, params);
        const total = Number(countResult.recordset[0]?.total) || 0;

        // Obtener propuestas paginadas
        const offset = (page - 1) * pageSize;
        const query = `
            SELECT * FROM PriceChangeProposals
            ${whereClause}
            ORDER BY CreatedAt DESC
            OFFSET ${offset} ROWS
            FETCH NEXT ${pageSize} ROWS ONLY
        `;

        const result = await executeQuery(query, params);
        const proposals = result.recordset.map((row: any) => ({
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
        }));

        const response: ProposalsResponse = {
            proposals,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize)
        };

        return NextResponse.json(response);

    } catch (error) {
        console.error('Error obteniendo propuestas:', error);
        return NextResponse.json(
            { error: 'Error al obtener propuestas', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}

// POST: Crear nueva propuesta
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const proposal: Partial<PriceChangeProposal> = body;

        if (!proposal.baseCol || !proposal.precioActual || !proposal.precioPropuesto || !proposal.motivo) {
            return NextResponse.json(
                { error: 'Faltan campos requeridos: baseCol, precioActual, precioPropuesto, motivo' },
                { status: 400 }
            );
        }

        const insertQuery = `
            INSERT INTO PriceChangeProposals (
                BaseCol, Descripcion, PrecioActual, PrecioPropuesto, PrecioAntes, UsarPrecioAntesAhora,
                Motivo, Notas, Estado, SellOutProyectado, MargenTotalProyectado, CostoCastigo,
                ConfianzaElasticidad, UsuarioNombre, CreatedAt, UpdatedAt
            )
            OUTPUT INSERTED.Id
            VALUES (
                @baseCol, @descripcion, @precioActual, @precioPropuesto, @precioAntes, @usarPrecioAntesAhora,
                @motivo, @notas, @estado, @sellOut, @margen, @costoCastigo,
                @confianza, @usuarioNombre, GETDATE(), GETDATE()
            )
        `;

        const result = await executeQuery(insertQuery, [
            { name: 'baseCol', type: sql.NVarChar(50), value: proposal.baseCol },
            { name: 'descripcion', type: sql.NVarChar(500), value: proposal.descripcion || null },
            { name: 'precioActual', type: sql.Decimal(18, 2), value: proposal.precioActual },
            { name: 'precioPropuesto', type: sql.Decimal(18, 2), value: proposal.precioPropuesto },
            { name: 'precioAntes', type: sql.Decimal(18, 2), value: proposal.precioAntes || null },
            { name: 'usarPrecioAntesAhora', type: sql.Bit, value: proposal.usarPrecioAntesAhora || false },
            { name: 'motivo', type: sql.NVarChar(100), value: proposal.motivo },
            { name: 'notas', type: sql.NVarChar(sql.MAX), value: proposal.notas || null },
            { name: 'estado', type: sql.NVarChar(20), value: proposal.estado || 'pendiente' },
            { name: 'sellOut', type: sql.Decimal(5, 2), value: proposal.sellOutProyectado || null },
            { name: 'margen', type: sql.Decimal(18, 2), value: proposal.margenTotalProyectado || null },
            { name: 'costoCastigo', type: sql.Decimal(18, 2), value: proposal.costoCastigo || null },
            { name: 'confianza', type: sql.NVarChar(20), value: proposal.confianzaElasticidad || null },
            { name: 'usuarioNombre', type: sql.NVarChar(100), value: proposal.usuarioNombre || 'Sistema' }
        ]);

        const newId = result.recordset[0]?.Id;

        // Registrar en historial
        await executeQuery(`
            INSERT INTO PriceChangeHistory (ProposalId, Campo, ValorAnterior, ValorNuevo, Usuario, Accion)
            VALUES (@proposalId, 'created', NULL, 'Nueva propuesta', @usuario, 'created')
        `, [
            { name: 'proposalId', type: sql.Int, value: newId },
            { name: 'usuario', type: sql.NVarChar(100), value: proposal.usuarioNombre || 'Sistema' }
        ]);

        return NextResponse.json({ id: newId, success: true }, { status: 201 });

    } catch (error) {
        console.error('Error creando propuesta:', error);
        return NextResponse.json(
            { error: 'Error al crear propuesta', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
