// Script para verificar datos reales en la base de datos
const sql = require('mssql');

const config = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_NAME || 'stadium',
    options: { encrypt: false, trustServerCertificate: true }
};

async function checkData() {
    try {
        await sql.connect(config);
        
        // Ver marcas reales
        console.log('=== MARCAS REALES (Top 10 últimos 30 días) ===\n');
        const marcas = await sql.query`
            SELECT TOP 10 DescripcionMarca, COUNT(*) as Transacciones, SUM(Cantidad) as Unidades, CAST(SUM(Precio) as decimal(18,2)) as Ventas
            FROM transacciones 
            WHERE Cantidad > 0 AND DescripcionMarca IS NOT NULL
            AND Fecha >= DATEADD(DAY, -30, GETDATE())
            GROUP BY DescripcionMarca
            ORDER BY Ventas DESC
        `;
        marcas.recordset.forEach((r, i) => {
            console.log(`${i+1}. ${r.DescripcionMarca}: $${r.Ventas.toLocaleString('es-UY')} (${r.Unidades} uds)`);
        });
        
        // Verificar si Adidas existe
        console.log('\n=== ¿EXISTE ADIDAS? ===\n');
        const adidas = await sql.query`
            SELECT TOP 5 Descripcion, BaseCol, SUM(Cantidad) as Unidades, CAST(SUM(Precio) as decimal(18,2)) as Ventas
            FROM transacciones 
            WHERE Cantidad > 0 AND LOWER(DescripcionMarca) LIKE '%adidas%'
            AND Fecha >= DATEADD(DAY, -30, GETDATE())
            GROUP BY Descripcion, BaseCol
            ORDER BY Ventas DESC
        `;
        if (adidas.recordset.length === 0) {
            console.log('❌ NO HAY PRODUCTOS DE ADIDAS EN LA BASE DE DATOS');
        } else {
            adidas.recordset.forEach((r, i) => {
                console.log(`${i+1}. ${r.Descripcion}`);
                console.log(`   Código: ${r.BaseCol} | Ventas: $${r.Ventas.toLocaleString('es-UY')} | Uds: ${r.Unidades}`);
            });
        }
        
        // Verificar productos top
        console.log('\n=== TOP 5 PRODUCTOS REALES ===\n');
        const productos = await sql.query`
            SELECT TOP 5 
                BaseCol,
                MAX(Descripcion) as Producto, 
                MAX(DescripcionMarca) as Marca,
                SUM(Cantidad) as Unidades, 
                CAST(SUM(Precio) as decimal(18,2)) as Ventas
            FROM transacciones 
            WHERE Cantidad > 0
            AND Fecha >= DATEADD(DAY, -30, GETDATE())
            GROUP BY BaseCol
            ORDER BY Ventas DESC
        `;
        productos.recordset.forEach((r, i) => {
            console.log(`${i+1}. ${r.Producto} (${r.Marca})`);
            console.log(`   Código: ${r.BaseCol} | Ventas: $${r.Ventas.toLocaleString('es-UY')} | Uds: ${r.Unidades}`);
        });
        
        await sql.close();
        console.log('\n✅ Consulta completada');
    } catch (err) {
        console.error('Error:', err.message);
    }
    process.exit(0);
}

checkData();
