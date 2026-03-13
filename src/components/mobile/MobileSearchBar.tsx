'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { useFilters } from '@/context/FilterContext';
import { cn } from '@/lib/utils';
import { MobileSearchResults } from './MobileSearchResults';
import { FilterItem } from '@/types';

type SearchType = 'brand' | 'product' | 'idle';

interface BrandMatch {
    item: FilterItem;
    metrics: { sales: number; units: number } | null;
    loading: boolean;
}

function detectSearchType(query: string, brands: FilterItem[]): { type: SearchType; brandMatch?: FilterItem } {
    const trimmed = query.trim();
    if (!trimmed) return { type: 'idle' };

    // Product code pattern: digits followed by dot (e.g., "146.S211")
    if (/^\d{2,4}\./.test(trimmed)) return { type: 'product' };

    // Check for brand name match (case-insensitive prefix)
    const matchedBrand = brands.find(b =>
        b.label.toLowerCase().startsWith(trimmed.toLowerCase())
    );
    if (matchedBrand) return { type: 'brand', brandMatch: matchedBrand };

    // Default: search as product (description, brand, code)
    return { type: 'product' };
}

interface MobileSearchBarProps {
    startDate: string;
    endDate: string;
}

export function MobileSearchBar({ startDate, endDate }: MobileSearchBarProps) {
    const { filterData } = useFilters();
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [searchType, setSearchType] = useState<SearchType>('idle');
    const [brandMatch, setBrandMatch] = useState<BrandMatch | null>(null);
    const [productResults, setProductResults] = useState<any[]>([]);
    const [isLoadingProducts, setIsLoadingProducts] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(query.trim());
        }, 300);
        return () => clearTimeout(timer);
    }, [query]);

    // Execute search when debounced query changes
    useEffect(() => {
        if (!debouncedQuery) {
            setSearchType('idle');
            setBrandMatch(null);
            setProductResults([]);
            return;
        }

        const detection = detectSearchType(debouncedQuery, filterData.brands);
        setSearchType(detection.type);

        if (detection.type === 'brand' && detection.brandMatch) {
            // Fetch brand metrics
            setBrandMatch({ item: detection.brandMatch, metrics: null, loading: true });
            setProductResults([]);

            fetch('/api/metrics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    startDate,
                    endDate,
                    brands: [detection.brandMatch.id],
                }),
            })
                .then(res => res.json())
                .then(data => {
                    setBrandMatch(prev => prev ? {
                        ...prev,
                        metrics: { sales: data.current?.sales || 0, units: data.current?.units || 0 },
                        loading: false,
                    } : null);
                })
                .catch(() => {
                    setBrandMatch(prev => prev ? { ...prev, loading: false } : null);
                });
        } else if (detection.type === 'product') {
            // Fetch product results
            setBrandMatch(null);
            setIsLoadingProducts(true);

            fetch('/api/products/analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    startDate,
                    endDate,
                    search: debouncedQuery,
                    page: 1,
                    pageSize: 10,
                }),
            })
                .then(res => res.json())
                .then(data => {
                    setProductResults(data.products || []);
                    setIsLoadingProducts(false);
                })
                .catch(() => {
                    setProductResults([]);
                    setIsLoadingProducts(false);
                });
        }
    }, [debouncedQuery, filterData.brands, startDate, endDate]);

    const handleClear = useCallback(() => {
        setQuery('');
        setDebouncedQuery('');
        setSearchType('idle');
        setBrandMatch(null);
        setProductResults([]);
        inputRef.current?.focus();
    }, []);

    const handleBlur = () => {
        // Delay to allow taps on results
        setTimeout(() => setIsFocused(false), 200);
    };

    const showResults = searchType !== 'idle' && debouncedQuery.length > 0;
    const isLoading = (searchType === 'brand' && brandMatch?.loading) || (searchType === 'product' && isLoadingProducts);

    return (
        <div className="px-4 relative">
            <div className={cn(
                "flex items-center gap-3 bg-slate-800 rounded-2xl px-4 h-12 border transition-colors",
                isFocused ? "border-blue-500/50 bg-slate-800/80" : "border-slate-700"
            )}>
                {isLoading ? (
                    <Loader2 size={18} className="text-slate-500 animate-spin shrink-0" />
                ) : (
                    <Search size={18} className="text-slate-500 shrink-0" />
                )}
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={handleBlur}
                    placeholder="Buscar marca, artículo, código..."
                    className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                />
                {query && (
                    <button
                        onClick={handleClear}
                        className="p-1 text-slate-500 active:text-white"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            {/* Search Results Dropdown */}
            {showResults && (
                <MobileSearchResults
                    searchType={searchType}
                    brandMatch={brandMatch}
                    productResults={productResults}
                    isLoading={!!isLoading}
                    startDate={startDate}
                    endDate={endDate}
                    onClose={() => { setQuery(''); setDebouncedQuery(''); }}
                />
            )}
        </div>
    );
}
