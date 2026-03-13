'use client';

import React, { Suspense, useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFilters } from '@/context/FilterContext';
import { MobileDateSelector } from '@/components/mobile/MobileDateSelector';
import { MobileDrillHeader, BreadcrumbItem } from '@/components/mobile/MobileDrillHeader';
import { MobileDrillList } from '@/components/mobile/MobileDrillList';

// Default drill order: when user taps a row, go to next dimension
const DRILL_ORDER: Record<string, string> = {
    stores: 'brands',
    brands: 'categories',
    sections: 'categories',
    categories: 'products',
};

const DIMENSION_LABELS: Record<string, string> = {
    stores: 'Tiendas',
    brands: 'Marcas',
    sections: 'Secciones',
    categories: 'Clases',
    products: 'Artículos',
};

const METRIC_LABELS: Record<string, string> = {
    ventas: 'Ventas $',
    unidades: 'Unidades',
    margen: 'Margen',
};

// Maps groupBy to the filter key used when drilling down
const GROUP_TO_FILTER: Record<string, string> = {
    stores: 'stores',
    brands: 'brands',
    sections: 'sections',
    categories: 'categories',
};

function DrillPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { selectedFilters, setSelectedFilters, filterData } = useFilters();

    const [data, setData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterText, setFilterText] = useState('');

    // Parse URL params
    const metric = searchParams.get('metric') || 'ventas';
    const groupBy = searchParams.get('groupBy') || 'stores';

    // Extract accumulated filters from URL
    const urlFilters = useMemo(() => {
        const filters: Record<string, string[]> = {};
        const filterKeys = ['stores', 'brands', 'sections', 'categories', 'genders', 'suppliers'];
        for (const key of filterKeys) {
            const val = searchParams.get(key);
            if (val) {
                filters[key] = val.split(',');
            }
        }
        return filters;
    }, [searchParams]);

    // Build breadcrumbs from URL params
    const breadcrumbs = useMemo(() => {
        const crumbs: BreadcrumbItem[] = [
            { label: METRIC_LABELS[metric] || metric, href: '/m' },
        ];

        // Reconstruct path from filter params
        const filterKeys = ['stores', 'brands', 'sections', 'categories'];
        let accumulatedParams = `metric=${metric}`;

        for (const key of filterKeys) {
            const val = searchParams.get(key);
            if (val) {
                const ids = val.split(',');
                // Try to find label for the filter value
                let label = val;
                if (key === 'stores') {
                    const store = filterData.stores.find(s => String(s.id) === ids[0]);
                    label = store?.label || val;
                } else if (key === 'brands') {
                    const brand = filterData.brands.find(b => String(b.id) === ids[0]);
                    label = brand?.label || val;
                } else if (key === 'sections') {
                    const section = filterData.sections.find(s => String(s.id) === ids[0]);
                    label = section?.label || val;
                } else if (key === 'categories') {
                    const cat = filterData.categories.find(c => String(c.id) === ids[0]);
                    label = cat?.label || val;
                }

                accumulatedParams += `&${key}=${val}`;
                // The groupBy at each level: next dimension after the current key
                const nextGroup = DRILL_ORDER[key] || 'products';
                crumbs.push({
                    label: label,
                    href: `/m/drill?${accumulatedParams}&groupBy=${nextGroup}`,
                });
            }
        }

        // Add current view label
        crumbs.push({
            label: DIMENSION_LABELS[groupBy] || groupBy,
            href: `/m/drill?${searchParams.toString()}`,
        });

        return crumbs;
    }, [searchParams, metric, groupBy, filterData]);

    // Fetch data
    useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                // Build merged filters
                const mergedFilters = {
                    startDate: selectedFilters.startDate,
                    endDate: selectedFilters.endDate,
                    stores: urlFilters.stores?.map(Number) || selectedFilters.stores || [],
                    brands: urlFilters.brands?.map(Number) || selectedFilters.brands || [],
                    sections: urlFilters.sections?.map(Number) || selectedFilters.sections || [],
                    categories: urlFilters.categories?.map(Number) || selectedFilters.categories || [],
                    genders: selectedFilters.genders || [],
                    suppliers: selectedFilters.suppliers || [],
                };

                if (groupBy === 'products') {
                    // Use products/analysis endpoint for article-level drill
                    const response = await fetch('/api/products/analysis', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            ...mergedFilters,
                            page: 1,
                            pageSize: 50,
                            sortColumn: metric === 'unidades' ? 'unidades_vendidas' : 'venta_total',
                            sortDirection: 'desc',
                        }),
                    });

                    if (!response.ok) throw new Error('Error');
                    const result = await response.json();

                    // Map to drill format
                    const mapped = (result.products || []).map((p: any) => ({
                        id: p.BaseCol,
                        label: p.DescripcionCorta || p.Descripcion || p.BaseCol,
                        units: p.unidades_vendidas || 0,
                        sales: p.venta_total || 0,
                        BaseCol: p.BaseCol,
                        DescripcionMarca: p.DescripcionMarca,
                        stock_total: p.stock_total,
                    }));

                    setData(mapped);
                } else {
                    // Use metrics/details endpoint
                    const metricTitle = METRIC_LABELS[metric] || 'Ventas $';
                    const response = await fetch('/api/metrics/details', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            filters: mergedFilters,
                            groupBy: groupBy,
                            metricTitle: metricTitle,
                            includeComparison: true,
                        }),
                    });

                    if (!response.ok) throw new Error('Error');
                    const result = await response.json();
                    setData(Array.isArray(result) ? result : []);
                }
            } catch (err) {
                console.error('Drill fetch error:', err);
                setData([]);
            } finally {
                setIsLoading(false);
            }
        }

        fetchData();
    }, [selectedFilters.startDate, selectedFilters.endDate, groupBy, metric, urlFilters, selectedFilters.stores, selectedFilters.brands, selectedFilters.sections, selectedFilters.categories, selectedFilters.genders, selectedFilters.suppliers]);

    // Reset filter text when groupBy changes
    useEffect(() => {
        setFilterText('');
    }, [groupBy]);

    // Filter items client-side based on filterText
    const filteredData = useMemo(() => {
        if (!filterText.trim()) return data;
        const q = filterText.toLowerCase().trim();
        return data.filter(item => {
            const label = (item.label || '').toLowerCase();
            const id = String(item.id || '').toLowerCase();
            const marca = (item.DescripcionMarca || '').toLowerCase();
            return label.includes(q) || id.includes(q) || marca.includes(q);
        });
    }, [data, filterText]);

    const handleDateChange = useCallback((start: string, end: string) => {
        setSelectedFilters(prev => ({ ...prev, startDate: start, endDate: end }));
    }, [setSelectedFilters]);

    const handleDimensionChange = useCallback((newGroupBy: string) => {
        // Keep all current URL params but change groupBy
        const params = new URLSearchParams(searchParams.toString());
        params.set('groupBy', newGroupBy);
        router.push(`/m/drill?${params.toString()}`);
    }, [searchParams, router]);

    const handleItemClick = useCallback((item: any) => {
        if (groupBy === 'products') {
            // Navigate to product detail
            router.push(`/m/product/${encodeURIComponent(item.id)}`);
            return;
        }

        // Drill deeper: add current selection as filter, move to next groupBy
        const params = new URLSearchParams(searchParams.toString());
        const filterKey = GROUP_TO_FILTER[groupBy];
        if (filterKey) {
            params.set(filterKey, String(item.id));
        }

        const nextGroupBy = DRILL_ORDER[groupBy] || 'products';
        params.set('groupBy', nextGroupBy);
        router.push(`/m/drill?${params.toString()}`);
    }, [groupBy, searchParams, router]);

    return (
        <div className="pb-8">
            <MobileDateSelector
                startDate={selectedFilters.startDate}
                endDate={selectedFilters.endDate}
                onChange={handleDateChange}
            />
            <MobileDrillHeader
                breadcrumbs={breadcrumbs}
                currentGroupBy={groupBy}
                onDimensionChange={handleDimensionChange}
                filterText={filterText}
                onFilterTextChange={setFilterText}
            />
            <MobileDrillList
                items={filteredData}
                isLoading={isLoading}
                isProducts={groupBy === 'products'}
                metricKey={metric}
                onItemClick={handleItemClick}
            />
        </div>
    );
}

export default function DrillPage() {
    return (
        <Suspense fallback={
            <div className="px-4 mt-8 space-y-4">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-14 bg-slate-800 animate-pulse rounded-xl" />
                ))}
            </div>
        }>
            <DrillPageContent />
        </Suspense>
    );
}
