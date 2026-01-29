import { executeQuery } from '../src/lib/db';

async function checkCostTables() {
    try {
        console.log('=== Checking UltimaCompra table ===');
        const ultimaCompraQuery = `
            SELECT TOP 5 
                COLUMN_NAME, 
                DATA_TYPE,
                IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME IN ('UltimaCompra', 'ultimaCompra', 'ULTIMACOMPRA')
            ORDER BY ORDINAL_POSITION
        `;
        const ucResult = await executeQuery(ultimaCompraQuery);
        console.log('UltimaCompra columns:', ucResult.recordset);

        // Check actual table name
        const tableNameQuery = `
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME LIKE '%compra%' OR TABLE_NAME LIKE '%Compra%'
            ORDER BY TABLE_NAME
        `;
        const tableResult = await executeQuery(tableNameQuery);
        console.log('\n=== Tables with "compra" in name ===');
        console.log(tableResult.recordset);

        console.log('\n=== Checking ArticuloPrecio table ===');
        const precioQuery = `
            SELECT TOP 5 
                COLUMN_NAME, 
                DATA_TYPE,
                IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME IN ('ArticuloPrecio', 'articuloPrecio', 'ARTICULOPRECIO')
            ORDER BY ORDINAL_POSITION
        `;
        const precioResult = await executeQuery(precioQuery);
        console.log('ArticuloPrecio columns:', precioResult.recordset);

        // Check actual table name
        const precioTableQuery = `
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME LIKE '%precio%' OR TABLE_NAME LIKE '%Precio%'
            ORDER BY TABLE_NAME
        `;
        const precioTableResult = await executeQuery(precioTableQuery);
        console.log('\n=== Tables with "precio" in name ===');
        console.log(precioTableResult.recordset);

        // Test a sample query to see if we get data
        console.log('\n=== Testing sample query for BaseCol 009.P98620102 ===');
        const sampleQuery = `
            SELECT TOP 1
                UC.BaseArticulo,
                UC.UltimoCosto,
                aPR.baseCol,
                aPR.Precio
            FROM UltimaCompra UC
            FULL OUTER JOIN ArticuloPrecio aPR ON aPR.baseCol = UC.BaseArticulo
            WHERE UC.BaseArticulo LIKE '009.P98620102%' 
               OR aPR.baseCol LIKE '009.P98620102%'
        `;
        const sampleResult = await executeQuery(sampleQuery);
        console.log('Sample data:', sampleResult.recordset);

        // Check what BaseCol format we have in transacciones
        console.log('\n=== Checking BaseCol format in transacciones ===');
        const baseColQuery = `
            SELECT TOP 5 
                BaseCol,
                IdMarca,
                DescripcionMarca
            FROM transacciones
            WHERE IdMarca = 9
            GROUP BY BaseCol, IdMarca, DescripcionMarca
        `;
        const baseColResult = await executeQuery(baseColQuery);
        console.log('Sample BaseCols:', baseColResult.recordset);

    } catch (err) {
        console.error('Error:', err);
    }
}

checkCostTables();
