import type { NextRequest } from 'next/server';

// Dynamic imports para evitar problemas con Webpack
let jwt: any;
let bcrypt: any;

async function getJwt() {
    if (!jwt) {
        jwt = (await import('jsonwebtoken')).default;
    }
    return jwt;
}

async function getBcrypt() {
    if (!bcrypt) {
        bcrypt = (await import('bcryptjs')).default;
    }
    return bcrypt;
}

const JWT_SECRET = process.env.JWT_SECRET || 'stadium-dashboard-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'; // 7 días por defecto
const COOKIE_NAME = 'stadium-auth-token';

export interface User {
    id: number;
    usuario: string;
    email?: string;
    nombre?: string;
    rol: 'admin' | 'usuario' | 'viewer';
    activo: boolean;
}

export interface AuthTokenPayload {
    userId: number;
    usuario: string;
    rol: string;
    iat?: number;
    exp?: number;
}

/**
 * Genera un token JWT para el usuario
 */
export async function generateToken(user: User): Promise<string> {
    const jwtLib = await getJwt();
    const payload: AuthTokenPayload = {
        userId: user.id,
        usuario: user.usuario,
        rol: user.rol
    };
    
    return jwtLib.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN
    });
}

/**
 * Verifica y decodifica un token JWT
 */
export async function verifyToken(token: string): Promise<AuthTokenPayload | null> {
    try {
        const jwtLib = await getJwt();
        return jwtLib.verify(token, JWT_SECRET) as AuthTokenPayload;
    } catch (error) {
        return null;
    }
}

/**
 * Hashea una contraseña
 */
export async function hashPassword(password: string): Promise<string> {
    const bcryptLib = await getBcrypt();
    return bcryptLib.hash(password, 10);
}

/**
 * Compara una contraseña con su hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
    const bcryptLib = await getBcrypt();
    return bcryptLib.compare(password, hash);
}

/**
 * Obtiene el token de las cookies del request
 */
export function getTokenFromRequest(req: NextRequest): string | null {
    return req.cookies.get(COOKIE_NAME)?.value || null;
}

/**
 * Obtiene el usuario autenticado desde el request
 */
export async function getAuthenticatedUser(req: NextRequest): Promise<User | null> {
    const token = getTokenFromRequest(req);
    if (!token) return null;
    
    const payload = await verifyToken(token);
    if (!payload) return null;
    
    // Verificar que el usuario existe y está activo en la BD
    const { executeQuery } = await import('./db');
    try {
        const result = await executeQuery(`
            SELECT Id, Usuario, Email, Nombre, Rol, Activo
            FROM Usuarios
            WHERE Id = ${payload.userId} AND Activo = 1
        `);
        
        if (result.recordset.length === 0) return null;
        
        const user = result.recordset[0];
        return {
            id: user.Id,
            usuario: user.Usuario,
            email: user.Email,
            nombre: user.Nombre,
            rol: user.Rol,
            activo: user.Activo
        };
    } catch (error) {
        console.error('Error getting authenticated user:', error);
        return null;
    }
}

/**
 * Obtiene el usuario desde las cookies del servidor (para Server Components)
 */
export async function getServerUser(): Promise<User | null> {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    
    if (!token) return null;
    
    const payload = await verifyToken(token);
    if (!payload) return null;
    
    const { executeQuery } = await import('./db');
    try {
        const result = await executeQuery(`
            SELECT Id, Usuario, Email, Nombre, Rol, Activo
            FROM Usuarios
            WHERE Id = ${payload.userId} AND Activo = 1
        `);
        
        if (result.recordset.length === 0) return null;
        
        const user = result.recordset[0];
        return {
            id: user.Id,
            usuario: user.Usuario,
            email: user.Email,
            nombre: user.Nombre,
            rol: user.Rol,
            activo: user.Activo
        };
    } catch (error) {
        console.error('Error getting server user:', error);
        return null;
    }
}
