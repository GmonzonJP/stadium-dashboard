import { buildDashboardQuery } from '../src/lib/query-builder';
import { FilterParams } from '../src/types';

// Simular exactamente lo que hace la API
const filters: FilterParams = {
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  brands: [9], // Adidas
  stores: [],
  categories: [],
  genders: [],
  suppliers: [],
  search: ''
};

console.log('=== TEST: Recompra API Logic ===\n');
console.log('Filters:', JSON.stringify(filters, null, 2));

// Sanitizar brands como lo hace la API
const brandIds = filters.brands?.length 
  ? filters.brands.map(b => {
      const num = Number(b);
      if (isNaN(num)) {
        console.warn('Invalid brand ID:', b);
        return null;
      }
      return num;
    }).filter(b => b !== null) as number[]
  : [];

if (brandIds.length > 0) {
  filters.brands = brandIds;
  console.log('\nSanitized brand IDs:', brandIds);
}

const diffDays = 365;

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

console.log('\n=== Step 1: buildDashboardQuery ===');
let finalQuery = buildDashboardQuery(recompraSQL, filters, {
  tableAlias: 'T',
  searchColumns: [
    'T.DescripcionMarca',
    'T.BaseCol',
    'AR.descripcionCorta',
    'T.DescripcionClase',
    'T.DescripcionGenero'
  ]
});

console.log('\nQuery after buildDashboardQuery:');
console.log(finalQuery.substring(0, 500));
console.log('...');

// Verificar si el filtro de marca está en el WHERE
const brandFilterInWhere = `T.IdMarca IN (${brandIds.join(',')})`;
console.log('\n=== Step 2: Check WHERE clause ===');
console.log('Looking for:', brandFilterInWhere);
console.log('Contains exact match?', finalQuery.includes(brandFilterInWhere));
console.log('Contains "T.IdMarca IN"?', finalQuery.includes('T.IdMarca IN'));

// Extraer WHERE clause
const whereMatch = finalQuery.match(/WHERE\s+(.+?)(?:\s+GROUP BY|\s+HAVING|$)/i);
if (whereMatch) {
  console.log('\nWHERE clause found:', whereMatch[1]);
  console.log('WHERE clause includes brand filter?', whereMatch[1].includes('IdMarca'));
} else {
  console.log('\nWARNING: No WHERE clause found!');
}

// Verificar HAVING clause original
const havingMatch = finalQuery.match(/HAVING\s+(.+?)(?:\s*$)/i);
if (havingMatch) {
  console.log('\n=== Step 3: Original HAVING clause ===');
  console.log('HAVING clause:', havingMatch[1]);
}

// Aplicar la lógica de reemplazo del HAVING como en la API
if (brandIds.length > 0) {
  const havingBrandFilter = `HAVING SUM(T.Cantidad) > 0 AND T.IdMarca IN (${brandIds.join(',')})`;
  const patterns = [
    /HAVING\s+SUM\s*\(\s*T\.Cantidad\s*\)\s*>\s*0/i,
    /HAVING SUM\(T\.Cantidad\) > 0/,
    /HAVING\s+SUM\(T\.Cantidad\)\s*>\s*0/
  ];
  
  let replaced = false;
  for (const pattern of patterns) {
    if (pattern.test(finalQuery)) {
      finalQuery = finalQuery.replace(pattern, havingBrandFilter);
      replaced = true;
      console.log('\n=== Step 4: HAVING replacement ===');
      console.log('Pattern matched:', pattern);
      console.log('Replaced with:', havingBrandFilter);
      break;
    }
  }
  
  if (!replaced) {
    console.log('\n=== Step 4: HAVING replacement ===');
    console.log('WARNING: Could not find HAVING clause to replace!');
  }
  
  // Verificar HAVING final
  const finalHavingMatch = finalQuery.match(/HAVING\s+(.+?)(?:\s*$)/i);
  if (finalHavingMatch) {
    console.log('\nFinal HAVING clause:', finalHavingMatch[1]);
  }
}

console.log('\n=== Final Query (last 300 chars) ===');
console.log(finalQuery.substring(finalQuery.length - 300));
