'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getProductImageUrl } from '@/lib/utils';

interface DrillItem {
    id: string | number;
    label: string;
    units: number;
    sales: number;
    utility?: number;
    unitsAnterior?: number;
    salesAnterior?: number;
    // Product-specific fields
    BaseCol?: string;
    DescripcionMarca?: string;
    DescripcionCorta?: string;
    stock_total?: number;
}

interface MobileDrillListProps {
    items: DrillItem[];
    isLoading: boolean;
    isProducts?: boolean;
    metricKey: string; // 'ventas' | 'unidades' | 'margen'
    onItemClick: (item: DrillItem) => void;
}

function formatCurrency(value: number): string {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
    return `$${value.toFixed(0)}`;
}

function getGrowth(current: number, previous: number): number | null {
    if (!previous || previous === 0) return null;
    return ((current - previous) / previous) * 100;
}

function GrowthBadge({ growth }: { growth: number | null }) {
    if (growth === null) return null;
    return (
        <span className={cn(
            "text-[10px] font-bold tabular-nums",
            growth >= 0 ? "text-emerald-400" : "text-red-400"
        )}>
            {growth >= 0 ? '+' : ''}{growth.toFixed(0)}%
        </span>
    );
}

export function MobileDrillList({ items, isLoading, isProducts, metricKey, onItemClick }: MobileDrillListProps) {
    if (isLoading) {
        return (
            <div className="px-4 mt-4 space-y-1">
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between py-4 border-b border-slate-800/50">
                        <div className="space-y-2">
                            <div className="h-4 w-32 bg-slate-800 animate-pulse rounded" />
                            <div className="h-3 w-20 bg-slate-800 animate-pulse rounded" />
                        </div>
                        <div className="h-5 w-16 bg-slate-800 animate-pulse rounded" />
                    </div>
                ))}
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="px-4 mt-8 text-center">
                <p className="text-slate-500 text-sm">Sin datos para este período</p>
            </div>
        );
    }

    // Calculate totals
    const totalSales = items.reduce((sum, item) => sum + (item.sales || 0), 0);
    const totalUnits = items.reduce((sum, item) => sum + (item.units || 0), 0);
    const totalSalesAnterior = items.reduce((sum, item) => sum + (item.salesAnterior || 0), 0);
    const totalUnitsAnterior = items.reduce((sum, item) => sum + (item.unitsAnterior || 0), 0);
    const totalSalesGrowth = getGrowth(totalSales, totalSalesAnterior);
    const totalUnitsGrowth = getGrowth(totalUnits, totalUnitsAnterior);

    return (
        <div className="px-4 mt-2">
            {/* Column headers */}
            <div className="flex items-center py-2 border-b border-slate-700/50 mb-1">
                <div className="flex-1" />
                <div className="flex gap-4 shrink-0 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    <span className="w-[72px] text-right">Unidades</span>
                    <span className="w-[72px] text-right">Importe</span>
                </div>
                {!isProducts && <div className="w-4 shrink-0" />}
            </div>

            {/* Items */}
            {items.map((item, idx) => {
                const salesPct = totalSales > 0 ? (item.sales / totalSales) * 100 : 0;
                const unitsGrowth = getGrowth(item.units, item.unitsAnterior || 0);
                const salesGrowth = getGrowth(item.sales, item.salesAnterior || 0);

                return (
                    <button
                        key={item.id || idx}
                        onClick={() => onItemClick(item)}
                        className="w-full flex items-center gap-2 py-3 border-b border-slate-800/40 active:bg-slate-800/30 transition-colors relative"
                    >
                        {/* Proportional bar background */}
                        <div
                            className="absolute inset-y-0 left-0 bg-blue-500/5 rounded-r-lg"
                            style={{ width: `${Math.min(salesPct, 100)}%` }}
                        />

                        {/* Product image */}
                        {isProducts && (
                            <div className="w-10 h-10 rounded-lg bg-slate-800 shrink-0 overflow-hidden relative z-10">
                                <img
                                    src={getProductImageUrl(String(item.id))}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                            </div>
                        )}

                        {/* Label */}
                        <div className="flex-1 min-w-0 text-left relative z-10">
                            <p className={cn(
                                "text-white font-medium truncate",
                                isProducts ? "text-sm" : "text-sm"
                            )}>
                                {item.label}
                            </p>
                            {isProducts && item.DescripcionMarca && (
                                <p className="text-xs text-slate-500 truncate">{item.DescripcionMarca}</p>
                            )}
                        </div>

                        {/* Units column */}
                        <div className="w-[72px] text-right shrink-0 relative z-10">
                            <p className="text-sm font-semibold text-white tabular-nums">
                                {item.units.toLocaleString()}
                            </p>
                            <GrowthBadge growth={unitsGrowth} />
                        </div>

                        {/* Sales column */}
                        <div className="w-[72px] text-right shrink-0 relative z-10">
                            <p className="text-sm font-semibold text-white tabular-nums">
                                {formatCurrency(item.sales)}
                            </p>
                            <GrowthBadge growth={salesGrowth} />
                        </div>

                        {!isProducts && (
                            <ChevronRight size={14} className="text-slate-600 shrink-0 relative z-10" />
                        )}
                    </button>
                );
            })}

            {/* Totals row */}
            <div className="flex items-center gap-2 py-3 mt-1 border-t-2 border-slate-700">
                <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-bold text-slate-300 uppercase">Total</p>
                    <p className="text-xs text-slate-500">{items.length} items</p>
                </div>

                {/* Units total */}
                <div className="w-[72px] text-right shrink-0">
                    <p className="text-sm font-bold text-white tabular-nums">
                        {totalUnits.toLocaleString()}
                    </p>
                    <GrowthBadge growth={totalUnitsGrowth} />
                </div>

                {/* Sales total */}
                <div className="w-[72px] text-right shrink-0">
                    <p className="text-sm font-bold text-white tabular-nums">
                        {formatCurrency(totalSales)}
                    </p>
                    <GrowthBadge growth={totalSalesGrowth} />
                </div>

                {!isProducts && <div className="w-4 shrink-0" />}
            </div>
        </div>
    );
}
