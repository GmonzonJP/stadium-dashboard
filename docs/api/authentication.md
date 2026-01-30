# Sistema de Autenticación

## Visión General

Stadium Dashboard utiliza autenticación basada en JWT (JSON Web Tokens) con almacenamiento en cookies HttpOnly.

```
┌─────────────────────────────────────────────────────────────┐
│                    FLUJO DE AUTENTICACIÓN                    │
│                                                              │
│  1. Login (POST /api/auth/login)                            │
│     └─▶ Validar credenciales en BD                          │
│     └─▶ Generar JWT                                         │
│     └─▶ Setear cookie HttpOnly                              │
│                                                              │
│  2. Requests autenticados                                    │
│     └─▶ Cookie enviada automáticamente                      │
│     └─▶ Middleware verifica estructura                      │
│     └─▶ API handler verifica firma y expiration             │
│                                                              │
│  3. Logout (POST /api/auth/logout)                          │
│     └─▶ Eliminar cookie                                     │
└─────────────────────────────────────────────────────────────┘
```

## Estructura del JWT

**Header:**
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

**Payload:**
```json
{
  "userId": 1,
  "usuario": "admin",
  "rol": "admin",
  "iat": 1706457600,
  "exp": 1707062400
}
```

**Firma:** HMAC-SHA256 con JWT_SECRET

## Roles de Usuario

| Rol | Permisos |
|-----|----------|
| `admin` | Acceso completo, gestión de usuarios |
| `usuario` | Dashboard, reportes, Price Actions |
| `viewer` | Solo lectura |

## Configuración de Cookie

```typescript
const cookieConfig = {
  name: 'auth_token',
  httpOnly: true,           // No accesible desde JavaScript
  secure: isProduction,     // Solo HTTPS en producción
  sameSite: 'lax',          // Protección CSRF
  path: '/',                // Disponible en toda la app
  maxAge: rememberMe
    ? 30 * 24 * 60 * 60     // 30 días si "recordar"
    : 7 * 24 * 60 * 60      // 7 días default
};
```

## Tabla de Usuarios

```sql
CREATE TABLE dashboard_users (
  Id INT IDENTITY PRIMARY KEY,
  Usuario NVARCHAR(50) UNIQUE NOT NULL,
  PasswordHash NVARCHAR(255) NOT NULL,
  Nombre NVARCHAR(100),
  Email NVARCHAR(100),
  Rol NVARCHAR(20) DEFAULT 'usuario',
  Activo BIT DEFAULT 1,
  UltimoAcceso DATETIME,
  RecordarSesion BIT DEFAULT 0,
  FechaCreacion DATETIME DEFAULT GETDATE()
);
```

## Archivos Relevantes

| Archivo | Responsabilidad |
|---------|-----------------|
| `src/lib/auth.ts` | Generación y verificación de tokens |
| `src/middleware.ts` | Verificación en edge (estructura) |
| `src/context/AuthContext.tsx` | Estado de autenticación en React |
| `src/app/api/auth/login/route.ts` | Endpoint de login |
| `src/app/api/auth/logout/route.ts` | Endpoint de logout |
| `src/app/api/auth/me/route.ts` | Usuario actual |

## Funciones Principales (auth.ts)

### generateToken(user)
```typescript
export async function generateToken(user: UserPayload): Promise<string> {
  const jwt = await import('jsonwebtoken');
  return jwt.default.sign(
    { userId: user.id, usuario: user.usuario, rol: user.rol },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );
}
```

### verifyToken(token)
```typescript
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const jwt = await import('jsonwebtoken');
    return jwt.default.verify(token, process.env.JWT_SECRET!) as JWTPayload;
  } catch {
    return null;
  }
}
```

### getAuthenticatedUser(request)
```typescript
export async function getAuthenticatedUser(
  request: Request
): Promise<User | null> {
  const token = getTokenFromRequest(request);
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  // Verificar en BD que usuario sigue activo
  const pool = await getPool();
  const result = await pool.request()
    .input('userId', payload.userId)
    .query('SELECT * FROM dashboard_users WHERE Id = @userId AND Activo = 1');

  return result.recordset[0] || null;
}
```

## Middleware de Autenticación

```typescript
// src/middleware.ts
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Rutas públicas
  const publicRoutes = ['/login', '/api/auth/login', '/api/auth/logout'];
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  // Verificar token
  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    // Sin token -> redirigir a login
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Verificación ligera de estructura (3 partes)
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some(p => !p)) {
    // Token mal formado -> limpiar y redirigir
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('auth_token');
    return response;
  }

  return NextResponse.next();
}
```

## Seguridad

### Protecciones Implementadas

| Amenaza | Mitigación |
|---------|------------|
| XSS (robo de token) | Cookie HttpOnly |
| CSRF | Cookie SameSite=lax |
| Brute Force | Rate limiting (10 req/min) |
| User Enumeration | Mensajes genéricos de error |
| Session Hijacking | Verificación de usuario activo en BD |

### Buenas Prácticas

1. **JWT_SECRET** debe ser aleatorio y seguro:
   ```bash
   openssl rand -base64 32
   ```

2. **No almacenar** información sensible en el payload JWT

3. **Verificar** estado de usuario en BD en cada request crítico

4. **Renovar** tokens periódicamente (no implementado, mejora futura)

## Ejemplo de Uso en API Route

```typescript
// src/app/api/some-endpoint/route.ts
import { getAuthenticatedUser } from '@/lib/auth';

export async function GET(request: Request) {
  // 1. Obtener usuario autenticado
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json(
      { error: 'No autenticado' },
      { status: 401 }
    );
  }

  // 2. Verificar rol si es necesario
  if (user.rol !== 'admin') {
    return NextResponse.json(
      { error: 'No autorizado' },
      { status: 403 }
    );
  }

  // 3. Proceder con la lógica
  // ...
}
```

## Ejemplo de Uso en Cliente

```typescript
// Usando AuthContext
import { useAuth } from '@/context/AuthContext';

function MyComponent() {
  const { user, isLoading, login, logout } = useAuth();

  if (isLoading) return <Loading />;

  if (!user) return <LoginRequired />;

  return (
    <div>
      <p>Bienvenido, {user.nombre}</p>
      <button onClick={logout}>Cerrar Sesión</button>
    </div>
  );
}
```
