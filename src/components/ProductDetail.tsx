'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeft, Store, Calendar, Package, ChevronDown, TrendingUp, Box, DollarSign, Percent, Clock, ShoppingCart } from 'lucide-react';
import { cn, getProductImageUrl } from '@/lib/utils';
import { TallaGaussianOverlayChart } from './TallaGaussianOverlayChart';
import { ProductInsights } from './ProductInsights';
import { ProductStatusBadge, SaldoBadge } from './ProductStatusBadge';
import { UnifiedTallaTable } from './ProductDetail/UnifiedTallaTable';
import { RelatedColors } from './ProductDetail/RelatedColors';
import { HistorialAnual } from './ProductDetail/HistorialAnual';
import { clasificarProductoCompleto } from '@/lib/producto-classifier';
import { DEPOSITOS_CONFIG, UMBRALES } from '@/types/sell-out';

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

// Componente de métrica compacta
function MetricCard({ label, value, subValue, color = 'default', icon: Icon }: {
    label: string;
    value: string | number;
    subValue?: string;
    color?: 'default' | 'green' | 'blue' | 'amber' | 'red';
    icon?: any;
}) {
    const colorClasses = {
        default: 'text-white',
        green: 'text-emerald-400',
        blue: 'text-blue-400',
        amber: 'text-amber-400',
        red: 'text-red-400',
    };

    return (
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase tracking-wide mb-1">
                {Icon && <Icon size={12} />}
                {label}
            </div>
            <div className={cn("text-lg font-bold", colorClasses[color])}>
                {value}
            </div>
            {subValue && (
                <div className="text-[10px] text-slate-500 mt-0.5">{subValue}</div>
            )}
        </div>
    );
}

export function ProductDetail({ productId, onClose, initialStartDate, initialEndDate }: ProductDetailProps) {
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedColor, setSelectedColor] = useState<string | null>(null);
    const [startDate, setStartDate] = useState<string>(initialStartDate || '');
    const [endDate, setEndDate] = useState<string>(initialEndDate || '');
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

    const currentProductId = selectedColor || productId;

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

    useEffect(() => {
        if (!productId) {
            setSelectedColor(null);
        } else {
            if (initialStartDate) setStartDate(initialStartDate);
            if (initialEndDate) setEndDate(initialEndDate);
        }
    }, [productId, initialStartDate, initialEndDate]);

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

    const unifiedTableData = useMemo(() => {
        if (!data?.matrixData || !data?.tallasData) return null;

        const tallas = data.tallasData.map((t: any) => t.talla);
        const tiendasMap = new Map<number, any>();
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

    const topTiendas = useMemo(() => {
        if (!data?.sucursales) return [];
        return [...data.sucursales]
            .filter((s: any) => !DEPOSITOS_CONFIG.central.includes(s.id) && !DEPOSITOS_CONFIG.outlet.includes(s.id))
            .sort((a: any, b: any) => (b.ttlimporteVenta || 0) - (a.ttlimporteVenta || 0))
            .slice(0, 5);
    }, [data]);

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

    // Calcular métricas
    const porcentajeVendido = data?.unidadesCompradas > 0
        ? Math.round((data.unidadesVendidasDesdeUltCompra / data.unidadesCompradas) * 100)
        : 0;

    const formatCurrency = (val: number) => {
        if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
        if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
        return `$${val.toFixed(0)}`;
    };

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
                        className="fixed inset-4 bg-slate-900 rounded-2xl z-[610] shadow-2xl flex flex-col overflow-hidden"
                    >
                        {/* Header Compacto */}
                        <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between bg-slate-800/50">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={selectedColor ? () => setSelectedColor(null) : onClose}
                                    className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-all"
                                >
                                    <ArrowLeft size={20} />
                                </button>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-slate-500 font-mono">{data?.BaseCol || currentProductId}</span>
                                    <span className="text-base font-bold text-blue-400">{data?.DescripcionMarca || 'N/A'}</span>
                                    {clasificacion && <ProductStatusBadge estado={clasificacion.estado} size="sm" />}
                                    {esSaldo && <SaldoBadge size="sm" />}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <button
                                        onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                                        className={cn(
                                            "flex items-center gap-2 bg-slate-800 border border-slate-700 px-2.5 py-1.5 rounded-lg text-xs transition-colors",
                                            isDatePickerOpen ? "text-white border-blue-500/50" : "text-slate-400 hover:text-white"
                                        )}
                                    >
                                        <Calendar size={12} />
                                        <span>
                                            {startDate && endDate
                                                ? `${new Date(startDate + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} - ${new Date(endDate + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}`
                                                : 'Todo'}
                                        </span>
                                    </button>

                                    <AnimatePresence>
                                        {isDatePickerOpen && (
                                            <>
                                                <div className="fixed inset-0 z-[620]" onClick={() => setIsDatePickerOpen(false)} />
                                                <motion.div
                                                    initial={{ opacity: 0, y: 5 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: 5 }}
                                                    className="absolute right-0 top-full mt-1 w-44 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-[630] py-1"
                                                >
                                                    {['Hoy', 'Ayer', 'Ultimos 7 Dias', 'Ultimos 90 Dias', 'Este Mes', 'Mes Pasado'].map((preset) => (
                                                        <button
                                                            key={preset}
                                                            onClick={() => applyDatePreset(preset)}
                                                            className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white"
                                                        >
                                                            {preset}
                                                        </button>
                                                    ))}
                                                    {(startDate || endDate) && (
                                                        <>
                                                            <div className="h-px bg-slate-700 my-1" />
                                                            <button
                                                                onClick={() => applyDatePreset('clear')}
                                                                className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/20"
                                                            >
                                                                Limpiar
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
                                    className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-all"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {isLoading ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="w-10 h-10 border-3 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                                </div>
                            ) : (
                                <div className="p-4">
                                    {/* Row 1: Imagen + Métricas + Top Tiendas */}
                                    <div className="grid grid-cols-12 gap-4 mb-4">
                                        {/* Imagen pequeña */}
                                        <div className="col-span-2">
                                            <div className="bg-slate-800 rounded-xl p-2 aspect-square flex items-center justify-center">
                                                <img
                                                    src={getProductImageUrl(data?.BaseCol || currentProductId)}
                                                    alt={data?.descripcionCorta || currentProductId}
                                                    className="max-w-full max-h-full object-contain"
                                                    onError={(e) => {
                                                        e.currentTarget.src = 'https://placehold.co/200x200/1e293b/64748b?text=?';
                                                    }}
                                                />
                                            </div>
                                            {/* Colores relacionados */}
                                            {relatedColors.length > 1 && (
                                                <div className="flex gap-1 mt-2 flex-wrap">
                                                    {relatedColors.slice(0, 4).map((c: any) => (
                                                        <button
                                                            key={c.baseCol}
                                                            onClick={() => setSelectedColor(c.baseCol)}
                                                            className={cn(
                                                                "w-8 h-8 rounded-md overflow-hidden border-2 transition-all",
                                                                c.baseCol === (data?.BaseCol || currentProductId)
                                                                    ? "border-blue-500"
                                                                    : "border-slate-700 hover:border-slate-500"
                                                            )}
                                                        >
                                                            <img
                                                                src={c.imageUrl}
                                                                alt={c.color}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Métricas principales - Grid compacto */}
                                        <div className="col-span-7">
                                            <div className="grid grid-cols-4 gap-2 mb-2">
                                                <MetricCard
                                                    label="Stock"
                                                    value={data?.stock?.toLocaleString() || 0}
                                                    subValue={`de ${data?.unidadesCompradas?.toLocaleString() || 0} comp.`}
                                                    icon={Box}
                                                    color={data?.stock > 100 ? 'amber' : 'default'}
                                                />
                                                <MetricCard
                                                    label="Vendidas"
                                                    value={data?.unidadesVendidasDesdeUltCompra?.toLocaleString() || 0}
                                                    subValue={`${porcentajeVendido}% del total`}
                                                    icon={ShoppingCart}
                                                    color="green"
                                                />
                                                <MetricCard
                                                    label="Venta $"
                                                    value={formatCurrency(data?.importeVentaDesdeUltCompra || 0)}
                                                    subValue="desde últ. compra"
                                                    icon={DollarSign}
                                                    color="green"
                                                />
                                                <MetricCard
                                                    label="Utilidad"
                                                    value={formatCurrency(
                                                        data?.importeVentaDesdeUltCompra && data?.ultimoCosto
                                                            ? data.importeVentaDesdeUltCompra - (data.unidadesVendidasDesdeUltCompra * data.ultimoCosto * 1.22)
                                                            : 0
                                                    )}
                                                    subValue="bruta estimada"
                                                    icon={TrendingUp}
                                                    color="green"
                                                />
                                            </div>
                                            <div className="grid grid-cols-5 gap-2">
                                                <MetricCard
                                                    label="Días Stock"
                                                    value={data?.diasStock || '-'}
                                                    color={data?.diasStock > 180 ? 'red' : data?.diasStock > 90 ? 'amber' : 'default'}
                                                    icon={Clock}
                                                />
                                                <MetricCard
                                                    label="Par/Día"
                                                    value={data?.ritmoDiario?.toFixed(1) || '-'}
                                                    color={data?.ritmoDiario > 1 ? 'green' : 'default'}
                                                />
                                                <MetricCard
                                                    label="Margen"
                                                    value={data?.margen ? `${data.margen.toFixed(0)}%` : '-'}
                                                    color={data?.margen >= 30 ? 'green' : data?.margen >= 15 ? 'amber' : 'red'}
                                                    icon={Percent}
                                                />
                                                <MetricCard
                                                    label="Costo"
                                                    value={`$${((data?.ultimoCosto || 0) * 1.22).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                                                    subValue="con IVA"
                                                />
                                                <MetricCard
                                                    label="PVP"
                                                    value={`$${(data?.pvp || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                                                    color="blue"
                                                />
                                            </div>
                                            {/* Fechas en línea */}
                                            <div className="flex gap-4 mt-2 text-[10px] text-slate-500">
                                                {data?.fechaUltCompraFormatted && (
                                                    <span>Últ. Compra: <span className="text-slate-400">{data.fechaUltCompraFormatted}</span></span>
                                                )}
                                                {data?.primeraVentaFormatted && (
                                                    <span>1ra Venta: <span className="text-slate-400">{data.primeraVentaFormatted}</span></span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Top Tiendas - Compacto */}
                                        <div className="col-span-3">
                                            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 h-full">
                                                <div className="px-3 py-2 border-b border-slate-700/50 flex items-center gap-2">
                                                    <Store size={12} className="text-blue-400" />
                                                    <span className="text-xs font-medium text-slate-300">Top Tiendas</span>
                                                </div>
                                                <div className="p-2 space-y-1">
                                                    {topTiendas.map((s: any, idx: number) => (
                                                        <div key={s.id} className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-slate-700/30">
                                                            <span className="text-slate-400 truncate max-w-[100px]">
                                                                <span className="text-slate-500 mr-1">{idx + 1}.</span>
                                                                {s.descripcion?.replace('STADIUM', 'S').replace('Stadium ', 'S')}
                                                            </span>
                                                            <div className="flex items-center gap-3">
                                                                <span className="font-bold text-white">{s.ttlunidadesVenta || 0}</span>
                                                                <span className="font-mono text-emerald-400">{formatCurrency(s.ttlimporteVenta || 0)}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row 2: Historial + Distribución por Talla */}
                                    <div className="grid grid-cols-12 gap-4 mb-4">
                                        {/* Historial */}
                                        <div className="col-span-4">
                                            {data?.historialAnual && data.historialAnual.length > 0 && (
                                                <HistorialAnual
                                                    historial={data.historialAnual}
                                                    temporadas={data.temporadas || 1}
                                                    primeraCompraAnio={data.primeraCompraAnio}
                                                    stockActual={data.stock || 0}
                                                />
                                            )}
                                        </div>

                                        {/* Gráfico de tallas */}
                                        <div className="col-span-8">
                                            {data?.tallasData && data.tallasData.length > 0 && (
                                                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-3">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Package size={14} className="text-blue-400" />
                                                        <span className="text-xs font-medium text-slate-300">Distribución por Talla</span>
                                                    </div>
                                                    <TallaGaussianOverlayChart tallasData={data.tallasData} height={180} />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Row 3: Tabla de Stock y Ventas por Talla */}
                                    {unifiedTableData && (
                                        <div className="mb-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Package size={14} className="text-blue-400" />
                                                <span className="text-sm font-medium text-white">Stock y Ventas por Talla</span>
                                            </div>
                                            <UnifiedTallaTable
                                                tallas={unifiedTableData.tallas}
                                                tiendas={unifiedTableData.tiendas}
                                                stockCentralPorTalla={unifiedTableData.stockCentralPorTalla}
                                            />
                                        </div>
                                    )}

                                    {/* Insights al final */}
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
