'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useFilters } from '@/context/FilterContext';
import { X, ArrowUpDown, ArrowUp, ArrowDown, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface PinnedMetricTableProps {
    id: string;
    title: string;
    groupBy: string;
    groupByLabel: string;
    onClose: (id: string) => void;
    /** Mostrar columnas comparativas con año anterior */
    showComparison?: boolean;
    /** Si es true, aplica el efecto de highlight y scroll */
    isNew?: boolean;
}

interface DataRow {
    label: string;
    units: number;
    sales: number;
    utility: number;
    // Datos del período anterior para comparativos
    unitsAnterior?: number;
    salesAnterior?: number;
}

// Helper para calcular variación porcentual
function calcularVariacion(actual: number, anterior: number): number | null {
    if (!anterior || anterior === 0) return null;
    return ((actual - anterior) / anterior) * 100;
}

// Componente para mostrar comparativo con color
function ComparativoCell({ actual, anterior, isMoney = false }: { actual: number; anterior?: number; isMoney?: boolean }) {
    if (anterior === undefined || anterior === null) {
        return (
            <span className={cn("tabular-nums", isMoney ? "text-emerald-400" : "text-slate-300")}>
                {isMoney ? '$' : ''}{actual?.toLocaleString()}
            </span>
        );
    }

    const variacion = calcularVariacion(actual, anterior);
    const esPositivo = actual >= anterior;
    const esMayor = actual > anterior;
    const esMenor = actual < anterior;

    return (
        <div className="flex flex-col items-end">
            <div className="flex items-center gap-1.5">
                <span className={cn(
                    "tabular-nums font-bold",
                    esMayor ? "text-emerald-400" : esMenor ? "text-red-400" : "text-slate-300"
                )}>
                    {isMoney ? '$' : ''}{actual?.toLocaleString()}
                </span>
                {esMayor && <TrendingUp size={12} className="text-emerald-400" />}
                {esMenor && <TrendingDown size={12} className="text-red-400" />}
                {!esMayor && !esMenor && <Minus size={12} className="text-slate-500" />}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-500">
                <span>vs {isMoney ? '$' : ''}{anterior?.toLocaleString()}</span>
                {variacion !== null && (
                    <span className={cn(
                        "font-medium",
                        esPositivo ? "text-emerald-500" : "text-red-500"
                    )}>
                        ({esPositivo ? '+' : ''}{variacion.toFixed(1)}%)
                    </span>
                )}
            </div>
        </div>
    );
}

export function PinnedMetricTable({ id, title, groupBy, groupByLabel, onClose, showComparison = true, isNew = false }: PinnedMetricTableProps) {
    const { selectedFilters } = useFilters();
    const [data, setData] = useState<DataRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showHighlight, setShowHighlight] = useState(isNew);
    const tableRef = useRef<HTMLDivElement>(null);

    // Sorting state: default to sales descending
    const [sortColumn, setSortColumn] = useState<string>('sales');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    // Scroll into view and highlight when new
    useEffect(() => {
        if (isNew && tableRef.current) {
            setTimeout(() => {
                tableRef.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }, 100);
            // Remove highlight after animation completes
            const timer = setTimeout(() => {
                setShowHighlight(false);
            }, 2100);
            return () => clearTimeout(timer);
        }
    }, [isNew]);

    useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                const response = await fetch('/api/metrics/details', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filters: selectedFilters,
                        groupBy,
                        metricTitle: title,
                        includeComparison: showComparison
                    }),
                });

                if (!response.ok) throw new Error('Failed to fetch details');

                const result = await response.json();
                setData(result);
            } catch (err) {
                console.error('Error fetching metric details:', err);
                setError('Error al cargar datos');
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [selectedFilters, groupBy, showComparison]);

    // Handle column sorting
    const handleSort = (column: string) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('desc');
        }
    };
    
    // Sort data
    const sortedData = [...data].sort((a, b) => {
        let aValue: any;
        let bValue: any;
        
        switch (sortColumn) {
            case 'label':
                aValue = (a.label || '').toLowerCase();
                bValue = (b.label || '').toLowerCase();
                break;
            case 'units':
                aValue = Number(a.units) || 0;
                bValue = Number(b.units) || 0;
                break;
            case 'sales':
                aValue = Number(a.sales) || 0;
                bValue = Number(b.sales) || 0;
                break;
            case 'percent':
                const totalSales = data.reduce((sum, item) => sum + (item.sales || 0), 0);
                aValue = totalSales > 0 ? (a.sales / totalSales) * 100 : 0;
                bValue = totalSales > 0 ? (b.sales / totalSales) * 100 : 0;
                break;
            case 'utility':
                aValue = Number(a.utility) || 0;
                bValue = Number(b.utility) || 0;
                break;
            default:
                return 0;
        }
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
            return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        } else {
            return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }
    });
    
    const totalSales = data.reduce((sum, item) => sum + (item.sales || 0), 0);
    const totalUnits = data.reduce((sum, item) => sum + (item.units || 0), 0);
    const totalSalesAnterior = data.reduce((sum, item) => sum + (item.salesAnterior || 0), 0);
    const totalUnitsAnterior = data.reduce((sum, item) => sum + (item.unitsAnterior || 0), 0);
    const hasAnyComparison = showComparison && data.some(item => item.unitsAnterior !== undefined || item.salesAnterior !== undefined);
    const isStockMetric = title === 'Stock Estimado';

    return (
        <motion.div
            ref={tableRef}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={cn(
                "bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-xl mb-6 last:mb-0",
                showHighlight && "apple-highlight"
            )}
        >
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-800/20">
                <div>
                    <h3 className="text-white font-bold">{title}</h3>
                    <div className="flex items-center gap-3">
                        <p className="text-xs text-slate-500">Agrupado por: <span className="text-blue-400 font-medium">{groupByLabel}</span></p>
                        {hasAnyComparison && (
                            <span className="text-[10px] text-slate-600 bg-slate-800 px-2 py-0.5 rounded">
                                Comparativo vs Año Anterior
                            </span>
                        )}
                    </div>
                </div>
                <button
                    onClick={() => onClose(id)}
                    className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                >
                    <X size={18} />
                </button>
            </div>

            <div className="overflow-x-auto max-h-[400px] custom-scrollbar">
                {isLoading ? (
                    <div className="flex items-center justify-center p-12">
                        <Loader2 className="animate-spin text-blue-500" size={30} />
                    </div>
                ) : error ? (
                    <div className="p-8 text-center text-red-400 text-sm">{error}</div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-800/30 sticky top-0 z-10 backdrop-blur-sm">
                            <tr>
                                <th className="p-3 font-semibold text-slate-400 uppercase text-xs">
                                    <button
                                        onClick={() => handleSort('label')}
                                        className="flex items-center space-x-2 hover:text-white transition-colors"
                                    >
                                        <span>Etiqueta</span>
                                        {sortColumn === 'label' ? (
                                            sortDirection === 'asc' ? <ArrowUp size={12} className="text-blue-400" /> : <ArrowDown size={12} className="text-blue-400" />
                                        ) : (
                                            <ArrowUpDown size={12} className="opacity-50" />
                                        )}
                                    </button>
                                </th>
                                <th className="p-3 font-semibold text-slate-400 uppercase text-xs text-right">
                                    <button
                                        onClick={() => handleSort('units')}
                                        className="flex items-center justify-end space-x-2 hover:text-white transition-colors w-full"
                                    >
                                        <span>{isStockMetric ? 'Stock' : 'Unidades'}</span>
                                        {sortColumn === 'units' ? (
                                            sortDirection === 'asc' ? <ArrowUp size={12} className="text-blue-400" /> : <ArrowDown size={12} className="text-blue-400" />
                                        ) : (
                                            <ArrowUpDown size={12} className="opacity-50" />
                                        )}
                                    </button>
                                </th>
                                {!isStockMetric && (
                                    <>
                                        <th className="p-3 font-semibold text-slate-400 uppercase text-xs text-right">
                                            <button
                                                onClick={() => handleSort('sales')}
                                                className="flex items-center justify-end space-x-2 hover:text-white transition-colors w-full"
                                            >
                                                <span>Venta ($)</span>
                                                {sortColumn === 'sales' ? (
                                                    sortDirection === 'asc' ? <ArrowUp size={12} className="text-blue-400" /> : <ArrowDown size={12} className="text-blue-400" />
                                                ) : (
                                                    <ArrowUpDown size={12} className="opacity-50" />
                                                )}
                                            </button>
                                        </th>
                                        <th className="p-3 font-semibold text-slate-400 uppercase text-xs text-right">
                                            <button
                                                onClick={() => handleSort('utility')}
                                                className="flex items-center justify-end space-x-2 hover:text-white transition-colors w-full"
                                            >
                                                <span>Utilidad</span>
                                                {sortColumn === 'utility' ? (
                                                    sortDirection === 'asc' ? <ArrowUp size={12} className="text-blue-400" /> : <ArrowDown size={12} className="text-blue-400" />
                                                ) : (
                                                    <ArrowUpDown size={12} className="opacity-50" />
                                                )}
                                            </button>
                                        </th>
                                    </>
                                )}
                                <th className="p-3 font-semibold text-slate-400 uppercase text-xs text-right">
                                    <button
                                        onClick={() => handleSort('percent')}
                                        className="flex items-center justify-end space-x-2 hover:text-white transition-colors w-full"
                                    >
                                        <span>% Total</span>
                                        {sortColumn === 'percent' ? (
                                            sortDirection === 'asc' ? <ArrowUp size={12} className="text-blue-400" /> : <ArrowDown size={12} className="text-blue-400" />
                                        ) : (
                                            <ArrowUpDown size={12} className="opacity-50" />
                                        )}
                                    </button>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {sortedData.map((item, idx) => {
                                const percent = isStockMetric
                                    ? (totalUnits > 0 ? (item.units / totalUnits) * 100 : 0)
                                    : (totalSales > 0 ? (item.sales / totalSales) * 100 : 0);

                                const hasComparison = showComparison && (item.unitsAnterior !== undefined || item.salesAnterior !== undefined);

                                return (
                                    <tr key={idx} className="hover:bg-slate-800/20 transition-colors">
                                        <td className="p-3 text-white font-medium truncate max-w-[200px]">{item.label || 'N/A'}</td>
                                        <td className="p-3 text-right">
                                            {isStockMetric ? (
                                                <span className="text-cyan-400 tabular-nums font-bold">{item.units?.toLocaleString()}</span>
                                            ) : hasComparison ? (
                                                <ComparativoCell actual={item.units} anterior={item.unitsAnterior} />
                                            ) : (
                                                <span className="text-slate-300 tabular-nums font-bold">{item.units?.toLocaleString()}</span>
                                            )}
                                        </td>
                                        {!isStockMetric && (
                                            <>
                                                <td className="p-3 text-right">
                                                    {hasComparison ? (
                                                        <ComparativoCell actual={item.sales} anterior={item.salesAnterior} isMoney />
                                                    ) : (
                                                        <span className="text-emerald-400 tabular-nums font-bold">${item.sales?.toLocaleString()}</span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-right tabular-nums">
                                                    <span className={item.utility >= 0 ? "text-emerald-500" : "text-red-500"}>
                                                        {item.utility}%
                                                    </span>
                                                </td>
                                            </>
                                        )}
                                        <td className="p-3 text-right text-slate-400 tabular-nums">
                                            <div className="flex items-center justify-end gap-2">
                                                <span className="text-xs">{percent.toFixed(1)}%</span>
                                                <div className="w-12 h-1 bg-slate-800 rounded-full overflow-hidden">
                                                    <div className={`h-full ${isStockMetric ? 'bg-cyan-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(percent, 100)}%` }}></div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-slate-800/20 font-bold border-t border-slate-800 sticky bottom-0">
                            <tr>
                                <td className="p-3 text-slate-400">TOTAL</td>
                                <td className="p-3 text-right">
                                    {isStockMetric ? (
                                        <span className="text-cyan-400">{totalUnits.toLocaleString()}</span>
                                    ) : hasAnyComparison ? (
                                        <ComparativoCell actual={totalUnits} anterior={totalUnitsAnterior} />
                                    ) : (
                                        <span className="text-white">{totalUnits.toLocaleString()}</span>
                                    )}
                                </td>
                                {!isStockMetric && (
                                    <>
                                        <td className="p-3 text-right">
                                            {hasAnyComparison ? (
                                                <ComparativoCell actual={totalSales} anterior={totalSalesAnterior} isMoney />
                                            ) : (
                                                <span className="text-emerald-500">${totalSales.toLocaleString()}</span>
                                            )}
                                        </td>
                                        <td className="p-3"></td>
                                    </>
                                )}
                                <td className="p-3 text-right text-slate-500">100%</td>
                            </tr>
                        </tfoot>
                    </table>
                )}
            </div>
        </motion.div>
    );
}
