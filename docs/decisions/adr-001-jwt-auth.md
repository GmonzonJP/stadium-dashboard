# ADR-001: Autenticación con JWT y Cookies HttpOnly

## Estado
Aceptado

## Contexto
Se necesita un sistema de autenticación para Stadium Dashboard que:
- Funcione con Next.js 14 (App Router)
- Sea seguro contra ataques comunes (XSS, CSRF)
- Soporte sesiones persistentes (recordar usuario)
- No requiera infraestructura adicional (Redis, etc.)

## Decisión
Implementar autenticación basada en JWT almacenado en cookies HttpOnly.

### Componentes:
1. **JWT (jsonwebtoken)**: Tokens firmados con HMAC-SHA256
2. **Bcrypt**: Hash de contraseñas con 10 rounds
3. **Cookies HttpOnly**: Almacenamiento seguro del token

### Flujo:
```
Login → Validar credenciales → Generar JWT → Set Cookie HttpOnly
Request → Cookie automática → Middleware verifica → API valida firma
Logout → Eliminar cookie
```

## Alternativas Consideradas

### 1. NextAuth.js
- **Pro**: Solución completa, soporte OAuth
- **Contra**: Complejidad innecesaria para auth simple
- **Contra**: Dependencia de sesiones en BD o JWT complicado

### 2. Token en LocalStorage
- **Pro**: Fácil de implementar
- **Contra**: Vulnerable a XSS (cualquier script puede leer el token)

### 3. Session-based (cookies de sesión)
- **Pro**: Más simple
- **Contra**: Requiere almacenamiento de sesiones (memoria/Redis)
- **Contra**: No escala horizontalmente sin infraestructura adicional

## Consecuencias

### Positivas
- Token autocontenido (no requiere BD para validar firma)
- Cookie HttpOnly previene robo por XSS
- SameSite=lax previene CSRF en la mayoría de casos
- No requiere infraestructura adicional
- Fácil de implementar y mantener

### Negativas
- No se puede invalidar token antes de expiración (sin blacklist)
- Token más grande que session ID simple
- Renovación de token requiere implementación adicional

## Mitigaciones
- Verificar en BD que usuario sigue activo en endpoints críticos
- Expiración corta (7 días) con opción de extender (30 días)
- Logs de actividad para auditoría

## Notas de Implementación

### Archivos modificados:
- `src/lib/auth.ts`: Funciones de token
- `src/middleware.ts`: Verificación edge
- `src/context/AuthContext.tsx`: Estado React
- `src/app/api/auth/*`: Endpoints

### Variables de entorno:
```
JWT_SECRET=<32 bytes aleatorios base64>
```

### Ejemplo de generación:
```bash
openssl rand -base64 32
```
