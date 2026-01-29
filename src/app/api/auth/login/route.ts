import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { generateToken, comparePassword, hashPassword } from '@/lib/auth';
import sql from 'mssql';

export async function POST(req: NextRequest) {
    try {
        const { usuario, password, rememberMe } = await req.json();

        if (!usuario || !password) {
            return NextResponse.json(
                { error: 'Usuario y contraseña son requeridos' },
                { status: 400 }
            );
        }

        // Buscar usuario en la base de datos
        const result = await executeQuery(`
            SELECT Id, Usuario, Email, Nombre, Rol, Activo, PasswordHash
            FROM Usuarios
            WHERE Usuario = @usuario
        `, [
            { name: 'usuario', type: sql.NVarChar(50), value: usuario }
        ]);

        if (result.recordset.length === 0) {
            return NextResponse.json(
                { error: 'Usuario o contraseña incorrectos' },
                { status: 401 }
            );
        }

        const user = result.recordset[0];

        if (!user.Activo) {
            return NextResponse.json(
                { error: 'Usuario inactivo. Contacte al administrador' },
                { status: 403 }
            );
        }

        // Verificar contraseña
        const isValidPassword = await comparePassword(password, user.PasswordHash);
        
        if (!isValidPassword) {
            return NextResponse.json(
                { error: 'Usuario o contraseña incorrectos' },
                { status: 401 }
            );
        }

        // Generar token
        const token = await generateToken({
            id: user.Id,
            usuario: user.Usuario,
            email: user.Email,
            nombre: user.Nombre,
            rol: user.Rol,
            activo: user.Activo
        });

        // Actualizar último acceso
        await executeQuery(`
            UPDATE Usuarios
            SET UltimoAcceso = GETDATE(), RecordarSesion = @rememberMe
            WHERE Id = @userId
        `, [
            { name: 'userId', type: sql.Int, value: user.Id },
            { name: 'rememberMe', type: sql.Bit, value: rememberMe || false }
        ]);

        // Crear respuesta con cookie
        const response = NextResponse.json({
            success: true,
            user: {
                id: user.Id,
                usuario: user.Usuario,
                email: user.Email,
                nombre: user.Nombre,
                rol: user.Rol
            }
        });

        // Configurar cookie
        const maxAge = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7; // 30 días o 7 días
        const isSecure = req.headers.get('x-forwarded-proto') === 'https';
        response.cookies.set('stadium-auth-token', token, {
            httpOnly: true,
            secure: isSecure,
            sameSite: 'lax',
            maxAge: maxAge,
            path: '/'
        });

        return response;

    } catch (error) {
        console.error('Error en login:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
