'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, LucideIcon, Info, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

import { MoreHorizontal, LayoutGrid, Tag, User, MapPin, Box, DollarSign, Clock, Layers } from 'lucide-react';

interface MetricCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: LucideIcon;
    growth?: number;
    loading?: boolean;
    onGroup?: (type: string) => void;
    /** Callback cuando se clickea la tarjeta (para expandir/ver detalle) */
    onClick?: () => void;
    /** Ref para scroll automático */
    scrollTargetRef?: React.RefObject<HTMLDivElement>;
    /** Filtros que este KPI ignora (ej: "período" para YTD) */
    ignoresFilters?: string[];
    /** Filtros que este KPI aplica (para mostrar en tooltip) */
    appliedFilters?: string[];
    /** Razón por la que el valor puede estar vacío/N.A. */
    emptyReason?: string;
    /** Si es true, muestra el valor como N/A con explicación */
    isUnavailable?: boolean;
    /** Valor del año pasado para mostrar comparativo */
    valorAnterior?: number | string;
}

export function MetricCard({
    title,
    value,
    subtitle,
    icon: Icon,
    growth,
    loading,
    onGroup,
    onClick,
    scrollTargetRef,
    ignoresFilters,
    appliedFilters,
    emptyReason,
    isUnavailable,
    valorAnterior
}: MetricCardProps) {
    const [showMenu, setShowMenu] = React.useState(false);
    const [showTooltip, setShowTooltip] = React.useState(false);

    const handleClick = () => {
        if (onClick) {
            onClick();
            // Scroll automático a la tabla si hay ref
            if (scrollTargetRef?.current) {
                setTimeout(() => {
                    scrollTargetRef.current?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }, 100);
            }
        }
    };

    const isClickable = !!onClick;

    const groupOptions = [
        { id: 'stores', label: 'Por Tienda', icon: MapPin },
        { id: 'brands', label: 'Por Marca', icon: Tag },
        { id: 'genders', label: 'Por Genero', icon: User },
        { id: 'sections', label: 'Por Seccion', icon: Layers },
        { id: 'categories', label: 'Por Clase', icon: LayoutGrid },
        { id: 'products', label: 'Por Articulo', icon: Box },
        { id: 'price', label: 'Por Precio', icon: DollarSign },
        { id: 'hour', label: 'Por Hora', icon: Clock },
    ];

    const hasMetaInfo = ignoresFilters?.length || appliedFilters?.length || emptyReason;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={handleClick}
            className={cn(
                "bg-slate-900/50 border border-slate-800 p-6 rounded-2xl relative overflow-hidden group hover:border-blue-500/50 transition-colors",
                isClickable && "cursor-pointer hover:bg-slate-800/50"
            )}
        >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
                <Icon size={80} className="text-blue-500" />
            </div>

            {/* Group By Menu Button */}
            {onGroup && (
                <div className="absolute top-4 right-4 z-20">
                    <div className="relative">
                        <button
                            onClick={() => setShowMenu(!showMenu)}
                            className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-slate-800/50 transition-colors"
                        >
                            <MoreHorizontal size={20} />
                        </button>

                        {showMenu && (
                            <>
                                <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                                <div className="absolute right-0 top-full mt-2 w-48 bg-[#020617] border border-slate-800 rounded-xl shadow-2xl z-40 overflow-hidden py-1">
                                    {groupOptions.map((option) => (
                                        <button
                                            key={option.id}
                                            onClick={() => {
                                                onGroup(option.id);
                                                setShowMenu(false);
                                            }}
                                            className="w-full text-left px-4 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 flex items-center gap-2"
                                        >
                                            <option.icon size={14} />
                                            {option.label}
                                        </button>
                                    ))}
                                    <div className="h-px bg-slate-800 my-1" />
                                    <button
                                        onClick={() => {
                                            onGroup('all');
                                            setShowMenu(false);
                                        }}
                                        className="w-full text-left px-4 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800"
                                    >
                                        Ver Todo
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Icon className="text-blue-500" size={24} />
                </div>
                <div className="flex items-center gap-2">
                    {/* Badge de filtros ignorados */}
                    {ignoresFilters?.length ? (
                        <div 
                            className="relative"
                            onMouseEnter={() => setShowTooltip(true)}
                            onMouseLeave={() => setShowTooltip(false)}
                        >
                            <div className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 cursor-help">
                                <AlertCircle size={10} />
                                <span>Ignora {ignoresFilters[0]}</span>
                            </div>
                            
                            {/* Tooltip */}
                            {showTooltip && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50">
                                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl w-56 text-left">
                                        <p className="text-xs text-amber-400 font-medium mb-1">Filtros ignorados:</p>
                                        <ul className="text-xs text-slate-400 space-y-1">
                                            {ignoresFilters.map((f, i) => (
                                                <li key={i} className="flex items-center gap-1">
                                                    <span className="w-1 h-1 bg-amber-500 rounded-full" />
                                                    {f}
                                                </li>
                                            ))}
                                        </ul>
                                        {emptyReason && (
                                            <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-700">
                                                {emptyReason}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : null}
                    
                    {growth !== undefined && growth !== null && (
                        <div className={cn(
                            "flex items-center space-x-1 text-xs font-bold px-2 py-1 rounded-full",
                            growth >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                        )}>
                            {growth >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                            <span>{Math.abs(growth).toFixed(1)}%</span>
                        </div>
                    )}
                </div>
            </div>

            <div>
                <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-slate-500 text-sm font-medium uppercase tracking-wider">{title}</h3>
                    {/* Info icon with tooltip for meta info */}
                    {hasMetaInfo && !ignoresFilters?.length && (
                        <div 
                            className="relative"
                            onMouseEnter={() => setShowTooltip(true)}
                            onMouseLeave={() => setShowTooltip(false)}
                        >
                            <Info size={14} className="text-slate-600 hover:text-slate-400 cursor-help" />
                            
                            {showTooltip && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50">
                                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl w-56 text-left">
                                        {appliedFilters?.length ? (
                                            <>
                                                <p className="text-xs text-blue-400 font-medium mb-1">Filtros aplicados:</p>
                                                <ul className="text-xs text-slate-400 space-y-1">
                                                    {appliedFilters.map((f, i) => (
                                                        <li key={i} className="flex items-center gap-1">
                                                            <span className="w-1 h-1 bg-blue-500 rounded-full" />
                                                            {f}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </>
                                        ) : null}
                                        {emptyReason && (
                                            <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-700">
                                                <span className="text-slate-400">Si aparece vacío:</span> {emptyReason}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                
                {loading ? (
                    <div className="h-8 w-24 bg-slate-800 animate-pulse rounded-lg mt-2"></div>
                ) : isUnavailable ? (
                    <div className="flex items-center gap-2 mt-2">
                        <span className="text-2xl font-bold text-slate-600">N/A</span>
                        {emptyReason && (
                            <span className="text-xs text-slate-600">{emptyReason}</span>
                        )}
                    </div>
                ) : (
                    <div className="flex items-baseline space-x-2">
                        <span className="text-3xl font-bold text-white tabular-nums">{value}</span>
                    </div>
                )}
                {subtitle && (
                    <p className="text-xs text-slate-500 mt-2 font-medium">{subtitle}</p>
                )}
            </div>
        </motion.div>
    );
}
