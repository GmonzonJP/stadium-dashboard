import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'stadium-dashboard-secret-key-change-in-production';

// Verificación básica del token (solo estructura, no firma completa)
// La verificación completa se hace en las rutas API
function hasValidTokenStructure(token: string): boolean {
    if (!token || typeof token !== 'string') return false;
    
    // Un JWT tiene 3 partes separadas por puntos
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    // Verificar que cada parte tenga contenido y sea de longitud razonable
    return parts.every(part => part.length > 0 && part.length < 1000);
}

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    
    // Rutas públicas (no requieren autenticación)
    const publicRoutes = ['/login', '/api/auth/login', '/api/auth/logout'];
    
    // Permitir GET en /api/chat para health check (sin autenticación)
    if (pathname === '/api/chat' && request.method === 'GET') {
        return NextResponse.next();
    }
    
    // Si es una ruta pública, permitir acceso
    if (publicRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))) {
        return NextResponse.next();
    }
    
    // Verificar token en cookies
    const token = request.cookies.get('stadium-auth-token')?.value;
    
    if (!token) {
        // Redirigir a login si no hay token
        if (pathname.startsWith('/api/')) {
            return NextResponse.json(
                { error: 'No autenticado' },
                { status: 401 }
            );
        }
        return NextResponse.redirect(new URL('/login', request.url));
    }
    
    // Verificación básica de estructura (la verificación completa se hace en las APIs)
    if (!hasValidTokenStructure(token)) {
        // Token inválido, redirigir a login
        if (pathname.startsWith('/api/')) {
            return NextResponse.json(
                { error: 'Token inválido' },
                { status: 401 }
            );
        }
        const response = NextResponse.redirect(new URL('/login', request.url));
        response.cookies.delete('stadium-auth-token');
        return response;
    }
    
    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
}
