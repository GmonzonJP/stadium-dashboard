'use client';

import React, { useState } from 'react';
import { Calendar, TrendingDown, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface HistorialAnualData {
    anio: number;
    unidadesVendidas: number;
    importeVenta: number;
    precioPromedio: number;
    margenPromedio: number | null;
    porcentajeVendido: number | null;
}

interface HistorialAnualProps {
    historial: HistorialAnualData[];
    temporadas: number;
    primeraCompraAnio: number | null;
    stockActual: number;
}

export function HistorialAnual({
    historial,
    temporadas,
    primeraCompraAnio,
    stockActual
}: HistorialAnualProps) {
    const [isExpanded, setIsExpanded] = useState(true);

    if (!historial || historial.length === 0) {
        return null;
    }

    const anioActual = new Date().getFullYear();
    const esProductoViejo = temporadas >= 2;
    const esCritico = temporadas >= 3;

    // Calcular tendencia de ventas
    const tendenciaVentas = historial.length >= 2
        ? ((historial[0]?.unidadesVendidas || 0) - (historial[1]?.unidadesVendidas || 0)) /
          Math.max(1, historial[1]?.unidadesVendidas || 1) * 100
        : 0;

    const tendenciaNegativa = tendenciaVentas < -20;

    return (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
            {/* Header - Clickeable para colapsar */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-800/30 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-400" />
                    <h3 className="text-sm font-semibold text-white">Historial del Producto</h3>
                    {primeraCompraAnio && (
                        <span className="text-xs text-slate-400 ml-2">
                            Desde {primeraCompraAnio} ({temporadas} {temporadas === 1 ? 'temporada' : 'temporadas'})
                        </span>
                    )}
                    {esCritico && stockActual > 0 && (
                        <span className="ml-2 px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded-full">
                            {temporadas}a temporada
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {tendenciaNegativa && historial.length >= 2 && (
                        <span className="text-xs text-red-400 flex items-center gap-1">
                            <TrendingDown className="w-3 h-3" />
                            {Math.abs(tendenciaVentas).toFixed(0)}%
                        </span>
                    )}
                    {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                </div>
            </button>

            <AnimatePresence initial={false}>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-4">
                            {/* Warning banner for old products */}
                            {esCritico && stockActual > 0 && (
                                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 mb-4 flex items-start gap-2">
                                    <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-orange-300">
                                            Producto en {temporadas}a temporada
                                        </p>
                                        <p className="text-xs text-orange-400/80 mt-1">
                                            Cada día que pasa cuesta más tenerlo y se vende menos.
                                            {stockActual > 30 && ' Considerar liquidación urgente.'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {esProductoViejo && !esCritico && stockActual > 0 && (
                                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4 flex items-start gap-2">
                                    <TrendingDown className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-yellow-300">
                                            Producto de temporada anterior
                                        </p>
                                        <p className="text-xs text-yellow-400/80 mt-1">
                                            Evaluar promoción o descuento para acelerar la rotación.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-700">
                                            <th className="text-left py-2 px-2 text-slate-400 font-medium">Año</th>
                                            <th className="text-right py-2 px-2 text-slate-400 font-medium">Vendido</th>
                                            <th className="text-right py-2 px-2 text-slate-400 font-medium">%</th>
                                            <th className="text-right py-2 px-2 text-slate-400 font-medium">Importe</th>
                                            <th className="text-right py-2 px-2 text-slate-400 font-medium">Precio Prom</th>
                                            <th className="text-right py-2 px-2 text-slate-400 font-medium">Margen</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {historial.map((row, index) => {
                                            const esAnioActual = row.anio === anioActual;
                                            const margenColor = row.margenPromedio !== null
                                                ? row.margenPromedio >= 30 ? 'text-emerald-400'
                                                    : row.margenPromedio >= 15 ? 'text-yellow-400'
                                                        : 'text-red-400'
                                                : 'text-slate-500';

                                            return (
                                                <tr
                                                    key={row.anio}
                                                    className={cn(
                                                        "border-b border-slate-800/50",
                                                        esAnioActual && "bg-blue-500/10"
                                                    )}
                                                >
                                                    <td className="py-2 px-2">
                                                        <span className={cn(
                                                            "font-medium",
                                                            esAnioActual ? "text-blue-400" : "text-white"
                                                        )}>
                                                            {row.anio}
                                                        </span>
                                                        {esAnioActual && (
                                                            <span className="ml-1 text-[10px] text-blue-400">(actual)</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2 px-2 text-right">
                                                        <span className="text-white font-medium tabular-nums">
                                                            {row.unidadesVendidas.toLocaleString()}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-2 text-right">
                                                        {row.porcentajeVendido !== null ? (
                                                            <span className={cn(
                                                                "tabular-nums",
                                                                row.porcentajeVendido >= 50 ? "text-emerald-400" :
                                                                    row.porcentajeVendido >= 20 ? "text-yellow-400" :
                                                                        "text-red-400"
                                                            )}>
                                                                {row.porcentajeVendido.toFixed(0)}%
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-500">-</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2 px-2 text-right">
                                                        <span className="text-slate-300 tabular-nums">
                                                            ${row.importeVenta.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-2 text-right">
                                                        <span className="text-slate-300 tabular-nums">
                                                            ${row.precioPromedio.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-2 text-right">
                                                        {row.margenPromedio !== null ? (
                                                            <span className={cn("tabular-nums font-medium", margenColor)}>
                                                                {row.margenPromedio.toFixed(0)}%
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-500">-</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Trend indicator */}
                            {tendenciaNegativa && historial.length >= 2 && (
                                <div className="mt-3 flex items-center gap-2 text-xs text-red-400">
                                    <TrendingDown className="w-4 h-4" />
                                    <span>
                                        Ventas cayeron {Math.abs(tendenciaVentas).toFixed(0)}% vs año anterior
                                    </span>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
