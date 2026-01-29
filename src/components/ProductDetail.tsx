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
import DatePicker, { registerLocale } from 'react-datepicker';
import { es } from 'date-fns/locale';
import 'react-datepicker/dist/react-datepicker.css';

registerLocale('es', es);

interface ProductDetailProps {
    productId: string | null;
    onClose: () => void;
}

export function ProductDetail({ productId, onClose }: ProductDetailProps) {
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedColor, setSelectedColor] = useState<string | null>(null);

    // Date range for filtering
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Current displayed product
    const currentProductId = selectedColor || productId;

    useEffect(() => {
        if (currentProductId) {
            setIsLoading(true);
            const params = new URLSearchParams({ t: Date.now().toString() });
            if (startDate) params.append('startDate', startDate.toISOString().split('T')[0]);
            if (endDate) params.append('endDate', endDate.toISOString().split('T')[0]);

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

    // Reset selected color when modal closes
    useEffect(() => {
        if (!productId) {
            setSelectedColor(null);
            setStartDate(null);
            setEndDate(null);
        }
    }, [productId]);

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
                // Get sales from sucursales data
                const sucursal = data.sucursales?.find((s: any) => s.id === storeId);
                const ventas = data.ventasPorTallaTienda?.[storeId]?.[t.talla] || 0;

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
                        className="fixed inset-4 bg-white rounded-3xl z-[610] shadow-2xl flex flex-col overflow-hidden"
                    >
                        {/* Header - CYBE Style */}
                        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
                            <div className="flex items-center space-x-4">
                                <button
                                    onClick={selectedColor ? () => setSelectedColor(null) : onClose}
                                    className="p-2 hover:bg-slate-200 rounded-xl text-slate-600 hover:text-slate-900 transition-all"
                                >
                                    <ArrowLeft size={24} />
                                </button>
                                <div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm text-slate-500 font-mono">{data?.BaseCol || currentProductId}</span>
                                        <span className="text-lg font-bold text-blue-600">{data?.DescripcionMarca || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-slate-200 rounded-xl text-slate-600 hover:text-slate-900 transition-all"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {isLoading ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                                </div>
                            ) : (
                                <div className="p-6">
                                    {/* Main Grid: Image + Info */}
                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
                                        {/* Left Column: Image + Color Variants */}
                                        <div className="lg:col-span-4 space-y-4">
                                            <div className="bg-slate-50 rounded-2xl p-6 flex items-center justify-center min-h-[300px]">
                                                <img
                                                    src={getProductImageUrl(data?.BaseCol || currentProductId)}
                                                    alt={data?.descripcionCorta || currentProductId}
                                                    className="max-w-full max-h-[350px] object-contain"
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

                                        {/* Right Column: Product Info + Metrics */}
                                        <div className="lg:col-span-8 space-y-4">
                                            {/* Product Title + Status */}
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                                                        <span>{data?.DescripcionColor || 'Color N/A'}</span>
                                                    </div>
                                                    <h2 className="text-xl font-bold text-slate-900">
                                                        {data?.descripcionCorta || currentProductId}
                                                    </h2>
                                                    <p className="text-sm text-slate-500 mt-1">
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
                                            <ProductMetricsGrid
                                                ritmoVenta={clasificacion?.paresPorDia || null}
                                                diasStock={data?.diasStock || null}
                                                stock={data?.stock || 0}
                                                margenBruto={data?.margen || null}
                                                costo={(data?.ultimoCosto || 0) * 1.22}
                                                pvp={data?.precioVenta || 0}
                                                unidadesVendidas={data?.unidadesVendidasDesdeUltCompra || 0}
                                                ultimoCosto={data?.ultimoCosto || 0}
                                                fechaUltimaCompra={data?.fechaUltCompraFormatted}
                                                fecha1raVenta={data?.primeraVentaFormatted}
                                                fechaUltimaVenta={data?.ultimaVentaFormatted}
                                            />
                                        </div>
                                    </div>

                                    {/* Date Range Picker */}
                                    <div className="flex items-center gap-4 mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                                        <Calendar className="text-slate-500" size={20} />
                                        <span className="text-sm font-medium text-slate-700">Período:</span>
                                        <div className="flex items-center gap-2">
                                            <DatePicker
                                                selected={startDate}
                                                onChange={(date: Date | null) => setStartDate(date)}
                                                selectsStart
                                                startDate={startDate}
                                                endDate={endDate}
                                                locale="es"
                                                dateFormat="dd/MM/yyyy"
                                                placeholderText="Desde"
                                                className="w-28 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                                            />
                                            <span className="text-slate-400">-</span>
                                            <DatePicker
                                                selected={endDate}
                                                onChange={(date: Date | null) => setEndDate(date)}
                                                selectsEnd
                                                startDate={startDate}
                                                endDate={endDate}
                                                minDate={startDate ?? undefined}
                                                locale="es"
                                                dateFormat="dd/MM/yyyy"
                                                placeholderText="Hasta"
                                                className="w-28 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                                            />
                                        </div>
                                        {(startDate || endDate) && (
                                            <button
                                                onClick={() => { setStartDate(null); setEndDate(null); }}
                                                className="text-xs text-blue-600 hover:text-blue-800"
                                            >
                                                Limpiar
                                            </button>
                                        )}
                                    </div>

                                    {/* Unified Talla Table - Stock + Ventas */}
                                    {unifiedTableData && (
                                        <div className="mb-6">
                                            <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                                                <Package className="text-blue-600" size={20} />
                                                Stock y Ventas por Talla
                                            </h3>
                                            <UnifiedTallaTable
                                                tallas={unifiedTableData.tallas}
                                                tiendas={unifiedTableData.tiendas}
                                                stockCentralPorTalla={unifiedTableData.stockCentralPorTalla}
                                            />
                                        </div>
                                    )}

                                    {/* Top 7 Ventas por Tienda */}
                                    {topTiendas.length > 0 && (
                                        <div className="mb-6">
                                            <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                                                <Store className="text-blue-600" size={20} />
                                                Top Ventas por Tienda
                                            </h3>
                                            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-slate-100">
                                                        <tr>
                                                            <th className="py-2 px-4 text-left font-semibold text-slate-700">#</th>
                                                            <th className="py-2 px-4 text-left font-semibold text-slate-700">Tienda</th>
                                                            <th className="py-2 px-4 text-center font-semibold text-slate-700">Stock</th>
                                                            <th className="py-2 px-4 text-center font-semibold text-slate-700">Unidades</th>
                                                            <th className="py-2 px-4 text-right font-semibold text-slate-700">Venta $</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {topTiendas.map((s: any, idx: number) => (
                                                            <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50">
                                                                <td className="py-2 px-4 text-slate-500 font-mono">{idx + 1}</td>
                                                                <td className="py-2 px-4 font-medium text-slate-900">{s.descripcion}</td>
                                                                <td className="py-2 px-4 text-center">
                                                                    <span className={cn(
                                                                        "px-2 py-0.5 rounded-full text-xs font-bold",
                                                                        s.ttlstock > 0 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                                                                    )}>
                                                                        {s.ttlstock || 0}
                                                                    </span>
                                                                </td>
                                                                <td className="py-2 px-4 text-center font-semibold">{s.ttlunidadesVenta || 0}</td>
                                                                <td className="py-2 px-4 text-right font-mono text-emerald-600">
                                                                    ${Number(s.ttlimporteVenta || 0).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {/* Gaussian Chart */}
                                    {data?.tallasData && data.tallasData.length > 0 && (
                                        <div className="mb-6">
                                            <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                                                <Package className="text-blue-600" size={20} />
                                                Distribución por Talla
                                            </h3>
                                            <div className="bg-white border border-slate-200 rounded-xl p-4">
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
