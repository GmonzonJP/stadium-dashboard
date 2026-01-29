
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

async function checkColumns() {
    try {
        const pool = await new sql.ConnectionPool(config).connect();
        console.log('Connected!');

        const query = `
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Transacciones'
        `;
        const result = await pool.request().query(query);
        console.log('Columns:', result.recordset.map(r => r.COLUMN_NAME));

        await pool.close();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkColumns();
