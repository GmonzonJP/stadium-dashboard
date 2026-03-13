'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Filter, ArrowUp, ArrowDown, Check, X, Search } from 'lucide-react';

export type SortDirection = 'asc' | 'desc' | null;

export interface ColumnSort {
  key: string;
  direction: SortDirection;
}

export interface ColumnFilter {
  key: string;
  values: Set<string>;
}

interface SmartColumnHeaderProps {
  label: string;
  columnKey: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  filterable?: boolean;
  currentSort: ColumnSort | null;
  onSort: (key: string, direction: SortDirection) => void;
  filterValues?: string[];
  activeFilter?: Set<string>;
  onFilter?: (key: string, values: Set<string>) => void;
  className?: string;
}

export function SmartColumnHeader({
  label,
  columnKey,
  align = 'left',
  sortable = true,
  filterable = false,
  currentSort,
  onSort,
  filterValues = [],
  activeFilter,
  onFilter,
  className = '',
}: SmartColumnHeaderProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [tempSelected, setTempSelected] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const filterBtnRef = useRef<HTMLButtonElement>(null);

  const isSorted = currentSort?.key === columnKey && currentSort.direction !== null;
  const sortDirection = currentSort?.key === columnKey ? currentSort.direction : null;
  const isFiltered = activeFilter && activeFilter.size > 0;

  // Sync tempSelected with activeFilter when opening
  useEffect(() => {
    if (isFilterOpen) {
      setTempSelected(new Set(activeFilter || []));
      setSearchTerm('');
    }
  }, [isFilterOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isFilterOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        filterBtnRef.current &&
        !filterBtnRef.current.contains(e.target as Node)
      ) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isFilterOpen]);

  const filteredValues = useMemo(() => {
    if (!searchTerm) return filterValues;
    const lower = searchTerm.toLowerCase();
    return filterValues.filter(v => v.toLowerCase().includes(lower));
  }, [filterValues, searchTerm]);

  // Click en label → cycle sort: null → asc → desc → null
  const handleSortClick = () => {
    if (!sortable) return;
    const nextDir: SortDirection =
      sortDirection === null ? 'asc' :
      sortDirection === 'asc' ? 'desc' : null;
    onSort(columnKey, nextDir);
  };

  const handleApplyFilter = () => {
    onFilter?.(columnKey, tempSelected);
    setIsFilterOpen(false);
  };

  const handleClearFilter = () => {
    onFilter?.(columnKey, new Set());
    setIsFilterOpen(false);
  };

  const toggleValue = (val: string) => {
    const next = new Set(tempSelected);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    setTempSelected(next);
  };

  const selectAll = () => setTempSelected(new Set(filteredValues));
  const selectNone = () => setTempSelected(new Set());

  const alignClass = align === 'right' ? 'justify-end text-right' : align === 'center' ? 'justify-center text-center' : 'justify-start text-left';

  return (
    <th className={`relative px-3 py-3 text-xs font-bold uppercase tracking-wider select-none ${className}`}>
      <div className={`flex items-center gap-0.5 ${alignClass}`}>
        {/* Label + sort icon: clickable for sorting */}
        <button
          onClick={handleSortClick}
          className={`flex items-center gap-1 group transition-colors ${
            sortable ? 'cursor-pointer' : 'cursor-default'
          } ${
            isSorted
              ? 'text-blue-400'
              : 'text-gray-500 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300'
          }`}
        >
          <span className="truncate">{label}</span>
          {sortable && (
            <span className={`flex-shrink-0 transition-opacity ${isSorted ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`}>
              {sortDirection === 'asc' ? <ArrowUp size={12} /> : sortDirection === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} className="opacity-30" />}
            </span>
          )}
        </button>

        {/* Filter icon: separate button for filter dropdown */}
        {filterable && filterValues.length > 0 && (
          <button
            ref={filterBtnRef}
            onClick={(e) => { e.stopPropagation(); setIsFilterOpen(!isFilterOpen); }}
            className={`flex-shrink-0 p-0.5 rounded transition-colors relative ${
              isFiltered
                ? 'text-blue-400 hover:text-blue-300'
                : 'text-gray-400 dark:text-slate-600 hover:text-gray-600 dark:hover:text-slate-400'
            }`}
            title="Filtrar"
          >
            <Filter size={11} />
            {isFiltered && (
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-blue-400" />
            )}
          </button>
        )}
      </div>

      {/* Filter dropdown */}
      {isFilterOpen && filterable && filterValues.length > 0 && (
        <div
          ref={dropdownRef}
          className={`absolute top-full z-50 mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 min-w-[200px] max-w-[280px] ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-2">
            <div className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase mb-1 px-1">Filtrar</div>
            {/* Search box */}
            {filterValues.length > 8 && (
              <div className="relative mb-2">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full pl-7 pr-2 py-1.5 text-xs rounded border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-slate-300 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  autoFocus
                />
              </div>
            )}

            {/* Select all / none */}
            <div className="flex gap-2 mb-1 px-1">
              <button onClick={selectAll} className="text-[10px] text-blue-500 hover:underline">
                Todos
              </button>
              <button onClick={selectNone} className="text-[10px] text-blue-500 hover:underline">
                Ninguno
              </button>
            </div>

            {/* Values list */}
            <div className="max-h-[200px] overflow-auto space-y-0.5">
              {filteredValues.map((val) => (
                <label
                  key={val}
                  className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 text-xs text-gray-700 dark:text-slate-300"
                >
                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                    tempSelected.has(val)
                      ? 'bg-blue-500 border-blue-500'
                      : 'border-gray-300 dark:border-slate-600'
                  }`}>
                    {tempSelected.has(val) && <Check size={10} className="text-white" />}
                  </div>
                  <span className="truncate">{val || '(vacío)'}</span>
                </label>
              ))}
              {filteredValues.length === 0 && (
                <div className="px-2 py-2 text-xs text-gray-400 text-center">Sin resultados</div>
              )}
            </div>

            {/* Apply / Clear buttons */}
            <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100 dark:border-slate-700">
              <button
                onClick={handleApplyFilter}
                className="flex-1 px-2 py-1.5 text-xs font-medium bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                Aplicar
              </button>
              {isFiltered && (
                <button
                  onClick={handleClearFilter}
                  className="px-2 py-1.5 text-xs text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </th>
  );
}
