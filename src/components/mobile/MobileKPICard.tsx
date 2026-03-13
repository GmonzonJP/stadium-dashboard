'use client';

import React from 'react';
import { TrendingUp, TrendingDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileKPICardProps {
    title: string;
    value: string;
    growth?: number | null;
    subtitle?: string;
    primary?: boolean;
    loading?: boolean;
    onClick?: () => void;
}

export function MobileKPICard({ title, value, growth, subtitle, primary, loading, onClick }: MobileKPICardProps) {
    if (loading) {
        return (
            <div className={cn(
                "rounded-2xl p-5 border border-slate-800 bg-slate-900/50",
                primary && "border-blue-500/30 bg-blue-950/20"
            )}>
                <div className="h-4 w-20 bg-slate-800 animate-pulse rounded mb-3" />
                <div className="h-10 w-32 bg-slate-800 animate-pulse rounded mb-2" />
                <div className="h-3 w-24 bg-slate-800 animate-pulse rounded" />
            </div>
        );
    }

    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full rounded-2xl p-5 border text-left transition-all",
                "active:scale-[0.98] active:brightness-90",
                primary
                    ? "border-blue-500/30 bg-gradient-to-br from-blue-950/40 to-slate-900/50"
                    : "border-slate-800 bg-slate-900/50"
            )}
        >
            <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
                <div className="flex items-center gap-2">
                    {growth !== undefined && growth !== null && (
                        <div className={cn(
                            "flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full",
                            growth >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                        )}>
                            {growth >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            <span>{Math.abs(growth).toFixed(1)}%</span>
                        </div>
                    )}
                    <ChevronRight size={18} className="text-slate-600" />
                </div>
            </div>
            <div className={cn(
                "font-bold tabular-nums text-white",
                primary ? "text-4xl" : "text-3xl"
            )}>
                {value}
            </div>
            {subtitle && (
                <p className="text-xs text-slate-500 mt-1 font-medium">{subtitle}</p>
            )}
        </button>
    );
}
