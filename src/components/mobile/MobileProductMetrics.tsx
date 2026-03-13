'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface MetricItem {
    label: string;
    value: string;
    color?: string; // 'green' | 'red' | 'blue' | 'orange' | 'default'
}

interface MobileProductMetricsProps {
    metrics: MetricItem[];
    loading?: boolean;
}

function getColorClasses(color?: string): string {
    switch (color) {
        case 'green': return 'text-emerald-400';
        case 'red': return 'text-red-400';
        case 'blue': return 'text-blue-400';
        case 'orange': return 'text-orange-400';
        default: return 'text-white';
    }
}

export function MobileProductMetrics({ metrics, loading }: MobileProductMetricsProps) {
    if (loading) {
        return (
            <div className="grid grid-cols-2 gap-3 px-4">
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="bg-slate-800/50 rounded-xl p-3">
                        <div className="h-3 w-12 bg-slate-700 animate-pulse rounded mb-2" />
                        <div className="h-6 w-16 bg-slate-700 animate-pulse rounded" />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 gap-2.5 px-4">
            {metrics.map((metric, idx) => (
                <div key={idx} className="bg-slate-800/40 border border-slate-800 rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        {metric.label}
                    </p>
                    <p className={cn("text-lg font-bold tabular-nums", getColorClasses(metric.color))}>
                        {metric.value}
                    </p>
                </div>
            ))}
        </div>
    );
}
