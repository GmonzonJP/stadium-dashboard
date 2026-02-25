'use client';

import React, { useMemo } from 'react';
import { X, Store, Tags, LayoutGrid, Users, Truck, LucideIcon } from 'lucide-react';
import { FilterParams, FilterData, SectionItem } from '@/types';
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

const filterIcons: Record<string, LucideIcon> = {
    stores: Store,
    brands: Tags,
    categories: LayoutGrid,
    genders: Users,
    suppliers: Truck
};

const filterColors: Record<string, string> = {
    stores: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    brands: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    categories: 'bg-green-500/10 text-green-400 border-green-500/20',
    genders: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
    suppliers: 'bg-orange-500/10 text-orange-400 border-orange-500/20'
};

interface TagItem {
    category: keyof FilterParams;
    id: number | string;
    label: string;
    categoryLabel: string;
    // For collapsed section tags: all category IDs in the section
    sectionCategoryIds?: number[];
}

export function ActiveFiltersTags({ selectedFilters, filterData, onRemoveFilter }: ActiveFiltersTagsProps) {
    // Build category→section lookup
    const categoryToSection = useMemo(() => {
        const map = new Map<number, { sectionLabel: string; section: SectionItem }>();
        filterData.sections?.forEach(s => {
            s.categories.forEach(c => map.set(c.id, { sectionLabel: s.label, section: s }));
        });
        return map;
    }, [filterData.sections]);

    const activeFilters = useMemo(() => {
        const tags: TagItem[] = [];
        const selectedCategoryIds = selectedFilters.categories || [];

        (['stores', 'brands', 'categories', 'genders', 'suppliers'] as const).forEach(category => {
            if (category === 'categories') {
                // Group selected categories by section for collapse logic
                const sectionGroups = new Map<number, { section: SectionItem; selectedIds: number[] }>();
                const ungrouped: number[] = [];

                selectedCategoryIds.forEach(id => {
                    const info = categoryToSection.get(id);
                    if (info) {
                        const group = sectionGroups.get(info.section.id);
                        if (group) {
                            group.selectedIds.push(id);
                        } else {
                            sectionGroups.set(info.section.id, {
                                section: info.section,
                                selectedIds: [id]
                            });
                        }
                    } else {
                        ungrouped.push(id);
                    }
                });

                // For each section group, collapse if all categories are selected
                sectionGroups.forEach(({ section, selectedIds }) => {
                    if (selectedIds.length === section.categories.length) {
                        // All selected → collapsed tag
                        tags.push({
                            category: 'categories',
                            id: `section-${section.id}`,
                            label: `${section.label} (todas)`,
                            categoryLabel: filterLabels.categories,
                            sectionCategoryIds: selectedIds
                        });
                    } else {
                        // Individual tags with section prefix
                        selectedIds.forEach(id => {
                            const item = (filterData.categories || []).find(i => i.id === id);
                            if (item) {
                                const sectionLabel = categoryToSection.get(id)?.sectionLabel;
                                tags.push({
                                    category: 'categories',
                                    id,
                                    label: sectionLabel ? `${sectionLabel} > ${item.label}` : item.label,
                                    categoryLabel: filterLabels.categories
                                });
                            }
                        });
                    }
                });

                // Ungrouped categories (no section info)
                ungrouped.forEach(id => {
                    const item = (filterData.categories || []).find(i => i.id === id);
                    if (item) {
                        tags.push({
                            category: 'categories',
                            id,
                            label: item.label,
                            categoryLabel: filterLabels.categories
                        });
                    }
                });
            } else {
                const ids = selectedFilters[category] || [];
                const items = filterData[category] || [];

                ids.forEach(id => {
                    const item = items.find(i => i.id === id);
                    if (item) {
                        tags.push({
                            category,
                            id,
                            label: item.label,
                            categoryLabel: filterLabels[category] || category
                        });
                    }
                });
            }
        });

        return tags;
    }, [selectedFilters, filterData, categoryToSection]);

    if (activeFilters.length === 0) {
        return null;
    }

    const handleRemove = (filter: TagItem) => {
        if (filter.sectionCategoryIds) {
            // Remove all categories in this section
            filter.sectionCategoryIds.forEach(id => onRemoveFilter('categories', id));
            // Also remove the section from sections filter
            const sectionIdStr = String(filter.id).replace('section-', '');
            const sectionId = Number(sectionIdStr);
            if (!isNaN(sectionId)) {
                onRemoveFilter('sections', sectionId);
            }
        } else {
            onRemoveFilter(filter.category, filter.id as number);
        }
    };

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
                        {filterIcons[filter.category] && (
                            React.createElement(filterIcons[filter.category], { size: 12, className: "opacity-70" })
                        )}
                        <span className="font-semibold text-[10px] uppercase tracking-wider opacity-70">
                            {filter.categoryLabel}:
                        </span>
                        <span className="font-medium">{filter.label}</span>
                        <button
                            onClick={() => handleRemove(filter)}
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
