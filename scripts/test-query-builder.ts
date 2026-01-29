import { buildDashboardQuery } from '../src/lib/query-builder';
import { FilterParams } from '../src/types';

// Simulate exactly what the recompra route does
const filters: FilterParams = {
    startDate: '2025-12-17',
    endDate: '2026-01-16',
    brands: [9],
    stores: [],
    categories: [],
    genders: [],
    suppliers: []
};

const diffDays = 31;

const recompraSQL = `
      SELECT 
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
      LEFT JOIN (
          SELECT BaseArticulo, MAX(UltimoCosto) as ultimoCosto 
          FROM UltimaCompra 
          GROUP BY BaseArticulo
      ) UC ON UC.BaseArticulo = T.BaseCol
      LEFT JOIN (
          SELECT SUBSTRING(IdArticulo, 1, 13) as BaseCol, SUM(TotalStock) as stock
          FROM MovStockTotalResumen
          GROUP BY SUBSTRING(IdArticulo, 1, 13)
      ) STK ON STK.BaseCol = T.BaseCol
      LEFT JOIN ArticuloPrecio aPR ON aPR.baseCol = T.BaseCol
      {WHERE}
      GROUP BY T.IdGenero, T.DescripcionGenero, T.BaseCol, AR.descripcionCorta, T.IdMarca, T.DescripcionMarca, aPR.Precio
      HAVING SUM(T.Cantidad) > 0
    `;

console.log('=== Testing Query Builder ===');
console.log('Filters:', JSON.stringify(filters, null, 2));
console.log('');

const finalQuery = buildDashboardQuery(recompraSQL, filters, {
    tableAlias: 'T',
    searchColumns: [
        'T.DescripcionMarca',
        'T.BaseCol',
        'AR.descripcionCorta',
        'T.DescripcionClase',
        'T.DescripcionGenero'
    ]
});

console.log('=== Generated Query ===');
console.log(finalQuery);
console.log('');

// Check if WHERE clause contains brand filter
const whereMatch = finalQuery.match(/WHERE\s+(.+?)(?:\s+GROUP BY|\s+HAVING|$)/i);
if (whereMatch) {
    console.log('=== WHERE Clause ===');
    console.log(whereMatch[1]);
    console.log('');
    
    // Check if brand filter is present
    if (whereMatch[1].includes('IdMarca') || whereMatch[1].includes('T.IdMarca')) {
        console.log('✅ Brand filter found in WHERE clause');
    } else {
        console.log('❌ Brand filter NOT found in WHERE clause!');
    }
} else {
    console.log('❌ No WHERE clause found!');
}

// Check if query contains brand filter anywhere
if (finalQuery.includes('IdMarca IN (9)') || finalQuery.includes('T.IdMarca IN (9)')) {
    console.log('✅ Brand filter found in query');
} else {
    console.log('❌ Brand filter NOT found in query!');
}
