'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { PackageX, Package, DollarSign, Store, AlertTriangle, RefreshCw, X } from 'lucide-react';
import { DashboardContainer } from '@/components/DashboardContainer';
import { useFilters } from '@/context/FilterContext';
import { SmartColumnHeader, ColumnSort } from '@/components/SmartColumnHeader';
import { ExportButton } from '@/components/ExportButton';
import { exportToXlsx, ExportColumn } from '@/lib/export-xlsx';
import { ProductDetail } from '@/components/ProductDetail';
import { StockSinVentasItem, StockSinVentasResponse } from '@/types';
import { getProductImageUrl } from '@/lib/utils';

const formatNumber = (n: number) => new Intl.NumberFormat('es-UY').format(n);
const formatCurrency = (n: number) =>
    new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU', maximumFractionDigits: 0 }).format(n);

export default function StockSinVentasPage() {
    const { selectedFilters } = useFilters();
    const [data, setData] = useState<StockSinVentasResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

    // Column sort/filter state
    const [sort, setSort] = useState<ColumnSort | null>(null);
    const [filters, setFilters] = useState<Map<string, Set<string>>>(new Map());

    const handleSort = useCallback((key: string, direction: 'asc' | 'desc' | null) => {
        setSort(direction ? { key, direction } : null);
    }, []);

    const handleFilter = useCallback((key: string, values: Set<string>) => {
        setFilters(prev => {
            const next = new Map(prev);
            if (values.size === 0) next.delete(key);
            else next.set(key, values);
            return next;
        });
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/stock-sin-ventas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(selectedFilters),
            });

            if (!response.ok) throw new Error('Error al cargar datos');

            const result: StockSinVentasResponse = await response.json();
            setData(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedFilters]);

    // Sort and filter logic
    const getSortValue = (item: StockSinVentasItem, key: string): number | string => {
        switch (key) {
            case 'codigo': return item.BaseCol;
            case 'descripcion': return item.descripcionCorta;
            case 'marca': return item.descripcionMarca;
            case 'clase': return item.descripcionClase;
            case 'seccion': return item.descripcionSeccion;
            case 'stock': return item.stockTotal;
            case 'depositos': return item.cantidadDepositos;
            case 'diasSinVenta': return item.diasSinVenta ?? 99999;
            case 'ultimaVenta': return item.fechaUltimaVenta || '';
            case 'pvp': return item.pvp ?? 0;
            case 'costo': return item.ultimoCosto ?? 0;
            case 'valorInventario': return item.valorInventario;
            default: return 0;
        }
    };

    const processedItems = useMemo(() => {
        if (!data) return [];
        let result = [...data.items];

        // Apply filters
        Array.from(filters.entries()).forEach(([key, values]) => {
            if (key === 'marca') result = result.filter(i => values.has(i.descripcionMarca));
            if (key === 'clase') result = result.filter(i => values.has(i.descripcionClase));
            if (key === 'seccion') result = result.filter(i => values.has(i.descripcionSeccion));
        });

        // Apply sort
        if (sort && sort.direction) {
            const { key, direction } = sort;
            result.sort((a, b) => {
                const va = getSortValue(a, key);
                const vb = getSortValue(b, key);
                const cmp = typeof va === 'string' ? va.localeCompare(vb as string, 'es') : (va as number) - (vb as number);
                return direction === 'asc' ? cmp : -cmp;
            });
        }

        return result;
    }, [data, sort, filters]);

    // Unique values for column filters
    const filterValues = useMemo(() => {
        if (!data) return { marcas: [], clases: [], secciones: [] };
        const marcas = Array.from(new Set(data.items.map(i => i.descripcionMarca))).filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'));
        const clases = Array.from(new Set(data.items.map(i => i.descripcionClase))).filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'));
        const secciones = Array.from(new Set(data.items.map(i => i.descripcionSeccion))).filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'));
        return { marcas, clases, secciones };
    }, [data]);

    const handleExport = () => {
        if (!data) return;

        const cols: ExportColumn<StockSinVentasItem>[] = [
            { header: 'Código', accessor: r => r.BaseCol },
            { header: 'Descripción', accessor: r => r.descripcionCorta },
            { header: 'Marca', accessor: r => r.descripcionMarca },
            { header: 'Clase', accessor: r => r.descripcionClase },
            { header: 'Sección', accessor: r => r.descripcionSeccion },
            { header: 'Stock Total', accessor: r => r.stockTotal },
            { header: 'Tiendas con Stock', accessor: r => r.cantidadDepositos },
            { header: 'Días sin Venta', accessor: r => r.diasSinVenta ?? 'Nunca vendió' },
            { header: 'Última Venta', accessor: r => r.fechaUltimaVenta ? new Date(r.fechaUltimaVenta).toLocaleDateString('es-AR') : 'Nunca' },
            { header: 'PVP', accessor: r => r.pvp != null ? Math.round(r.pvp) : '' },
            { header: 'Costo', accessor: r => r.ultimoCosto != null ? Math.round(r.ultimoCosto) : '' },
            { header: 'Valor Inventario', accessor: r => Math.round(r.valorInventario) },
        ];

        exportToXlsx(processedItems, cols, 'stock-sin-ventas', 'Stock sin Ventas');
    };

    const hasActiveFilters = filters.size > 0 || sort !== null;

    return (
        <DashboardContainer>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                            <PackageX className="text-orange-600" size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                Stock sin Ventas
                            </h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Artículos con stock que no vendieron en el período seleccionado
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <ExportButton onClick={handleExport} disabled={!data || data.items.length === 0} />
                        <button
                            onClick={fetchData}
                            disabled={isLoading}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500"
                        >
                            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {/* Error state */}
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                        <p className="text-red-600 dark:text-red-400">{error}</p>
                    </div>
                )}

                {/* Summary cards */}
                {data && !isLoading && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4"
                    >
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-1">
                                <PackageX className="text-orange-500" size={16} />
                                <span className="text-xs text-gray-500 uppercase font-semibold">Artículos</span>
                            </div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                {formatNumber(data.resumen.totalArticulos)}
                            </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-1">
                                <Package className="text-blue-500" size={16} />
                                <span className="text-xs text-gray-500 uppercase font-semibold">Unidades</span>
                            </div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                {formatNumber(data.resumen.totalUnidadesStock)}
                            </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-1">
                                <DollarSign className="text-green-500" size={16} />
                                <span className="text-xs text-gray-500 uppercase font-semibold">Valor Inventario</span>
                            </div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                {formatCurrency(data.resumen.valorInventarioTotal)}
                            </div>
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-1">
                                <AlertTriangle className="text-red-500" size={16} />
                                <span className="text-xs text-red-600 uppercase font-semibold">Nunca vendieron</span>
                            </div>
                            <div className="text-2xl font-bold text-red-600">
                                {formatNumber(data.resumen.articulosSinVentaNunca)}
                            </div>
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-1">
                                <Store className="text-amber-500" size={16} />
                                <span className="text-xs text-amber-600 uppercase font-semibold">Sin venta en período</span>
                            </div>
                            <div className="text-2xl font-bold text-amber-600">
                                {formatNumber(data.resumen.articulosSinVentaPeriodo)}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Loading state */}
                {isLoading && (
                    <div className="flex items-center justify-center py-20">
                        <div className="flex flex-col items-center gap-3">
                            <RefreshCw className="animate-spin text-blue-500" size={32} />
                            <p className="text-gray-500">Analizando stock...</p>
                        </div>
                    </div>
                )}

                {/* Data table */}
                {data && !isLoading && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white dark:bg-slate-900/50 rounded-lg dark:rounded-3xl shadow-sm dark:shadow-2xl overflow-hidden dark:border dark:border-slate-800"
                    >
                        {hasActiveFilters && (
                            <div className="px-4 py-3 border-b dark:border-slate-800 flex items-center justify-between">
                                <h3 className="font-semibold text-gray-900 dark:text-white">
                                    Artículos sin ventas
                                    {filters.size > 0 && (
                                        <span className="ml-2 text-xs font-normal text-blue-500">
                                            ({processedItems.length} de {data.items.length})
                                        </span>
                                    )}
                                </h3>
                                <button
                                    onClick={() => { setSort(null); setFilters(new Map()); }}
                                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                >
                                    <X size={12} />
                                    Limpiar filtros
                                </button>
                            </div>
                        )}
                        <div className="max-h-[75vh] overflow-auto">
                            <table className="w-full">
                                <thead className="bg-[#0c1425] sticky top-0 z-20 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
                                    <tr className="border-b-2 border-orange-500/30">
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase w-10">#</th>
                                        <SmartColumnHeader label="Código" columnKey="codigo" align="left"
                                            currentSort={sort} onSort={handleSort} />
                                        <SmartColumnHeader label="Descripción" columnKey="descripcion" align="left"
                                            currentSort={sort} onSort={handleSort} />
                                        <SmartColumnHeader label="Marca" columnKey="marca" align="left" sortable filterable
                                            currentSort={sort} onSort={handleSort}
                                            filterValues={filterValues.marcas}
                                            activeFilter={filters.get('marca')} onFilter={handleFilter} />
                                        <SmartColumnHeader label="Clase" columnKey="clase" align="left" sortable filterable
                                            currentSort={sort} onSort={handleSort}
                                            filterValues={filterValues.clases}
                                            activeFilter={filters.get('clase')} onFilter={handleFilter} />
                                        <SmartColumnHeader label="Sección" columnKey="seccion" align="left" sortable filterable
                                            currentSort={sort} onSort={handleSort}
                                            filterValues={filterValues.secciones}
                                            activeFilter={filters.get('seccion')} onFilter={handleFilter} />
                                        <SmartColumnHeader label="Stock" columnKey="stock" align="right"
                                            currentSort={sort} onSort={handleSort} />
                                        <SmartColumnHeader label="Tiendas" columnKey="depositos" align="center"
                                            currentSort={sort} onSort={handleSort} />
                                        <SmartColumnHeader label="Días s/Venta" columnKey="diasSinVenta" align="right"
                                            currentSort={sort} onSort={handleSort} />
                                        <SmartColumnHeader label="Última Venta" columnKey="ultimaVenta" align="center"
                                            currentSort={sort} onSort={handleSort} />
                                        <SmartColumnHeader label="PVP" columnKey="pvp" align="right"
                                            currentSort={sort} onSort={handleSort} />
                                        <SmartColumnHeader label="Valor Inv." columnKey="valorInventario" align="right"
                                            currentSort={sort} onSort={handleSort} />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {processedItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={12} className="px-4 py-12 text-center text-gray-500">
                                                No se encontraron artículos con stock sin ventas para los filtros seleccionados
                                            </td>
                                        </tr>
                                    ) : (
                                        processedItems.map((item, idx) => (
                                            <tr
                                                key={item.BaseCol}
                                                className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                                                onClick={() => setSelectedProductId(item.BaseCol)}
                                            >
                                                <td className="px-4 py-3 text-xs text-gray-400">{idx + 1}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <img
                                                            src={getProductImageUrl(item.BaseCol)}
                                                            alt=""
                                                            className="w-8 h-8 rounded object-cover bg-gray-100 dark:bg-gray-800"
                                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                        />
                                                        <span className="font-mono text-sm text-blue-600 dark:text-blue-400">{item.BaseCol}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-sm max-w-[200px] truncate" title={item.descripcionCorta}>
                                                    {item.descripcionCorta}
                                                </td>
                                                <td className="px-4 py-3 text-sm">{item.descripcionMarca}</td>
                                                <td className="px-4 py-3 text-sm">{item.descripcionClase}</td>
                                                <td className="px-4 py-3 text-sm">{item.descripcionSeccion}</td>
                                                <td className="px-4 py-3 text-right font-semibold">{formatNumber(item.stockTotal)}</td>
                                                <td className="px-4 py-3 text-center">{item.cantidadDepositos}</td>
                                                <td className="px-4 py-3 text-right">
                                                    {item.diasSinVenta != null ? (
                                                        <span className={item.diasSinVenta > 365 ? 'text-red-500 font-semibold' : item.diasSinVenta > 180 ? 'text-amber-500' : ''}>
                                                            {formatNumber(item.diasSinVenta)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-red-500 text-xs font-semibold">Nunca</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center text-sm text-gray-500">
                                                    {item.fechaUltimaVenta
                                                        ? new Date(item.fechaUltimaVenta).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })
                                                        : '-'
                                                    }
                                                </td>
                                                <td className="px-4 py-3 text-right text-sm">
                                                    {item.pvp != null ? formatCurrency(item.pvp) : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-right font-semibold">
                                                    {formatCurrency(item.valorInventario)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                {processedItems.length > 0 && (
                                    <tfoot className="bg-[#0c1425] sticky bottom-0 z-20 shadow-[0_-2px_8px_rgba(0,0,0,0.3)]">
                                        <tr className="border-t-2 border-orange-500/30 font-semibold text-white">
                                            <td colSpan={6} className="px-4 py-3 text-sm">
                                                Total: {formatNumber(processedItems.length)} artículos
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {formatNumber(processedItems.reduce((s, i) => s + i.stockTotal, 0))}
                                            </td>
                                            <td className="px-4 py-3 text-center">-</td>
                                            <td className="px-4 py-3 text-right">-</td>
                                            <td className="px-4 py-3 text-center">-</td>
                                            <td className="px-4 py-3 text-right">-</td>
                                            <td className="px-4 py-3 text-right">
                                                {formatCurrency(processedItems.reduce((s, i) => s + i.valorInventario, 0))}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Product Detail Modal */}
            {selectedProductId && (
                <ProductDetail
                    productId={selectedProductId}
                    onClose={() => setSelectedProductId(null)}
                />
            )}
        </DashboardContainer>
    );
}
