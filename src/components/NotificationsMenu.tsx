'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X, ChevronRight, Store, ExternalLink } from 'lucide-react';
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
    dateRange: {
        start: string;
        end: string;
    };
}

interface NotificationsMenuProps {
    isOpen: boolean;
    onClose: () => void;
    alertsCount: number;
    alertsData?: any;
    isLoadingAlerts?: boolean;
}

export function NotificationsMenu({ isOpen, onClose, alertsCount, alertsData, isLoadingAlerts }: NotificationsMenuProps) {
    const [selectedAlertIndex, setSelectedAlertIndex] = useState<number | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

    // Usar los datos pasados como props
    const data = alertsData;
    const isLoading = isLoadingAlerts ?? false;

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

    const getInsight = (alert: StockAlert) => {
        if (alert.problema.tipo === 'stock_central_sin_distribucion') {
            return 'Stock en central sin distribuir a tiendas con alta rotación';
        } else if (alert.problema.tipo === 'stock_desbalanceado_entre_tiendas') {
            return 'Desbalance de stock entre tiendas';
        }
        return '';
    };

    const getFullInsight = (alert: StockAlert) => {
        if (alert.problema.tipo === 'stock_central_sin_distribucion') {
            return 'Este producto tiene stock disponible en el depósito central pero las tiendas con mayor rotación no tienen stock. Considera redistribuir desde el central.';
        } else if (alert.problema.tipo === 'stock_desbalanceado_entre_tiendas') {
            return 'Este producto se vende muy bien en algunas tiendas pero tiene bajo movimiento en otras. Hay exceso de stock en tiendas con baja rotación y falta stock en tiendas con alta rotación. Considera redistribuir stock entre tiendas.';
        }
        return '';
    };

    const handleAlertClick = (index: number, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation(); // Prevenir que se cierre el menú
        setSelectedAlertIndex(index);
        setShowDetailModal(true);
    };

    return (
        <>
            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={(e) => {
                            // Solo cerrar si no hay modal abierto
                            if (!showDetailModal) {
                                onClose();
                            }
                        }}
                    />
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-96 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 max-h-[600px] flex flex-col overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                {/* Header */}
                <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-slate-900/50">
                    <div className="flex items-center space-x-2">
                        <AlertTriangle className="text-red-400" size={20} />
                        <h3 className="text-lg font-bold text-white">Alertas de Stock</h3>
                        {alertsCount > 0 && (
                            <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                                {alertsCount}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {isLoading ? (
                        <div className="p-8 text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                            <p className="text-slate-400 text-sm">Cargando alertas...</p>
                        </div>
                    ) : !data || data.alerts.length === 0 ? (
                        <div className="p-8 text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full mb-4">
                                <AlertTriangle className="text-green-400" size={24} />
                            </div>
                            <p className="text-green-400 font-semibold mb-2">Todo en orden</p>
                            <p className="text-slate-400 text-sm">
                                No se detectaron problemas de distribución de stock
                            </p>
                        </div>
                    ) : (
                        <div className="p-2">
                            {data.alerts.map((alert: StockAlert, index: number) => (
                                <motion.div
                                    key={alert.baseCol}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    onClick={(e) => handleAlertClick(index, e)}
                                    className={`mb-2 p-3 rounded-lg border cursor-pointer hover:bg-slate-700/50 transition-all ${getSeverityColor(alert.problema.severidad)}`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center space-x-2 mb-1">
                                                <span className="text-white font-mono text-sm font-bold truncate">
                                                    {alert.baseCol}
                                                </span>
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0 ${getSeverityBadge(alert.problema.severidad)}`}>
                                                    {alert.problema.severidad.toUpperCase()}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-300 truncate mb-1">
                                                {alert.descripcion || alert.baseCol}
                                            </p>
                                            <p className="text-xs text-yellow-400/80 font-medium line-clamp-2">
                                                💡 {getFullInsight(alert)}
                                            </p>
                                        </div>
                                        <ChevronRight className="text-slate-400 flex-shrink-0 ml-2" size={16} />
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
                    </motion.div>
                </>
            )}

            {/* Modal de detalle de alerta - Renderizado fuera del menú usando portal */}
            {typeof window !== 'undefined' && showDetailModal && selectedAlertIndex !== null && data?.alerts[selectedAlertIndex] && createPortal(
                <AnimatePresence>
                    <AlertDetailModal
                        key={`alert-modal-${selectedAlertIndex}`}
                        alert={data.alerts[selectedAlertIndex]}
                        currentIndex={selectedAlertIndex}
                        totalAlerts={data.alerts.length}
                        onClose={() => {
                            setShowDetailModal(false);
                            setSelectedAlertIndex(null);
                        }}
                        onNext={() => {
                            if (selectedAlertIndex < data.alerts.length - 1) {
                                setSelectedAlertIndex(selectedAlertIndex + 1);
                            }
                        }}
                        onPrevious={() => {
                            if (selectedAlertIndex > 0) {
                                setSelectedAlertIndex(selectedAlertIndex - 1);
                            }
                        }}
                        onProductClick={(productId) => {
                            // No cerrar el modal de alerta, solo abrir el de producto encima
                            setSelectedProductId(productId);
                        }}
                    />
                </AnimatePresence>,
                document.body
            )}

            {/* Modal de ProductDetail - Renderizado fuera usando portal */}
            {typeof window !== 'undefined' && selectedProductId && createPortal(
                <ProductDetail 
                    productId={selectedProductId}
                    onClose={() => setSelectedProductId(null)}
                />,
                document.body
            )}
        </>
    );
}

// Componente del modal de detalle de alerta
interface AlertDetailModalProps {
    alert: StockAlert;
    currentIndex: number;
    totalAlerts: number;
    onClose: () => void;
    onNext: () => void;
    onPrevious: () => void;
    onProductClick: (productId: string) => void;
}

function AlertDetailModal({ alert, currentIndex, totalAlerts, onClose, onNext, onPrevious, onProductClick }: AlertDetailModalProps) {

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

    return (
        <>
            <motion.div
                key="overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-black/60 backdrop-blur-md z-[500]"
            />
            <motion.div
                key={`modal-${currentIndex}`}
                initial={{ opacity: 0, scale: 0.95, y: 20, x: 100 }}
                animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20, x: -100 }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={(e, info: PanInfo) => {
                    if (info.offset.x < -100) {
                        onNext();
                    } else if (info.offset.x > 100) {
                        onPrevious();
                    }
                }}
                onClick={(e) => e.stopPropagation()}
                className="fixed inset-4 bg-slate-900 rounded-3xl z-[510] shadow-2xl flex flex-col overflow-hidden border border-slate-800 cursor-grab active:cursor-grabbing"
            >
                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                    <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                            <span className="text-white font-bold text-xl font-mono">
                                {alert.baseCol}
                            </span>
                            <span className={`px-2 py-1 rounded text-xs font-bold ${getSeverityBadge(alert.problema.severidad)}`}>
                                {alert.problema.severidad.toUpperCase()}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center space-x-4">
                        {totalAlerts > 1 && (
                            <div className="flex items-center space-x-2 text-sm text-slate-400">
                                <button
                                    onClick={onPrevious}
                                    disabled={currentIndex === 0}
                                    className="p-1 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 rounded"
                                >
                                    <ChevronRight className="rotate-180" size={18} />
                                </button>
                                <span>{currentIndex + 1} / {totalAlerts}</span>
                                <button
                                    onClick={onNext}
                                    disabled={currentIndex === totalAlerts - 1}
                                    className="p-1 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 rounded"
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content - Aquí va el contenido completo de la alerta */}
                <div className="flex-1 overflow-y-auto p-6 cursor-grab active:cursor-grabbing">
                    <AlertDetailContent alert={alert} onProductClick={onProductClick} />
                </div>
                
                {/* Indicador de swipe */}
                {totalAlerts > 1 && (
                    <div className="p-4 border-t border-slate-800 text-center">
                        <p className="text-xs text-slate-500">Desliza a la derecha para siguiente alerta →</p>
                    </div>
                )}
            </motion.div>
        </>
    );
}

// Componente del contenido del detalle de alerta
interface AlertDetailContentProps {
    alert: StockAlert;
    onProductClick: (productId: string) => void;
}

function AlertDetailContent({ alert, onProductClick }: AlertDetailContentProps) {
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

    return (
        <div className="space-y-6">
            {/* Insight destacado - Primero y más visible */}
            <div className="p-4 bg-yellow-500/10 border-2 border-yellow-500/30 rounded-xl">
                <div className="flex items-start space-x-3">
                    <span className="text-yellow-400 text-2xl flex-shrink-0">💡</span>
                    <div className="flex-1">
                        <p className="text-yellow-400 font-bold text-sm mb-2">INSIGHT</p>
                        <p className="text-white text-sm leading-relaxed">
                            {alert.problema.tipo === 'stock_central_sin_distribucion'
                                ? 'Este producto tiene stock disponible en el depósito central pero las tiendas con mayor rotación no tienen stock. Considera redistribuir desde el central.'
                                : 'Este producto se vende muy bien en algunas tiendas pero tiene bajo movimiento en otras. Hay exceso de stock en tiendas con baja rotación y falta stock en tiendas con alta rotación. Considera redistribuir stock entre tiendas.'
                            }
                        </p>
                    </div>
                </div>
            </div>

            {/* Información del producto */}
            <div className={`border rounded-xl p-5 ${getSeverityColor(alert.problema.severidad)}`}>
                <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                        <p className="text-lg text-slate-300 mb-3">
                            {alert.descripcion || alert.baseCol}
                        </p>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <p className="text-slate-400">Ventas</p>
                                <p className="text-white font-bold">{alert.totalUnidadesVendidas.toLocaleString()} unidades</p>
                            </div>
                            <div>
                                <p className="text-slate-400">Stock Central</p>
                                <p className="text-blue-300 font-bold">{alert.centralStock.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tablas de tiendas - Aquí va el contenido completo que ya tenías */}
                {alert.problema.tipo === 'stock_central_sin_distribucion' && alert.problema.tiendas && (
                    <div className="mt-4 pt-4 border-t border-slate-700/50">
                        <div className="flex items-center space-x-2 mb-3">
                            <span className="text-sm font-semibold text-slate-300">
                                {alert.problema.tiendasAfectadas} tienda{alert.problema.tiendasAfectadas !== 1 ? 's' : ''} con alta rotación y stock insuficiente:
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-700/50">
                                        <th className="text-left p-2 text-slate-400 font-semibold">Tienda</th>
                                        <th className="text-right p-2 text-slate-400 font-semibold">Ventas</th>
                                        <th className="text-right p-2 text-slate-400 font-semibold">% Ventas</th>
                                        <th className="text-right p-2 text-slate-400 font-semibold">Stock</th>
                                        <th className="text-center p-2 text-slate-400 font-semibold">Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {alert.problema.tiendas.map((tienda) => (
                                        <tr key={tienda.id} className="border-b border-slate-700/20 hover:bg-slate-800/30">
                                            <td className="p-2 text-slate-300 font-medium">
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
                )}

                {alert.problema.tipo === 'stock_desbalanceado_entre_tiendas' && (
                    <div className="mt-4 pt-4 border-t border-slate-700/50">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-700/50">
                                        <th className="text-left p-2 text-slate-400 font-semibold">Tienda</th>
                                        <th className="text-right p-2 text-slate-400 font-semibold">Ventas</th>
                                        <th className="text-right p-2 text-slate-400 font-semibold">% Ventas</th>
                                        <th className="text-right p-2 text-slate-400 font-semibold">Stock</th>
                                        <th className="text-center p-2 text-slate-400 font-semibold">Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {alert.problema.tiendasNecesitanStock?.map((tienda) => (
                                        <tr key={`need-${tienda.id}`} className="border-b border-red-900/20 hover:bg-red-900/10">
                                            <td className="p-2 text-red-300 font-medium">
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
                                                <span className="font-bold font-mono text-red-400">
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
                                    {alert.problema.tiendasConExceso?.map((tienda) => (
                                        <tr key={`excess-${tienda.id}`} className="border-b border-orange-900/20 hover:bg-orange-900/10">
                                            <td className="p-2 text-orange-300 font-medium">
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
                            </table>
                        </div>
                        {alert.problema.totalExcessStock && alert.problema.totalNeededStock && (
                            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                                <div className="bg-orange-900/20 p-2 rounded">
                                    <p className="text-orange-400/70">Stock disponible para redistribuir</p>
                                    <p className="text-orange-300 font-bold">{alert.problema.totalExcessStock.toLocaleString()} unidades</p>
                                </div>
                                <div className="bg-red-900/20 p-2 rounded">
                                    <p className="text-red-400/70">Stock necesario</p>
                                    <p className="text-red-300 font-bold">{alert.problema.totalNeededStock.toLocaleString()} unidades</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Botón para ver detalle completo del producto */}
                <div className="mt-6 pt-6 border-t border-slate-700/50">
                    <button
                        onClick={() => onProductClick(alert.baseCol)}
                        className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-semibold"
                    >
                        <span>Ver detalle completo del producto</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
