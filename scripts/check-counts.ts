
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

const config = {
    user: (envVars.DB_USER || 'sa').trim(),
    password: (envVars.DB_PASSWORD || 'Republica.900').trim(),
    server: (envVars.DB_SERVER || '10.120.0.19').trim(),
    database: (envVars.DB_DATABASE || 'anysys').trim(),
    options: {
        encrypt: true,
        trustServerCertificate: true,
        connectTimeout: 5000,
    },
};

async function checkCounts() {
    try {
        const pool = await new sql.ConnectionPool(config).connect();

        const r1 = await pool.request().query('SELECT COUNT(*) as count FROM MovStockTotalResumen');
        console.log('MovStockTotalResumen count:', r1.recordset[0].count);

        const r2 = await pool.request().query('SELECT COUNT(*) as count FROM Transacciones');
        console.log('Transacciones count:', r2.recordset[0].count);

        await pool.close();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkCounts();
