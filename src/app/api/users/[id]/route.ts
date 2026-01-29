import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';
import { hashPassword } from '@/lib/auth';
import sql from 'mssql';

// PUT: Actualizar usuario
export async function PUT(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const user = await getAuthenticatedUser(req);
        
        if (!user) {
            return NextResponse.json(
                { error: 'No autenticado' },
                { status: 401 }
            );
        }

        const userId = parseInt(params.id);
        const { email, nombre, rol, activo, password } = await req.json();

        // Solo admin puede cambiar rol y activo, o el propio usuario puede actualizar sus datos
        if (user.rol !== 'admin' && user.id !== userId) {
            return NextResponse.json(
                { error: 'No autorizado' },
                { status: 403 }
            );
        }

        // Si hay contraseña, hashearla
        let updateFields: string[] = [];
        let paramsList: any[] = [];

        if (email !== undefined) {
            updateFields.push('Email = @email');
            paramsList.push({ name: 'email', type: sql.NVarChar(100), value: email || null });
        }

        if (nombre !== undefined) {
            updateFields.push('Nombre = @nombre');
            paramsList.push({ name: 'nombre', type: sql.NVarChar(100), value: nombre || null });
        }

        if (rol !== undefined && user.rol === 'admin') {
            updateFields.push('Rol = @rol');
            paramsList.push({ name: 'rol', type: sql.NVarChar(20), value: rol });
        }

        if (activo !== undefined && user.rol === 'admin') {
            updateFields.push('Activo = @activo');
            paramsList.push({ name: 'activo', type: sql.Bit, value: activo });
        }

        if (password) {
            const passwordHash = await hashPassword(password);
            updateFields.push('PasswordHash = @passwordHash');
            paramsList.push({ name: 'passwordHash', type: sql.NVarChar(255), value: passwordHash });
        }

        if (updateFields.length === 0) {
            return NextResponse.json(
                { error: 'No hay campos para actualizar' },
                { status: 400 }
            );
        }

        paramsList.push({ name: 'userId', type: sql.Int, value: userId });

        await executeQuery(`
            UPDATE Usuarios
            SET ${updateFields.join(', ')}
            WHERE Id = @userId
        `, paramsList);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating user:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}

// DELETE: Eliminar usuario (solo admin)
export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const user = await getAuthenticatedUser(req);
        
        if (!user || user.rol !== 'admin') {
            return NextResponse.json(
                { error: 'No autorizado' },
                { status: 403 }
            );
        }

        const userId = parseInt(params.id);

        // No permitir eliminar el propio usuario
        if (user.id === userId) {
            return NextResponse.json(
                { error: 'No puedes eliminar tu propio usuario' },
                { status: 400 }
            );
        }

        await executeQuery(`
            DELETE FROM Usuarios WHERE Id = @userId
        `, [
            { name: 'userId', type: sql.Int, value: userId }
        ]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting user:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
