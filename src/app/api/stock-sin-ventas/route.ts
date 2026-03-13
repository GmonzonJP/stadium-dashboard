import { NextRequest, NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';
import { DEPOSITOS_CONFIG } from '@/types/sell-out';
import { StockSinVentasItem, StockSinVentasResponse } from '@/types';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { startDate, endDate, stores, brands, categories, sections, genders, suppliers } = body;

        console.log('Stock sin ventas - Inicio query:', { startDate, endDate, brands: brands?.length, stores: stores?.length });
        const t0 = Date.now();

        const pool = await getDbConnection();

        // Excluir depositos web y ocultos del stock
        const hiddenStores = [...DEPOSITOS_CONFIG.web, ...DEPOSITOS_CONFIG.ocultar];
        const storeFilter = stores?.length
            ? `AND M.idDeposito IN (${stores.join(',')})`
            : `AND M.idDeposito NOT IN (${hiddenStores.join(',')})`;

        // Filtros sobre Articulos (master data)
        const articulosWhere: string[] = [];
        if (brands?.length) articulosWhere.push(`A.IdMarca IN (${brands.join(',')})`);
        if (categories?.length) articulosWhere.push(`A.IdClase IN (${categories.join(',')})`);
        if (sections?.length) articulosWhere.push(`A.IdSeccion IN (${sections.join(',')})`);
        if (genders?.length) articulosWhere.push(`A.IdGenero IN (${genders.join(',')})`);
        const articulosWhereStr = articulosWhere.length > 0 ? 'AND ' + articulosWhere.join(' AND ') : '';

        // Filtro de proveedores (usa idProveedor)
        const supplierFilter = suppliers?.length
            ? `AND T.idProveedor IN (${suppliers.join(',')})`
            : '';

        // Filtro de tiendas para ventas
        const ventasStoreFilter = stores?.length
            ? `AND T.IdDeposito IN (${stores.join(',')})`
            : '';

        const query = `
            WITH StockActual AS (
                SELECT
                    A.Base as BaseCol,
                    MAX(A.Descripcion) as Descripcion,
                    MAX(A.DescripcionCorta) as DescripcionCorta,
                    MAX(A.DescripcionMarca) as DescripcionMarca,
                    MAX(A.IdMarca) as IdMarca,
                    MAX(A.DescripcionClase) as DescripcionClase,
                    MAX(A.DescripcionSeccion) as DescripcionSeccion,
                    SUM(M.TotalStock) as StockTotal,
                    COUNT(DISTINCT M.idDeposito) as CantidadDepositos,
                    MAX(A.PrecioLista) as PVP
                FROM MovStockTotalResumen M WITH (NOLOCK)
                INNER JOIN Articulos A WITH (NOLOCK) ON A.IdArticulo = M.IdArticulo
                WHERE M.TotalStock > 0
                    ${storeFilter}
                    ${articulosWhereStr}
                    AND A.Descripcion NOT IN ('SALDO', '{Sin Definir}')
                GROUP BY A.Base
                HAVING SUM(M.TotalStock) > 0
            ),
            VentasPeriodo AS (
                SELECT
                    T.BaseCol,
                    SUM(T.Cantidad) as UnidadesVendidas
                FROM Transacciones T WITH (NOLOCK)
                WHERE T.Fecha >= '${startDate}'
                    AND T.Fecha <= '${endDate}'
                    AND T.Cantidad > 0
                    ${ventasStoreFilter}
                    ${supplierFilter}
                    AND T.BaseCol IN (SELECT BaseCol FROM StockActual)
                GROUP BY T.BaseCol
            ),
            UltimaVenta AS (
                SELECT
                    T.BaseCol,
                    MAX(T.Fecha) as FechaUltimaVenta
                FROM Transacciones T WITH (NOLOCK)
                WHERE T.Cantidad > 0
                    AND T.BaseCol IN (SELECT BaseCol FROM StockActual)
                GROUP BY T.BaseCol
            ),
            CostoInfo AS (
                SELECT
                    A.Base as BaseCol,
                    MAX(UC.UltimoCosto) as UltimoCosto
                FROM UltimaCompra UC WITH (NOLOCK)
                INNER JOIN Articulos A WITH (NOLOCK) ON A.IdArticulo = UC.BaseArticulo
                WHERE A.Base IN (SELECT BaseCol FROM StockActual)
                GROUP BY A.Base
            )
            SELECT TOP 5000
                SA.BaseCol,
                SA.Descripcion,
                SA.DescripcionCorta,
                SA.DescripcionMarca,
                SA.IdMarca,
                SA.DescripcionClase,
                SA.DescripcionSeccion,
                SA.StockTotal,
                SA.CantidadDepositos,
                SA.PVP,
                UV.FechaUltimaVenta,
                DATEDIFF(DAY, UV.FechaUltimaVenta, GETDATE()) as DiasSinVenta,
                CI.UltimoCosto,
                SA.StockTotal * ISNULL(CI.UltimoCosto, 0) as ValorInventario
            FROM StockActual SA
            LEFT JOIN VentasPeriodo VP ON SA.BaseCol = VP.BaseCol
            LEFT JOIN UltimaVenta UV ON SA.BaseCol = UV.BaseCol
            LEFT JOIN CostoInfo CI ON SA.BaseCol = CI.BaseCol
            WHERE (VP.UnidadesVendidas IS NULL OR VP.UnidadesVendidas = 0)
            ORDER BY SA.StockTotal DESC
        `;

        const result = await pool.request().query(query);
        console.log(`Stock sin ventas - Query completada en ${Date.now() - t0}ms, ${result.recordset.length} filas`);
        const rows = result.recordset;

        const items: StockSinVentasItem[] = rows.map((row: any) => ({
            BaseCol: row.BaseCol,
            descripcion: row.Descripcion || '',
            descripcionCorta: row.DescripcionCorta || '',
            descripcionMarca: row.DescripcionMarca || '',
            idMarca: row.IdMarca || 0,
            descripcionClase: row.DescripcionClase || '',
            descripcionSeccion: row.DescripcionSeccion || '',
            stockTotal: row.StockTotal || 0,
            cantidadDepositos: row.CantidadDepositos || 0,
            diasSinVenta: row.DiasSinVenta ?? null,
            fechaUltimaVenta: row.FechaUltimaVenta || null,
            pvp: row.PVP || null,
            ultimoCosto: row.UltimoCosto || null,
            valorInventario: row.ValorInventario || 0,
        }));

        const totalUnidadesStock = items.reduce((sum, i) => sum + i.stockTotal, 0);
        const valorInventarioTotal = items.reduce((sum, i) => sum + i.valorInventario, 0);
        const articulosSinVentaNunca = items.filter(i => i.fechaUltimaVenta === null).length;
        const articulosSinVentaPeriodo = items.filter(i => i.fechaUltimaVenta !== null).length;

        const response: StockSinVentasResponse = {
            items,
            resumen: {
                totalArticulos: items.length,
                totalUnidadesStock,
                valorInventarioTotal,
                articulosSinVentaNunca,
                articulosSinVentaPeriodo,
            },
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('Error en API stock-sin-ventas:', error);
        return NextResponse.json(
            { error: 'Error al procesar reporte de stock sin ventas', details: String(error) },
            { status: 500 }
        );
    }
}
