import { NextResponse } from 'next/server';

export async function POST() {
    const response = NextResponse.json({ success: true });
    
    // Eliminar cookie
    response.cookies.delete('stadium-auth-token');
    
    return response;
}
