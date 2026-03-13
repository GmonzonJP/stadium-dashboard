'use client';

import React from 'react';
import { ChevronRight, Loader2, SearchX } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getProductImageUrl } from '@/lib/utils';
import { FilterItem } from '@/types';

interface BrandMatch {
    item: FilterItem;
    metrics: { sales: number; units: number } | null;
    loading: boolean;
}

interface MobileSearchResultsProps {
    searchType: 'brand' | 'product' | 'idle';
    brandMatch: BrandMatch | null;
    productResults: any[];
    isLoading: boolean;
    startDate: string;
    endDate: string;
    onClose: () => void;
}

function formatCurrency(value: number): string {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
    return `$${value.toFixed(0)}`;
}

export function MobileSearchResults({
    searchType,
    brandMatch,
    productResults,
    isLoading,
    startDate,
    endDate,
    onClose,
}: MobileSearchResultsProps) {
    const router = useRouter();

    if (isLoading) {
        return (
            <div className="mt-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <div className="flex items-center justify-center gap-2 text-slate-500">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-sm">Buscando...</span>
                </div>
            </div>
        );
    }

    // Brand result
    if (searchType === 'brand' && brandMatch) {
        return (
            <div className="mt-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <button
                    onClick={() => {
                        router.push(`/m/drill?metric=ventas&groupBy=stores&brands=${brandMatch.item.id}`);
                        onClose();
                    }}
                    className="w-full flex items-center justify-between p-4 active:bg-slate-800 transition-colors"
                >
                    <div className="text-left">
                        <p className="text-white font-bold text-base">{brandMatch.item.label}</p>
                        {brandMatch.metrics && (
                            <p className="text-sm text-slate-400 mt-0.5">
                                {formatCurrency(brandMatch.metrics.sales)} &middot; {brandMatch.metrics.units.toLocaleString()} un.
                            </p>
                        )}
                    </div>
                    <ChevronRight size={20} className="text-slate-600" />
                </button>
            </div>
        );
    }

    // Product results
    if (searchType === 'product') {
        if (productResults.length === 0) {
            return (
                <div className="mt-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <div className="flex flex-col items-center gap-2 text-slate-500">
                        <SearchX size={24} />
                        <span className="text-sm">Sin resultados</span>
                    </div>
                </div>
            );
        }

        return (
            <div className="mt-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden max-h-[60vh] overflow-y-auto">
                {productResults.map((product, idx) => (
                    <button
                        key={product.BaseCol || idx}
                        onClick={() => {
                            router.push(`/m/product/${encodeURIComponent(product.BaseCol)}`);
                            onClose();
                        }}
                        className="w-full flex items-center gap-3 p-3 active:bg-slate-800 transition-colors border-b border-slate-800/50 last:border-0"
                    >
                        <div className="w-12 h-12 rounded-lg bg-slate-800 shrink-0 overflow-hidden">
                            <img
                                src={getProductImageUrl(product.BaseCol)}
                                alt=""
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                            <p className="text-sm text-white font-medium truncate">
                                {product.DescripcionCorta || product.Descripcion}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                                {product.DescripcionMarca} &middot; {product.BaseCol}
                            </p>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="text-sm text-white font-semibold tabular-nums">
                                {formatCurrency(product.venta_total || 0)}
                            </p>
                            <p className="text-xs text-slate-500 tabular-nums">
                                {product.unidades_vendidas || 0} un.
                            </p>
                        </div>
                    </button>
                ))}
            </div>
        );
    }

    return null;
}
