
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

console.log('Connecting to:', config.server);

async function testConnection() {
    try {
        const pool = await new sql.ConnectionPool(config).connect();
        console.log('Connected successfully!');

        const result = await pool.request().query('SELECT TOP 1 * FROM Transacciones');
        console.log('Query success, row count:', result.recordset.length);

        await pool.close();
    } catch (err: any) {
        console.error('Connection failed:', err.message);
        if (err.code) console.error('Error code:', err.code);
    }
}

testConnection();
