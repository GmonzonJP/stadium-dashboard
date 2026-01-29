import sql from 'mssql';

const config: sql.config = {
    user: (process.env.DB_USER || 'sa').trim(),
    password: (process.env.DB_PASSWORD || 'Republica.900').trim(),
    server: (process.env.DB_SERVER || '10.120.0.19').trim(),
    database: (process.env.DB_DATABASE || 'anysys').trim(),
    options: {
        encrypt: true, // Back to true as per screenshot
        trustServerCertificate: true, // For internal connections
        ...(process.env.DB_INSTANCE ? { instanceName: process.env.DB_INSTANCE } : {}),
        connectTimeout: 30000,
    },
    requestTimeout: 60000, // Increase to 60s for analytical queries
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
    },
};

let pool: sql.ConnectionPool | null = null;

export async function getDbConnection() {
    if (pool) return pool;

    try {
        pool = await new sql.ConnectionPool(config).connect();
        return pool;
    } catch (err) {
        console.error('Database connection failed:', err);
        throw err;
    }
}

export async function executeQuery(query: string, params: { name: string, type: any, value: any }[] = []) {
    const connection = await getDbConnection();
    const request = connection.request();

    params.forEach(param => {
        request.input(param.name, param.type, param.value);
    });

    return request.query(query);
}
