import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
    try {
        const user = await getAuthenticatedUser(req);
        
        if (!user) {
            return NextResponse.json(
                { error: 'No autenticado' },
                { status: 401 }
            );
        }

        return NextResponse.json({
            user: {
                id: user.id,
                usuario: user.usuario,
                email: user.email,
                nombre: user.nombre,
                rol: user.rol
            }
        });
    } catch (error: any) {
        console.error('Error en /api/auth/me:', error);
        // Si es un error de autenticación, devolver 401 en lugar de 500
        if (error?.message?.includes('No autenticado') || error?.message?.includes('Token')) {
            return NextResponse.json(
                { error: 'No autenticado' },
                { status: 401 }
            );
        }
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
