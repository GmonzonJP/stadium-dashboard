'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Minus, Filter, Search, ChevronDown, ChevronRight, Layers, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionItem } from '@/types';
import { useFilters } from '@/context/FilterContext';

interface CategoryFilterPanelProps {
    isOpen: boolean;
    onClose: () => void;
    sections: SectionItem[];
    selectedIds: number[];
    onToggle: (id: number) => void;
    onToggleSection: (categoryIds: number[], select: boolean, sectionId?: number) => void;
    onSelectAll: () => void;
    onClear: () => void;
}

export function CategoryFilterPanel({
    isOpen,
    onClose,
    sections,
    selectedIds,
    onToggle,
    onToggleSection,
    onSelectAll,
    onClear
}: CategoryFilterPanelProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
    const [viewMode, setViewMode] = useState<'grouped' | 'flat'>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('categoryViewMode') as 'grouped' | 'flat') || 'grouped';
        }
        return 'grouped';
    });
    const { filterSortOrder, filterData } = useFilters();

    const toggleSection = useCallback((sectionId: number) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(sectionId)) {
                next.delete(sectionId);
            } else {
                next.add(sectionId);
            }
            return next;
        });
    }, []);

    const filteredSections = useMemo(() => {
        let result = sections;

        // Apply search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = sections
                .map(section => {
                    const sectionMatches = section.label.toLowerCase().includes(query);
                    if (sectionMatches) {
                        return section;
                    }
                    const matchingCategories = section.categories.filter(
                        cat => cat.label.toLowerCase().includes(query)
                    );
                    if (matchingCategories.length > 0) {
                        return { ...section, categories: matchingCategories };
                    }
                    return null;
                })
                .filter((s): s is SectionItem => s !== null);
        }

        // Apply sorting
        if (filterSortOrder === 'alphabetical') {
            result = [...result]
                .sort((a, b) => a.label.localeCompare(b.label, 'es'))
                .map(s => ({
                    ...s,
                    categories: [...s.categories].sort((a, b) => a.label.localeCompare(b.label, 'es'))
                }));
        } else {
            // Por ventas: ordenar categorías dentro de cada sección por ventas
            const salesOrder = new Map(filterData.categories.map((c, i) => [c.id, i]));
            result = [...result].map(s => ({
                ...s,
                categories: [...s.categories].sort((a, b) => {
                    const orderA = salesOrder.get(a.id) ?? 9999;
                    const orderB = salesOrder.get(b.id) ?? 9999;
                    return orderA - orderB;
                })
            }));
        }

        return result;
    }, [sections, searchQuery, filterSortOrder, filterData.categories]);

    // When searching, auto-expand matching sections
    const isExpanded = useCallback((sectionId: number) => {
        if (searchQuery.trim()) return true;
        return expandedSections.has(sectionId);
    }, [searchQuery, expandedSections]);

    const getSectionCount = useCallback((section: SectionItem) => {
        const total = section.categories.length;
        const selected = section.categories.filter(c => selectedIds.includes(c.id)).length;
        return { selected, total };
    }, [selectedIds]);

    const totalCategories = useMemo(() => {
        return sections.reduce((acc, s) => acc + s.categories.length, 0);
    }, [sections]);

    // Flat list: todas las categorías sin agrupar
    const flatCategories = useMemo(() => {
        const allCats = sections.flatMap(s => s.categories);
        // Deduplicar por id
        const seen = new Set<number>();
        const unique = allCats.filter(c => {
            if (seen.has(c.id)) return false;
            seen.add(c.id);
            return true;
        });
        // Filtrar por búsqueda
        let result = unique;
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = unique.filter(c => c.label.toLowerCase().includes(query));
        }
        // Ordenar según preferencia
        if (filterSortOrder === 'alphabetical') {
            return [...result].sort((a, b) => a.label.localeCompare(b.label, 'es'));
        }
        // Por ventas: usar el orden de filterData.categories (viene ordenado por ventas del API)
        const salesOrder = new Map(filterData.categories.map((c, i) => [c.id, i]));
        return [...result].sort((a, b) => {
            const orderA = salesOrder.get(a.id) ?? 9999;
            const orderB = salesOrder.get(b.id) ?? 9999;
            return orderA - orderB;
        });
    }, [sections, searchQuery, filterSortOrder, filterData.categories]);

    const toggleViewMode = useCallback(() => {
        setViewMode(prev => {
            const next = prev === 'grouped' ? 'flat' : 'grouped';
            localStorage.setItem('categoryViewMode', next);
            return next;
        });
    }, []);

    const handleClose = () => {
        setSearchQuery('');
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
                    />
                    <motion.div
                        initial={{ x: -400 }}
                        animate={{ x: 0 }}
                        exit={{ x: -400 }}
                        className="fixed left-0 top-0 h-full w-[350px] bg-[#020617] border-r border-slate-800 z-[70] shadow-2xl flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <Filter className="text-blue-500" size={20} />
                                <h2 className="text-lg font-bold text-white">Seleccionar Categorías</h2>
                            </div>
                            <div className="flex items-center space-x-1">
                                <button
                                    onClick={toggleViewMode}
                                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-all"
                                    title={viewMode === 'grouped' ? 'Vista plana' : 'Vista agrupada'}
                                >
                                    {viewMode === 'grouped' ? <List size={18} /> : <Layers size={18} />}
                                </button>
                                <button onClick={handleClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-all">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Search */}
                        <div className="p-4 border-b border-slate-800">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                                <input
                                    type="text"
                                    placeholder="Buscar sección o categoría..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2.5 pl-10 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                            {searchQuery && (
                                <div className="mt-2 text-xs text-slate-500">
                                    {filteredSections.reduce((acc, s) => acc + s.categories.length, 0)} de {totalCategories} categorías
                                </div>
                            )}
                        </div>

                        {/* Select All / Clear */}
                        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/30">
                            <button
                                onClick={onSelectAll}
                                className="text-xs font-bold text-blue-500 hover:text-blue-400 transition-colors px-2 py-1"
                            >
                                SELECCIONAR TODO
                            </button>
                            <button
                                onClick={onClear}
                                className="text-xs font-bold text-slate-500 hover:text-slate-400 transition-colors px-2 py-1"
                            >
                                LIMPIAR
                            </button>
                        </div>

                        {/* Categories list */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
                            {viewMode === 'flat' ? (
                                /* Vista plana - todas las categorías sin secciones */
                                flatCategories.length === 0 ? (
                                    <div className="text-center py-8 text-slate-500">
                                        No se encontraron resultados
                                    </div>
                                ) : (
                                    <div className="space-y-0.5">
                                        {flatCategories.map((category) => {
                                            const isSelected = selectedIds.includes(category.id);
                                            return (
                                                <button
                                                    key={category.id}
                                                    onClick={() => onToggle(category.id)}
                                                    className={cn(
                                                        "w-full flex items-center justify-between p-2.5 px-4 rounded-lg transition-all group/cat",
                                                        isSelected
                                                            ? "bg-blue-500/10 text-white"
                                                            : "hover:bg-slate-800/50 text-slate-400 hover:text-slate-200"
                                                    )}
                                                >
                                                    <span className="text-sm font-medium truncate">{category.label}</span>
                                                    <div className={cn(
                                                        "w-5 h-5 rounded border transition-all flex items-center justify-center shrink-0",
                                                        isSelected
                                                            ? "bg-blue-500 border-blue-500"
                                                            : "border-slate-700 group-hover/cat:border-slate-500"
                                                    )}>
                                                        {isSelected && <Check size={14} className="text-white" strokeWidth={3} />}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )
                            ) : (
                            /* Vista agrupada - secciones con categorías */
                            filteredSections.length === 0 ? (
                                <div className="text-center py-8 text-slate-500">
                                    No se encontraron resultados
                                </div>
                            ) : (
                                filteredSections.map((section) => {
                                    const { selected, total } = getSectionCount(section);
                                    const expanded = isExpanded(section.id);
                                    const hasSelected = selected > 0;

                                    const allSelected = selected === total;
                                    const isPartial = selected > 0 && selected < total;

                                    return (
                                        <div key={section.id} className="mb-1">
                                            {/* Section header */}
                                            <div
                                                className={cn(
                                                    "w-full flex items-center justify-between p-3 rounded-xl transition-all group",
                                                    hasSelected
                                                        ? "bg-blue-500/5 hover:bg-blue-500/10"
                                                        : "hover:bg-slate-800/50"
                                                )}
                                            >
                                                {/* Checkbox - selects/deselects all categories */}
                                                <button
                                                    onClick={() => {
                                                        const catIds = section.categories.map(c => c.id);
                                                        onToggleSection(catIds, !allSelected, section.id);
                                                        if (!expanded) toggleSection(section.id);
                                                    }}
                                                    className="shrink-0 mr-3"
                                                >
                                                    <div className={cn(
                                                        "w-5 h-5 rounded border transition-all flex items-center justify-center",
                                                        allSelected
                                                            ? "bg-blue-500 border-blue-500"
                                                            : isPartial
                                                                ? "bg-blue-500/40 border-blue-500"
                                                                : "border-slate-700 group-hover:border-slate-500"
                                                    )}>
                                                        {allSelected && <Check size={14} className="text-white" strokeWidth={3} />}
                                                        {isPartial && <Minus size={14} className="text-white" strokeWidth={3} />}
                                                    </div>
                                                </button>

                                                {/* Clickable area for expand/collapse */}
                                                <button
                                                    onClick={() => toggleSection(section.id)}
                                                    className="flex-1 flex items-center justify-between min-w-0"
                                                >
                                                    <div className="flex items-center space-x-3 min-w-0">
                                                        <Layers size={16} className={cn(
                                                            "shrink-0 transition-colors",
                                                            hasSelected ? "text-blue-400" : "text-slate-500 group-hover:text-slate-400"
                                                        )} />
                                                        <span className={cn(
                                                            "text-sm font-semibold truncate transition-colors",
                                                            hasSelected ? "text-white" : "text-slate-300 group-hover:text-white"
                                                        )}>
                                                            {section.label}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center space-x-2 shrink-0">
                                                        <span className={cn(
                                                            "text-[11px] font-medium px-2 py-0.5 rounded-full transition-colors",
                                                            hasSelected
                                                                ? "bg-blue-500/15 text-blue-400"
                                                                : "bg-slate-800 text-slate-500"
                                                        )}>
                                                            {selected} de {total}
                                                        </span>
                                                        <motion.div
                                                            animate={{ rotate: expanded ? 0 : -90 }}
                                                            transition={{ duration: 0.2 }}
                                                        >
                                                            <ChevronDown size={16} className="text-slate-500" />
                                                        </motion.div>
                                                    </div>
                                                </button>
                                            </div>

                                            {/* Categories within section */}
                                            <AnimatePresence initial={false}>
                                                {expanded && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="pl-4 pt-1 pb-2 space-y-0.5">
                                                            {section.categories.map((category) => {
                                                                const isSelected = selectedIds.includes(category.id);
                                                                return (
                                                                    <button
                                                                        key={category.id}
                                                                        onClick={() => onToggle(category.id)}
                                                                        className={cn(
                                                                            "w-full flex items-center justify-between p-2.5 pl-4 rounded-lg transition-all group/cat",
                                                                            isSelected
                                                                                ? "bg-blue-500/10 text-white"
                                                                                : "hover:bg-slate-800/50 text-slate-400 hover:text-slate-200"
                                                                        )}
                                                                    >
                                                                        <span className="text-sm font-medium truncate">{category.label}</span>
                                                                        <div className={cn(
                                                                            "w-5 h-5 rounded border transition-all flex items-center justify-center shrink-0",
                                                                            isSelected
                                                                                ? "bg-blue-500 border-blue-500"
                                                                                : "border-slate-700 group-hover/cat:border-slate-500"
                                                                        )}>
                                                                            {isSelected && <Check size={14} className="text-white" strokeWidth={3} />}
                                                                        </div>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    );
                                })
                            )
                            )}
                        </div>

                        {/* Apply button */}
                        <div className="p-6 border-t border-slate-800">
                            <button
                                onClick={handleClose}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]"
                            >
                                APLICAR FILTROS
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
