import { executeQuery } from '../src/lib/db';
import { comparePassword } from '../src/lib/auth';

async function checkAdminHash() {
    try {
        console.log('Verificando hash del usuario admin...\n');

        const result = await executeQuery(`
            SELECT Usuario, PasswordHash, LEN(PasswordHash) as HashLength
            FROM Usuarios
            WHERE Usuario = 'admin'
        `);

        if (result.recordset.length === 0) {
            console.error('❌ Usuario admin no encontrado');
            return;
        }

        const admin = result.recordset[0];
        console.log('Hash en BD:', admin.PasswordHash);
        console.log('Longitud del hash:', admin.HashLength);
        console.log('Formato:', admin.PasswordHash?.substring(0, 7));

        // Probar con admin123
        const testPassword = 'admin123';
        const isValid = await comparePassword(testPassword, admin.PasswordHash);
        console.log('\n✅ Contraseña "admin123" válida:', isValid ? 'SÍ' : 'NO');

        if (!isValid) {
            console.log('\n⚠️  El hash no coincide. Ejecuta: npx tsx scripts/fix-admin-password.ts');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

checkAdminHash();
