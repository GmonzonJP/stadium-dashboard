# Configuración de Autenticación

## Pasos para configurar la autenticación

### 1. Crear la tabla de usuarios en la base de datos

Ejecuta el script SQL en tu base de datos:

```bash
# Conecta a tu base de datos SQL Server y ejecuta:
scripts/create-users-table.sql
```

Este script creará:
- La tabla `Usuarios` con todos los campos necesarios
- Un usuario administrador por defecto:
  - **Usuario:** `admin`
  - **Contraseña:** `admin123`
  - **Rol:** `admin`

⚠️ **IMPORTANTE:** Cambia la contraseña del usuario admin después del primer login.

### 2. Configurar variables de entorno

Agrega estas variables a tu archivo `.env.local`:

```env
# JWT Secret (cambia esto por una clave segura en producción)
JWT_SECRET=tu-clave-secreta-super-segura-aqui-cambiar-en-produccion

# Opcional: Tiempo de expiración del token (default: 7d)
JWT_EXPIRES_IN=7d
```

Para generar una clave secreta segura, puedes usar:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Funcionalidades implementadas

✅ **Autenticación basada en cookies**
- Los tokens JWT se almacenan en cookies httpOnly
- Las cookies se configuran automáticamente según "Recordar sesión"
- Duración: 7 días (normal) o 30 días (con "Recordar sesión")

✅ **Middleware de protección**
- Todas las rutas están protegidas excepto `/login` y `/api/auth/login`
- Redirección automática a login si no hay sesión válida

✅ **Gestión de usuarios**
- API REST para CRUD de usuarios (`/api/users`)
- Solo administradores pueden gestionar usuarios
- Roles: `admin`, `usuario`, `viewer`

✅ **Interfaz de usuario**
- Página de login moderna y responsive
- TopBar muestra usuario autenticado con menú desplegable
- Botón de logout funcional

### 4. APIs disponibles

#### Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/logout` - Cerrar sesión
- `GET /api/auth/me` - Obtener usuario actual

#### Gestión de usuarios (solo admin)
- `GET /api/users` - Listar todos los usuarios
- `POST /api/users` - Crear nuevo usuario
- `PUT /api/users/[id]` - Actualizar usuario
- `DELETE /api/users/[id]` - Eliminar usuario

### 5. Uso

1. Accede a la aplicación - serás redirigido a `/login`
2. Ingresa con:
   - Usuario: `admin`
   - Contraseña: `admin123`
3. Marca "Recordar sesión" si quieres que la sesión dure 30 días
4. Una vez autenticado, tendrás acceso completo al dashboard

### 6. Crear nuevos usuarios

Los administradores pueden crear usuarios desde la API:

```javascript
// Ejemplo: Crear nuevo usuario
fetch('/api/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    usuario: 'nuevo_usuario',
    password: 'contraseña_segura',
    email: 'usuario@ejemplo.com',
    nombre: 'Nombre Completo',
    rol: 'usuario' // 'admin', 'usuario', 'viewer'
  })
});
```

### 7. Seguridad

- Las contraseñas se hashean con bcrypt (10 rounds)
- Los tokens JWT son firmados y verificados
- Las cookies son httpOnly (no accesibles desde JavaScript)
- En producción, las cookies son secure (solo HTTPS)
- El middleware valida tokens en cada request

### 8. Próximos pasos (opcional)

- [ ] Página de gestión de usuarios en el frontend
- [ ] Cambio de contraseña desde el perfil
- [ ] Recuperación de contraseña por email
- [ ] Autenticación de dos factores (2FA)
- [ ] Logs de auditoría de accesos
