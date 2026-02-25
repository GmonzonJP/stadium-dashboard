'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { FilterData, FilterParams, FilterItem } from '@/types';
import { NavItemId } from '@/components/Sidebar';

export type ComparisonMode = '52weeks' | 'calendar';
export type FilterSortOrder = 'sales' | 'alphabetical';

interface FilterContextType {
    activeFilterId: NavItemId | null;
    setActiveFilterId: (id: NavItemId | null) => void;
    filterData: FilterData;
    selectedFilters: FilterParams;
    setSelectedFilters: React.Dispatch<React.SetStateAction<FilterParams>>;
    isLoading: boolean;
    toggleFilter: (category: keyof FilterParams, id: number) => void;
    comparisonMode: ComparisonMode;
    setComparisonMode: (mode: ComparisonMode) => void;
    filterSortOrder: FilterSortOrder;
    setFilterSortOrder: (order: FilterSortOrder) => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: React.ReactNode }) {
    const [activeFilterId, setActiveFilterId] = useState<NavItemId | null>(null);
    const [filterData, setFilterData] = useState<FilterData>({
        stores: [],
        brands: [],
        categories: [],
        sections: [],
        genders: [],
        suppliers: []
    });

    const [selectedFilters, setSelectedFilters] = useState<FilterParams>({
        startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        stores: [],
        brands: [],
        categories: [],
        sections: [],
        genders: [],
        suppliers: []
    });

    const [isLoading, setIsLoading] = useState(true);
    const [comparisonMode, setComparisonMode] = useState<ComparisonMode>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('comparisonMode');
            return (saved as ComparisonMode) || '52weeks';
        }
        return '52weeks';
    });

    const [filterSortOrder, setFilterSortOrder] = useState<FilterSortOrder>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('filterSortOrder');
            return (saved as FilterSortOrder) || 'sales';
        }
        return 'sales';
    });

    // Guardar preferencias en localStorage
    useEffect(() => {
        localStorage.setItem('comparisonMode', comparisonMode);
    }, [comparisonMode]);

    useEffect(() => {
        localStorage.setItem('filterSortOrder', filterSortOrder);
    }, [filterSortOrder]);

    useEffect(() => {
        fetch('/api/filters')
            .then(res => {
                if (!res.ok) throw new Error(`Filters API returned ${res.status}`);
                return res.json();
            })
            .then(data => {
                setFilterData(prev => ({
                    stores: Array.isArray(data.stores) ? data.stores : prev.stores,
                    brands: Array.isArray(data.brands) ? data.brands : prev.brands,
                    categories: Array.isArray(data.categories) ? data.categories : prev.categories,
                    sections: Array.isArray(data.sections) ? data.sections : prev.sections,
                    genders: Array.isArray(data.genders) ? data.genders : prev.genders,
                    suppliers: Array.isArray(data.suppliers) ? data.suppliers : prev.suppliers,
                }));
                setIsLoading(false);
            })
            .catch(err => {
                console.error('Error loading filters:', err);
                setIsLoading(false);
            });
    }, []);

    const toggleFilter = (category: keyof FilterParams, id: number) => {
        setSelectedFilters(prev => {
            const current = (prev[category] as number[]) || [];
            const next = current.includes(id)
                ? current.filter(i => i !== id)
                : [...current, id];
            return { ...prev, [category]: next };
        });
    };

    return (
        <FilterContext.Provider value={{
            activeFilterId,
            setActiveFilterId,
            filterData,
            selectedFilters,
            setSelectedFilters,
            isLoading,
            toggleFilter,
            comparisonMode,
            setComparisonMode,
            filterSortOrder,
            setFilterSortOrder
        }}>
            {children}
        </FilterContext.Provider>
    );
}

export function useFilters() {
    const context = useContext(FilterContext);
    if (context === undefined) {
        throw new Error('useFilters must be used within a FilterProvider');
    }
    return context;
}
