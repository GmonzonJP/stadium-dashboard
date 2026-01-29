import { executeQuery } from '../src/lib/db';
import { hashPassword } from '../src/lib/auth';
import sql from 'mssql';

async function fixAdminPassword() {
    try {
        console.log('Actualizando contraseña del usuario admin...\n');

        // Generar nuevo hash para 'admin123'
        const newHash = await hashPassword('admin123');
        console.log('Nuevo hash generado:', newHash);

        // Actualizar en la BD
        const result = await executeQuery(`
            UPDATE Usuarios
            SET PasswordHash = @passwordHash
            WHERE Usuario = 'admin'
        `, [
            { name: 'passwordHash', type: sql.NVarChar(255), value: newHash }
        ]);

        console.log('\n✅ Contraseña del usuario admin actualizada correctamente');
        console.log('\nAhora puedes iniciar sesión con:');
        console.log('  Usuario: admin');
        console.log('  Contraseña: admin123');

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

fixAdminPassword();
