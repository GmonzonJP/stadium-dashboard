'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { WatchlistItem, WatchlistFilters, WatchlistResponse, WatchlistJobResultSummary } from '@/types/price-actions';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ArrowUp, ArrowDown, 
    Search, Loader2, Calculator, RefreshCw,
    ChevronLeft, ChevronRight, Play,
    TrendingDown, TrendingUp, Minus, AlertTriangle,
    CheckCircle, Clock, Settings, X, Calendar,
    Info, ImageOff
} from 'lucide-react';
import { cn, getProductImageUrl } from '@/lib/utils';
import { formatCurrency, formatPercent, formatNumber } from '@/lib/calculation-utils';
import { exportToXlsx, ExportColumn } from '@/lib/export-xlsx';
import { WatchlistProgressModal } from './WatchlistProgressModal';
import { useFilters } from '@/context/FilterContext';
import { ActiveFiltersTags } from '@/components/ActiveFiltersTags';
import { ExportButton } from '@/components/ExportButton';
import { EditablePriceCell } from '@/components/EditablePriceCell';
import { AddToPriceQueueModal } from '@/components/AddToPriceQueueModal';

// Tooltip component using Portal to escape overflow
function InfoTooltip({ text }: { text: string }) {
    const [show, setShow] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0 });
    const btnRef = useRef<HTMLButtonElement>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleEnter = () => {
        if (btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect();
            setPos({
                top: rect.bottom + 8,
                left: Math.max(120, Math.min(rect.left, window.innerWidth - 140))
            });
            setShow(true);
        }
    };

    const tooltip = show && mounted ? createPortal(
        <div
            style={{
                position: 'fixed',
                top: pos.top,
                left: pos.left,
                zIndex: 99999,
            }}
            className="bg-slate-800 border border-slate-600 rounded-lg shadow-2xl px-3 py-2 text-xs text-slate-200 w-56 text-left"
        >
            {text}
        </div>,
        document.body
    ) : null;

    return (
        <>
            <button
                ref={btnRef}
                type="button"
                onMouseEnter={handleEnter}
                onMouseLeave={() => setShow(false)}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEnter(); }}
                className="ml-1.5 text-slate-500 hover:text-blue-400 focus:outline-none"
            >
                <Info size={13} />
            </button>
            {tooltip}
        </>
    );
}

// Product image component with fallback
function ProductImage({ baseCol, descripcion }: { baseCol: string; descripcion?: string }) {
    const [hasError, setHasError] = useState(false);
    // URL de imágenes via proxy nginx
    const imageUrl = getProductImageUrl(baseCol);

    if (hasError) {
        return (
            <div className="w-20 h-20 bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
                <ImageOff size={24} className="text-slate-600" />
            </div>
        );
    }

    return (
        <div className="w-20 h-20 bg-white rounded-lg overflow-hidden flex-shrink-0 shadow-sm border border-slate-700">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={imageUrl}
                alt={descripcion || baseCol}
                className="w-full h-full object-contain"
                onError={() => setHasError(true)}
            />
        </div>
    );
}

// Column definitions with info tooltips
const COLUMN_INFO = {
    score: "Puntuación de prioridad (0-100). Mayor score = más urgente actuar. Combina índice de ritmo, días de stock, margen y volumen.",
    sku: "Código único del producto (BaseCol) y su descripción corta.",
    categoria: "Categoría, marca y banda de precio del producto.",
    precio: "Precio de venta actual y costo del producto (con IVA incluido).",
    stock: "Unidades disponibles en todas las tiendas.",
    ritmo: "Velocidad de venta actual (unidades/día). Cluster = promedio de productos similares.",
    indice: "Ritmo actual ÷ Ritmo del cluster. < 1 = vende menos que sus pares. Desacel = desaceleración vs inicio del ciclo.",
    diasStock: "Días estimados para agotar el stock al ritmo actual de venta.",
    motivo: "Razón por la que entró a la watchlist: Early (fracaso temprano), Desacelera, Sobrestock, Sin tracción."
};

interface WatchlistTableProps {
    onSimulatePrice?: (item: WatchlistItem) => void;
}

export function WatchlistTable({ onSimulatePrice }: WatchlistTableProps) {
    // Use shared filter context (same as Dashboard)
    const { selectedFilters, filterData, toggleFilter } = useFilters();
    
    // Data state
    const [data, setData] = useState<WatchlistResponse | null>(null);
    const [summary, setSummary] = useState<WatchlistJobResultSummary | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    
    // Loading and error state
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Job state
    const [currentJobId, setCurrentJobId] = useState<string | null>(null);
    const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
    
    // Configuration panel state
    const [showConfig, setShowConfig] = useState(true);
    
    // Calculation parameters (only days - filters come from context)
    const [ritmoVentanaDias, setRitmoVentanaDias] = useState(14);
    const [cycleDays, setCycleDays] = useState(90);
    
    // Pagination and filtering state
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [sortColumn, setSortColumn] = useState<keyof WatchlistItem>('score');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    // Price edit modal state
    const [priceEditData, setPriceEditData] = useState<{
        baseCol: string;
        descripcion: string;
        precioActual: number;
        precioNuevo: number;
    } | null>(null);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Build active filter count from context
    const activeFilterCount = [
        (selectedFilters.categories?.length || 0) > 0,
        (selectedFilters.brands?.length || 0) > 0,
        (selectedFilters.genders?.length || 0) > 0,
        (selectedFilters.stores?.length || 0) > 0
    ].filter(Boolean).length;

    // Start a new watchlist calculation job
    const startCalculation = async () => {
        setError(null);
        setIsLoading(true);
        setShowConfig(false);

        try {
            // Use filters from shared context
            const requestFilters: WatchlistFilters = {
                categories: selectedFilters.categories?.length ? selectedFilters.categories : undefined,
                brands: selectedFilters.brands?.length ? selectedFilters.brands : undefined,
                genders: selectedFilters.genders?.length ? selectedFilters.genders : undefined,
                stores: selectedFilters.stores?.length ? selectedFilters.stores : undefined,
                search: debouncedSearch || undefined
            };

            const response = await fetch('/api/price-actions/watchlist/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filters: requestFilters,
                    ritmoVentanaDias,
                    cycleDays
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.details || errorData.error || 'Error al iniciar cálculo');
            }

            const result = await response.json();
            setCurrentJobId(result.jobId);
            setIsProgressModalOpen(true);
        } catch (err) {
            console.error('Error starting calculation:', err);
            setError(err instanceof Error ? err.message : 'Error al iniciar cálculo');
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch results when job completes
    const fetchResults = async (jobId: string) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/price-actions/watchlist/result/${jobId}?page=${page}&pageSize=${pageSize}&sortColumn=${sortColumn}&sortDirection=${sortDirection}`);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.details || errorData.error || 'Error al obtener resultados');
            }

            const result = await response.json();
            setData({
                items: result.items,
                total: result.total,
                page: result.page,
                pageSize: result.pageSize,
                totalPages: result.totalPages
            });
            setSummary(result.summary || null);
            setLastUpdated(result.completedAt ? new Date(result.completedAt) : new Date());
            setIsProgressModalOpen(false);
        } catch (err) {
            console.error('Error fetching results:', err);
            setError(err instanceof Error ? err.message : 'Error al obtener resultados');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle job completion
    const handleJobComplete = (jobId: string) => {
        fetchResults(jobId);
    };

    // Handle job error
    const handleJobError = (errorMsg: string) => {
        setError(errorMsg);
        setIsProgressModalOpen(false);
    };

    // Handle page change, sort change, or pageSize change - fetch results with new parameters
    useEffect(() => {
        if (currentJobId && data) {
            fetchResults(currentJobId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, sortColumn, sortDirection, pageSize]);

    // Reset page when pageSize changes
    useEffect(() => {
        setPage(1);
    }, [pageSize]);

    // Handle sort - text columns default to ascending (A-Z), numeric columns to descending (high to low)
    const handleSort = useCallback((column: keyof WatchlistItem) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            // Text columns default to ascending (A-Z)
            const textColumns: (keyof WatchlistItem)[] = ['baseCol', 'categoria', 'marca'];
            setSortDirection(textColumns.includes(column) ? 'asc' : 'desc');
        }
    }, [sortColumn]);

    // Los items ya vienen ordenados del servidor
    const sortedItems = data?.items || [];

    const getSeverityColor = (indiceRitmo: number) => {
        if (indiceRitmo < 0.6) return 'text-red-400';
        if (indiceRitmo < 0.9) return 'text-orange-400';
        if (indiceRitmo < 1.1) return 'text-yellow-400';
        return 'text-green-400';
    };

    const getMotivoBadgeColor = (motivo: string) => {
        switch (motivo) {
            case 'Early': return 'bg-red-500/20 text-red-400 border-red-500/30';
            case 'Desacelera': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
            case 'Sobrestock': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case 'Sin tracción': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
            default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
        }
    };

    const formatTimeAgo = (date: Date): string => {
        const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
        if (seconds < 60) return `hace ${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `hace ${minutes}m`;
        const hours = Math.floor(minutes / 60);
        return `hace ${hours}h`;
    };

    return (
        <div className="space-y-4">
            {/* Progress Modal */}
            <WatchlistProgressModal
                jobId={currentJobId}
                isOpen={isProgressModalOpen}
                onClose={() => setIsProgressModalOpen(false)}
                onComplete={handleJobComplete}
                onError={handleJobError}
            />

            {/* Configuration Panel */}
            <AnimatePresence>
                {showConfig && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-slate-900/80 border border-slate-700 rounded-2xl overflow-hidden"
                    >
                        <div className="p-5 space-y-5">
                            {/* Config Header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center">
                                        <Settings className="text-blue-400" size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white">Configurar Análisis</h3>
                                        <p className="text-xs text-slate-500">Define los parámetros antes de calcular la watchlist</p>
                                    </div>
                                </div>
                                {data && (
                                    <button
                                        onClick={() => setShowConfig(false)}
                                        className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                                    >
                                        <X size={18} />
                                    </button>
                                )}
                            </div>

                            {/* Parameters Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Ventana de Ritmo */}
                                <div className="space-y-2">
                                    <label className="flex items-center space-x-2 text-sm font-medium text-slate-300">
                                        <Calendar size={16} className="text-blue-400" />
                                        <span>Ventana de Ritmo (días)</span>
                                    </label>
                                    <div className="flex gap-2">
                                        {[7, 14, 21, 28].map(days => (
                                            <button
                                                key={days}
                                                onClick={() => setRitmoVentanaDias(days)}
                                                className={cn(
                                                    "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all",
                                                    ritmoVentanaDias === days
                                                        ? "bg-blue-600 text-white"
                                                        : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
                                                )}
                                            >
                                                {days}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-slate-600">Período para calcular el ritmo actual de ventas</p>
                                </div>

                                {/* Días del Ciclo */}
                                <div className="space-y-2">
                                    <label className="flex items-center space-x-2 text-sm font-medium text-slate-300">
                                        <Clock size={16} className="text-purple-400" />
                                        <span>Ciclo de Venta (días)</span>
                                    </label>
                                    <div className="flex gap-2">
                                        {[60, 90, 120, 180].map(days => (
                                            <button
                                                key={days}
                                                onClick={() => setCycleDays(days)}
                                                className={cn(
                                                    "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all",
                                                    cycleDays === days
                                                        ? "bg-purple-600 text-white"
                                                        : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
                                                )}
                                            >
                                                {days}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-slate-600">Duración esperada del ciclo de venta</p>
                                </div>
                            </div>

                            {/* Active Filters Tags (from sidebar) */}
                            <div className="border-t border-slate-800 pt-4">
                                <div className="text-xs text-slate-500 mb-2">
                                    Filtros aplicados desde el panel lateral:
                                </div>
                                <ActiveFiltersTags
                                    selectedFilters={selectedFilters}
                                    filterData={filterData}
                                    onRemoveFilter={toggleFilter}
                                />
                                {activeFilterCount === 0 && (
                                    <p className="text-xs text-slate-600 italic mt-2">
                                        Sin filtros = analiza todo el catálogo. Usa el menú lateral para aplicar filtros.
                                    </p>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center justify-end pt-2 border-t border-slate-800">
                                <button
                                    onClick={startCalculation}
                                    disabled={isLoading}
                                    className={cn(
                                        "flex items-center space-x-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all",
                                        isLoading
                                            ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                                            : "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-500/25"
                                    )}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="animate-spin" size={18} />
                                            <span>Iniciando...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Play size={18} />
                                            <span>Calcular Watchlist</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header with Calculate Button (when config is closed) */}
            {!showConfig && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setShowConfig(true)}
                                className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-colors"
                            >
                                <Settings size={16} />
                                <span>Configurar</span>
                            </button>
                            
                            <button
                                onClick={startCalculation}
                                disabled={isLoading}
                                className={cn(
                                    "flex items-center space-x-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all",
                                    isLoading
                                        ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                                        : "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-500/25"
                                )}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="animate-spin" size={18} />
                                        <span>Iniciando...</span>
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw size={18} />
                                        <span>Recalcular</span>
                                    </>
                                )}
                            </button>

                            {lastUpdated && (
                                <div className="flex items-center space-x-2 text-xs text-slate-500">
                                    <Clock size={14} />
                                    <span>Actualizado: {formatTimeAgo(lastUpdated)}</span>
                                </div>
                            )}
                        </div>

                        {/* Days config info */}
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span className="px-2 py-1 bg-slate-800 rounded-lg">
                                Ritmo: {ritmoVentanaDias}d
                            </span>
                            <span className="px-2 py-1 bg-slate-800 rounded-lg">
                                Ciclo: {cycleDays}d
                            </span>
                        </div>
                    </div>
                    
                    {/* Active filters tags */}
                    <ActiveFiltersTags
                        selectedFilters={selectedFilters}
                        filterData={filterData}
                        onRemoveFilter={toggleFilter}
                    />
                </div>
            )}

            {/* Summary Cards */}
            {summary && (
                <div className="grid grid-cols-4 gap-4">
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                        <div className="text-2xl font-bold text-white">{summary.totalItems}</div>
                        <div className="text-xs text-slate-500">Total en Watchlist</div>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                        <div className="text-2xl font-bold text-red-400">{summary.criticalCount}</div>
                        <div className="text-xs text-slate-500">Críticos (Índice &lt; 0.6)</div>
                    </div>
                    <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
                        <div className="text-2xl font-bold text-orange-400">{summary.lowCount}</div>
                        <div className="text-xs text-slate-500">Bajos (0.6 - 0.9)</div>
                    </div>
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                        <div className="text-2xl font-bold text-slate-300">{summary.averageScore}</div>
                        <div className="text-xs text-slate-500">Score Promedio</div>
                    </div>
                </div>
            )}

            {/* Search and Filters */}
            {data && (
                <div className="flex items-center gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por SKU, descripción..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-900/50 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <ExportButton
                        onClick={() => {
                            const items = data?.items || [];
                            const cols: ExportColumn<WatchlistItem>[] = [
                                { header: 'Score', accessor: r => r.score },
                                { header: 'SKU', accessor: r => r.baseCol },
                                { header: 'Descripción', accessor: r => r.descripcionCorta || r.descripcion },
                                { header: 'Categoría', accessor: r => r.categoria },
                                { header: 'Marca', accessor: r => r.marca },
                                { header: 'Precio', accessor: r => r.precioActual },
                                { header: 'Costo', accessor: r => r.costo },
                                { header: 'Stock', accessor: r => r.stockTotal },
                                { header: 'Ritmo', accessor: r => Number(r.ritmoActual.toFixed(2)) },
                                { header: 'Índice', accessor: r => Number(r.indiceRitmo.toFixed(2)) },
                                { header: 'Días Stock', accessor: r => r.diasStock != null ? Math.round(r.diasStock) : null },
                                { header: 'Motivo', accessor: r => r.motivo.join(', ') },
                            ];
                            exportToXlsx(items, cols, 'watchlist-precios', 'Watchlist');
                        }}
                        disabled={!data?.items?.length}
                    />
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center space-x-3">
                    <AlertTriangle className="text-red-400" size={20} />
                    <p className="text-red-400 text-sm">{error}</p>
                </div>
            )}

            {/* Empty State */}
            {!data && !isLoading && !error && (
                <div className="text-center py-16 border-2 border-dashed border-slate-800 rounded-xl">
                    <div className="flex flex-col items-center space-y-4">
                        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center">
                            <Play className="text-slate-500" size={24} />
                        </div>
                        <div>
                            <p className="text-slate-400 font-medium">No hay datos de watchlist</p>
                            <p className="text-slate-600 text-sm mt-1">
                                Haz clic en &quot;Calcular Watchlist&quot; para comenzar el análisis
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Table */}
            {data && data.items.length > 0 && (
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                        <table className="w-full">
                            <thead className="bg-slate-800/90 border-b border-slate-700 sticky top-0 z-10 backdrop-blur-sm">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                        <button
                                            onClick={() => handleSort('score')}
                                            className={cn(
                                                "flex items-center space-x-1 hover:text-white transition-colors cursor-pointer",
                                                sortColumn === 'score' && "text-blue-400"
                                            )}
                                        >
                                            <span>Score</span>
                                            <InfoTooltip text={COLUMN_INFO.score} />
                                            {sortColumn === 'score' && (
                                                sortDirection === 'asc' ? <ArrowUp size={14} className="text-blue-400" /> : <ArrowDown size={14} className="text-blue-400" />
                                            )}
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                        <button
                                            onClick={() => handleSort('baseCol')}
                                            className={cn(
                                                "flex items-center space-x-1 hover:text-white transition-colors cursor-pointer",
                                                sortColumn === 'baseCol' && "text-blue-400"
                                            )}
                                        >
                                            <span>SKU / Descripción</span>
                                            <InfoTooltip text={COLUMN_INFO.sku} />
                                            {sortColumn === 'baseCol' && (
                                                sortDirection === 'asc' ? <ArrowUp size={14} className="text-blue-400" /> : <ArrowDown size={14} className="text-blue-400" />
                                            )}
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                        <button
                                            onClick={() => handleSort('categoria')}
                                            className={cn(
                                                "flex items-center space-x-1 hover:text-white transition-colors cursor-pointer",
                                                sortColumn === 'categoria' && "text-blue-400"
                                            )}
                                        >
                                            <span>Categoría / Marca</span>
                                            <InfoTooltip text={COLUMN_INFO.categoria} />
                                            {sortColumn === 'categoria' && (
                                                sortDirection === 'asc' ? <ArrowUp size={14} className="text-blue-400" /> : <ArrowDown size={14} className="text-blue-400" />
                                            )}
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                        <button
                                            onClick={() => handleSort('precioActual')}
                                            className={cn(
                                                "flex items-center space-x-1 hover:text-white transition-colors cursor-pointer",
                                                sortColumn === 'precioActual' && "text-blue-400"
                                            )}
                                        >
                                            <span>Precio / Costo</span>
                                            <InfoTooltip text={COLUMN_INFO.precio} />
                                            {sortColumn === 'precioActual' && (
                                                sortDirection === 'asc' ? <ArrowUp size={14} className="text-blue-400" /> : <ArrowDown size={14} className="text-blue-400" />
                                            )}
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                        <button
                                            onClick={() => handleSort('stockTotal')}
                                            className={cn(
                                                "flex items-center space-x-1 hover:text-white transition-colors cursor-pointer",
                                                sortColumn === 'stockTotal' && "text-blue-400"
                                            )}
                                        >
                                            <span>Stock</span>
                                            <InfoTooltip text={COLUMN_INFO.stock} />
                                            {sortColumn === 'stockTotal' && (
                                                sortDirection === 'asc' ? <ArrowUp size={14} className="text-blue-400" /> : <ArrowDown size={14} className="text-blue-400" />
                                            )}
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                        <button
                                            onClick={() => handleSort('ritmoActual')}
                                            className={cn(
                                                "flex items-center space-x-1 hover:text-white transition-colors cursor-pointer",
                                                sortColumn === 'ritmoActual' && "text-blue-400"
                                            )}
                                        >
                                            <span>Ritmo</span>
                                            <InfoTooltip text={COLUMN_INFO.ritmo} />
                                            {sortColumn === 'ritmoActual' && (
                                                sortDirection === 'asc' ? <ArrowUp size={14} className="text-blue-400" /> : <ArrowDown size={14} className="text-blue-400" />
                                            )}
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                        <button
                                            onClick={() => handleSort('indiceRitmo')}
                                            className={cn(
                                                "flex items-center space-x-1 hover:text-white transition-colors cursor-pointer",
                                                sortColumn === 'indiceRitmo' && "text-blue-400"
                                            )}
                                        >
                                            <span>Índice</span>
                                            <InfoTooltip text={COLUMN_INFO.indice} />
                                            {sortColumn === 'indiceRitmo' && (
                                                sortDirection === 'asc' ? <ArrowUp size={14} className="text-blue-400" /> : <ArrowDown size={14} className="text-blue-400" />
                                            )}
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                        <button
                                            onClick={() => handleSort('diasStock')}
                                            className={cn(
                                                "flex items-center space-x-1 hover:text-white transition-colors cursor-pointer",
                                                sortColumn === 'diasStock' && "text-blue-400"
                                            )}
                                        >
                                            <span>Días Stock</span>
                                            <InfoTooltip text={COLUMN_INFO.diasStock} />
                                            {sortColumn === 'diasStock' && (
                                                sortDirection === 'asc' ? <ArrowUp size={14} className="text-blue-400" /> : <ArrowDown size={14} className="text-blue-400" />
                                            )}
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                        <button
                                            onClick={() => handleSort('motivo')}
                                            className={cn(
                                                "flex items-center space-x-1 hover:text-white transition-colors cursor-pointer",
                                                sortColumn === 'motivo' && "text-blue-400"
                                            )}
                                        >
                                            <span>Motivo</span>
                                            <InfoTooltip text={COLUMN_INFO.motivo} />
                                            {sortColumn === 'motivo' && (
                                                sortDirection === 'asc' ? <ArrowUp size={14} className="text-blue-400" /> : <ArrowDown size={14} className="text-blue-400" />
                                            )}
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                        Acción
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {sortedItems.map((item, idx) => (
                                    <motion.tr
                                        key={item.baseCol}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.02 }}
                                        className="hover:bg-slate-800/30 transition-colors"
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center space-x-2">
                                                <span className={cn(
                                                    "font-bold text-lg w-10 text-center",
                                                    item.score >= 70 ? "text-red-400" :
                                                    item.score >= 50 ? "text-orange-400" :
                                                    item.score >= 30 ? "text-yellow-400" :
                                                    "text-slate-400"
                                                )}>
                                                    {item.score.toFixed(0)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <ProductImage baseCol={item.baseCol} descripcion={item.descripcionCorta} />
                                                <div className="flex flex-col min-w-0">
                                                    <span className="font-medium text-white text-sm">{item.baseCol}</span>
                                                    <span className="text-xs text-slate-500 truncate max-w-[200px]">
                                                        {item.descripcionCorta || item.descripcion}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col text-xs">
                                                <span className="text-slate-300">{item.categoria}</span>
                                                <span className="text-slate-500">{item.marca}</span>
                                                <span className="text-slate-600">{item.priceBand}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col text-xs">
                                                <EditablePriceCell
                                                    baseCol={item.baseCol}
                                                    descripcion={item.descripcionCorta || item.descripcion}
                                                    precio={item.precioActual}
                                                    onPriceEdit={setPriceEditData}
                                                    formatCurrency={formatCurrency}
                                                    className="justify-start"
                                                />
                                                <span className="text-slate-500 mt-1">Costo: {formatCurrency(item.costo)}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-sm text-white">{formatNumber(item.stockTotal)}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col text-xs">
                                                <span className="text-white">{formatNumber(item.ritmoActual, 2)}/día</span>
                                                <span className="text-slate-500">Cluster: {formatNumber(item.ritmoCluster, 2)}/día</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center space-x-1">
                                                {item.indiceRitmo < 0.9 ? (
                                                    <TrendingDown size={14} className="text-red-400" />
                                                ) : item.indiceRitmo > 1.1 ? (
                                                    <TrendingUp size={14} className="text-green-400" />
                                                ) : (
                                                    <Minus size={14} className="text-slate-500" />
                                                )}
                                                <span className={cn("text-sm font-medium", getSeverityColor(item.indiceRitmo))}>
                                                    {item.indiceRitmo.toFixed(2)}x
                                                </span>
                                            </div>
                                            {item.indiceDesaceleracion < 0.7 && (
                                                <div className="text-xs text-orange-400 mt-1">
                                                    Desacel: {item.indiceDesaceleracion.toFixed(2)}x
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={cn(
                                                "text-sm",
                                                item.diasStock !== null && item.diasStock > 45 ? "text-red-400" :
                                                item.diasStock !== null && item.diasStock > 30 ? "text-orange-400" :
                                                "text-slate-400"
                                            )}>
                                                {item.diasStock !== null ? formatNumber(item.diasStock) : '—'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-1">
                                                {item.motivo.map(m => (
                                                    <span
                                                        key={m}
                                                        className={cn(
                                                            "px-2 py-0.5 text-xs rounded-full border",
                                                            getMotivoBadgeColor(m)
                                                        )}
                                                    >
                                                        {m}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => onSimulatePrice?.(item)}
                                                className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
                                            >
                                                <Calculator size={14} />
                                                <span>Simular</span>
                                            </button>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="text-sm text-slate-500">
                                Mostrando {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, data.total)} de {data.total}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">Mostrar:</span>
                                <select
                                    value={pageSize}
                                    onChange={(e) => setPageSize(Number(e.target.value))}
                                    className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                >
                                    {PAGE_SIZE_OPTIONS.map(size => (
                                        <option key={size} value={size}>{size}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        {data.totalPages > 1 && (
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className={cn(
                                        "p-2 rounded-lg transition-colors",
                                        page === 1
                                            ? "bg-slate-800/50 text-slate-600 cursor-not-allowed"
                                            : "bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                                    )}
                                >
                                    <ChevronLeft size={18} />
                                </button>
                                <span className="text-sm text-slate-400">
                                    Página {page} de {data.totalPages}
                                </span>
                                <button
                                    onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                                    disabled={page === data.totalPages}
                                    className={cn(
                                        "p-2 rounded-lg transition-colors",
                                        page === data.totalPages
                                            ? "bg-slate-800/50 text-slate-600 cursor-not-allowed"
                                            : "bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                                    )}
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Empty Results State */}
            {data && data.items.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-xl">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                    <p className="text-slate-400 font-medium">No se encontraron productos en la watchlist</p>
                    <p className="text-slate-600 text-sm mt-1">
                        Todos los productos están vendiendo a un ritmo adecuado
                    </p>
                </div>
            )}

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
