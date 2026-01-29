import { executeQuery } from '../src/lib/db';

async function checkBaseColPattern() {
    try {
        // Check a sample product to see BaseCol pattern
        const sampleQuery = `
            SELECT TOP 10
                T.BaseCol,
                T.idArticulo,
                AR.base as ArticulosBase,
                LEN(T.BaseCol) as BaseColLength,
                LEN(T.idArticulo) as IdArticuloLength
            FROM transacciones T
            INNER JOIN Articulos AR ON AR.base = T.BaseCol
            WHERE T.BaseCol IS NOT NULL
            GROUP BY T.BaseCol, T.idArticulo, AR.base
            ORDER BY T.BaseCol
        `;
        
        const result = await executeQuery(sampleQuery);
        console.log('=== BaseCol Pattern Analysis ===');
        console.log('Sample BaseCols:', result.recordset);

        // Check MovStockTotalResumen pattern
        const stockQuery = `
            SELECT TOP 10
                IdArticulo,
                LEN(IdArticulo) as Length,
                SUBSTRING(IdArticulo, 1, 13) as First13,
                SUBSTRING(IdArticulo, 1, 15) as First15
            FROM MovStockTotalResumen
            WHERE IdArticulo IS NOT NULL
            GROUP BY IdArticulo
        `;
        
        const stockResult = await executeQuery(stockQuery);
        console.log('\n=== MovStockTotalResumen Pattern ===');
        console.log('Sample IdArticulos:', stockResult.recordset);

        // Check UltimaCompra pattern
        const compraQuery = `
            SELECT TOP 10
                BaseArticulo,
                LEN(BaseArticulo) as Length,
                SUBSTRING(BaseArticulo, 1, 13) as First13
            FROM UltimaCompra
            WHERE BaseArticulo IS NOT NULL
            GROUP BY BaseArticulo
        `;
        
        const compraResult = await executeQuery(compraQuery);
        console.log('\n=== UltimaCompra Pattern ===');
        console.log('Sample BaseArticulos:', compraResult.recordset);

    } catch (err) {
        console.error('Error:', err);
    }
}

checkBaseColPattern();
