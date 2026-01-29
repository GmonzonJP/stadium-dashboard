import { NextRequest, NextResponse } from 'next/server';

// En una implementación real, esto guardaría en base de datos
// Por ahora, simula las acciones
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { accion, motivo, parametros } = body;

    if (!['APROBAR', 'IGNORAR', 'IMPLEMENTAR'].includes(accion)) {
      return NextResponse.json(
        { error: 'Acción no válida' },
        { status: 400 }
      );
    }

    if (accion === 'IGNORAR' && !motivo) {
      return NextResponse.json(
        { error: 'Se requiere un motivo para ignorar' },
        { status: 400 }
      );
    }

    // Aquí se implementaría la lógica real:
    // - APROBAR: Crear orden de envío, actualizar sistema
    // - IGNORAR: Marcar como ignorada con motivo
    // - IMPLEMENTAR: Ejecutar la acción directamente

    const resultado = {
      id,
      accion,
      estado: accion === 'APROBAR' ? 'APROBADA' : accion === 'IGNORAR' ? 'IGNORADA' : 'IMPLEMENTADA',
      procesadaEn: new Date().toISOString(),
      motivo: motivo || null,
      parametros: parametros || null,
    };

    // Log para auditoría
    console.log('Incidencia procesada:', resultado);

    return NextResponse.json({
      success: true,
      resultado,
      mensaje: accion === 'APROBAR'
        ? 'Incidencia aprobada. Se creará la orden de envío.'
        : accion === 'IGNORAR'
        ? 'Incidencia ignorada.'
        : 'Acción implementada.',
    });
  } catch (error) {
    console.error('Error al procesar acción de incidencia:', error);
    return NextResponse.json(
      { error: 'Error al procesar la acción', details: String(error) },
      { status: 500 }
    );
  }
}
