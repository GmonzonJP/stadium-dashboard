import { executeQuery } from '../src/lib/db';

async function testRecompraQuery() {
    try {
        console.log('Testing Recompra Query with Brand Filter...\n');

        const filters = {
            startDate: '2025-12-17',
            endDate: '2026-01-16',
            brands: [9]
        };

        const diffDays = Math.max(1, Math.ceil((new Date(filters.endDate).getTime() - new Date(filters.startDate).getTime()) / (1000 * 60 * 60 * 24)));

        // Test 1: Query without brand filter
        console.log('=== TEST 1: Query WITHOUT brand filter ===');
        const queryWithoutFilter = `
            SELECT TOP 10
                T.IdMarca, 
                T.DescripcionMarca, 
                T.BaseCol,
                COUNT(*) as transactionCount
            FROM transacciones T
            WHERE T.Fecha >= '${filters.startDate}' AND T.Fecha <= '${filters.endDate}'
            GROUP BY T.IdMarca, T.DescripcionMarca, T.BaseCol
            ORDER BY transactionCount DESC
        `;
        
        const result1 = await executeQuery(queryWithoutFilter);
        console.log('Results (first 10):', result1.recordset.map((r: any) => ({
            IdMarca: r.IdMarca,
            DescripcionMarca: r.DescripcionMarca,
            BaseCol: r.BaseCol,
            count: r.transactionCount
        })));
        console.log('');

        // Test 2: Query WITH brand filter
        console.log('=== TEST 2: Query WITH brand filter (IdMarca = 9) ===');
        const queryWithFilter = `
            SELECT TOP 10
                T.IdMarca, 
                T.DescripcionMarca, 
                T.BaseCol,
                COUNT(*) as transactionCount
            FROM transacciones T
            WHERE T.Fecha >= '${filters.startDate}' 
              AND T.Fecha <= '${filters.endDate}'
              AND T.IdMarca IN (9)
            GROUP BY T.IdMarca, T.DescripcionMarca, T.BaseCol
            ORDER BY transactionCount DESC
        `;
        
        const result2 = await executeQuery(queryWithFilter);
        console.log('Results (first 10):', result2.recordset.map((r: any) => ({
            IdMarca: r.IdMarca,
            DescripcionMarca: r.DescripcionMarca,
            BaseCol: r.BaseCol,
            count: r.transactionCount
        })));
        console.log('');

        // Test 3: Check if there are BaseCols with multiple brands (skip if error)
        console.log('=== TEST 3: Check BaseCols with multiple brands ===');
        try {
            const queryMultiBrand = `
                SELECT TOP 5
                    T.BaseCol,
                    COUNT(DISTINCT T.IdMarca) as brandCount
                FROM transacciones T
                WHERE T.Fecha >= '${filters.startDate}' 
                  AND T.Fecha <= '${filters.endDate}'
                GROUP BY T.BaseCol
                HAVING COUNT(DISTINCT T.IdMarca) > 1
                ORDER BY brandCount DESC
            `;
            
            const result3 = await executeQuery(queryMultiBrand);
            console.log(`Found ${result3.recordset.length} BaseCols with multiple brands (sample)`);
            if (result3.recordset.length > 0) {
                console.log('Sample:', result3.recordset.map((r: any) => ({
                    BaseCol: r.BaseCol,
                    brandCount: r.brandCount
                })));
            }
        } catch (e) {
            console.log('Test 3 skipped (error expected)');
        }
        console.log('');

        // Test 4: Full recompra query with brand filter
        console.log('=== TEST 4: Full Recompra Query with brand filter ===');
        const fullQuery = `
            SELECT TOP 10
                T.IdMarca, 
                T.DescripcionMarca, 
                T.BaseCol, 
                AR.descripcionCorta,
                SUM(T.Cantidad) as unidades,
                CAST(SUM(T.PRECIO) as decimal(10,2)) as Venta
            FROM transacciones T
            INNER JOIN (
                SELECT AR.base as BaseCol, AR.descripcionCorta 
                FROM Articulos AR 
                GROUP BY AR.base, AR.descripcionCorta
            ) AR ON AR.BaseCol = T.BaseCol
            WHERE T.Fecha >= '${filters.startDate}' 
              AND T.Fecha <= '${filters.endDate}'
              AND T.IdMarca IN (9)
            GROUP BY T.IdGenero, T.DescripcionGenero, T.BaseCol, AR.descripcionCorta, T.IdMarca, T.DescripcionMarca
            HAVING SUM(T.Cantidad) > 0
            ORDER BY Venta DESC
        `;
        
        const result4 = await executeQuery(fullQuery);
        console.log(`Returned ${result4.recordset.length} rows`);
        console.log('Results (first 10):', result4.recordset.map((r: any) => ({
            IdMarca: r.IdMarca,
            DescripcionMarca: r.DescripcionMarca,
            BaseCol: r.BaseCol,
            descripcionCorta: r.descripcionCorta,
            unidades: r.unidades,
            Venta: r.Venta
        })));
        
        // Check for wrong brands
        const wrongBrands = result4.recordset.filter((r: any) => Number(r.IdMarca) !== 9);
        if (wrongBrands.length > 0) {
            console.error(`\n❌ ERROR: Found ${wrongBrands.length} rows with wrong brand!`);
            console.error('Wrong brands:', wrongBrands.slice(0, 5));
        } else {
            console.log('\n✅ All rows have correct brand (IdMarca = 9)');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

testRecompraQuery();
