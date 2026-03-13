'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
    label: string;
    href: string;
}

interface DimensionOption {
    id: string;
    label: string;
}

const DIMENSIONS: DimensionOption[] = [
    { id: 'stores', label: 'Tienda' },
    { id: 'brands', label: 'Marca' },
    { id: 'sections', label: 'Sección' },
    { id: 'categories', label: 'Clase' },
];

const SEARCH_PLACEHOLDERS: Record<string, string> = {
    stores: 'Filtrar tienda...',
    brands: 'Filtrar marca...',
    sections: 'Filtrar sección...',
    categories: 'Filtrar clase...',
    products: 'Filtrar artículo...',
};

interface MobileDrillHeaderProps {
    breadcrumbs: BreadcrumbItem[];
    currentGroupBy: string;
    onDimensionChange: (groupBy: string) => void;
    filterText: string;
    onFilterTextChange: (text: string) => void;
}

export function MobileDrillHeader({ breadcrumbs, currentGroupBy, onDimensionChange, filterText, onFilterTextChange }: MobileDrillHeaderProps) {
    const router = useRouter();

    const handleBack = () => {
        if (breadcrumbs.length > 1) {
            router.push(breadcrumbs[breadcrumbs.length - 2].href);
        } else {
            router.push('/m');
        }
    };

    return (
        <div className="sticky top-0 z-40 bg-[#020617]/95 backdrop-blur-sm border-b border-slate-800">
            {/* Back + Breadcrumbs */}
            <div className="flex items-center gap-1 px-2 py-3">
                <button
                    onClick={handleBack}
                    className="p-2 -ml-1 text-slate-400 active:text-white min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                    <ChevronLeft size={22} />
                </button>
                <div className="flex items-center gap-1 overflow-x-auto flex-1 scrollbar-hide">
                    {breadcrumbs.map((crumb, idx) => (
                        <React.Fragment key={idx}>
                            {idx > 0 && <ChevronRight size={12} className="text-slate-600 shrink-0" />}
                            <button
                                onClick={() => router.push(crumb.href)}
                                className={cn(
                                    "shrink-0 text-sm font-medium px-2 py-1 rounded-lg transition-colors",
                                    idx === breadcrumbs.length - 1
                                        ? "text-white bg-slate-800/50"
                                        : "text-slate-400 active:text-white"
                                )}
                            >
                                {crumb.label}
                            </button>
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {/* Dimension Switcher */}
            {currentGroupBy !== 'products' && (
                <div className="flex gap-2 px-4 pb-2 overflow-x-auto scrollbar-hide">
                    {DIMENSIONS.map((dim) => (
                        <button
                            key={dim.id}
                            onClick={() => onDimensionChange(dim.id)}
                            className={cn(
                                "shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
                                currentGroupBy === dim.id
                                    ? "bg-blue-600 text-white"
                                    : "bg-slate-800/80 text-slate-400 active:bg-slate-700"
                            )}
                        >
                            {dim.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Filter/Search input */}
            <div className="px-4 pb-3">
                <div className="flex items-center gap-2 bg-slate-800/60 rounded-xl px-3 h-9 border border-slate-700/50">
                    <Search size={14} className="text-slate-500 shrink-0" />
                    <input
                        type="text"
                        value={filterText}
                        onChange={(e) => onFilterTextChange(e.target.value)}
                        placeholder={SEARCH_PLACEHOLDERS[currentGroupBy] || 'Filtrar...'}
                        className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 outline-none"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                    />
                    {filterText && (
                        <button
                            onClick={() => onFilterTextChange('')}
                            className="p-0.5 text-slate-500 active:text-white"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
