import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { FilterParams } from '@/types';
import { buildDashboardQuery } from '@/lib/query-builder';

const CENTRAL_DEPOT_ID = 999;
const TOP_PRODUCTS_LIMIT = 150;
const HIGH_ROTATION_THRESHOLD = 0.05; // 5% of total product sales in a store = high rotation
const MIN_SALES_FOR_HIGH_ROTATION = 10; // Minimum units sold to consider high rotation

export async function POST(req: NextRequest) {
    try {
        const filters: FilterParams = await req.json();

        // Use filters date range or default to last 30 days
        const startDateStr = filters.startDate || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0];
        const endDateStr = filters.endDate || new Date().toISOString().split('T')[0];

        console.log(`Analyzing stock alerts from ${startDateStr} to ${endDateStr}`, {
            brands: filters.brands?.length || 0,
            stores: filters.stores?.length || 0
        });

        // Step 1: Get top products by sales (units) - BaseCol level
        // Build query for top products with filters
        // Build additional WHERE conditions for filters (excluding Fecha which is already in WHERE)
        const additionalWhereClauses: string[] = [];
        
        if (filters.stores?.length) {
            additionalWhereClauses.push(`T.IdDeposito IN (${filters.stores.join(',')})`);
        }
        
        if (filters.brands?.length) {
            additionalWhereClauses.push(`T.IdMarca IN (${filters.brands.join(',')})`);
        }
        
        if (filters.categories?.length) {
            additionalWhereClauses.push(`T.IdClase IN (${filters.categories.join(',')})`);
        }
        
        if (filters.genders?.length) {
            additionalWhereClauses.push(`T.idGenero IN (${filters.genders.join(',')})`);
        }
        
        if (filters.suppliers?.length) {
            const formattedSuppliers = filters.suppliers.map(s => typeof s === 'string' ? `'${s}'` : s);
            additionalWhereClauses.push(`T.idProveedor IN (${formattedSuppliers.join(',')})`);
        }
        
        const additionalWhere = additionalWhereClauses.length > 0 
            ? ` AND ${additionalWhereClauses.join(' AND ')}` 
            : '';
        
        const topProductsQuery = `
            SELECT TOP ${TOP_PRODUCTS_LIMIT}
                T.BaseCol,
                MAX(AR.descripcionCorta) as descripcion,
                SUM(T.Cantidad) as totalUnidadesVendidas,
                CAST(SUM(T.PRECIO) as decimal(18,2)) as totalImporteVenta
            FROM Transacciones T
            INNER JOIN (
                SELECT AR.base as BaseCol, AR.descripcionCorta 
                FROM Articulos AR 
                GROUP BY AR.base, AR.descripcionCorta
            ) AR ON AR.BaseCol = T.BaseCol
            WHERE T.Fecha >= '${startDateStr}' AND T.Fecha <= '${endDateStr}'
            ${additionalWhere}
            GROUP BY T.BaseCol
            HAVING SUM(T.Cantidad) > 0
            ORDER BY SUM(T.Cantidad) DESC
        `;
        
        console.log('Top products query:', topProductsQuery.substring(0, 300) + '...');

        let topProductsResult;
        try {
            topProductsResult = await executeQuery(topProductsQuery);
        } catch (err) {
            console.error('Error executing top products query:', err);
            console.error('Query was:', topProductsQuery);
            return NextResponse.json({ 
                alerts: [], 
                totalProductsAnalyzed: 0,
                error: 'Error executing query',
                debug: { 
                    message: 'Error executing top products query',
                    error: err instanceof Error ? err.message : String(err)
                } 
            });
        }
        
        const topProducts = topProductsResult.recordset || [];
        
        console.log(`Found ${topProducts.length} top products`);
        if (topProducts.length > 0) {
            console.log(`First 5 products:`, topProducts.slice(0, 5).map((p: any) => ({
                baseCol: p.BaseCol,
                descripcion: p.descripcion,
                unidades: p.totalUnidadesVendidas
            })));
        } else {
            console.warn('No products found! Query result:', {
                recordsetLength: topProductsResult?.recordset?.length,
                query: topProductsQuery.substring(0, 300)
            });
        }

        if (topProducts.length === 0) {
            return NextResponse.json({ 
                alerts: [], 
                totalProductsAnalyzed: 0,
                dateRange: {
                    start: startDateStr,
                    end: endDateStr
                },
                debug: { 
                    message: 'No top products found',
                    filters: filters,
                    query: topProductsQuery.substring(0, 500)
                } 
            });
        }

        const baseCols = topProducts.map((p: any) => `'${p.BaseCol}'`).join(',');
        
        // Step 2: Get stock by product and depot
        // Use LIKE pattern matching - we'll map BaseCol in code after
        // Build WHERE clause with OR conditions for each BaseCol
        const stockConditions = topProducts.map((p: any) => 
            `M.IdArticulo LIKE '${p.BaseCol.replace(/'/g, "''")}%'`
        ).join(' OR ');
        
        const stockByProductDepotQuery = `
            SELECT 
                M.IdArticulo,
                M.idDeposito,
                MAX(TI.Descripcion) as descripcionDeposito,
                SUM(M.TotalStock) as stock
            FROM MovStockTotalResumen M
            INNER JOIN Tiendas TI ON TI.IdTienda = M.idDeposito
            WHERE (${stockConditions})
            GROUP BY M.IdArticulo, M.idDeposito
        `;

        const stockResult = await executeQuery(stockByProductDepotQuery);
        const stockByProductDepot = new Map<string, Map<number, { descripcion: string; stock: number }>>();
        
        console.log(`Stock query returned ${stockResult.recordset.length} rows`);
        
        // Create a map of BaseCol patterns for quick lookup
        const baseColPatterns = new Map<string, string>();
        topProducts.forEach((p: any) => {
            baseColPatterns.set(p.BaseCol, p.BaseCol);
        });
        
        stockResult.recordset.forEach((row: any) => {
            const idArticulo = row.IdArticulo;
            const depositoId = row.idDeposito;
            
            // Find matching BaseCol by checking which pattern matches
            let matchedBaseCol: string = idArticulo.substring(0, 13); // Default fallback
            for (const [baseCol] of Array.from(baseColPatterns.entries())) {
                if (idArticulo.startsWith(baseCol)) {
                    matchedBaseCol = baseCol;
                    break;
                }
            }
            
            if (!stockByProductDepot.has(matchedBaseCol)) {
                stockByProductDepot.set(matchedBaseCol, new Map());
            }
            stockByProductDepot.get(matchedBaseCol)!.set(depositoId, {
                descripcion: row.descripcionDeposito,
                stock: Number(row.stock) || 0
            });
        });
        
        console.log(`Stock data processed for ${stockByProductDepot.size} products`);

        // Step 3: Get sales by product and depot to identify high rotation stores
        // Apply filters but keep BaseCol filter
        // Reuse the additionalWhereClauses from above
        const salesAdditionalWhere = additionalWhereClauses.length > 0 
            ? ` AND ${additionalWhereClauses.join(' AND ')}` 
            : '';
        
        const salesByProductDepotQuery = `
            SELECT 
                T.BaseCol,
                T.IdDeposito,
                MAX(TI.Descripcion) as descripcionDeposito,
                SUM(T.Cantidad) as unidadesVendidas,
                CAST(SUM(T.PRECIO) as decimal(18,2)) as importeVenta
            FROM Transacciones T
            INNER JOIN Tiendas TI ON TI.IdTienda = T.IdDeposito
            WHERE T.BaseCol IN (${baseCols})
            AND T.Fecha >= '${startDateStr}' AND T.Fecha <= '${endDateStr}'
            ${salesAdditionalWhere}
            GROUP BY T.BaseCol, T.IdDeposito
        `;

        const salesResult = await executeQuery(salesByProductDepotQuery);
        const salesByProductDepot = new Map<string, Map<number, { descripcion: string; unidades: number; importe: number }>>();
        const totalSalesByProduct = new Map<string, number>();
        
        console.log(`Sales query returned ${salesResult.recordset.length} rows`);
        
        salesResult.recordset.forEach((row: any) => {
            const baseCol = row.BaseCol;
            const depositoId = row.IdDeposito;
            const unidades = Number(row.unidadesVendidas) || 0;
            
            if (!salesByProductDepot.has(baseCol)) {
                salesByProductDepot.set(baseCol, new Map());
            }
            salesByProductDepot.get(baseCol)!.set(depositoId, {
                descripcion: row.descripcionDeposito,
                unidades: unidades,
                importe: Number(row.importeVenta) || 0
            });
            
            // Track total sales per product
            const currentTotal = totalSalesByProduct.get(baseCol) || 0;
            totalSalesByProduct.set(baseCol, currentTotal + unidades);
        });
        
        console.log(`Total products with sales data: ${salesByProductDepot.size}`);

        // Step 4: Analyze and generate alerts
        const alerts: any[] = [];

        topProducts.forEach((product: any) => {
            const baseCol = product.BaseCol;
            const stockMap = stockByProductDepot.get(baseCol) || new Map();
            const salesMap = salesByProductDepot.get(baseCol) || new Map();
            const totalProductSales = totalSalesByProduct.get(baseCol) || 0;

            // Get central stock
            const centralStock = stockMap.get(CENTRAL_DEPOT_ID)?.stock || 0;
            const centralDesc = stockMap.get(CENTRAL_DEPOT_ID)?.descripcion || 'Central';

            // Find stores with high rotation
            // Criteria: Either > threshold % of total sales OR > minimum units sold
            const highRotationStores: Array<{ id: number; descripcion: string; unidades: number; stock: number; percentage: number }> = [];
            
            salesMap.forEach((salesData, depositoId) => {
                if (depositoId === CENTRAL_DEPOT_ID) return; // Skip central
                
                const salesPercentage = totalProductSales > 0 
                    ? (salesData.unidades / totalProductSales) 
                    : 0;
                
                // Consider high rotation if:
                // 1. Sales percentage >= threshold (5%), OR
                // 2. Units sold >= minimum threshold (10 units)
                const isHighRotation = salesPercentage >= HIGH_ROTATION_THRESHOLD || 
                                      salesData.unidades >= MIN_SALES_FOR_HIGH_ROTATION;
                
                if (isHighRotation) {
                    const stockData = stockMap.get(depositoId);
                    const storeStock = stockData?.stock || 0;
                    
                    highRotationStores.push({
                        id: depositoId,
                        descripcion: salesData.descripcion,
                        unidades: salesData.unidades,
                        stock: storeStock,
                        percentage: salesPercentage
                    });
                }
            });

            // Detect problem: Central has stock but high rotation stores have 0 or low stock
            // Also consider stores with stock < 5% of central stock as problematic
            const storesWithZeroStock = highRotationStores.filter(s => s.stock === 0);
            const storesWithLowStock = highRotationStores.filter(s => 
                s.stock > 0 && s.stock < (centralStock * 0.05) && centralStock > 10
            );
            const problematicStores = [...storesWithZeroStock, ...storesWithLowStock];
            
            // Debug logging for first few products
            if (topProducts.indexOf(product) < 3) {
                console.log(`\nProduct ${baseCol}:`, {
                    centralStock,
                    totalProductSales,
                    highRotationStoresCount: highRotationStores.length,
                    storesWithZeroStock: storesWithZeroStock.length,
                    storesWithLowStock: storesWithLowStock.length
                });
            }
            
            if (centralStock > 0 && problematicStores.length > 0) {
                alerts.push({
                    baseCol: baseCol,
                    descripcion: product.descripcion,
                    totalUnidadesVendidas: Number(product.totalUnidadesVendidas) || 0,
                    totalImporteVenta: Number(product.totalImporteVenta) || 0,
                    centralStock: centralStock,
                    centralDescripcion: centralDesc,
                    problema: {
                        tipo: 'stock_central_sin_distribucion',
                        severidad: problematicStores.length > 3 ? 'alta' : problematicStores.length > 1 ? 'media' : 'baja',
                        tiendasAfectadas: problematicStores.length,
                        tiendas: problematicStores.map(s => ({
                            id: s.id,
                            descripcion: s.descripcion,
                            unidadesVendidas: s.unidades,
                            stock: s.stock,
                            porcentajeVentas: (s.percentage * 100).toFixed(1)
                        }))
                    }
                });
            }

            // NEW: Detect imbalance between stores (high sales in one store, low/zero in another)
            // No stock in central, but stock imbalance between stores
            if (centralStock === 0 && salesMap.size >= 2 && totalProductSales > 0) {
                // Find stores with high sales vs stores with low/zero sales
                const storesWithHighSales: Array<{ id: number; descripcion: string; unidades: number; stock: number; percentage: number }> = [];
                const storesWithLowSales: Array<{ id: number; descripcion: string; unidades: number; stock: number; percentage: number }> = [];
                
                salesMap.forEach((salesData, depositoId) => {
                    if (depositoId === CENTRAL_DEPOT_ID) return;
                    
                    const salesPercentage = salesData.unidades / totalProductSales;
                    const stockData = stockMap.get(depositoId);
                    const storeStock = stockData?.stock || 0;
                    
                    const storeInfo = {
                        id: depositoId,
                        descripcion: salesData.descripcion,
                        unidades: salesData.unidades,
                        stock: storeStock,
                        percentage: salesPercentage
                    };
                    
                    // High sales: > 15% of total product sales OR > 15 units (más flexible)
                    if (salesPercentage >= 0.15 || salesData.unidades >= 15) {
                        storesWithHighSales.push(storeInfo);
                    }
                    // Low sales: < 10% of total product sales AND < 10 units (más flexible)
                    else if (salesPercentage < 0.10 && salesData.unidades < 10) {
                        storesWithLowSales.push(storeInfo);
                    }
                });
                
                // Check for imbalance: high sales stores have low/zero stock, low sales stores have high stock
                // Más flexible: stock < 10 para alta venta, stock >= 5 para baja venta
                const highSalesStoresNeedingStock = storesWithHighSales.filter(s => s.stock < 10);
                const lowSalesStoresWithExcessStock = storesWithLowSales.filter(s => s.stock >= 5);
                
                // Debug logging for first few products
                if (topProducts.indexOf(product) < 3 && centralStock === 0) {
                    console.log(`\nProduct ${baseCol} - Checking imbalance:`, {
                        salesMapSize: salesMap.size,
                        totalProductSales,
                        storesWithHighSales: storesWithHighSales.length,
                        storesWithLowSales: storesWithLowSales.length,
                        highSalesNeedingStock: highSalesStoresNeedingStock.length,
                        lowSalesWithExcess: lowSalesStoresWithExcessStock.length
                    });
                }
                
                if (highSalesStoresNeedingStock.length > 0 && lowSalesStoresWithExcessStock.length > 0) {
                    // Calculate total excess stock that could be redistributed
                    const totalExcessStock = lowSalesStoresWithExcessStock.reduce((sum, s) => sum + s.stock, 0);
                    const totalNeededStock = highSalesStoresNeedingStock.reduce((sum, s) => {
                        // Estimate needed stock based on sales (e.g., 2x monthly sales)
                        const estimatedNeed = Math.max(10, s.unidades * 2);
                        return sum + Math.max(0, estimatedNeed - s.stock);
                    }, 0);
                    
                    alerts.push({
                        baseCol: baseCol,
                        descripcion: product.descripcion,
                        totalUnidadesVendidas: Number(product.totalUnidadesVendidas) || 0,
                        totalImporteVenta: Number(product.totalImporteVenta) || 0,
                        centralStock: 0,
                        centralDescripcion: 'Sin stock en central',
                        problema: {
                            tipo: 'stock_desbalanceado_entre_tiendas',
                            severidad: (highSalesStoresNeedingStock.length + lowSalesStoresWithExcessStock.length) > 4 ? 'alta' : 
                                      (highSalesStoresNeedingStock.length + lowSalesStoresWithExcessStock.length) > 2 ? 'media' : 'baja',
                            tiendasAfectadas: highSalesStoresNeedingStock.length + lowSalesStoresWithExcessStock.length,
                            tiendasNecesitanStock: highSalesStoresNeedingStock.map(s => ({
                                id: s.id,
                                descripcion: s.descripcion,
                                unidadesVendidas: s.unidades,
                                stock: s.stock,
                                porcentajeVentas: (s.percentage * 100).toFixed(1),
                                tipo: 'necesita_stock'
                            })),
                            tiendasConExceso: lowSalesStoresWithExcessStock.map(s => ({
                                id: s.id,
                                descripcion: s.descripcion,
                                unidadesVendidas: s.unidades,
                                stock: s.stock,
                                porcentajeVentas: (s.percentage * 100).toFixed(1),
                                tipo: 'exceso_stock'
                            })),
                            totalExcessStock,
                            totalNeededStock
                        }
                    });
                }
            }
        });

        // Sort alerts by severity and number of affected stores
        alerts.sort((a, b) => {
            const severityOrder: Record<string, number> = { alta: 3, media: 2, baja: 1 };
            const severityDiff = (severityOrder[b.problema.severidad] || 0) - (severityOrder[a.problema.severidad] || 0);
            if (severityDiff !== 0) return severityDiff;
            return b.problema.tiendasAfectadas - a.problema.tiendasAfectadas;
        });

        console.log(`Generated ${alerts.length} stock alerts`);

        // Calculate statistics for debugging
        let productsWithCentralStock = 0;
        let productsWithStoreSales = 0;
        let productsWithHighRotationStores = 0;
        
        topProducts.forEach((product: any) => {
            const baseCol = product.BaseCol;
            const stockMap = stockByProductDepot.get(baseCol);
            const salesMap = salesByProductDepot.get(baseCol);
            
            const centralStock = stockMap?.get(CENTRAL_DEPOT_ID);
            if (stockMap && centralStock && centralStock.stock > 0) {
                productsWithCentralStock++;
            }
            if (salesMap && salesMap.size > 0) {
                productsWithStoreSales++;
                const totalProductSales = totalSalesByProduct.get(baseCol) || 0;
                let hasHighRotation = false;
                salesMap.forEach((salesData, depositoId) => {
                    if (depositoId !== CENTRAL_DEPOT_ID) {
                        const salesPercentage = totalProductSales > 0 
                            ? (salesData.unidades / totalProductSales) 
                            : 0;
                        if (salesPercentage >= HIGH_ROTATION_THRESHOLD || salesData.unidades >= MIN_SALES_FOR_HIGH_ROTATION) {
                            hasHighRotation = true;
                        }
                    }
                });
                if (hasHighRotation) {
                    productsWithHighRotationStores++;
                }
            }
        });

        return NextResponse.json({ 
            alerts,
            totalProductsAnalyzed: topProducts.length,
            statistics: {
                productsWithCentralStock,
                productsWithStoreSales,
                productsWithHighRotationStores,
                totalStockRecords: stockResult.recordset.length,
                totalSalesRecords: salesResult.recordset.length
            },
            dateRange: {
                start: startDateStr,
                end: endDateStr
            }
        }, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });

    } catch (error) {
        console.error('Error in stock-alerts API:', error);
        return NextResponse.json({ 
            error: 'Internal Server Error', 
            details: error instanceof Error ? error.message : String(error) 
        }, { status: 500 });
    }
}
