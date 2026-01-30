import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { extractTalla, sortTallas } from '@/lib/talla-utils';

// Function to calculate insights based on stock and sales patterns
function calculateInsights(tallasData: any[], stockActual: number, unidadesVendidas: number, stockInicial: number) {
    const insights: Array<{ type: 'success' | 'warning' | 'error' | 'info'; title: string; message: string; stars: number }> = [];
    
    // Calculate total purchased and total sold
    const totalComprado = tallasData.reduce((sum, t) => sum + (t.comprado || 0), 0);
    const totalVendido = tallasData.reduce((sum, t) => sum + (t.ventas || 0), 0);
    const totalStock = tallasData.reduce((sum, t) => sum + (t.stock || 0), 0);
    
    // Rotación rate
    const rotacionRate = totalComprado > 0 ? (totalVendido / totalComprado) * 100 : 0;
    
    // Stock vs Sales ratio
    const stockVentaRatio = totalVendido > 0 ? totalStock / totalVendido : 0;
    
    // Pattern 1: Alta rotación (vendió más del 80% de lo comprado)
    if (rotacionRate >= 80 && totalComprado > 0) {
        insights.push({
            type: 'success',
            title: 'Alta Rotación',
            message: `Excelente rotación: vendiste el ${rotacionRate.toFixed(0)}% de lo comprado. Considera aumentar el stock para esta referencia.`,
            stars: 5
        });
    }
    
    // Pattern 2: Baja rotación (vendió menos del 30% de lo comprado)
    if (rotacionRate < 30 && totalComprado > 0) {
        insights.push({
            type: 'error',
            title: 'Baja Rotación',
            message: `Rotación baja: solo vendiste el ${rotacionRate.toFixed(0)}% de lo comprado. Revisa el precio, promoción o considera liquidación.`,
            stars: 1
        });
    }
    
    // Pattern 3: Alto stock + baja rotación (problema crítico)
    if (totalStock > totalComprado * 0.5 && rotacionRate < 40) {
        insights.push({
            type: 'error',
            title: 'Alto Stock con Baja Rotación',
            message: `Tienes ${totalStock} unidades en stock pero solo rotaste ${rotacionRate.toFixed(0)}%. Riesgo de obsolescencia. Acción urgente requerida.`,
            stars: 1
        });
    }
    
    // Pattern 4: Bajo stock + alta rotación (oportunidad)
    if (totalStock < totalComprado * 0.2 && rotacionRate >= 70) {
        insights.push({
            type: 'warning',
            title: 'Bajo Stock con Alta Rotación',
            message: `Solo quedan ${totalStock} unidades pero rotaste ${rotacionRate.toFixed(0)}%. Oportunidad de recompra inmediata para no perder ventas.`,
            stars: 4
        });
    }
    
    // Pattern 5: Stock desbalanceado por tallas
    if (tallasData.length > 1) {
        const tallasConStock = tallasData.filter(t => (t.stock || 0) > 0);
        const tallasConVentas = tallasData.filter(t => (t.ventas || 0) > 0);
        const tallasConCompra = tallasData.filter(t => (t.comprado || 0) > 0);
        
        // Si hay tallas compradas pero sin ventas
        const tallasSinVentas = tallasData.filter(t => (t.comprado || 0) > 0 && (t.ventas || 0) === 0);
        if (tallasSinVentas.length > 0) {
            insights.push({
                type: 'warning',
                title: 'Tallas Sin Ventas',
                message: `${tallasSinVentas.length} talla(s) comprada(s) pero sin ventas: ${tallasSinVentas.map(t => t.talla).join(', ')}. Revisa el mix de tallas.`,
                stars: 2
            });
        }
        
        // Si hay tallas con mucho stock pero sin ventas
        const tallasConStockSinVentas = tallasData.filter(t => (t.stock || 0) > 10 && (t.ventas || 0) === 0);
        if (tallasConStockSinVentas.length > 0) {
            insights.push({
                type: 'error',
                title: 'Tallas con Exceso de Stock',
                message: `${tallasConStockSinVentas.length} talla(s) con stock alto pero sin ventas. Considera promoción o liquidación.`,
                stars: 1
            });
        }
    }
    
    // Pattern 6: Rotación saludable
    if (rotacionRate >= 40 && rotacionRate < 80 && totalStock > 0 && totalStock < totalComprado) {
        insights.push({
            type: 'success',
            title: 'Rotación Saludable',
            message: `Rotación del ${rotacionRate.toFixed(0)}% con stock controlado. Mantén este nivel de reposición.`,
            stars: 4
        });
    }
    
    // Pattern 7: Sin stock pero con ventas recientes
    if (totalStock === 0 && unidadesVendidas > 0) {
        insights.push({
            type: 'warning',
            title: 'Stock Agotado',
            message: `Stock agotado pero hubo ${unidadesVendidas} ventas recientes. Recompra urgente para no perder oportunidades.`,
            stars: 5
        });
    }
    
    // Sort by priority (error > warning > info > success) and stars
    insights.sort((a, b) => {
        const priority = { error: 4, warning: 3, info: 2, success: 1 };
        if (priority[a.type] !== priority[b.type]) {
            return priority[b.type] - priority[a.type];
        }
        return b.stars - a.stars;
    });
    
    return insights.slice(0, 5); // Return top 5 insights
}

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const { id: articulo } = params;

    // Get date filters from query params
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build date filter clause for queries
    const dateFilter = startDate && endDate
        ? `AND T.Fecha >= '${startDate}' AND T.Fecha <= '${endDate}'`
        : '';

    try {
        // Get basic product info from transacciones
        const baseInfoQuery = `
            SELECT
                T.BaseCol,
                T.IdMarca,
                T.DescripcionMarca,
                MAX(T.idClase) as idClase,
                MAX(T.DescripcionClase) as DescripcionClase,
                T.IdGenero,
                T.DescripcionGenero,
                AR.descripcionCorta,
                SUM(T.Cantidad) as unidades,
                CAST(SUM(T.PRECIO) as decimal(18,2)) as Venta,
                COALESCE(MAX(AP.Precio), MAX(T.PRECIO / NULLIF(T.Cantidad, 0))) as precioUnitarioLista,
                MIN(T.Fecha) as primeraVenta
            FROM Transacciones T
            INNER JOIN (
                SELECT AR.base as BaseCol, AR.descripcionCorta
                FROM Articulos AR
                GROUP BY AR.base, AR.descripcionCorta
            ) AR ON AR.BaseCol = T.BaseCol
            LEFT JOIN (
                -- ArticuloPrecio pre-agregado por baseCol
                SELECT
                    baseCol as BaseCol,
                    MAX(Precio) as Precio
                FROM ArticuloPrecio
                GROUP BY baseCol
            ) AP ON AP.BaseCol = T.BaseCol
            WHERE T.BaseCol = @articulo
            GROUP BY T.IdGenero, T.DescripcionGenero, T.BaseCol, AR.descripcionCorta, T.IdMarca, T.DescripcionMarca
            HAVING SUM(T.Cantidad) > 0
        `;

        const baseResult = await executeQuery(baseInfoQuery.replace(/@articulo/g, `'${articulo}'`));

        if (baseResult.recordset.length === 0) {
            console.error(`Product not found: ${articulo}`);
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }

        const product = baseResult.recordset[0];
        console.log(`Product found: ${articulo}`, {
            marca: product.DescripcionMarca,
            unidades: product.unidades,
            venta: product.Venta
        });

        // Get last purchase info from UltimaCompra
        // Get the most recent date and sum all quantities for that date
        // Use MAX(UltimoCosto) instead of AVG to get the actual cost (should be the same for all items in same purchase)
        const ultimaCompraQuery = `
            SELECT TOP 1
                FechaUltimaCompra as fecha,
                SUM(CantidadUltimaCompra) as cantidadTotal,
                MAX(UltimoCosto) as costoPromedio
            FROM UltimaCompra
            WHERE BaseArticulo LIKE @articulo + '%'
            AND UltimoCosto IS NOT NULL
            AND UltimoCosto > 0
            GROUP BY FechaUltimaCompra
            ORDER BY FechaUltimaCompra DESC
        `;

        const ultimaCompraResult = await executeQuery(ultimaCompraQuery.replace(/@articulo/g, `'${articulo}'`));
        const ultimaCompra = ultimaCompraResult.recordset[0] || null;
        
        // Also get the total quantity across all dates for reference
        const totalCompradoQuery = `
            SELECT 
                SUM(CantidadUltimaCompra) as cantidadTotal
            FROM UltimaCompra
            WHERE BaseArticulo LIKE @articulo + '%'
        `;
        
        let totalCompradoResult;
        try {
            totalCompradoResult = await executeQuery(totalCompradoQuery.replace(/@articulo/g, `'${articulo}'`));
        } catch (err) {
            console.error('Error getting total purchased:', err);
            totalCompradoResult = { recordset: [{ cantidadTotal: 0 }] };
        }
        
        const totalComprado = Number(totalCompradoResult.recordset[0]?.cantidadTotal) || 0;
        
        console.log(`Last purchase for ${articulo}:`, {
            found: !!ultimaCompra,
            fecha: ultimaCompra?.fecha,
            cantidad: ultimaCompra?.cantidadTotal,
            costo: ultimaCompra?.costoPromedio,
            totalComprado: totalComprado
        });

        // Get stock by store from MovStockTotalResumen (grouped by BaseCol and IdDeposito)
        // Use LIKE to match BaseCol (first part before talla)
        const stockByStoreQuery = `
            SELECT 
                M.idDeposito as id,
                MAX(TI.Descripcion) as descripcion,
                SUM(M.TotalStock) as ttlstock
            FROM MovStockTotalResumen M
            INNER JOIN Tiendas TI ON TI.IdTienda = M.idDeposito
            WHERE M.IdArticulo LIKE @articulo + '%'
            GROUP BY M.idDeposito
        `;

        let stockByStoreResult;
        try {
            stockByStoreResult = await executeQuery(stockByStoreQuery.replace(/@articulo/g, `'${articulo}'`));
            console.log(`Stock by store found: ${stockByStoreResult.recordset.length} stores`);
        } catch (err) {
            console.error('Error getting stock by store:', err);
            stockByStoreResult = { recordset: [] };
        }

        // Get sales by store from transacciones (grouped by BaseCol and IdDeposito)
        // Apply date filter if provided
        const salesByStoreQuery = `
            SELECT
                T.IdDeposito as id,
                MAX(TI.Descripcion) as descripcion,
                SUM(T.Cantidad) as ttlunidadesVenta,
                CAST(SUM(T.PRECIO) as decimal(18,2)) as ttlimporteVenta
            FROM Transacciones T
            INNER JOIN Tiendas TI ON TI.IdTienda = T.IdDeposito
            WHERE T.BaseCol = @articulo
            ${dateFilter}
            GROUP BY T.IdDeposito
        `;

        let salesByStoreResult;
        try {
            salesByStoreResult = await executeQuery(salesByStoreQuery.replace(/@articulo/g, `'${articulo}'`));
            console.log(`Sales by store found: ${salesByStoreResult.recordset.length} stores`);
        } catch (err) {
            console.error('Error getting sales by store:', err);
            salesByStoreResult = { recordset: [] };
        }

        // Combine stock and sales by store
        const storesMap = new Map();
        
        // Add stock data
        stockByStoreResult.recordset.forEach((row: any) => {
            storesMap.set(row.id, {
                id: row.id,
                descripcion: row.descripcion,
                ttlstock: Number(row.ttlstock) || 0,
                ttlunidadesVenta: 0,
                ttlimporteVenta: 0
            });
        });

        // Add/update sales data
        salesByStoreResult.recordset.forEach((row: any) => {
            const existing = storesMap.get(row.id);
            if (existing) {
                existing.ttlunidadesVenta = Number(row.ttlunidadesVenta) || 0;
                existing.ttlimporteVenta = Number(row.ttlimporteVenta) || 0;
            } else {
                storesMap.set(row.id, {
                    id: row.id,
                    descripcion: row.descripcion,
                    ttlstock: 0,
                    ttlunidadesVenta: Number(row.ttlunidadesVenta) || 0,
                    ttlimporteVenta: Number(row.ttlimporteVenta) || 0
                });
            }
        });

        const sucursales = Array.from(storesMap.values());

        // Calculate units sold since last purchase and total sales amount
        // Get total units sold from all transactions (this is what was sold since last purchase)
        let unidadesVendidasDesdeUltCompra = 0;
        let importeVentaDesdeUltCompra = 0;
        
        if (ultimaCompra && ultimaCompra.fecha) {
            // Format date properly for SQL Server
            const fechaUltCompra = new Date(ultimaCompra.fecha);
            const fechaFormateada = fechaUltCompra.toISOString().split('T')[0]; // YYYY-MM-DD
            
            const ventasDesdeUltCompraQuery = `
                SELECT 
                    SUM(Cantidad) as unidades,
                    CAST(SUM(PRECIO) as decimal(18,2)) as importe
                FROM Transacciones
                WHERE BaseCol = @articulo
                AND Fecha >= '${fechaFormateada}'
            `;
            try {
                const ventasResult = await executeQuery(ventasDesdeUltCompraQuery.replace(/@articulo/g, `'${articulo}'`));
                unidadesVendidasDesdeUltCompra = Number(ventasResult.recordset[0]?.unidades) || 0;
                importeVentaDesdeUltCompra = Number(ventasResult.recordset[0]?.importe) || 0;
                
                console.log(`Sales since last purchase for ${articulo}:`, {
                    fechaUltCompra: fechaFormateada,
                    unidades: unidadesVendidasDesdeUltCompra,
                    importe: importeVentaDesdeUltCompra,
                    query: ventasDesdeUltCompraQuery.replace(/@articulo/g, `'${articulo}'`)
                });
            } catch (err) {
                console.error('Error getting sales since last purchase:', err);
            }
        } else {
            // If no last purchase date, get all sales
            console.log(`No last purchase date found for ${articulo}, getting all sales`);
            const todasLasVentasQuery = `
                SELECT 
                    SUM(Cantidad) as unidades,
                    CAST(SUM(PRECIO) as decimal(18,2)) as importe
                FROM Transacciones
                WHERE BaseCol = @articulo
            `;
            try {
                const ventasResult = await executeQuery(todasLasVentasQuery.replace(/@articulo/g, `'${articulo}'`));
                unidadesVendidasDesdeUltCompra = Number(ventasResult.recordset[0]?.unidades) || 0;
                importeVentaDesdeUltCompra = Number(ventasResult.recordset[0]?.importe) || 0;
                
                console.log(`All sales for ${articulo}:`, {
                    unidades: unidadesVendidasDesdeUltCompra,
                    importe: importeVentaDesdeUltCompra
                });
            } catch (err) {
                console.error('Error getting all sales:', err);
            }
        }
        
        // Also check if there are any transactions at all for this product
        const checkTransaccionesQuery = `
            SELECT TOP 5
                Fecha,
                Cantidad,
                PRECIO,
                BaseCol
            FROM Transacciones
            WHERE BaseCol = @articulo
            ORDER BY Fecha DESC
        `;
        try {
            const checkResult = await executeQuery(checkTransaccionesQuery.replace(/@articulo/g, `'${articulo}'`));
            console.log(`Sample transactions for ${articulo}:`, checkResult.recordset.length, 'found');
            if (checkResult.recordset.length > 0) {
                console.log('First transaction:', checkResult.recordset[0]);
            }
        } catch (err) {
            console.error('Error checking transactions:', err);
        }

        // Get sales for the selected period (if date filters are provided)
        let ventasPeriodo = {
            unidades: 0,
            importe: 0,
            fechaInicio: startDate,
            fechaFin: endDate
        };

        if (startDate && endDate) {
            const ventasPeriodoQuery = `
                SELECT
                    COALESCE(SUM(T.Cantidad), 0) as unidades,
                    COALESCE(CAST(SUM(T.PRECIO) as decimal(18,2)), 0) as importe,
                    MIN(T.Fecha) as primeraVenta,
                    MAX(T.Fecha) as ultimaVenta
                FROM Transacciones T
                WHERE T.BaseCol = @articulo
                AND T.Fecha >= '${startDate}'
                AND T.Fecha <= '${endDate}'
            `;
            try {
                const ventasPeriodoResult = await executeQuery(ventasPeriodoQuery.replace(/@articulo/g, `'${articulo}'`));
                ventasPeriodo.unidades = Number(ventasPeriodoResult.recordset[0]?.unidades) || 0;
                ventasPeriodo.importe = Number(ventasPeriodoResult.recordset[0]?.importe) || 0;
                console.log(`Period sales for ${articulo} (${startDate} - ${endDate}):`, ventasPeriodo);
            } catch (err) {
                console.error('Error getting period sales:', err);
            }
        } else {
            // If no date filter, use all-time sales
            ventasPeriodo.unidades = unidadesVendidasDesdeUltCompra;
            ventasPeriodo.importe = importeVentaDesdeUltCompra;
        }

        // Calculate cost of last purchase: cantidadTotal * costoPromedio
        const costoUltimaCompra = ultimaCompra && ultimaCompra.cantidadTotal && ultimaCompra.costoPromedio
            ? Number(ultimaCompra.cantidadTotal) * Number(ultimaCompra.costoPromedio)
            : 0;

        // Stock inicial = cantidad total de última compra (suma de todas las tallas en esa fecha)
        // Stock actual = stock actual en MovStockTotalResumen
        // Unidades vendidas = unidades vendidas desde última compra
        const stockActual = sucursales.reduce((sum, s) => sum + s.ttlstock, 0);
        const stockInicial = ultimaCompra && ultimaCompra.cantidadTotal 
            ? Number(ultimaCompra.cantidadTotal) 
            : stockActual + unidadesVendidasDesdeUltCompra;

        // Get monthly data (last 6 months) with stock
        // Stock is current stock from MovStockTotalResumen (snapshot)
        // For historical stock, we'll use the current stock as reference
        const monthlyQuery = `
            SELECT 
                FORMAT(T.Fecha, 'yyyy-MM') as mes,
                DATEPART(YEAR, T.Fecha) as year,
                DATEPART(MONTH, T.Fecha) as month,
                MAX(T.PRECIO / NULLIF(T.Cantidad, 0)) as precioVenta,
                SUM(T.Cantidad) as unidades
            FROM Transacciones T
            WHERE T.BaseCol = @articulo
            AND T.Fecha >= DATEADD(MONTH, -6, GETDATE())
            GROUP BY FORMAT(T.Fecha, 'yyyy-MM'), DATEPART(YEAR, T.Fecha), DATEPART(MONTH, T.Fecha)
            ORDER BY year DESC, month DESC
        `;

        const monthlyResult = await executeQuery(monthlyQuery.replace(/@articulo/g, `'${articulo}'`));

        // Get current stock for all variants (to show in monthly table)
        const currentStockQuery = `
            SELECT SUM(TotalStock) as stock
            FROM MovStockTotalResumen
            WHERE IdArticulo LIKE @articulo + '%'
        `;

        let currentStockResult;
        try {
            currentStockResult = await executeQuery(currentStockQuery.replace(/@articulo/g, `'${articulo}'`));
        } catch (err) {
            console.error('Error getting current stock:', err);
            currentStockResult = { recordset: [{ stock: 0 }] };
        }

        const currentStock = Number(currentStockResult.recordset[0]?.stock) || 0;

        // Get purchased quantities by size (talla) from UltimaCompra
        // Get the most recent date first, then sum all quantities for each talla on that date
        const fechaUltimaCompra = ultimaCompra?.fecha;
        
        // Format date properly for SQL Server
        let fechaFormateada = null;
        if (fechaUltimaCompra) {
            const fecha = new Date(fechaUltimaCompra);
            fechaFormateada = fecha.toISOString().split('T')[0]; // YYYY-MM-DD
        }
        
        const comprasByTallaQuery = fechaFormateada ? `
            SELECT 
                BaseArticulo,
                SUM(CantidadUltimaCompra) as cantidadComprada,
                AVG(UltimoCosto) as costo
            FROM UltimaCompra
            WHERE BaseArticulo LIKE @articulo + '%'
            AND FechaUltimaCompra = '${fechaFormateada}'
            GROUP BY BaseArticulo
        ` : `
            SELECT 
                BaseArticulo,
                SUM(CantidadUltimaCompra) as cantidadComprada,
                AVG(UltimoCosto) as costo
            FROM UltimaCompra
            WHERE BaseArticulo LIKE @articulo + '%'
            GROUP BY BaseArticulo
        `;

        let comprasByTallaResult;
        try {
            const queryStr = comprasByTallaQuery.replace(/@articulo/g, `'${articulo}'`);
            comprasByTallaResult = await executeQuery(queryStr);
            console.log(`Purchases by talla for ${articulo}:`, {
                fechaFormateada,
                rows: comprasByTallaResult.recordset.length,
                data: comprasByTallaResult.recordset
            });
        } catch (err) {
            console.error('Error getting purchases by talla:', err);
            comprasByTallaResult = { recordset: [] };
        }

        // Get stock by size (talla) from MovStockTotalResumen (for reference)
        const stockByTallaQuery = `
            SELECT 
                M.IdArticulo,
                SUM(M.TotalStock) as stock
            FROM MovStockTotalResumen M
            WHERE M.IdArticulo LIKE @articulo + '%'
            GROUP BY M.IdArticulo
        `;

        let stockByTallaResult;
        try {
            stockByTallaResult = await executeQuery(stockByTallaQuery.replace(/@articulo/g, `'${articulo}'`));
        } catch (err) {
            console.error('Error getting stock by talla:', err);
            stockByTallaResult = { recordset: [] };
        }

        // Get sales by size (talla) from transacciones
        // Apply date filter if provided
        const salesByTallaQuery = `
            SELECT
                T.idArticulo,
                SUM(T.Cantidad) as unidades,
                CAST(SUM(T.PRECIO) as decimal(18,2)) as importe
            FROM Transacciones T
            WHERE T.BaseCol = @articulo
            ${dateFilter}
            GROUP BY T.idArticulo
        `;

        let salesByTallaResult;
        try {
            salesByTallaResult = await executeQuery(salesByTallaQuery.replace(/@articulo/g, `'${articulo}'`));
        } catch (err) {
            console.error('Error getting sales by talla:', err);
            salesByTallaResult = { recordset: [] };
        }

        // Process tallas: extract size and combine purchased quantities + sales + stock
        const tallasMap = new Map<string, { comprado: number; stock: number; ventas: number; importe: number }>();

        // Add purchased quantities (from UltimaCompra) - this is the primary data
        comprasByTallaResult.recordset.forEach((row: any) => {
            if (row.BaseArticulo) {
                const talla = extractTalla(row.BaseArticulo, articulo);
                if (talla) {
                    const existing = tallasMap.get(talla) || { comprado: 0, stock: 0, ventas: 0, importe: 0 };
                    existing.comprado += Number(row.cantidadComprada) || 0; // Sum in case there are multiple entries
                    tallasMap.set(talla, existing);
                    console.log(`Talla ${talla}: comprado = ${existing.comprado} (added ${row.cantidadComprada})`);
                } else {
                    console.log(`Could not extract talla from: ${row.BaseArticulo} (BaseCol: ${articulo})`);
                }
            }
        });
        
        console.log(`Total tallas with purchases: ${tallasMap.size}`);

        // Add stock data (for reference)
        stockByTallaResult.recordset.forEach((row: any) => {
            if (row.IdArticulo) {
                const talla = extractTalla(row.IdArticulo, articulo);
                if (talla) {
                    const existing = tallasMap.get(talla) || { comprado: 0, stock: 0, ventas: 0, importe: 0 };
                    existing.stock = Number(row.stock) || 0;
                    tallasMap.set(talla, existing);
                }
            }
        });

        // Add/update sales data
        salesByTallaResult.recordset.forEach((row: any) => {
            if (row.idArticulo) {
                const talla = extractTalla(row.idArticulo, articulo);
                if (talla) {
                    const existing = tallasMap.get(talla) || { comprado: 0, stock: 0, ventas: 0, importe: 0 };
                    existing.ventas = Number(row.unidades) || 0;
                    existing.importe = Number(row.importe) || 0;
                    tallasMap.set(talla, existing);
                } else {
                    // If no talla extracted, it might be the base article itself
                    console.log(`Could not extract talla from: ${row.idArticulo} (BaseCol: ${articulo})`);
                }
            }
        });

        // Convert to array and sort tallas
        const tallasArray = Array.from(tallasMap.entries()).map(([talla, data]) => ({
            talla,
            comprado: data.comprado,
            stock: data.stock,
            ventas: data.ventas,
            importe: data.importe
        }));

        // Sort tallas in logical order
        const sortedTallas = sortTallas(tallasArray.map(t => t.talla));
        const tallasData = sortedTallas.map(talla => {
            const found = tallasArray.find(t => t.talla === talla);
            return found || { talla, comprado: 0, stock: 0, ventas: 0, importe: 0 };
        });

        // Calculate insights based on patterns
        const insights = calculateInsights(tallasData, stockActual, unidadesVendidasDesdeUltCompra, stockInicial);

        // Get stock by store and size (talla) for matrix
        const stockByStoreAndTallaQuery = `
            SELECT 
                M.IdArticulo,
                M.idDeposito as idDeposito,
                MAX(TI.Descripcion) as descripcion,
                SUM(M.TotalStock) as stock
            FROM MovStockTotalResumen M
            INNER JOIN Tiendas TI ON TI.IdTienda = M.idDeposito
            WHERE M.IdArticulo LIKE @articulo + '%'
            GROUP BY M.IdArticulo, M.idDeposito
        `;

        let stockByStoreAndTallaResult;
        try {
            stockByStoreAndTallaResult = await executeQuery(stockByStoreAndTallaQuery.replace(/@articulo/g, `'${articulo}'`));
        } catch (err) {
            console.error('Error getting stock by store and talla:', err);
            stockByStoreAndTallaResult = { recordset: [] };
        }

        // Get sales by store and size (talla) for matrix
        // Apply date filter if provided
        const salesByStoreAndTallaQuery = `
            SELECT
                T.idArticulo,
                T.IdDeposito as idDeposito,
                MAX(TI.Descripcion) as descripcion,
                SUM(T.Cantidad) as ventas,
                CAST(SUM(T.PRECIO) as decimal(18,2)) as importe
            FROM Transacciones T
            INNER JOIN Tiendas TI ON TI.IdTienda = T.IdDeposito
            WHERE T.BaseCol = @articulo
            ${dateFilter}
            GROUP BY T.idArticulo, T.IdDeposito
        `;

        let salesByStoreAndTallaResult;
        try {
            salesByStoreAndTallaResult = await executeQuery(salesByStoreAndTallaQuery.replace(/@articulo/g, `'${articulo}'`));
        } catch (err) {
            console.error('Error getting sales by store and talla:', err);
            salesByStoreAndTallaResult = { recordset: [] };
        }

        // Build matrix: rows = tallas, columns = stores
        // Get all unique stores and sort them (Stadium 01, 02, etc.)
        const allStores = new Set<number>();
        stockByStoreAndTallaResult.recordset.forEach((row: any) => allStores.add(row.idDeposito));
        salesByStoreAndTallaResult.recordset.forEach((row: any) => allStores.add(row.idDeposito));
        
        // Get store descriptions for sorting
        const storesInfo = new Map<number, string>();
        Array.from(allStores).forEach(id => {
            const stockRow = stockByStoreAndTallaResult.recordset.find((r: any) => r.idDeposito === id);
            const salesRow = salesByStoreAndTallaResult.recordset.find((r: any) => r.idDeposito === id);
            const desc = stockRow?.descripcion || salesRow?.descripcion || '';
            storesInfo.set(id, desc);
        });

        // Sort stores: extract number from "Stadium 01", "Stadium 02", etc.
        const sortedStoreIds = Array.from(allStores).sort((a, b) => {
            const descA = storesInfo.get(a) || '';
            const descB = storesInfo.get(b) || '';
            // Extract number from "Stadium 01" -> 1, "Stadium 02" -> 2, etc.
            const numA = parseInt(descA.match(/\d+/)?.[0] || '999') || 999;
            const numB = parseInt(descB.match(/\d+/)?.[0] || '999') || 999;
            return numA - numB;
        });

        // Build matrix data: tallas x stores
        const matrixData = sortedTallas.map(talla => {
            const row: any = { talla };
            
            // Add stock and sales for each store
            sortedStoreIds.forEach(storeId => {
                const storeDesc = storesInfo.get(storeId) || '';
                
                // Find stock for this talla and store
                const stockRow = stockByStoreAndTallaResult.recordset.find((r: any) => {
                    const rowTalla = extractTalla(r.IdArticulo, articulo);
                    return rowTalla === talla && r.idDeposito === storeId;
                });
                
                // Find sales for this talla and store
                const salesRow = salesByStoreAndTallaResult.recordset.find((r: any) => {
                    const rowTalla = extractTalla(r.idArticulo, articulo);
                    return rowTalla === talla && r.idDeposito === storeId;
                });
                
                row[`store_${storeId}`] = {
                    id: storeId,
                    descripcion: storeDesc,
                    stock: Number(stockRow?.stock) || 0,
                    ventas: Number(salesRow?.ventas) || 0
                };
            });
            
            return row;
        });

        // Calculate totals row
        const totalsRow: any = { talla: 'TOTAL' };
        sortedStoreIds.forEach(storeId => {
            const storeDesc = storesInfo.get(storeId) || '';
            let totalStock = 0;
            let totalVentas = 0;
            
            matrixData.forEach(row => {
                const cell = row[`store_${storeId}`];
                if (cell) {
                    totalStock += cell.stock || 0;
                    totalVentas += cell.ventas || 0;
                }
            });
            
            totalsRow[`store_${storeId}`] = {
                id: storeId,
                descripcion: storeDesc,
                stock: totalStock,
                ventas: totalVentas
            };
        });

        // Format dates
        const formatDate = (dateStr: string | null) => {
            if (!dateStr) return null;
            try {
                const date = new Date(dateStr);
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = date.getFullYear();
                return `${day}/${month}/${year}`;
            } catch {
                return dateStr;
            }
        };

        // Format monthly data
        const monthlyData = monthlyResult.recordset.map((row: any) => {
            const date = new Date(row.year, row.month - 1);
            const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                              'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            return {
                mes: monthNames[date.getMonth()],
                precioVenta: Number(row.precioVenta || 0),
                unidades: Number(row.unidades || 0),
                stock: currentStock, // Current stock (snapshot - MovStockTotalResumen doesn't have historical data)
                participacion: 0
            };
        });

        // Calculate participation percentage
        const totalUnidades = monthlyData.reduce((sum: number, m: any) => sum + m.unidades, 0);
        monthlyData.forEach((m: any) => {
            m.participacion = totalUnidades > 0 ? (m.unidades / totalUnidades) * 100 : 0;
        });

        // Calcular métricas adicionales
        // PVP = precio de lista desde ArticuloPrecio (igual que en /api/products/analysis)
        const pvp = Number(product.precioUnitarioLista) || 0;
        const precioVenta = pvp; // Mantener para compatibilidad
        const ultimoCostoValue = ultimaCompra ? Number(ultimaCompra.costoPromedio) * 1.22 : 0; // Con IVA
        
        // ASP (Precio Promedio de Venta) = Importe Total / Unidades Vendidas
        const asp = unidadesVendidasDesdeUltCompra > 0 
            ? importeVentaDesdeUltCompra / unidadesVendidasDesdeUltCompra 
            : null;
        
        // Margen = (Precio - Costo) / Precio * 100
        const margen = asp && ultimoCostoValue > 0 
            ? ((asp - ultimoCostoValue) / asp) * 100 
            : null;
        
        // Markup = (Precio - Costo) / Costo * 100
        const markup = asp && ultimoCostoValue > 0 
            ? ((asp - ultimoCostoValue) / ultimoCostoValue) * 100 
            : null;
        
        // Días de Stock = Stock Actual / Ritmo de Venta Diario
        // Ritmo de venta diario basado en días desde última compra o período seleccionado
        let diasStock = null;
        let ritmoDiario = null;

        // Si hay filtro de período, calcular ritmo basado en el período
        if (startDate && endDate && ventasPeriodo.unidades > 0) {
            const fechaInicio = new Date(startDate);
            const fechaFin = new Date(endDate);
            const diasPeriodo = Math.max(1, Math.ceil((fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24)) + 1);
            ritmoDiario = ventasPeriodo.unidades / diasPeriodo;
            diasStock = ritmoDiario > 0 && stockActual > 0 ? Math.round(stockActual / ritmoDiario) : null;
        } else if (ultimaCompra?.fecha && stockActual > 0) {
            // Sin filtro de período, usar última compra
            const fechaUltCompra = new Date(ultimaCompra.fecha);
            const hoy = new Date();
            const diasTranscurridos = Math.max(1, Math.ceil((hoy.getTime() - fechaUltCompra.getTime()) / (1000 * 60 * 60 * 24)));
            ritmoDiario = unidadesVendidasDesdeUltCompra / diasTranscurridos;
            diasStock = ritmoDiario > 0 ? Math.round(stockActual / ritmoDiario) : null;
        }

        // Calcular utilidad de venta para el período
        // Utilidad = Importe Venta - (Unidades Vendidas * Costo Unitario)
        const costoVentaPeriodo = ventasPeriodo.unidades * ultimoCostoValue;
        const utilidadPeriodo = ventasPeriodo.importe - costoVentaPeriodo;

        // ASP y margen para el período
        const aspPeriodo = ventasPeriodo.unidades > 0
            ? ventasPeriodo.importe / ventasPeriodo.unidades
            : null;

        const margenPeriodo = aspPeriodo && ultimoCostoValue > 0
            ? ((aspPeriodo - ultimoCostoValue) / aspPeriodo) * 100
            : null;

        const response = NextResponse.json({
            ...product,
            sucursales: sucursales,
            monthlyData: monthlyData,
            tallasData: tallasData, // Purchased, stock and sales by size
            insights: insights, // AI-generated insights
            matrixData: matrixData, // Matrix: tallas x stores
            totalsRow: totalsRow, // Totals row for matrix
            sortedStoreIds: sortedStoreIds, // Store IDs in order
            storesInfo: Array.from(storesInfo.entries()).reduce((acc, [id, desc]) => {
                acc[id] = desc;
                return acc;
            }, {} as Record<number, string>), // Store descriptions
            stockInicial: stockInicial,
            stock: stockActual,
            unidadesVendidasDesdeUltCompra: unidadesVendidasDesdeUltCompra,
            unidadesCompradas: totalComprado, // Total comprado histórico
            importeVentaDesdeUltCompra: importeVentaDesdeUltCompra,
            costoUltimaCompra: costoUltimaCompra,
            unidades: product.unidades || 0, // Total units sold (all time)
            ultimoCosto: ultimaCompra ? Number(ultimaCompra.costoPromedio) : 0,
            primeraVentaFormatted: formatDate(product.primeraVenta),
            fechaUltCompraFormatted: formatDate(ultimaCompra?.fecha || null),
            precioVenta: precioVenta,
            pvp: pvp, // PVP igual que en tabla de análisis
            // Nuevas métricas solicitadas
            asp: asp, // Precio Promedio de Venta
            margen: margen, // Margen %
            markup: markup, // Markup %
            diasStock: diasStock, // Días de Stock estimados
            ritmoDiario: ritmoDiario, // Pares por día
            // Datos del período seleccionado
            ventasPeriodo: {
                unidades: ventasPeriodo.unidades,
                importe: ventasPeriodo.importe,
                asp: aspPeriodo,
                margen: margenPeriodo,
                utilidad: utilidadPeriodo,
                costoVenta: costoVentaPeriodo,
                fechaInicio: startDate,
                fechaFin: endDate,
                tieneFiltroPeriodo: !!(startDate && endDate)
            }
        });

        // Add no-cache headers
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');

        return response;

    } catch (error) {
        console.error('API Error in Product Detail:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}
