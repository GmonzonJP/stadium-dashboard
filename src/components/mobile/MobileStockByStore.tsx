'use client';

import React from 'react';

interface StoreData {
    id: number;
    descripcion: string;
    ttlstock: number;
    ttlunidadesVenta: number;
    ttlimporteVenta: number;
}

interface MobileStockByStoreProps {
    stores: StoreData[];
    loading?: boolean;
}

function formatCurrency(value: number): string {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
    return `$${value.toFixed(0)}`;
}

export function MobileStockByStore({ stores, loading }: MobileStockByStoreProps) {
    if (loading) {
        return (
            <div className="px-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between py-2">
                        <div className="h-4 w-28 bg-slate-800 animate-pulse rounded" />
                        <div className="h-4 w-16 bg-slate-800 animate-pulse rounded" />
                    </div>
                ))}
            </div>
        );
    }

    // Sort by sales descending, take top 7
    const topStores = [...stores]
        .sort((a, b) => b.ttlunidadesVenta - a.ttlunidadesVenta)
        .slice(0, 7);

    if (topStores.length === 0) {
        return (
            <div className="px-4 py-3 text-center">
                <p className="text-sm text-slate-500">Sin datos de tiendas</p>
            </div>
        );
    }

    return (
        <div className="px-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Top Tiendas
            </h3>
            {topStores.map((store, idx) => (
                <div
                    key={store.id}
                    className="flex items-center justify-between py-2.5 border-b border-slate-800/40 last:border-0"
                >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-xs text-slate-600 font-mono w-4 shrink-0">{idx + 1}</span>
                        <span className="text-sm text-white truncate">{store.descripcion}</span>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                        <span className="text-sm text-slate-400 tabular-nums w-12 text-right">
                            {store.ttlunidadesVenta} un.
                        </span>
                        <span className="text-sm text-white font-semibold tabular-nums w-16 text-right">
                            {formatCurrency(store.ttlimporteVenta)}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}
