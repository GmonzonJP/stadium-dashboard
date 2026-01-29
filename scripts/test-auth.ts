import { executeQuery } from '../src/lib/db';
import { hashPassword, comparePassword, generateToken, verifyToken } from '../src/lib/auth';

async function testAuth() {
    try {
        console.log('=== Test de Autenticación ===\n');

        // 1. Verificar que la tabla existe y tiene el usuario admin
        console.log('1. Verificando tabla Usuarios...');
        const usersResult = await executeQuery(`
            SELECT Id, Usuario, Email, Nombre, Rol, Activo
            FROM Usuarios
            WHERE Usuario = 'admin'
        `);

        if (usersResult.recordset.length === 0) {
            console.error('❌ No se encontró el usuario admin');
            return;
        }

        const adminUser = usersResult.recordset[0];
        console.log('✅ Usuario admin encontrado:', {
            id: adminUser.Id,
            usuario: adminUser.Usuario,
            nombre: adminUser.Nombre,
            rol: adminUser.Rol,
            activo: adminUser.Activo
        });

        // 2. Probar hash y comparación de contraseñas
        console.log('\n2. Probando hash de contraseñas...');
        const testPassword = 'admin123';
        const hash = await hashPassword(testPassword);
        console.log('✅ Hash generado:', hash.substring(0, 30) + '...');

        const isValid = await comparePassword(testPassword, hash);
        console.log('✅ Comparación de contraseña:', isValid ? 'CORRECTA' : 'INCORRECTA');

        // 3. Probar generación y verificación de tokens
        console.log('\n3. Probando tokens JWT...');
        const user = {
            id: adminUser.Id,
            usuario: adminUser.Usuario,
            email: adminUser.Email,
            nombre: adminUser.Nombre,
            rol: adminUser.Rol,
            activo: adminUser.Activo
        };

        const token = await generateToken(user);
        console.log('✅ Token generado:', token.substring(0, 50) + '...');

        const payload = await verifyToken(token);
        if (payload) {
            console.log('✅ Token verificado correctamente:', {
                userId: payload.userId,
                usuario: payload.usuario,
                rol: payload.rol
            });
        } else {
            console.error('❌ Error al verificar token');
        }

        // 4. Probar comparación con hash de la BD
        console.log('\n4. Probando autenticación con hash de BD...');
        const dbHash = adminUser.PasswordHash || '';
        const isValidDbPassword = await comparePassword(testPassword, dbHash);
        console.log('✅ Contraseña válida contra BD:', isValidDbPassword ? 'SÍ' : 'NO');

        console.log('\n=== Todos los tests pasaron ✅ ===');
        console.log('\nPuedes iniciar sesión con:');
        console.log('  Usuario: admin');
        console.log('  Contraseña: admin123');

    } catch (error) {
        console.error('❌ Error en test:', error);
    }
}

testAuth();
