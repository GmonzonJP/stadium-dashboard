'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useFilters } from '@/context/FilterContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ArrowUpDown, ArrowUp, ArrowDown, 
    ExternalLink, Search, Loader2,
    Info, ChevronLeft, ChevronRight,
    Package
} from 'lucide-react';
import { cn, getProductImageUrl } from '@/lib/utils';
import { ProductDetail } from './ProductDetail';
import { EditablePriceCell } from './EditablePriceCell';
import { AddToPriceQueueModal } from './AddToPriceQueueModal';

interface Product {
    BaseCol: string;
    DescripcionMarca: string;
    Descripcion: string;
    DescripcionCorta: string;
    unidades_vendidas: number;
    venta_total: number;
    precio_promedio_asp: number | null;
    ultimo_costo: number | null;
    pvp: number | null;
    ultima_compra_fecha: string | null;
    cantidad_ultima_compra: number | null;
    dias_desde_compra: number | null;
    stock_total: number;
    stock_pendiente: number;
    stock_on_hand: number;
    dias_stock: number | null;
    pares_por_dia: number | null;
    margen: number | null;
    markup: number | null;
    sell_through: number | null;
    semaforo: {
        color: 'red' | 'green' | 'black' | 'white';
        diasReales: number | null;
        diasEsperados: number | null;
        ritmoDiario: number | null;
        explanation: string;
    };
    duration_days: number;
}

interface ProductAnalysisResponse {
    products: Product[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
        hasMore: boolean;
    };
    duration_days: number;
    ventana_semaforo_dias: number;
    meta: {
        stockSource: string;
        aspFormula: string;
        margenFormula: string;
        markupFormula: string;
    };
}

type SortColumn = 
    | 'articulo' 
    | 'unidades_vendidas' 
    | 'stock_total' 
    | 'ultimo_costo' 
    | 'pvp' 
    | 'precio_promedio_asp' 
    | 'venta_total' 
    | 'margen' 
    | 'dias_stock' 
    | 'pares_por_dia'
    | 'semaforo';

const SEMAPHORE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
    red: { bg: 'bg-red-500', text: 'text-red-400', label: 'Sobrestock' },
    green: { bg: 'bg-emerald-500', text: 'text-emerald-400', label: 'Reponer' },
    black: { bg: 'bg-slate-600', text: 'text-slate-400', label: 'Normal' },
    white: { bg: 'bg-white border border-slate-500', text: 'text-slate-500', label: 'Sin Info' }
};

export function ProductAnalysisTable() {
    const { selectedFilters } = useFilters();
    const [data, setData] = useState<ProductAnalysisResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(25);

    // Price edit modal state
    const [priceEditData, setPriceEditData] = useState<{
        baseCol: string;
        descripcion: string;
        precioActual: number;
        precioNuevo: number;
    } | null>(null);

    // Sorting state
    const [sortColumn, setSortColumn] = useState<SortColumn>('venta_total');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Reset page when filters change
    useEffect(() => {
        setPage(1);
    }, [selectedFilters, debouncedSearch]);

    // Fetch data
    useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch('/api/products/analysis', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...selectedFilters,
                        search: debouncedSearch,
                        page,
                        pageSize
                    }),
                    cache: 'no-store'
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.details || errorData.error || 'Error al cargar datos');
                }

                const result = await response.json();
                setData(result);
            } catch (err) {
                console.error('Error fetching product analysis:', err);
                setError(err instanceof Error ? err.message : 'Error al cargar datos');
            } finally {
                setIsLoading(false);
            }
        }

        fetchData();
    }, [selectedFilters, debouncedSearch, page, pageSize]);

    // Handle sorting
    const handleSort = useCallback((column: SortColumn) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('desc');
        }
    }, [sortColumn]);

    // Sort data locally
    const sortedProducts = data?.products ? [...data.products].sort((a, b) => {
        let aVal: any;
        let bVal: any;

        switch (sortColumn) {
            case 'articulo':
                aVal = `${a.DescripcionMarca} ${a.DescripcionCorta}`.toLowerCase();
                bVal = `${b.DescripcionMarca} ${b.DescripcionCorta}`.toLowerCase();
                break;
            case 'unidades_vendidas':
                aVal = a.unidades_vendidas;
                bVal = b.unidades_vendidas;
                break;
            case 'stock_total':
                aVal = a.stock_total;
                bVal = b.stock_total;
                break;
            case 'ultimo_costo':
                aVal = a.ultimo_costo || 0;
                bVal = b.ultimo_costo || 0;
                break;
            case 'pvp':
                aVal = a.pvp || 0;
                bVal = b.pvp || 0;
                break;
            case 'precio_promedio_asp':
                aVal = a.precio_promedio_asp || 0;
                bVal = b.precio_promedio_asp || 0;
                break;
            case 'venta_total':
                aVal = a.venta_total;
                bVal = b.venta_total;
                break;
            case 'margen':
                aVal = a.margen || 0;
                bVal = b.margen || 0;
                break;
            case 'dias_stock':
                aVal = a.dias_stock || 999999;
                bVal = b.dias_stock || 999999;
                break;
            case 'pares_por_dia':
                aVal = a.pares_por_dia || 0;
                bVal = b.pares_por_dia || 0;
                break;
            case 'semaforo':
                const order = { red: 1, green: 2, black: 3, white: 4 };
                aVal = order[a.semaforo.color] || 5;
                bVal = order[b.semaforo.color] || 5;
                break;
            default:
                return 0;
        }

        if (typeof aVal === 'string' && typeof bVal === 'string') {
            return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }) : [];

    // Filter by search locally (additional filtering)
    const filteredProducts = sortedProducts.filter(p => {
        if (!debouncedSearch) return true;
        const search = debouncedSearch.toLowerCase();
        return (
            p.BaseCol.toLowerCase().includes(search) ||
            p.DescripcionMarca.toLowerCase().includes(search) ||
            p.DescripcionCorta?.toLowerCase().includes(search) ||
            p.Descripcion?.toLowerCase().includes(search)
        );
    });

    const formatCurrency = (value: number | null) => {
        if (value == null) return '—';
        return `$${value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    };

    const formatNumber = (value: number | null, decimals: number = 0) => {
        if (value == null) return '—';
        return value.toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    };

    const SortHeader = ({ column, label, align = 'right' }: { column: SortColumn; label: string; align?: 'left' | 'right' | 'center' }) => (
        <th className={cn("p-3 text-xs font-bold text-slate-500 uppercase tracking-wider", `text-${align}`)}>
            <button
                onClick={() => handleSort(column)}
                className={cn(
                    "flex items-center gap-1 hover:text-white transition-colors",
                    align === 'right' && "justify-end w-full",
                    align === 'center' && "justify-center w-full"
                )}
            >
                <span>{label}</span>
                {sortColumn === column ? (
                    sortDirection === 'asc' ? <ArrowUp size={12} className="text-blue-400" /> : <ArrowDown size={12} className="text-blue-400" />
                ) : (
                    <ArrowUpDown size={12} className="opacity-50" />
                )}
            </button>
        </th>
    );

    return (
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Package className="text-blue-500" size={20} />
                    <div>
                        <h3 className="text-white font-bold">Análisis de Productos</h3>
                        <p className="text-xs text-slate-500">
                            Stock desde MovStockTotalResumen · ASP = Ventas/Unidades
                        </p>
                    </div>
                </div>
                
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input
                        type="text"
                        placeholder="Buscar producto..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-2 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[1400px]">
                    <thead className="bg-slate-800/30 sticky top-0 z-10">
                        <tr>
                            <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-10">Img</th>
                            <SortHeader column="articulo" label="Artículo" align="left" />
                            <SortHeader column="unidades_vendidas" label="Unid." />
                            <SortHeader column="stock_total" label="Stock" />
                            <SortHeader column="ultimo_costo" label="Costo" />
                            <SortHeader column="pvp" label="PVP" />
                            <SortHeader column="precio_promedio_asp" label="ASP" />
                            <SortHeader column="venta_total" label="Venta $" />
                            <SortHeader column="margen" label="Margen" />
                            <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Markup</th>
                            <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Últ. Compra</th>
                            <SortHeader column="dias_stock" label="Días Stock" align="center" />
                            <SortHeader column="pares_por_dia" label="Par/Día" align="center" />
                            <SortHeader column="semaforo" label="Semáforo" align="center" />
                            <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Acción</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {isLoading ? (
                            <tr>
                                <td colSpan={15} className="p-12 text-center">
                                    <Loader2 className="animate-spin text-blue-500 mx-auto" size={32} />
                                    <p className="text-slate-500 mt-2 text-sm">Cargando productos...</p>
                                </td>
                            </tr>
                        ) : error ? (
                            <tr>
                                <td colSpan={15} className="p-12 text-center">
                                    <p className="text-red-400 font-medium">{error}</p>
                                    <button
                                        onClick={() => window.location.reload()}
                                        className="mt-2 text-sm text-blue-400 hover:text-blue-300"
                                    >
                                        Reintentar
                                    </button>
                                </td>
                            </tr>
                        ) : filteredProducts.length === 0 ? (
                            <tr>
                                <td colSpan={15} className="p-12 text-center text-slate-500 italic">
                                    No se encontraron productos
                                </td>
                            </tr>
                        ) : (
                            filteredProducts.map((product, idx) => (
                                <motion.tr
                                    key={product.BaseCol}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: idx * 0.02 }}
                                    className="hover:bg-slate-800/30 transition-colors group"
                                >
                                    {/* Imagen */}
                                    <td className="p-2">
                                        <button
                                            onClick={() => setSelectedProductId(product.BaseCol)}
                                            className="w-10 h-10 bg-white rounded-lg overflow-hidden border border-slate-700 group-hover:border-blue-500/50 transition-all"
                                        >
                                            <img
                                                src={getProductImageUrl(product.BaseCol)}
                                                alt={product.BaseCol}
                                                className="w-full h-full object-contain"
                                                onError={(e) => {
                                                    e.currentTarget.src = 'https://placehold.co/80x80/1e293b/475569?text=IMG';
                                                }}
                                            />
                                        </button>
                                    </td>
                                    
                                    {/* Artículo */}
                                    <td className="p-3">
                                        <button
                                            onClick={() => setSelectedProductId(product.BaseCol)}
                                            className="text-left group/text"
                                        >
                                            <div className="font-bold text-white group-hover/text:text-blue-400 transition-colors text-sm">
                                                {product.DescripcionMarca}
                                            </div>
                                            <div className="text-xs text-slate-400 truncate max-w-[200px]">
                                                {product.DescripcionCorta || product.Descripcion}
                                            </div>
                                            <div className="text-xs text-slate-600 font-mono">{product.BaseCol}</div>
                                        </button>
                                    </td>
                                    
                                    {/* Unidades */}
                                    <td className="p-3 text-right font-mono text-white font-bold tabular-nums">
                                        {formatNumber(product.unidades_vendidas)}
                                    </td>
                                    
                                    {/* Stock */}
                                    <td className="p-3 text-right">
                                        <span className={cn(
                                            "font-mono tabular-nums font-bold",
                                            product.stock_total > 0 ? "text-emerald-400" : "text-slate-500"
                                        )}>
                                            {formatNumber(product.stock_total)}
                                        </span>
                                        {product.stock_pendiente > 0 && (
                                            <span className="text-xs text-blue-400 ml-1" title="Pendiente">
                                                +{product.stock_pendiente}
                                            </span>
                                        )}
                                    </td>
                                    
                                    {/* Costo */}
                                    <td className="p-3 text-right font-mono text-slate-400 tabular-nums text-sm">
                                        {formatCurrency(product.ultimo_costo)}
                                    </td>
                                    
                                    {/* PVP */}
                                    <td className="p-3 text-right">
                                        <EditablePriceCell
                                            baseCol={product.BaseCol}
                                            descripcion={`${product.DescripcionMarca} ${product.DescripcionCorta || product.Descripcion}`}
                                            precio={product.pvp}
                                            onPriceEdit={setPriceEditData}
                                            formatCurrency={formatCurrency}
                                        />
                                    </td>
                                    
                                    {/* ASP */}
                                    <td className="p-3 text-right">
                                        <span className="font-mono text-blue-400 tabular-nums font-bold text-sm" title="Precio Promedio = Ventas / Unidades">
                                            {formatCurrency(product.precio_promedio_asp)}
                                        </span>
                                    </td>
                                    
                                    {/* Venta Total */}
                                    <td className="p-3 text-right font-mono text-emerald-400 tabular-nums font-bold">
                                        {formatCurrency(product.venta_total)}
                                    </td>
                                    
                                    {/* Margen */}
                                    <td className="p-3 text-right">
                                        <div 
                                            className={cn(
                                                "inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold",
                                                product.margen != null && product.margen >= 30 
                                                    ? "bg-emerald-500/10 text-emerald-400"
                                                    : product.margen != null && product.margen >= 15
                                                    ? "bg-blue-500/10 text-blue-400"
                                                    : "bg-red-500/10 text-red-400"
                                            )}
                                            title="(Precio - Costo) / Precio × 100"
                                        >
                                            {product.margen != null ? `${product.margen.toFixed(1)}%` : '—'}
                                        </div>
                                    </td>
                                    
                                    {/* Markup */}
                                    <td className="p-3 text-right text-xs text-slate-500 font-mono" title="(Precio - Costo) / Costo × 100">
                                        {product.markup != null ? `${product.markup.toFixed(1)}%` : '—'}
                                    </td>
                                    
                                    {/* Última Compra */}
                                    <td className="p-3 text-center text-xs text-slate-400">
                                        {product.ultima_compra_fecha 
                                            ? new Date(product.ultima_compra_fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
                                            : '—'
                                        }
                                    </td>
                                    
                                    {/* Días Stock */}
                                    <td className="p-3 text-center">
                                        <span className={cn(
                                            "text-xs font-bold px-2 py-1 rounded-full tabular-nums",
                                            product.dias_stock != null && product.dias_stock > 180 
                                                ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                                : product.dias_stock != null && product.dias_stock > 90
                                                ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                                                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                        )}>
                                            {product.dias_stock != null ? formatNumber(product.dias_stock) : '—'}
                                        </span>
                                    </td>
                                    
                                    {/* Pares por Día */}
                                    <td className="p-3 text-center text-xs text-slate-400 font-mono tabular-nums">
                                        {product.pares_por_dia != null ? product.pares_por_dia.toFixed(2) : '—'}
                                    </td>
                                    
                                    {/* Semáforo */}
                                    <td className="p-3 text-center">
                                        <div className="group/semaphore relative inline-block">
                                            <div 
                                                className={cn(
                                                    "w-5 h-5 rounded-full mx-auto cursor-help",
                                                    SEMAPHORE_COLORS[product.semaforo.color].bg
                                                )}
                                                title={product.semaforo.explanation}
                                            />
                                            {/* Tooltip */}
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/semaphore:block z-50">
                                                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl w-64 text-left">
                                                    <div className={cn("font-bold text-sm mb-1", SEMAPHORE_COLORS[product.semaforo.color].text)}>
                                                        {SEMAPHORE_COLORS[product.semaforo.color].label}
                                                    </div>
                                                    <p className="text-xs text-slate-400 leading-relaxed">
                                                        {product.semaforo.explanation}
                                                    </p>
                                                    {product.semaforo.diasReales != null && (
                                                        <div className="mt-2 pt-2 border-t border-slate-700 grid grid-cols-2 gap-2 text-xs">
                                                            <div>
                                                                <span className="text-slate-500">Días reales:</span>
                                                                <span className="text-white ml-1">{product.semaforo.diasReales}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-slate-500">Esperados:</span>
                                                                <span className="text-white ml-1">{product.semaforo.diasEsperados || '—'}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-slate-500">Ritmo:</span>
                                                                <span className="text-white ml-1">{product.semaforo.ritmoDiario?.toFixed(2) || '—'}/día</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    
                                    {/* Acción */}
                                    <td className="p-3 text-center">
                                        <a
                                            href={`/producto/${product.BaseCol}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 bg-slate-800/50 hover:bg-blue-600 rounded-lg transition-all text-slate-400 hover:text-white inline-flex items-center justify-center"
                                            title="Ver detalle (nueva pestaña)"
                                        >
                                            <ExternalLink size={14} />
                                        </a>
                                    </td>
                                </motion.tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {data && data.pagination && data.pagination.totalPages > 1 && (
                <div className="p-4 border-t border-slate-800 flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                        Mostrando {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, data.pagination.total)} de {data.pagination.total} productos
                    </p>
                    
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-slate-400 hover:text-white transition-colors"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        
                        <span className="text-sm text-slate-400 px-3">
                            Página {page} de {data.pagination.totalPages}
                        </span>
                        
                        <button
                            onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                            disabled={!data.pagination.hasMore}
                            className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-slate-400 hover:text-white transition-colors"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Legend */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/30">
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                    <span className="font-medium text-slate-400">Semáforo:</span>
                    {Object.entries(SEMAPHORE_COLORS).map(([color, config]) => (
                        <div key={color} className="flex items-center gap-1.5">
                            <div className={cn("w-3 h-3 rounded-full", config.bg)} />
                            <span>{config.label}</span>
                        </div>
                    ))}
                    <span className="text-slate-600 ml-2">|</span>
                    <span className="flex items-center gap-1">
                        <Info size={12} />
                        Hover sobre semáforo para más detalles
                    </span>
                </div>
            </div>

            {/* Product Detail Modal */}
            <ProductDetail
                productId={selectedProductId}
                onClose={() => setSelectedProductId(null)}
            />

            {/* Add to Price Queue Modal */}
            {priceEditData && (
                <AddToPriceQueueModal
                    isOpen={true}
                    onClose={() => setPriceEditData(null)}
                    baseCol={priceEditData.baseCol}
                    descripcion={priceEditData.descripcion}
                    precioActual={priceEditData.precioActual}
                    precioNuevo={priceEditData.precioNuevo}
                    onSuccess={() => setPriceEditData(null)}
                />
            )}
        </div>
    );
}
