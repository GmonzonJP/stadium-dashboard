// Test script to see what SQL query is generated for brand filter
import { buildDashboardQuery } from '../src/lib/query-builder';

const filters = {
    startDate: '2026-01-01',
    endDate: '2026-01-17',
    brands: [9],
    stores: [],
    categories: [],
    genders: [],
    suppliers: []
};

const diffDays = 17;

const recompraSQL = `
  SELECT 
    T.IdMarca, 
    T.DescripcionMarca, 
    MAX(T.idClase) as idClase,
    MAX(T.DescripcionClase) as DescripcionClase, 
    T.IdGenero, 
    T.DescripcionGenero, 
    T.BaseCol, 
    AR.descripcionCorta,
    T.BaseCol as imagen,
    MAX(UC.ultimoCosto) as ultimoCosto, 
    MAX(STK.stock) as stock, 
    SUM(T.Cantidad) as unidades,
    CAST(SUM(T.PRECIO) as decimal(10,2)) as Venta,  
    SUM(T.Cantidad) * (1.22 * MAX(UC.ultimoCosto)) as costoVenta,
    CAST(SUM(T.PRECIO) - (SUM(T.Cantidad) * (1.22 * MAX(UC.ultimoCosto))) as decimal(10,2)) as margenBruto, 
    CAST(SUM(T.PRECIO) / NULLIF((SUM(T.Cantidad) * (1.22 * MAX(UC.ultimoCosto))), 0) as decimal(10,2)) as margen, 
    aPR.Precio as precioUnitarioLista,
    CAST(MAX(STK.stock) / NULLIF((CAST(SUM(T.Cantidad) as decimal(10,2)) / NULLIF(${diffDays}, 0)), 0) as decimal(10,0)) as diasStock
  FROM Transacciones T
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

console.log('='.repeat(80));
console.log('GENERATED SQL QUERY:');
console.log('='.repeat(80));
console.log(finalQuery);
console.log('='.repeat(80));
console.log('\nLooking for brand filter...');
if (finalQuery.includes('T.IdMarca IN (9)')) {
    console.log('✓ Brand filter FOUND: T.IdMarca IN (9)');
} else {
    console.log('✗ Brand filter NOT FOUND!');
    console.log('Searching for any IdMarca reference...');
    const matches = finalQuery.match(/IdMarca[^,]*/g);
    console.log('Found:', matches);
}
