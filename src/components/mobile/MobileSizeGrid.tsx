'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface TallaData {
    talla: string;
    stock: number;
    comprado: number;
    ventas: number;
}

interface MobileSizeGridProps {
    tallas: TallaData[];
    loading?: boolean;
}

export function MobileSizeGrid({ tallas, loading }: MobileSizeGridProps) {
    if (loading) {
        return (
            <div className="px-4">
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="w-14 h-14 bg-slate-800 animate-pulse rounded-xl shrink-0" />
                    ))}
                </div>
            </div>
        );
    }

    if (tallas.length === 0) return null;

    return (
        <div className="px-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Stock por Talla
            </h3>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {tallas.map((t, idx) => (
                    <div
                        key={idx}
                        className={cn(
                            "shrink-0 flex flex-col items-center justify-center rounded-xl px-3 py-2 min-w-[52px] border",
                            t.stock > 0
                                ? "bg-emerald-500/10 border-emerald-500/20"
                                : "bg-slate-800/50 border-slate-800"
                        )}
                    >
                        <span className="text-xs font-semibold text-white">{t.talla}</span>
                        <span className={cn(
                            "text-sm font-bold tabular-nums",
                            t.stock > 0 ? "text-emerald-400" : "text-slate-600"
                        )}>
                            {t.stock}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
