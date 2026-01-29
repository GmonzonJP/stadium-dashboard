import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

export async function GET() {
    try {
        // Queries ported from legacy _EncuentraDarDash.java
        const queries = {
            stores: 'SELECT IdTienda as id, Descripcion as label FROM Tiendas',
            brands: `
        SELECT 
            T.idmarca as id, 
            MAX(T.DescripcionMarca) as label,
            SUM(T.Cantidad) as totalVentas
        FROM Transacciones T
        WHERE T.fecha >= DATEADD(DAY, -7, GETDATE())
        AND T.idmarca IS NOT NULL
        AND T.Cantidad > 0
        GROUP BY T.idmarca
        ORDER BY totalVentas DESC
      `,
            categories: `
        SELECT
            T.idClase as id,
            MAX(T.DescripcionClase) as label,
            SUM(T.PRECIO) as totalVentas
        FROM Transacciones T
        WHERE T.fecha >= DATEADD(YEAR, -1, GETDATE())
        AND T.idClase IS NOT NULL
        AND T.Cantidad > 0
        GROUP BY T.idClase
        ORDER BY totalVentas DESC
      `,
            genders: `
        SELECT DISTINCT idGenero as id, DescripcionGenero as label 
        FROM Transacciones 
        WHERE fecha >= DATEADD(YEAR, -2, GETDATE())
        AND idGenero IS NOT NULL
        ORDER BY label
      `,
            suppliers: `
        SELECT idProveedor as id, MAX(NombreProveedor) as label 
        FROM Transacciones 
        WHERE NombreProveedor IS NOT NULL 
        AND fecha >= DATEADD(YEAR, -2, GETDATE()) 
        GROUP BY idProveedor
        ORDER BY label
      `
        };

        const results: [string, any][] = [];
        for (const [key, query] of Object.entries(queries)) {
            const result = await executeQuery(query);
            results.push([key, result.recordset]);
        }

        return NextResponse.json(Object.fromEntries(results));

    } catch (error) {
        console.error('Filters API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
