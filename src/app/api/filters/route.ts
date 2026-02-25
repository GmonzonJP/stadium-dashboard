import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { SectionItem, CategoryItem } from '@/types';

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
        SELECT MIN(idProveedor) as id, NombreProveedor as label
        FROM Transacciones
        WHERE NombreProveedor IS NOT NULL
        AND LTRIM(RTRIM(NombreProveedor)) <> ''
        AND fecha >= DATEADD(YEAR, -2, GETDATE())
        GROUP BY NombreProveedor
        ORDER BY label
      `
        };

        // Jerarquía sección→clase desde Articulos (master data) para evitar
        // relaciones espurias por productos históricamente mal categorizados.
        const sectionsQuery = `
        SELECT
            A.IdSeccion as sectionId,
            MAX(A.DescripcionSeccion) as sectionLabel,
            A.IdClase as categoryId,
            MAX(A.DescripcionClase) as categoryLabel
        FROM Articulos A
        WHERE A.IdSeccion IS NOT NULL
          AND A.IdClase IS NOT NULL
          AND A.Descripcion NOT IN ('SALDO', '{Sin Definir}')
        GROUP BY A.IdSeccion, A.IdClase
        ORDER BY MAX(A.DescripcionSeccion), MAX(A.DescripcionClase)
      `;

        const results: [string, any][] = [];
        for (const [key, query] of Object.entries(queries)) {
            const result = await executeQuery(query);
            results.push([key, result.recordset]);
        }

        // Build hierarchical sections -> categories
        const sectionsResult = await executeQuery(sectionsQuery);
        const sectionMap = new Map<number, SectionItem>();

        for (const row of sectionsResult.recordset) {
            if (!sectionMap.has(row.sectionId)) {
                sectionMap.set(row.sectionId, {
                    id: row.sectionId,
                    label: row.sectionLabel,
                    categories: []
                });
            }
            const section = sectionMap.get(row.sectionId)!;
            section.categories.push({
                id: row.categoryId,
                label: row.categoryLabel,
                sectionId: row.sectionId,
                sectionLabel: row.sectionLabel
            });
        }

        // Sort sections alphabetically (ya no tenemos totalVentas desde Articulos)
        const sectionsData = Array.from(sectionMap.values());
        sectionsData.sort((a, b) => a.label.localeCompare(b.label, 'es'));

        results.push(['sections', sectionsData]);

        return NextResponse.json(Object.fromEntries(results));

    } catch (error) {
        console.error('Filters API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
