import { executeQuery } from '../src/lib/db';

async function testProductEndpoint() {
    const articulo = '051.372279-0202001'; // From the image
    
    try {
        console.log('=== Testing Product Endpoint ===');
        console.log('Product ID:', articulo);

        // Test base info query
        const baseInfoQuery = `
            SELECT 
                T.BaseCol,
                T.IdMarca, 
                T.DescripcionMarca, 
                MAX(T.idClase) as idClase,
                MAX(T.DescripcionClase) as DescripcionClase, 
                T.IdGenero, 
                T.DescripcionGenero, 
                AR.descripcionCorta,
                SUM(T.Cantidad) as unidades,
                CAST(SUM(T.PRECIO) as decimal(18,2)) as Venta,
                COALESCE(MAX(aPR.Precio), MAX(T.PRECIO / NULLIF(T.Cantidad, 0))) as precioUnitarioLista,
                MIN(T.Fecha) as primeraVenta
            FROM transacciones T
            INNER JOIN (
                SELECT AR.base as BaseCol, AR.descripcionCorta 
                FROM Articulos AR 
                GROUP BY AR.base, AR.descripcionCorta
            ) AR ON AR.BaseCol = T.BaseCol
            LEFT JOIN ArticuloPrecio aPR ON aPR.baseCol = T.BaseCol
            WHERE T.BaseCol = '${articulo}'
            GROUP BY T.IdGenero, T.DescripcionGenero, T.BaseCol, AR.descripcionCorta, T.IdMarca, T.DescripcionMarca
            HAVING SUM(T.Cantidad) > 0
        `;
        
        const baseResult = await executeQuery(baseInfoQuery);
        console.log('\n=== Base Info Result ===');
        console.log('Rows:', baseResult.recordset.length);
        if (baseResult.recordset.length > 0) {
            console.log('First row:', baseResult.recordset[0]);
        } else {
            console.log('No results! Checking if BaseCol exists...');
            
            // Check if BaseCol exists in transacciones
            const checkBaseCol = `
                SELECT TOP 5 BaseCol, idArticulo
                FROM transacciones
                WHERE idArticulo LIKE '${articulo}%'
            `;
            const checkResult = await executeQuery(checkBaseCol);
            console.log('BaseCols matching:', checkResult.recordset);
        }

        // Test UltimaCompra
        const ultimaCompraQuery = `
            SELECT TOP 1
                FechaUltimaCompra as fecha,
                CantidadUltimaCompra as cantidad,
                UltimoCosto as costo,
                BaseArticulo
            FROM UltimaCompra
            WHERE BaseArticulo LIKE '${articulo}%'
            ORDER BY FechaUltimaCompra DESC
        `;
        const ultimaCompraResult = await executeQuery(ultimaCompraQuery);
        console.log('\n=== UltimaCompra Result ===');
        console.log('Rows:', ultimaCompraResult.recordset.length);
        if (ultimaCompraResult.recordset.length > 0) {
            console.log('First row:', ultimaCompraResult.recordset[0]);
        }

        // Test MovStockTotalResumen
        const stockQuery = `
            SELECT 
                M.idDeposito as id,
                MAX(D.Descripcion) as descripcion,
                SUM(M.TotalStock) as ttlstock,
                M.IdArticulo
            FROM MovStockTotalResumen M
            INNER JOIN depositos D ON D.IdDeposito = M.idDeposito
            WHERE M.IdArticulo LIKE '${articulo}%'
            GROUP BY M.idDeposito, M.IdArticulo
        `;
        const stockResult = await executeQuery(stockQuery);
        console.log('\n=== Stock Result ===');
        console.log('Rows:', stockResult.recordset.length);
        if (stockResult.recordset.length > 0) {
            console.log('First 3 rows:', stockResult.recordset.slice(0, 3));
        }

        // Test sales
        const salesQuery = `
            SELECT 
                T.IdDeposito as id,
                MAX(D.Descripcion) as descripcion,
                SUM(T.Cantidad) as ttlunidadesVenta,
                CAST(SUM(T.PRECIO) as decimal(18,2)) as ttlimporteVenta
            FROM transacciones T
            INNER JOIN depositos D ON D.IdDeposito = T.IdDeposito
            WHERE T.BaseCol = '${articulo}'
            GROUP BY T.IdDeposito
        `;
        const salesResult = await executeQuery(salesQuery);
        console.log('\n=== Sales Result ===');
        console.log('Rows:', salesResult.recordset.length);
        if (salesResult.recordset.length > 0) {
            console.log('First 3 rows:', salesResult.recordset.slice(0, 3));
        }

    } catch (err) {
        console.error('Error:', err);
    }
}

testProductEndpoint();
