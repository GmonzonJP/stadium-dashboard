import sql from 'mssql';
import fs from 'fs';
import path from 'path';

// Manual env parsing
const envPath = path.resolve(process.cwd(), '.env.local');
let envVars: Record<string, string> = {};

if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const value = parts.slice(1).join('=').trim();
            envVars[key] = value;
        }
    });
}

const config: sql.config = {
    user: (envVars.DB_USER || 'sa').trim(),
    password: (envVars.DB_PASSWORD || 'Republica.900').trim(),
    server: (envVars.DB_SERVER || '10.120.0.19').trim(),
    database: (envVars.DB_DATABASE || 'anysys').trim(),
    options: {
        encrypt: true,
        trustServerCertificate: true,
        connectTimeout: 30000,
    },
    requestTimeout: 60000,
};

async function createTables() {
    let pool: sql.ConnectionPool | null = null;
    
    try {
        console.log('Conectando a la base de datos...');
        pool = await new sql.ConnectionPool(config).connect();
        console.log('✓ Conexión exitosa');

        // Leer el script SQL
        const sqlScriptPath = path.resolve(__dirname, 'create-price-actions-tables.sql');
        const sqlScript = fs.readFileSync(sqlScriptPath, 'utf8');

        console.log('Ejecutando script SQL...');
        
        // Ejecutar el script completo
        // SQL Server permite ejecutar múltiples statements separados por GO
        // Pero mssql no soporta GO directamente, así que dividimos por statements
        // Dividir por bloques BEGIN...END y statements individuales
        const blocks = sqlScript.split(/\bGO\b/i);
        
        for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i].trim();
            if (!block || block.startsWith('--')) continue;
            
            try {
                // Ejecutar el bloque completo (puede contener múltiples statements)
                await pool.request().query(block);
                
                // Extraer mensajes PRINT del bloque
                const printMatches = block.match(/PRINT\s+'([^']+)'/gi);
                if (printMatches) {
                    printMatches.forEach((match: string) => {
                        const message = match.replace(/PRINT\s+'([^']+)'/i, '$1');
                        console.log(`  ${message}`);
                    });
                }
            } catch (err: any) {
                // Ignorar errores de "ya existe" si son por IF NOT EXISTS
                const errorMsg = err.message || '';
                if (errorMsg.includes('ya existe') || 
                    errorMsg.includes('already exists') ||
                    errorMsg.includes('There is already an object')) {
                    // Extraer mensaje PRINT si existe
                    const printMatch = block.match(/PRINT\s+'([^']+)'/i);
                    if (printMatch) {
                        console.log(`  ${printMatch[1]}`);
                    }
                } else {
                    console.error(`Error en bloque ${i + 1}:`, errorMsg);
                    // No fallar completamente, continuar con el siguiente bloque
                }
            }
        }

        console.log('✓ Tablas creadas exitosamente');

        // Verificar que las tablas existen
        const checkTables = await pool.request().query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = 'dbo' 
            AND TABLE_NAME IN ('PriceActionsConfig', 'PriceChangeProposals', 'PriceChangeHistory')
            ORDER BY TABLE_NAME
        `);

        console.log('\nTablas verificadas:');
        checkTables.recordset.forEach((row: any) => {
            console.log(`  ✓ ${row.TABLE_NAME}`);
        });

    } catch (err: any) {
        console.error('Error:', err.message);
        if (err.code) console.error('Error code:', err.code);
        process.exit(1);
    } finally {
        if (pool) {
            await pool.close();
            console.log('\nConexión cerrada');
        }
    }
}

createTables();
