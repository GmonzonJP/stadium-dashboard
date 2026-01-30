'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeft, Store, Calendar, Package, ChevronDown } from 'lucide-react';
import { cn, getProductImageUrl } from '@/lib/utils';
import { TallaGaussianOverlayChart } from './TallaGaussianOverlayChart';
import { ProductInsights } from './ProductInsights';
import { ProductStatusBadge, SaldoBadge } from './ProductStatusBadge';
import { UnifiedTallaTable } from './ProductDetail/UnifiedTallaTable';
import { RelatedColors } from './ProductDetail/RelatedColors';
import { ProductMetricsGrid } from './ProductDetail/ProductMetricsGrid';
import { clasificarProductoCompleto } from '@/lib/producto-classifier';
import { DEPOSITOS_CONFIG, UMBRALES } from '@/types/sell-out';

// Helper para formatear fecha local sin conversión UTC
const formatDateLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

interface ProductDetailProps {
    productId: string | null;
    onClose: () => void;
    initialStartDate?: string;
    initialEndDate?: string;
}

export function ProductDetail({ productId, onClose, initialStartDate, initialEndDate }: ProductDetailProps) {
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedColor, setSelectedColor] = useState<string | null>(null);

    // Date range for filtering - inicializa con el período del dashboard
    const [startDate, setStartDate] = useState<string>(initialStartDate || '');
    const [endDate, setEndDate] = useState<string>(initialEndDate || '');
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

    // Current displayed product
    const currentProductId = selectedColor || productId;

    // Aplicar preset de fecha
    const applyDatePreset = (preset: string) => {
        const today = new Date();
        const year = today.getFullYear();
        let start = new Date();
        let end = new Date();

        switch (preset) {
            case 'clear':
                setStartDate('');
                setEndDate('');
                setIsDatePickerOpen(false);
                return;
            case 'Hoy':
                break;
            case 'Ayer':
                start.setDate(today.getDate() - 1);
                end.setDate(today.getDate() - 1);
                break;
            case 'Ultimos 7 Dias':
                start.setDate(today.getDate() - 6);
                break;
            case 'Ultimos 90 Dias':
                start.setDate(today.getDate() - 89);
                break;
            case 'Este Mes':
                start = new Date(year, today.getMonth(), 1);
                end = new Date(year, today.getMonth() + 1, 0);
                break;
            case 'Mes Pasado':
                start = new Date(year, today.getMonth() - 1, 1);
                end = new Date(year, today.getMonth(), 0);
                break;
            case 'Q1':
                start = new Date(year, 0, 1);
                end = new Date(year, 2, 31);
                break;
            case 'Q2':
                start = new Date(year, 3, 1);
                end = new Date(year, 5, 30);
                break;
            case 'Q3':
                start = new Date(year, 6, 1);
                end = new Date(year, 8, 30);
                break;
            case 'Q4':
                start = new Date(year, 9, 1);
                end = new Date(year, 11, 31);
                break;
            default:
                return;
        }

        setStartDate(formatDateLocal(start));
        setEndDate(formatDateLocal(end));
        setIsDatePickerOpen(false);
    };

    useEffect(() => {
        if (currentProductId) {
            setIsLoading(true);
            const params = new URLSearchParams({ t: Date.now().toString() });
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);

            fetch(`/api/product/${currentProductId}?${params}`, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' }
            })
                .then(res => res.json())
                .then(result => {
                    setData(result);
                    setIsLoading(false);
                })
                .catch(err => {
                    console.error('Error fetching product detail:', err);
                    setIsLoading(false);
                });
        }
    }, [currentProductId, startDate, endDate]);

    // Reset selected color when modal closes, and sync dates when modal opens
    useEffect(() => {
        if (!productId) {
            setSelectedColor(null);
        } else {
            // Cuando se abre el modal, usar las fechas del dashboard
            if (initialStartDate) setStartDate(initialStartDate);
            if (initialEndDate) setEndDate(initialEndDate);
        }
    }, [productId, initialStartDate, initialEndDate]);

    // Clasificar el producto
    const clasificacion = useMemo(() => {
        if (!data) return null;
        return clasificarProductoCompleto({
            BaseCol: data.BaseCol,
            marca: data.DescripcionMarca || '',
            stockActual: data.stock || 0,
            unidadesVendidas: data.unidadesVendidasDesdeUltCompra || 0,
            diasDesde1raVentaUltimaCompra: data.diasDesde1raVentaUltimaCompra || 0,
        });
    }, [data]);

    // Preparar datos para UnifiedTallaTable
    const unifiedTableData = useMemo(() => {
        if (!data?.matrixData || !data?.tallasData) return null;

        const tallas = data.tallasData.map((t: any) => t.talla);

        // Build tiendas data
        const tiendasMap = new Map<number, any>();

        // Get unique store IDs
        const storeIds = data.sortedStoreIds || [];

        for (const storeId of storeIds) {
            const nombre = data.storesInfo?.[storeId] || `Tienda ${storeId}`;
            const tallasData: Record<string, { stock: number; ventas: number }> = {};
            let totalStock = 0;
            let totalVentas = 0;

            for (const t of data.tallasData) {
                const matrixRow = data.matrixData.find((r: any) => r.talla === t.talla);
                const cell = matrixRow?.[`store_${storeId}`];
                const stock = cell?.stock || 0;
                // Get sales from matrixData cell (already includes ventas)
                const ventas = cell?.ventas || 0;

                tallasData[t.talla] = { stock, ventas };
                totalStock += stock;
                totalVentas += ventas;
            }

            tiendasMap.set(storeId, {
                id: storeId,
                nombre,
                tallas: tallasData,
                totalStock,
                totalVentas,
            });
        }

        // Stock central por talla
        const stockCentralPorTalla: Record<string, number> = {};
        for (const t of data.tallasData) {
            let centralStock = 0;
            for (const centralId of DEPOSITOS_CONFIG.central) {
                const matrixRow = data.matrixData.find((r: any) => r.talla === t.talla);
                centralStock += matrixRow?.[`store_${centralId}`]?.stock || 0;
            }
            stockCentralPorTalla[t.talla] = centralStock;
        }

        return {
            tallas,
            tiendas: Array.from(tiendasMap.values()),
            stockCentralPorTalla,
        };
    }, [data]);

    // Top 7 tiendas por ventas
    const topTiendas = useMemo(() => {
        if (!data?.sucursales) return [];
        return [...data.sucursales]
            .filter((s: any) => !DEPOSITOS_CONFIG.central.includes(s.id) && !DEPOSITOS_CONFIG.outlet.includes(s.id))
            .sort((a: any, b: any) => (b.ttlimporteVenta || 0) - (a.ttlimporteVenta || 0))
            .slice(0, 7);
    }, [data]);

    // Related colors
    const relatedColors = useMemo(() => {
        if (!data?.coloresRelacionados) return [];
        return data.coloresRelacionados.map((c: any) => ({
            baseCol: c.BaseCol,
            color: c.color || c.DescripcionColor,
            imageUrl: getProductImageUrl(c.BaseCol),
            stock: c.stock,
        }));
    }, [data]);

    const esSaldo = (data?.stock || 0) < UMBRALES.stockMinimoLiquidacion;

    return (
        <AnimatePresence>
            {productId && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-md z-[600]"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-4 bg-white dark:bg-slate-900 rounded-3xl z-[610] shadow-2xl flex flex-col overflow-hidden"
                    >
                        {/* Header - CYBE Style */}
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-900">
                            <div className="flex items-center space-x-4">
                                <button
                                    onClick={selectedColor ? () => setSelectedColor(null) : onClose}
                                    className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all"
                                >
                                    <ArrowLeft size={24} />
                                </button>
                                <div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm text-slate-500 dark:text-slate-400 font-mono">{data?.BaseCol || currentProductId}</span>
                                        <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{data?.DescripcionMarca || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Date Range Picker - Estilo Dashboard */}
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <button
                                        onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                                        className={cn(
                                            "flex items-center space-x-2 bg-slate-900/50 border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                                            isDatePickerOpen
                                                ? "text-white border-blue-500/50"
                                                : "text-slate-400 hover:text-white"
                                        )}
                                    >
                                        <Calendar size={14} />
                                        <span>
                                            {startDate && endDate
                                                ? `${new Date(startDate + 'T00:00:00').toLocaleDateString('es-ES')} - ${new Date(endDate + 'T00:00:00').toLocaleDateString('es-ES')}`
                                                : 'Todo el historial'}
                                        </span>
                                        <ChevronDown size={12} className={cn("transition-transform", isDatePickerOpen && "rotate-180")} />
                                    </button>

                                    <AnimatePresence>
                                        {isDatePickerOpen && (
                                            <>
                                                <div className="fixed inset-0 z-[620]" onClick={() => setIsDatePickerOpen(false)} />
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    className="absolute right-0 top-full mt-2 w-56 bg-[#020617] border border-slate-800 rounded-xl shadow-2xl z-[630] py-1"
                                                >
                                                    {['Hoy', 'Ayer', 'Ultimos 7 Dias', 'Ultimos 90 Dias', 'Este Mes', 'Mes Pasado', 'Q1', 'Q2', 'Q3', 'Q4'].map((preset) => (
                                                        <button
                                                            key={preset}
                                                            onClick={() => applyDatePreset(preset)}
                                                            className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                                                        >
                                                            {preset}
                                                        </button>
                                                    ))}
                                                    {(startDate || endDate) && (
                                                        <>
                                                            <div className="h-px bg-slate-800 my-1" />
                                                            <button
                                                                onClick={() => applyDatePreset('clear')}
                                                                className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-colors"
                                                            >
                                                                Limpiar filtro
                                                            </button>
                                                        </>
                                                    )}
                                                </motion.div>
                                            </>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <button
                                    onClick={onClose}
                                    className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {isLoading ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                                </div>
                            ) : (
                                <div className="p-6">
                                    {/* Main Grid: Image + Info + Top Ventas */}
                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
                                        {/* Left Column: Image + Color Variants */}
                                        <div className="lg:col-span-3 space-y-4">
                                            <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 flex items-center justify-center min-h-[280px]">
                                                <img
                                                    src={getProductImageUrl(data?.BaseCol || currentProductId)}
                                                    alt={data?.descripcionCorta || currentProductId}
                                                    className="max-w-full max-h-[260px] object-contain"
                                                    onError={(e) => {
                                                        e.currentTarget.src = 'https://placehold.co/400x400/e5e7eb/9ca3af?text=Sin+Imagen';
                                                    }}
                                                />
                                            </div>
                                            {/* Related Colors */}
                                            {relatedColors.length > 1 && (
                                                <RelatedColors
                                                    colors={relatedColors}
                                                    currentBaseCol={data?.BaseCol || currentProductId}
                                                    onSelectColor={(baseCol) => setSelectedColor(baseCol)}
                                                />
                                            )}
                                        </div>

                                        {/* Center Column: Product Info + Metrics */}
                                        <div className="lg:col-span-6 space-y-4">
                                            {/* Product Title + Status */}
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-1">
                                                        <span>{data?.DescripcionColor || 'Color N/A'}</span>
                                                    </div>
                                                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                                        {data?.descripcionCorta || currentProductId}
                                                    </h2>
                                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                                        {data?.DescripcionClase || 'N/A'} | {data?.DescripcionGenero || 'N/A'}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {clasificacion && (
                                                        <ProductStatusBadge estado={clasificacion.estado} size="lg" />
                                                    )}
                                                    {esSaldo && <SaldoBadge size="md" />}
                                                </div>
                                            </div>

                                            {/* Metrics Grid - CYBE Style */}
                                            {/* Usar siempre datos desde última compra, NO del período seleccionado */}
                                            <ProductMetricsGrid
                                                ritmoVenta={data?.ritmoDiario || clasificacion?.paresPorDia || null}
                                                diasStock={data?.diasStock || null}
                                                stock={data?.stock || 0}
                                                margenBruto={data?.margen || null}
                                                costo={(data?.ultimoCosto || 0) * 1.22}
                                                pvp={data?.pvp || data?.precioVenta || 0}
                                                unidadesVendidas={data?.unidadesVendidasDesdeUltCompra || 0}
                                                unidadesCompradas={data?.unidadesCompradas || 0}
                                                ultimoCosto={data?.ultimoCosto || 0}
                                                fechaUltimaCompra={data?.fechaUltCompraFormatted}
                                                fecha1raVenta={data?.primeraVentaFormatted}
                                                fechaUltimaVenta={data?.ultimaVentaFormatted}
                                                ventasImporte={data?.importeVentaDesdeUltCompra || 0}
                                                utilidadVenta={
                                                    data?.importeVentaDesdeUltCompra && data?.ultimoCosto
                                                        ? data.importeVentaDesdeUltCompra - (data.unidadesVendidasDesdeUltCompra * data.ultimoCosto * 1.22)
                                                        : undefined
                                                }
                                            />
                                        </div>

                                        {/* Right Column: Top Ventas por Tienda */}
                                        {topTiendas.length > 0 && (
                                            <div className="lg:col-span-3">
                                                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden h-full flex flex-col">
                                                    <div className="px-3 py-2 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                                                        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                                            <Store className="text-blue-600 dark:text-blue-400" size={14} />
                                                            Top Ventas por Tienda
                                                        </h3>
                                                    </div>
                                                    <div className="flex-1 overflow-y-auto max-h-[320px] custom-scrollbar">
                                                        <table className="w-full text-xs">
                                                            <thead className="bg-slate-50 dark:bg-slate-700/30 sticky top-0">
                                                                <tr>
                                                                    <th className="py-1.5 px-2 text-left font-semibold text-slate-600 dark:text-slate-400">Tienda</th>
                                                                    <th className="py-1.5 px-2 text-center font-semibold text-slate-600 dark:text-slate-400">Un.</th>
                                                                    <th className="py-1.5 px-2 text-right font-semibold text-slate-600 dark:text-slate-400">$</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {topTiendas.map((s: any, idx: number) => (
                                                                    <tr key={s.id} className="border-t border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                                                        <td className="py-1.5 px-2 font-medium text-slate-800 dark:text-slate-200 truncate max-w-[100px]" title={s.descripcion}>
                                                                            <span className="text-slate-400 dark:text-slate-500 mr-1">{idx + 1}.</span>
                                                                            {s.descripcion?.replace('Stadium ', 'S')}
                                                                        </td>
                                                                        <td className="py-1.5 px-2 text-center font-semibold text-slate-700 dark:text-slate-300">{s.ttlunidadesVenta || 0}</td>
                                                                        <td className="py-1.5 px-2 text-right font-mono text-emerald-600 dark:text-emerald-400 text-[10px]">
                                                                            ${Number(s.ttlimporteVenta || 0).toLocaleString('es-AR', { maximumFractionDigits: 0, notation: 'compact' })}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Unified Talla Table - Stock + Ventas */}
                                    {unifiedTableData && (
                                        <div className="mb-6">
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                                                <Package className="text-blue-600 dark:text-blue-400" size={20} />
                                                Stock y Ventas por Talla
                                            </h3>
                                            <UnifiedTallaTable
                                                tallas={unifiedTableData.tallas}
                                                tiendas={unifiedTableData.tiendas}
                                                stockCentralPorTalla={unifiedTableData.stockCentralPorTalla}
                                            />
                                        </div>
                                    )}

                                    {/* Gaussian Chart */}
                                    {data?.tallasData && data.tallasData.length > 0 && (
                                        <div className="mb-6">
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                                                <Package className="text-blue-600 dark:text-blue-400" size={20} />
                                                Distribución por Talla
                                            </h3>
                                            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                                                <TallaGaussianOverlayChart tallasData={data.tallasData} height={300} />
                                            </div>
                                        </div>
                                    )}

                                    {/* Insights */}
                                    {data?.insights && data.insights.length > 0 && (
                                        <ProductInsights insights={data.insights} />
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
