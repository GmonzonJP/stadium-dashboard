import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

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

        // Generar HTML imprimible (se puede imprimir como PDF desde el navegador)
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Price Actions - Propuestas de Cambio de Precio</title>
                <style>
                    @media print {
                        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        .no-print { display: none !important; }
                    }
                    * { box-sizing: border-box; }
                    body { 
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                        padding: 40px; 
                        background: #f8fafc;
                        color: #1e293b;
                        line-height: 1.5;
                    }
                    .header { 
                        background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
                        color: white;
                        padding: 30px;
                        border-radius: 12px;
                        margin-bottom: 30px;
                    }
                    .header h1 { margin: 0 0 10px 0; font-size: 28px; }
                    .header p { margin: 0; opacity: 0.9; }
                    .summary { 
                        display: flex; 
                        gap: 20px; 
                        margin-bottom: 30px; 
                    }
                    .summary-card {
                        flex: 1;
                        background: white;
                        padding: 20px;
                        border-radius: 12px;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                        text-align: center;
                    }
                    .summary-card .value { font-size: 32px; font-weight: bold; color: #1e40af; }
                    .summary-card .label { color: #64748b; font-size: 14px; }
                    table { 
                        width: 100%; 
                        border-collapse: collapse; 
                        background: white;
                        border-radius: 12px;
                        overflow: hidden;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                    }
                    th { 
                        background: #1e293b; 
                        color: white; 
                        padding: 14px 12px;
                        text-align: left;
                        font-weight: 600;
                        font-size: 12px;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    td { 
                        padding: 12px; 
                        border-bottom: 1px solid #e2e8f0;
                        font-size: 13px;
                    }
                    tr:last-child td { border-bottom: none; }
                    tr:hover { background: #f8fafc; }
                    .sku { font-weight: 600; color: #1e40af; }
                    .price { font-family: 'Monaco', monospace; }
                    .positive { color: #16a34a; }
                    .negative { color: #dc2626; }
                    .badge {
                        display: inline-block;
                        padding: 4px 10px;
                        border-radius: 20px;
                        font-size: 11px;
                        font-weight: 600;
                        text-transform: uppercase;
                    }
                    .badge-pendiente { background: #fef3c7; color: #92400e; }
                    .badge-aprobado { background: #dcfce7; color: #166534; }
                    .badge-descartado { background: #fee2e2; color: #991b1b; }
                    .print-btn {
                        position: fixed;
                        bottom: 30px;
                        right: 30px;
                        background: #1e40af;
                        color: white;
                        border: none;
                        padding: 15px 30px;
                        border-radius: 50px;
                        font-size: 16px;
                        cursor: pointer;
                        box-shadow: 0 4px 15px rgba(30,64,175,0.4);
                    }
                    .print-btn:hover { background: #1e3a8a; }
                    .footer {
                        margin-top: 30px;
                        text-align: center;
                        color: #94a3b8;
                        font-size: 12px;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📊 Propuestas de Cambio de Precio</h1>
                    <p>Generado el ${new Date().toLocaleDateString('es-UY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
                
                <div class="summary">
                    <div class="summary-card">
                        <div class="value">${proposals.length}</div>
                        <div class="label">Total Propuestas</div>
                    </div>
                    <div class="summary-card">
                        <div class="value">${proposals.filter((p: any) => p.Estado === 'pendiente').length}</div>
                        <div class="label">Pendientes</div>
                    </div>
                    <div class="summary-card">
                        <div class="value">${proposals.filter((p: any) => p.Estado === 'aprobado').length}</div>
                        <div class="label">Aprobadas</div>
                    </div>
                    <div class="summary-card">
                        <div class="value">$${proposals.reduce((sum: number, p: any) => sum + (Number(p.CostoCastigo) || 0), 0).toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                        <div class="label">Costo Total Castigo</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>SKU</th>
                            <th>Descripción</th>
                            <th>Precio Actual</th>
                            <th>Precio Nuevo</th>
                            <th>% Cambio</th>
                            <th>Motivo</th>
                            <th>Sell-out</th>
                            <th>Margen</th>
                            <th>Castigo</th>
                            <th>Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${proposals.map((p: any) => {
                            const cambio = ((Number(p.PrecioPropuesto) - Number(p.PrecioActual)) / Number(p.PrecioActual) * 100);
                            return `
                            <tr>
                                <td class="sku">${p.BaseCol}</td>
                                <td>${p.Descripcion || '—'}</td>
                                <td class="price">$${Number(p.PrecioActual).toLocaleString('es-UY')}</td>
                                <td class="price">$${Number(p.PrecioPropuesto).toLocaleString('es-UY')}</td>
                                <td class="${cambio < 0 ? 'negative' : 'positive'}">${cambio.toFixed(1)}%</td>
                                <td>${p.Motivo}</td>
                                <td>${p.SellOutProyectado ? Number(p.SellOutProyectado).toFixed(1) + '%' : '—'}</td>
                                <td class="price ${Number(p.MargenTotalProyectado) > 0 ? 'positive' : ''}">${p.MargenTotalProyectado ? '$' + Number(p.MargenTotalProyectado).toLocaleString('es-UY') : '—'}</td>
                                <td class="price negative">${p.CostoCastigo ? '$' + Number(p.CostoCastigo).toLocaleString('es-UY') : '—'}</td>
                                <td><span class="badge badge-${p.Estado}">${p.Estado}</span></td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>

                <div class="footer">
                    Stadium Dashboard • Price Actions Module
                </div>

                <button class="print-btn no-print" onclick="window.print()">
                    🖨️ Imprimir / Guardar PDF
                </button>
            </body>
            </html>
        `;

        // Retornar HTML que se puede imprimir como PDF
        return new NextResponse(html, {
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
            }
        });

    } catch (error) {
        console.error('Error exporting PDF:', error);
        return NextResponse.json(
            { error: 'Error al exportar PDF', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
