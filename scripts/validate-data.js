const sql = require('mssql');
require('dotenv').config({ path: '.env.local' });

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE || 'anysys',
    options: { encrypt: true, trustServerCertificate: true }
};

async function test() {
    console.log('Conectando a:', config.server, '/', config.database);
    const pool = await sql.connect(config);
    
    // Ver columnas de Transacciones
    const cols = await pool.request().query(`
        SELECT COLUMN_NAME, DATA_TYPE 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'Transacciones'
        ORDER BY ORDINAL_POSITION
    `);
    console.log('=== COLUMNAS DE Transacciones ===');
    cols.recordset.forEach((r) => {
        console.log('- ' + r.COLUMN_NAME + ' (' + r.DATA_TYPE + ')');
    });
    
    // Ver marcas reales
    console.log('');
    const marcas = await pool.request().query(`
        SELECT TOP 10 
            DescripcionMarca, 
            SUM(Cantidad) as Unidades,
            CAST(SUM(Precio) as decimal(18,2)) as Ventas
        FROM Transacciones 
        WHERE Cantidad > 0 
        AND Fecha >= DATEADD(DAY, -30, GETDATE())
        GROUP BY DescripcionMarca 
        ORDER BY Ventas DESC
    `);
    
    console.log('=== MARCAS REALES (últimos 30 días) ===');
    marcas.recordset.forEach((r, i) => {
        console.log((i+1) + '. ' + r.DescripcionMarca + ': $' + r.Ventas.toLocaleString() + ' (' + r.Unidades.toLocaleString() + ' uds)');
    });

    // Ver productos de la marca top
    if (marcas.recordset.length > 0) {
        const topMarca = marcas.recordset[0].DescripcionMarca;
        const productos = await pool.request().query(`
            SELECT TOP 5
                BaseCol,
                MAX(DescripcionArticulo) as Producto,
                SUM(Cantidad) as Unidades,
                CAST(SUM(PRECIO) as decimal(18,2)) as Ventas,
                CAST(SUM(PRECIO) / NULLIF(SUM(Cantidad), 0) as decimal(18,2)) as TicketPromedio,
                CAST(AVG(MargenPorc) as decimal(5,2)) as Margen
            FROM Transacciones
            WHERE Cantidad > 0 
            AND DescripcionMarca = '${topMarca}'
            AND Fecha >= DATEADD(DAY, -30, GETDATE())
            GROUP BY BaseCol
            ORDER BY Ventas DESC
        `);
        console.log('');
        console.log('=== TOP 5 PRODUCTOS DE ' + topMarca + ' ===');
        productos.recordset.forEach((r, i) => {
            console.log((i+1) + '. [' + r.BaseCol + '] ' + (r.Producto || 'Sin descripción'));
            console.log('   Ventas: $' + (r.Ventas ? r.Ventas.toLocaleString() : 0) + ' | Unidades: ' + r.Unidades);
            console.log('   Ticket: $' + (r.TicketPromedio ? r.TicketPromedio.toLocaleString() : 0) + ' | Margen: ' + (r.Margen || 0) + '%');
        });
    }
    
    await pool.close();
}
test().catch(console.error);
