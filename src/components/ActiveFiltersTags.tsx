'use client';

import React from 'react';
import { X } from 'lucide-react';
import { FilterParams, FilterData } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';

interface ActiveFiltersTagsProps {
    selectedFilters: FilterParams;
    filterData: FilterData;
    onRemoveFilter: (category: keyof FilterParams, id: number) => void;
}

const filterLabels: Record<string, string> = {
    stores: 'Tienda',
    brands: 'Marca',
    categories: 'Categoría',
    genders: 'Género',
    suppliers: 'Proveedor'
};

const filterColors: Record<string, string> = {
    stores: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    brands: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    categories: 'bg-green-500/10 text-green-400 border-green-500/20',
    genders: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
    suppliers: 'bg-orange-500/10 text-orange-400 border-orange-500/20'
};

export function ActiveFiltersTags({ selectedFilters, filterData, onRemoveFilter }: ActiveFiltersTagsProps) {
    const activeFilters: Array<{ category: keyof FilterParams; id: number; label: string; categoryLabel: string }> = [];

    // Recopilar todos los filtros activos
    (['stores', 'brands', 'categories', 'genders', 'suppliers'] as const).forEach(category => {
        const ids = selectedFilters[category] || [];
        const items = filterData[category] || [];
        
        ids.forEach(id => {
            const item = items.find(i => i.id === id);
            if (item) {
                activeFilters.push({
                    category,
                    id,
                    label: item.label,
                    categoryLabel: filterLabels[category] || category
                });
            }
        });
    });

    if (activeFilters.length === 0) {
        return null;
    }

    return (
        <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="text-xs text-slate-500 font-medium mr-1">Filtros activos:</span>
            <AnimatePresence>
                {activeFilters.map((filter) => (
                    <motion.div
                        key={`${filter.category}-${filter.id}`}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${filterColors[filter.category] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}
                    >
                        <span className="font-semibold text-[10px] uppercase tracking-wider opacity-70">
                            {filter.categoryLabel}:
                        </span>
                        <span className="font-medium">{filter.label}</span>
                        <button
                            onClick={() => onRemoveFilter(filter.category, filter.id)}
                            className="ml-1 hover:bg-white/10 rounded-full p-0.5 transition-colors"
                            aria-label={`Eliminar filtro ${filter.label}`}
                        >
                            <X size={12} className="opacity-70 hover:opacity-100" />
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
