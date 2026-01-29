import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';
import { hashPassword } from '@/lib/auth';
import sql from 'mssql';

// GET: Listar usuarios (solo admin)
export async function GET(req: NextRequest) {
    try {
        const user = await getAuthenticatedUser(req);
        
        if (!user || user.rol !== 'admin') {
            return NextResponse.json(
                { error: 'No autorizado' },
                { status: 403 }
            );
        }

        const result = await executeQuery(`
            SELECT 
                Id, Usuario, Email, Nombre, Rol, Activo, 
                FechaCreacion, UltimoAcceso, RecordarSesion
            FROM Usuarios
            ORDER BY FechaCreacion DESC
        `);

        const users = result.recordset.map((u: any) => ({
            id: u.Id,
            usuario: u.Usuario,
            email: u.Email,
            nombre: u.Nombre,
            rol: u.Rol,
            activo: u.Activo,
            fechaCreacion: u.FechaCreacion,
            ultimoAcceso: u.UltimoAcceso,
            recordarSesion: u.RecordarSesion
        }));

        return NextResponse.json({ users });
    } catch (error) {
        console.error('Error listing users:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}

// POST: Crear nuevo usuario (solo admin)
export async function POST(req: NextRequest) {
    try {
        const user = await getAuthenticatedUser(req);
        
        if (!user || user.rol !== 'admin') {
            return NextResponse.json(
                { error: 'No autorizado' },
                { status: 403 }
            );
        }

        const { usuario, password, email, nombre, rol } = await req.json();

        if (!usuario || !password) {
            return NextResponse.json(
                { error: 'Usuario y contraseña son requeridos' },
                { status: 400 }
            );
        }

        // Verificar que el usuario no exista
        const checkResult = await executeQuery(`
            SELECT Id FROM Usuarios WHERE Usuario = @usuario
        `, [
            { name: 'usuario', type: sql.NVarChar(50), value: usuario }
        ]);

        if (checkResult.recordset.length > 0) {
            return NextResponse.json(
                { error: 'El usuario ya existe' },
                { status: 400 }
            );
        }

        // Hashear contraseña
        const passwordHash = await hashPassword(password);

        // Crear usuario
        const insertResult = await executeQuery(`
            INSERT INTO Usuarios (Usuario, Email, Nombre, Rol, PasswordHash, Activo)
            OUTPUT INSERTED.Id
            VALUES (@usuario, @email, @nombre, @rol, @passwordHash, 1)
        `, [
            { name: 'usuario', type: sql.NVarChar(50), value: usuario },
            { name: 'email', type: sql.NVarChar(100), value: email || null },
            { name: 'nombre', type: sql.NVarChar(100), value: nombre || null },
            { name: 'rol', type: sql.NVarChar(20), value: rol || 'usuario' },
            { name: 'passwordHash', type: sql.NVarChar(255), value: passwordHash }
        ]);

        const newUserId = insertResult.recordset[0].Id;

        return NextResponse.json({
            success: true,
            user: {
                id: newUserId,
                usuario,
                email,
                nombre,
                rol: rol || 'usuario'
            }
        });
    } catch (error) {
        console.error('Error creating user:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
