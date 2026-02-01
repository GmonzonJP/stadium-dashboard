'use client';

import React, { useState } from 'react';
import { Calendar, TrendingDown, TrendingUp, AlertTriangle, ChevronDown, ChevronUp, Flame } from 'lucide-react';
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
    const [isExpanded, setIsExpanded] = useState(false);

    if (!historial || historial.length === 0) {
        return null;
    }

    const anioActual = new Date().getFullYear();
    const esCritico = temporadas >= 3 && stockActual > 0;

    // Calcular tendencia de ventas
    const tendenciaVentas = historial.length >= 2
        ? ((historial[0]?.unidadesVendidas || 0) - (historial[1]?.unidadesVendidas || 0)) /
          Math.max(1, historial[1]?.unidadesVendidas || 1) * 100
        : 0;

    const tendenciaNegativa = tendenciaVentas < -20;
    const tendenciaPositiva = tendenciaVentas > 20;

    // Total vendido histórico
    const totalVendido = historial.reduce((sum, h) => sum + h.unidadesVendidas, 0);

    return (
        <div className={cn(
            "rounded-xl overflow-hidden transition-all",
            esCritico
                ? "bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/30"
                : "bg-slate-800/30 border border-slate-700/50"
        )}>
            {/* Header Compacto - Clickeable */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        esCritico ? "bg-orange-500/20" : "bg-blue-500/20"
                    )}>
                        {esCritico ? (
                            <Flame className="w-4 h-4 text-orange-400" />
                        ) : (
                            <Calendar className="w-4 h-4 text-blue-400" />
                        )}
                    </div>
                    <div className="text-left">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white">
                                {temporadas} {temporadas === 1 ? 'temporada' : 'temporadas'}
                            </span>
                            {esCritico && (
                                <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 text-[10px] font-bold rounded">
                                    URGENTE
                                </span>
                            )}
                        </div>
                        <span className="text-xs text-slate-400">
                            {totalVendido.toLocaleString()} un. vendidas desde {primeraCompraAnio}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Tendencia */}
                    {historial.length >= 2 && (
                        <div className={cn(
                            "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium",
                            tendenciaNegativa
                                ? "bg-red-500/20 text-red-400"
                                : tendenciaPositiva
                                    ? "bg-emerald-500/20 text-emerald-400"
                                    : "bg-slate-700/50 text-slate-400"
                        )}>
                            {tendenciaNegativa ? (
                                <TrendingDown className="w-3 h-3" />
                            ) : tendenciaPositiva ? (
                                <TrendingUp className="w-3 h-3" />
                            ) : null}
                            <span>{tendenciaVentas > 0 ? '+' : ''}{tendenciaVentas.toFixed(0)}%</span>
                        </div>
                    )}

                    <ChevronDown className={cn(
                        "w-5 h-5 text-slate-400 transition-transform",
                        isExpanded && "rotate-180"
                    )} />
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
                            {/* Alerta crítica */}
                            {esCritico && (
                                <div className="flex items-center gap-2 p-2 mb-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                                    <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0" />
                                    <p className="text-xs text-orange-300">
                                        Cada día que pasa cuesta más tenerlo y se vende menos.
                                        {stockActual > 30 && ' Liquidación recomendada.'}
                                    </p>
                                </div>
                            )}

                            {/* Mini tabla visual */}
                            <div className="space-y-1.5">
                                {historial.map((row, index) => {
                                    const esAnioActual = row.anio === anioActual;
                                    const barWidth = row.porcentajeVendido || 0;

                                    return (
                                        <div
                                            key={row.anio}
                                            className={cn(
                                                "relative flex items-center gap-3 p-2 rounded-lg",
                                                esAnioActual ? "bg-blue-500/10" : "bg-slate-800/30"
                                            )}
                                        >
                                            {/* Año */}
                                            <div className="w-12 shrink-0">
                                                <span className={cn(
                                                    "text-sm font-bold",
                                                    esAnioActual ? "text-blue-400" : "text-white"
                                                )}>
                                                    {row.anio}
                                                </span>
                                            </div>

                                            {/* Barra de progreso */}
                                            <div className="flex-1 h-6 bg-slate-700/30 rounded overflow-hidden relative">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${Math.min(100, barWidth)}%` }}
                                                    transition={{ duration: 0.5, delay: index * 0.1 }}
                                                    className={cn(
                                                        "h-full rounded",
                                                        barWidth >= 50 ? "bg-emerald-500/60" :
                                                        barWidth >= 20 ? "bg-amber-500/60" :
                                                        "bg-red-500/60"
                                                    )}
                                                />
                                                <div className="absolute inset-0 flex items-center justify-between px-2">
                                                    <span className="text-xs font-medium text-white">
                                                        {row.unidadesVendidas.toLocaleString()} un.
                                                    </span>
                                                    <span className="text-xs text-slate-300">
                                                        ${(row.importeVenta / 1000).toFixed(0)}k
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Margen */}
                                            <div className="w-14 text-right shrink-0">
                                                {row.margenPromedio !== null ? (
                                                    <span className={cn(
                                                        "text-xs font-bold",
                                                        row.margenPromedio >= 30 ? "text-emerald-400" :
                                                        row.margenPromedio >= 15 ? "text-amber-400" :
                                                        "text-red-400"
                                                    )}>
                                                        {row.margenPromedio.toFixed(0)}% mg
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-500">-</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Footer con tendencia */}
                            {tendenciaNegativa && historial.length >= 2 && (
                                <div className="mt-3 pt-2 border-t border-slate-700/50 flex items-center gap-2 text-xs text-slate-400">
                                    <TrendingDown className="w-3 h-3 text-red-400" />
                                    <span>
                                        Ventas cayeron <span className="text-red-400 font-medium">{Math.abs(tendenciaVentas).toFixed(0)}%</span> vs año anterior
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
