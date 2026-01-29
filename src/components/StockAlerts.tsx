'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Package, Store, TrendingUp, X, ExternalLink, ChevronRight, ChevronLeft, Eye } from 'lucide-react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { useFilters } from '@/context/FilterContext';
import { ProductDetail } from './ProductDetail';

interface StockAlert {
    baseCol: string;
    descripcion: string;
    totalUnidadesVendidas: number;
    totalImporteVenta: number;
    centralStock: number;
    centralDescripcion: string;
    problema: {
        tipo: string;
        severidad: 'alta' | 'media' | 'baja';
        tiendasAfectadas: number;
        tiendas?: Array<{
            id: number;
            descripcion: string;
            unidadesVendidas: number;
            stock: number;
            porcentajeVentas?: string;
        }>;
        tiendasNecesitanStock?: Array<{
            id: number;
            descripcion: string;
            unidadesVendidas: number;
            stock: number;
            porcentajeVentas: string;
            tipo: string;
        }>;
        tiendasConExceso?: Array<{
            id: number;
            descripcion: string;
            unidadesVendidas: number;
            stock: number;
            porcentajeVentas: string;
            tipo: string;
        }>;
        totalExcessStock?: number;
        totalNeededStock?: number;
    };
}

interface StockAlertsData {
    alerts: StockAlert[];
    totalProductsAnalyzed: number;
    statistics?: {
        productsWithCentralStock: number;
        productsWithStoreSales: number;
        productsWithHighRotationStores: number;
        totalStockRecords: number;
        totalSalesRecords: number;
    };
    dateRange: {
        start: string;
        end: string;
    };
}

interface StockAlertsProps {
    onProductClick?: (productId: string) => void;
}

export function StockAlerts({ onProductClick }: StockAlertsProps) {
    const { selectedFilters } = useFilters();
    const [data, setData] = useState<StockAlertsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isExpanded, setIsExpanded] = useState(true);
    const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
    const [selectedAlertIndex, setSelectedAlertIndex] = useState<number | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

    useEffect(() => {
        async function fetchAlerts() {
            setIsLoading(true);
            setData(null); // Clear previous data while loading
            try {
                const response = await fetch('/api/insights/stock-alerts', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-cache'
                    },
                    body: JSON.stringify(selectedFilters),
                    cache: 'no-store'
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    console.error('Failed to fetch stock alerts:', errorData);
                    setData({
                        alerts: [],
                        totalProductsAnalyzed: 0,
                        dateRange: {
                            start: selectedFilters.startDate || '',
                            end: selectedFilters.endDate || ''
                        }
                    });
                    return;
                }

                const result = await response.json();
                console.log('Stock alerts result:', {
                    alertsCount: result.alerts?.length || 0,
                    totalProducts: result.totalProductsAnalyzed || 0,
                    hasError: !!result.error
                });
                setData(result);
            } catch (err) {
                console.error('Error fetching stock alerts:', err);
                setData({
                    alerts: [],
                    totalProductsAnalyzed: 0,
                    dateRange: {
                        start: selectedFilters.startDate || '',
                        end: selectedFilters.endDate || ''
                    }
                });
            } finally {
                setIsLoading(false);
            }
        }

        fetchAlerts();
    }, [selectedFilters]);

    const getSeverityColor = (severidad: string) => {
        switch (severidad) {
            case 'alta':
                return 'bg-red-500/20 border-red-500/40 text-red-400';
            case 'media':
                return 'bg-orange-500/20 border-orange-500/40 text-orange-400';
            case 'baja':
                return 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400';
            default:
                return 'bg-slate-500/20 border-slate-500/40 text-slate-400';
        }
    };

    const getSeverityBadge = (severidad: string) => {
        const colors = {
            alta: 'bg-red-500 text-white',
            media: 'bg-orange-500 text-white',
            baja: 'bg-yellow-500 text-slate-900'
        };
        return colors[severidad as keyof typeof colors] || 'bg-slate-500 text-white';
    };

    if (isLoading) {
        return (
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl"
            >
                <div className="flex items-center space-x-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
                    <p className="text-slate-400 text-sm">Analizando stock de productos top...</p>
                </div>
            </motion.div>
        );
    }

    if (!data || data.alerts.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-green-500/10 border border-green-500/20 p-6 rounded-2xl"
            >
                <div className="flex items-center space-x-3">
                    <Package className="text-green-400" size={20} />
                    <div>
                        <p className="text-green-400 font-semibold">Todo en orden</p>
                        <p className="text-green-500/70 text-sm">
                            No se detectaron problemas de distribución de stock en los {(data && data.totalProductsAnalyzed) || 0} productos más vendidos
                        </p>
                    </div>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            data-stock-alerts
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden"
        >
            <div 
                className="p-6 cursor-pointer hover:bg-slate-800/50 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-red-500/20 rounded-lg">
                            <AlertTriangle className="text-red-400" size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">
                                Alertas de Stock
                            </h3>
                            <p className="text-sm text-slate-400">
                                {data.alerts.length} producto{data.alerts.length !== 1 ? 's' : ''} con problemas de distribución
                                {data.dateRange && (
                                    <span className="ml-2">
                                        • {new Date(data.dateRange.start).toLocaleDateString('es-AR')} - {new Date(data.dateRange.end).toLocaleDateString('es-AR')}
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <span className="text-xs text-slate-500">
                            {data.totalProductsAnalyzed} productos analizados
                        </span>
                        <X 
                            className={`text-slate-500 transition-transform ${isExpanded ? 'rotate-45' : ''}`} 
                            size={18} 
                        />
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="px-6 pb-6">
                            {/* Vista de tarjetas con swipe */}
                            <div className="relative overflow-hidden min-h-[400px]">
                                {data.alerts.map((alert, index) => {
                                    const isActive = selectedAlertIndex === index || (selectedAlertIndex === null && index === 0);
                                    
                                    const getInsight = () => {
                                        if (alert.problema.tipo === 'stock_central_sin_distribucion') {
                                            return 'Este producto tiene stock disponible en el depósito central pero las tiendas con mayor rotación no tienen stock. Considera redistribuir desde el central.';
                                        } else if (alert.problema.tipo === 'stock_desbalanceado_entre_tiendas') {
                                            return 'Este producto se vende muy bien en algunas tiendas pero tiene bajo movimiento en otras. Hay exceso de stock en tiendas con baja rotación y falta stock en tiendas con alta rotación. Considera redistribuir stock entre tiendas.';
                                        }
                                        return '';
                                    };

                                    return (
                                        <AnimatePresence key={alert.baseCol}>
                                            {isActive && (
                                                <motion.div
                                                    initial={{ opacity: 0, x: 100 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: -100 }}
                                                    drag="x"
                                                    dragConstraints={{ left: 0, right: 0 }}
                                                    dragElastic={0.2}
                                                    onDragEnd={(e, info: PanInfo) => {
                                                        if (info.offset.x < -100 && index < data.alerts.length - 1) {
                                                            setSelectedAlertIndex(index + 1);
                                                        } else if (info.offset.x > 100 && index > 0) {
                                                            setSelectedAlertIndex(index - 1);
                                                        }
                                                    }}
                                                    className={`border rounded-xl p-5 ${getSeverityColor(alert.problema.severidad)} cursor-grab active:cursor-grabbing`}
                                                >
                                                    {/* Header con BaseCol y severidad */}
                                                    <div className="flex items-start justify-between mb-4">
                                                        <div className="flex-1">
                                                            <div className="flex items-center space-x-2 mb-2">
                                                                <span className="text-white font-bold text-lg font-mono">
                                                                    {alert.baseCol}
                                                                </span>
                                                                <span className={`px-2 py-1 rounded text-xs font-bold ${getSeverityBadge(alert.problema.severidad)}`}>
                                                                    {alert.problema.severidad.toUpperCase()}
                                                                </span>
                                                            </div>
                                                            <p className="text-sm text-slate-300 mb-3">
                                                                {alert.descripcion || alert.baseCol}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Insight destacado */}
                                                    <div className="mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                                                        <p className="text-xs text-slate-300 leading-relaxed">
                                                            <span className="text-yellow-400 mr-2">💡</span>
                                                            <strong className="text-white">Insight:</strong> {getInsight()}
                                                        </p>
                                                    </div>

                                                    {/* Métricas rápidas */}
                                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                                        <div className="flex items-center space-x-2 text-xs">
                                                            <TrendingUp size={14} className="text-slate-400" />
                                                            <div>
                                                                <p className="text-slate-400">Ventas</p>
                                                                <p className="text-white font-bold">{alert.totalUnidadesVendidas.toLocaleString()} unidades</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center space-x-2 text-xs">
                                                            <Package size={14} className="text-blue-400" />
                                                            <div>
                                                                <p className="text-slate-400">Stock Central</p>
                                                                <p className="text-blue-300 font-bold">{alert.centralStock.toLocaleString()}</p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Botón Ver Más */}
                                                    <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedProductId(alert.baseCol);
                                                                setShowDetailModal(true);
                                                            }}
                                                            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm font-semibold"
                                                        >
                                                            <Eye size={16} />
                                                            <span>Ver más</span>
                                                        </button>
                                                        {data.alerts.length > 1 && (
                                                            <div className="flex items-center space-x-2 text-xs text-slate-400">
                                                                <button
                                                                    onClick={() => index > 0 && setSelectedAlertIndex(index - 1)}
                                                                    disabled={index === 0}
                                                                    className="p-1 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 rounded"
                                                                >
                                                                    <ChevronLeft size={16} />
                                                                </button>
                                                                <span>{index + 1} / {data.alerts.length}</span>
                                                                <button
                                                                    onClick={() => index < data.alerts.length - 1 && setSelectedAlertIndex(index + 1)}
                                                                    disabled={index === data.alerts.length - 1}
                                                                    className="p-1 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 rounded"
                                                                >
                                                                    <ChevronRight size={16} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Indicador de swipe */}
                                                    {data.alerts.length > 1 && (
                                                        <div className="mt-3 text-center">
                                                            <p className="text-xs text-slate-500">Desliza a la derecha para siguiente alerta →</p>
                                                        </div>
                                                    )}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    );
                                })}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Modal de detalles completos */}
            <AnimatePresence>
                {showDetailModal && selectedProductId && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => {
                                setShowDetailModal(false);
                                setSelectedProductId(null);
                            }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100]"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="fixed inset-4 bg-slate-900 rounded-3xl z-[110] shadow-2xl flex flex-col overflow-hidden border border-slate-800"
                        >
                            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                                <h2 className="text-2xl font-bold text-white">Detalle de Alerta</h2>
                                <button
                                    onClick={() => {
                                        setShowDetailModal(false);
                                        setSelectedProductId(null);
                                    }}
                                    className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6">
                                {data?.alerts.find(a => a.baseCol === selectedProductId) && (() => {
                                    const alert = data.alerts.find(a => a.baseCol === selectedProductId)!;
                                    return (
                                        <div className="space-y-6">
                                            {/* Información del producto */}
                                            <div className={`border rounded-xl p-5 ${getSeverityColor(alert.problema.severidad)}`}>
                                                <div className="flex items-start justify-between mb-4">
                                                    <div className="flex-1">
                                                        <div className="flex items-center space-x-2 mb-2">
                                                            <span className="text-white font-bold text-xl font-mono">
                                                                {alert.baseCol}
                                                            </span>
                                                            <span className={`px-2 py-1 rounded text-xs font-bold ${getSeverityBadge(alert.problema.severidad)}`}>
                                                                {alert.problema.severidad.toUpperCase()}
                                                            </span>
                                                        </div>
                                                        <p className="text-lg text-slate-300 mb-3">
                                                            {alert.descripcion || alert.baseCol}
                                                        </p>
                                                    </div>
                                                </div>

                                                {alert.problema.tipo === 'stock_central_sin_distribucion' && alert.problema.tiendas && (
                                        <>
                                            <div className="mt-3 pt-3 border-t border-slate-700/50">
                                                <div className="flex items-center space-x-2 mb-3">
                                                    <Store size={14} className="text-slate-400" />
                                                    <span className="text-sm font-semibold text-slate-300">
                                                        {alert.problema.tiendasAfectadas} tienda{alert.problema.tiendasAfectadas !== 1 ? 's' : ''} con alta rotación y stock insuficiente:
                                                    </span>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-xs border-collapse">
                                                        <thead>
                                                            <tr className="border-b border-slate-700/50">
                                                                <th className="text-left p-2 text-slate-400 font-semibold sticky left-0 bg-slate-900/95 z-10">Tienda</th>
                                                                <th className="text-right p-2 text-slate-400 font-semibold">Ventas</th>
                                                                <th className="text-right p-2 text-slate-400 font-semibold">% Ventas</th>
                                                                <th className="text-right p-2 text-slate-400 font-semibold">Stock</th>
                                                                <th className="text-center p-2 text-slate-400 font-semibold">Estado</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {alert.problema.tiendas.map((tienda, idx) => (
                                                                <tr 
                                                                    key={tienda.id}
                                                                    className="border-b border-slate-700/20 hover:bg-slate-800/30"
                                                                >
                                                                    <td className="p-2 text-slate-300 font-medium sticky left-0 bg-slate-900/95 z-10">
                                                                        {tienda.descripcion}
                                                                        <span className="text-slate-500 ml-1">#{tienda.id}</span>
                                                                    </td>
                                                                    <td className="p-2 text-right text-slate-400 font-mono">
                                                                        {tienda.unidadesVendidas.toLocaleString()}
                                                                    </td>
                                                                    <td className="p-2 text-right text-slate-400/80">
                                                                        {tienda.porcentajeVentas || '0.0'}%
                                                                    </td>
                                                                    <td className="p-2 text-right">
                                                                        <span className={`font-bold font-mono ${
                                                                            tienda.stock === 0 ? 'text-red-400' : 
                                                                            tienda.stock < 5 ? 'text-orange-400' : 
                                                                            'text-yellow-400'
                                                                        }`}>
                                                                            {tienda.stock}
                                                                        </span>
                                                                    </td>
                                                                    <td className="p-2 text-center">
                                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                                            tienda.stock === 0 
                                                                                ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                                                                                : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                                                                        }`}>
                                                                            {tienda.stock === 0 ? 'SIN STOCK' : 'BAJO STOCK'}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                            <div className="mt-3 pt-3 border-t border-slate-700/50">
                                                <p className="text-xs text-slate-400 italic">
                                                    💡 <strong>Insight:</strong> Este producto tiene stock disponible en el depósito central 
                                                    pero las tiendas con mayor rotación no tienen stock. Considera redistribuir desde el central.
                                                </p>
                                            </div>
                                        </>
                                    )}

                                                {alert.problema.tipo === 'stock_desbalanceado_entre_tiendas' && (
                                        <>
                                            <div className="mt-3 pt-3 border-t border-slate-700/50">
                                                {/* Matriz compacta de tiendas */}
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-xs border-collapse">
                                                        <thead>
                                                            <tr className="border-b border-slate-700/50">
                                                                <th className="text-left p-2 text-slate-400 font-semibold sticky left-0 bg-slate-900/95 z-10">Tienda</th>
                                                                <th className="text-right p-2 text-slate-400 font-semibold">Ventas</th>
                                                                <th className="text-right p-2 text-slate-400 font-semibold">% Ventas</th>
                                                                <th className="text-right p-2 text-slate-400 font-semibold">Stock</th>
                                                                <th className="text-center p-2 text-slate-400 font-semibold">Estado</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {/* Tiendas que necesitan stock */}
                                                            {alert.problema.tiendasNecesitanStock?.map((tienda, idx) => (
                                                                <tr 
                                                                    key={`need-${tienda.id}`}
                                                                    className="border-b border-red-900/20 hover:bg-red-900/10"
                                                                >
                                                                    <td className="p-2 text-red-300 font-medium sticky left-0 bg-slate-900/95 z-10">
                                                                        {tienda.descripcion}
                                                                        <span className="text-red-500/70 ml-1">#{tienda.id}</span>
                                                                    </td>
                                                                    <td className="p-2 text-right text-red-400 font-mono">
                                                                        {tienda.unidadesVendidas.toLocaleString()}
                                                                    </td>
                                                                    <td className="p-2 text-right text-red-400/80">
                                                                        {tienda.porcentajeVentas}%
                                                                    </td>
                                                                    <td className="p-2 text-right">
                                                                        <span className={`font-bold font-mono ${
                                                                            tienda.stock < 0 ? 'text-red-500' : 
                                                                            tienda.stock === 0 ? 'text-red-400' : 
                                                                            'text-red-300'
                                                                        }`}>
                                                                            {tienda.stock}
                                                                        </span>
                                                                    </td>
                                                                    <td className="p-2 text-center">
                                                                        <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold">
                                                                            NECESITA
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                            {/* Tiendas con exceso */}
                                                            {alert.problema.tiendasConExceso?.map((tienda, idx) => (
                                                                <tr 
                                                                    key={`excess-${tienda.id}`}
                                                                    className="border-b border-orange-900/20 hover:bg-orange-900/10"
                                                                >
                                                                    <td className="p-2 text-orange-300 font-medium sticky left-0 bg-slate-900/95 z-10">
                                                                        {tienda.descripcion}
                                                                        <span className="text-orange-500/70 ml-1">#{tienda.id}</span>
                                                                    </td>
                                                                    <td className="p-2 text-right text-orange-400 font-mono">
                                                                        {tienda.unidadesVendidas.toLocaleString()}
                                                                    </td>
                                                                    <td className="p-2 text-right text-orange-400/80">
                                                                        {tienda.porcentajeVentas}%
                                                                    </td>
                                                                    <td className="p-2 text-right">
                                                                        <span className="font-bold font-mono text-orange-400">
                                                                            {tienda.stock}
                                                                        </span>
                                                                    </td>
                                                                    <td className="p-2 text-center">
                                                                        <span className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[10px] font-bold">
                                                                            EXCESO
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                        <tfoot>
                                                            <tr className="border-t-2 border-slate-700/50 bg-slate-900/50">
                                                                <td className="p-2 text-slate-300 font-bold">TOTALES</td>
                                                                <td className="p-2 text-right text-slate-300 font-mono">
                                                                    {((alert.problema.tiendasNecesitanStock?.reduce((sum, t) => sum + t.unidadesVendidas, 0) || 0) +
                                                                      (alert.problema.tiendasConExceso?.reduce((sum, t) => sum + t.unidadesVendidas, 0) || 0)).toLocaleString()}
                                                                </td>
                                                                <td className="p-2 text-right text-slate-300">100%</td>
                                                                <td className="p-2 text-right">
                                                                    <span className="font-bold font-mono text-slate-300">
                                                                        {((alert.problema.tiendasNecesitanStock?.reduce((sum, t) => sum + t.stock, 0) || 0) +
                                                                          (alert.problema.tiendasConExceso?.reduce((sum, t) => sum + t.stock, 0) || 0)).toLocaleString()}
                                                                    </span>
                                                                </td>
                                                                <td className="p-2"></td>
                                                            </tr>
                                                        </tfoot>
                                                    </table>
                                                </div>
                                            </div>
                                            {alert.problema.totalExcessStock && alert.problema.totalNeededStock && (
                                                <div className="mt-3 pt-3 border-t border-slate-700/50">
                                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                                        <div className="bg-orange-900/20 p-2 rounded">
                                                            <p className="text-orange-400/70">Stock disponible para redistribuir</p>
                                                            <p className="text-orange-300 font-bold">{alert.problema.totalExcessStock.toLocaleString()} unidades</p>
                                                        </div>
                                                        <div className="bg-red-900/20 p-2 rounded">
                                                            <p className="text-red-400/70">Stock necesario</p>
                                                            <p className="text-red-300 font-bold">{alert.problema.totalNeededStock.toLocaleString()} unidades</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="mt-3 pt-3 border-t border-slate-700/50">
                                                <p className="text-xs text-slate-400 italic">
                                                    💡 <strong>Insight:</strong> Este producto se vende muy bien en algunas tiendas pero tiene bajo movimiento en otras. 
                                                    Hay exceso de stock en tiendas con baja rotación y falta stock en tiendas con alta rotación. 
                                                    Considera redistribuir stock entre tiendas.
                                                </p>
                                            </div>
                                        </>
                                    )}
                                            </div>

                                            {/* Botón para ver detalle completo del producto */}
                                            <div className="mt-6 pt-6 border-t border-slate-700/50">
                                                <button
                                                    onClick={() => {
                                                        setShowDetailModal(false);
                                                        setSelectedProductId(alert.baseCol);
                                                    }}
                                                    className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-semibold"
                                                >
                                                    <ExternalLink size={18} />
                                                    <span>Ver detalle completo del producto</span>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
