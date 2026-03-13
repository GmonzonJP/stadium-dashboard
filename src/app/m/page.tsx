'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Monitor } from 'lucide-react';
import { useFilters } from '@/context/FilterContext';
import { MobileDateSelector } from '@/components/mobile/MobileDateSelector';
import { MobileSearchBar } from '@/components/mobile/MobileSearchBar';
import { MobileKPICard } from '@/components/mobile/MobileKPICard';

function formatCurrency(value: number): string {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
    return `$${value.toFixed(0)}`;
}

function formatDateDisplay(dateStr: string): string {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}

export default function MobileHome() {
    const router = useRouter();
    const { selectedFilters, setSelectedFilters } = useFilters();
    const [metrics, setMetrics] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchMetrics() {
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch('/api/metrics', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(selectedFilters),
                });

                if (!response.ok) throw new Error('Error cargando datos');

                const data = await response.json();
                setMetrics(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Error');
            } finally {
                setIsLoading(false);
            }
        }

        fetchMetrics();
    }, [selectedFilters]);

    const handleDateChange = (start: string, end: string) => {
        setSelectedFilters(prev => ({ ...prev, startDate: start, endDate: end }));
    };

    const handleKPIClick = (metric: string) => {
        router.push(`/m/drill?metric=${metric}&groupBy=stores`);
    };

    // Determine period label
    const getPeriodLabel = () => {
        const { startDate, endDate } = selectedFilters;
        if (startDate === endDate) {
            return formatDateDisplay(startDate);
        }
        return `${formatDateDisplay(startDate)} - ${formatDateDisplay(endDate)}`;
    };

    return (
        <div className="pb-8">
            {/* Header */}
            <div className="px-4 pt-4 pb-3">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
                        <span className="text-white font-bold text-sm">S</span>
                    </div>
                    <div className="flex-1">
                        <h1 className="text-lg font-bold text-white">Stadium</h1>
                        <p className="text-xs text-slate-500">{getPeriodLabel()}</p>
                    </div>
                    <button
                        onClick={() => {
                            localStorage.setItem('stadium-view-mode', 'full');
                            router.push('/');
                        }}
                        className="p-2 text-slate-400 active:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                        title="Modo Completo"
                    >
                        <Monitor size={20} />
                    </button>
                </div>
            </div>

            {/* Date Selector */}
            <MobileDateSelector
                startDate={selectedFilters.startDate}
                endDate={selectedFilters.endDate}
                onChange={handleDateChange}
            />

            {/* Search Bar */}
            <div className="mt-3">
                <MobileSearchBar
                    startDate={selectedFilters.startDate}
                    endDate={selectedFilters.endDate}
                />
            </div>

            {/* Error State */}
            {error && (
                <div className="mx-4 mt-4 bg-red-500/10 border border-red-500/20 p-4 rounded-2xl text-center">
                    <p className="text-red-400 text-sm font-medium">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-2 text-xs text-red-400 underline"
                    >
                        Reintentar
                    </button>
                </div>
            )}

            {/* KPI Cards */}
            <div className="mt-5 px-4 space-y-3">
                <MobileKPICard
                    title="Ventas $"
                    value={formatCurrency(metrics?.current?.sales || 0)}
                    growth={metrics?.growthLY?.sales != null ? metrics.growthLY.sales : metrics?.growth?.sales}
                    subtitle="vs año anterior"
                    primary
                    loading={isLoading}
                    onClick={() => handleKPIClick('ventas')}
                />
                <MobileKPICard
                    title="Unidades"
                    value={metrics?.current?.units?.toLocaleString() || '0'}
                    growth={metrics?.growthLY?.units != null ? metrics.growthLY.units : metrics?.growth?.units}
                    subtitle="vs año anterior"
                    loading={isLoading}
                    onClick={() => handleKPIClick('unidades')}
                />
                <MobileKPICard
                    title="Margen"
                    value={metrics?.current?.margin != null ? `${metrics.current.margin.toFixed(1)}%` : 'N/A'}
                    growth={metrics?.growthLY?.margin != null ? metrics.growthLY.margin : metrics?.growth?.margin}
                    subtitle="(Precio - Costo) / Costo"
                    loading={isLoading}
                    onClick={() => handleKPIClick('margen')}
                />
            </div>
        </div>
    );
}
