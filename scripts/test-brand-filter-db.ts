import { executeQuery } from '../src/lib/db';

async function testBrandFilter() {
    try {
        console.log('Testing brand filter with direct SQL query...\n');

        // Test 1: Get all brands in the date range
        const allBrandsQuery = `
      SELECT DISTINCT T.IdMarca, T.DescripcionMarca, COUNT(*) as count
      FROM Transacciones T
      WHERE T.Fecha >= '2026-01-01' AND T.Fecha <= '2026-01-17'
      GROUP BY T.IdMarca, T.DescripcionMarca
      ORDER BY count DESC
    `;

        console.log('Query 1: All brands in date range');
        const allBrands = await executeQuery(allBrandsQuery);
        console.log('Results:', allBrands.recordset);
        console.log('');

        // Test 2: Get only Adidas (brand 9)
        const adidasQuery = `
      SELECT DISTINCT T.IdMarca, T.DescripcionMarca, COUNT(*) as count
      FROM Transacciones T
      WHERE T.Fecha >= '2026-01-01' AND T.Fecha <= '2026-01-17'
        AND T.IdMarca IN (9)
      GROUP BY T.IdMarca, T.DescripcionMarca
    `;

        console.log('Query 2: Only Adidas (IdMarca = 9)');
        const adidas = await executeQuery(adidasQuery);
        console.log('Results:', adidas.recordset);
        console.log('');

        // Test 3: Sample products from Adidas
        const adidasProductsQuery = `
      SELECT TOP 5
        T.IdMarca,
        T.DescripcionMarca,
        T.BaseCol,
        COUNT(*) as transactionCount
      FROM Transacciones T
      WHERE T.Fecha >= '2026-01-01' AND T.Fecha <= '2026-01-17'
        AND T.IdMarca IN (9)
      GROUP BY T.IdMarca, T.DescripcionMarca, T.BaseCol
      ORDER BY transactionCount DESC
    `;

        console.log('Query 3: Sample Adidas products');
        const products = await executeQuery(adidasProductsQuery);
        console.log('Results:', products.recordset);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

testBrandFilter();
