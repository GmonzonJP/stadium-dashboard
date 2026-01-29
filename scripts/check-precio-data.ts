import { executeQuery } from '../src/lib/db';

async function checkPrecioData() {
    try {
        // Check if ArticuloPrecio has data for Adidas products
        console.log('=== Checking ArticuloPrecio data ===');
        const precioQuery = `
            SELECT TOP 10
                baseCol,
                Precio
            FROM ArticuloPrecio
            WHERE baseCol LIKE '009.%'
            ORDER BY baseCol
        `;
        const precioResult = await executeQuery(precioQuery);
        console.log('ArticuloPrecio samples:', precioResult.recordset);

        // Check if we can get price from transacciones
        console.log('\n=== Checking price from transacciones ===');
        const transPrecioQuery = `
            SELECT TOP 10
                T.BaseCol,
                MAX(T.PRECIO / NULLIF(T.Cantidad, 0)) as precioUnitario,
                MAX(aPR.Precio) as precioLista
            FROM transacciones T
            LEFT JOIN ArticuloPrecio aPR ON aPR.baseCol = T.BaseCol
            WHERE T.IdMarca = 9
            GROUP BY T.BaseCol
        `;
        const transResult = await executeQuery(transPrecioQuery);
        console.log('Price from transacciones:', transResult.recordset);

        // Check UltimaCompra with corrected JOIN
        console.log('\n=== Testing corrected UltimaCompra JOIN ===');
        const ucQuery = `
            SELECT TOP 10
                T.BaseCol,
                MAX(UC.ultimoCosto) as ultimoCosto
            FROM transacciones T
            LEFT JOIN (
                SELECT SUBSTRING(BaseArticulo, 1, 13) as BaseCol, MAX(UltimoCosto) as ultimoCosto 
                FROM UltimaCompra 
                GROUP BY SUBSTRING(BaseArticulo, 1, 13)
            ) UC ON UC.BaseCol = T.BaseCol
            WHERE T.IdMarca = 9
            GROUP BY T.BaseCol
            HAVING MAX(UC.ultimoCosto) IS NOT NULL
        `;
        const ucResult = await executeQuery(ucQuery);
        console.log('UltimaCompra with corrected JOIN:', ucResult.recordset);

    } catch (err) {
        console.error('Error:', err);
    }
}

checkPrecioData();
