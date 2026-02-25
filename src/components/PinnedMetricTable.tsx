'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useFilters } from '@/context/FilterContext';
import { X, ArrowUpDown, ArrowUp, ArrowDown, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { exportToXlsx, ExportColumn } from '@/lib/export-xlsx';
import { ExportButton } from './ExportButton';

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

// Celda con valor y variación debajo entre paréntesis
function ValueWithVariation({
    value,
    anterior,
    isMoney = false,
    colorPositive = "text-emerald-400",
    colorNegative = "text-red-400",
    colorNeutral = "text-slate-300"
}: {
    value: number;
    anterior?: number;
    isMoney?: boolean;
    colorPositive?: string;
    colorNegative?: string;
    colorNeutral?: string;
}) {
    const hasAnterior = anterior !== undefined && anterior !== null && anterior !== 0;
    const variacion = hasAnterior ? calcularVariacion(value, anterior) : null;
    const esMayor = hasAnterior && value > anterior;
    const esMenor = hasAnterior && value < anterior;

    const valueColor = hasAnterior
        ? (esMayor ? colorPositive : esMenor ? colorNegative : colorNeutral)
        : colorNeutral;

    return (
        <div className="flex flex-col items-end">
            <span className={cn("tabular-nums font-semibold text-sm", valueColor)}>
                {isMoney ? '$ ' : ''}{Math.round(value)?.toLocaleString()}
            </span>
            {hasAnterior && variacion !== null && (
                <span className={cn(
                    "text-[10px] tabular-nums",
                    esMayor ? "text-emerald-500" : esMenor ? "text-red-500" : "text-slate-500"
                )}>
                    ({esMayor ? '+' : ''}{variacion.toFixed(0)}%)
                </span>
            )}
        </div>
    );
}

// Celda simple para valores anteriores (sin variación)
function ValueCell({ value, isMoney = false, color = "text-slate-500" }: { value: number; isMoney?: boolean; color?: string }) {
    return (
        <span className={cn("tabular-nums text-sm", color)}>
            {isMoney ? '$ ' : ''}{Math.round(value)?.toLocaleString()}
        </span>
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
                "bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex-1 min-w-[400px] max-w-[calc(50%-0.5rem)]",
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
                <div className="flex items-center gap-1">
                    <ExportButton
                        onClick={() => {
                            const cols: ExportColumn<DataRow>[] = [
                                { header: groupByLabel, accessor: r => r.label },
                                ...(showComparison ? [{ header: 'Unid. Ant.', accessor: (r: DataRow) => r.unitsAnterior ?? '' }] : []),
                                { header: 'Unidades', accessor: r => r.units },
                                ...(showComparison ? [{ header: 'Ventas Ant. $', accessor: (r: DataRow) => r.salesAnterior != null ? Math.round(r.salesAnterior) : '' }] : []),
                                { header: 'Ventas $', accessor: r => Math.round(r.sales) },
                                { header: 'Utilidad %', accessor: r => Number(r.utility.toFixed(1)) },
                            ];
                            exportToXlsx(sortedData, cols, `metricas-${groupByLabel.toLowerCase()}`, groupByLabel);
                        }}
                        disabled={data.length === 0}
                    />
                    <button
                        onClick={() => onClose(id)}
                        className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto max-h-[1200px] custom-scrollbar">
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
                                <th className="p-2 font-semibold text-slate-400 uppercase text-[10px]">
                                    <button
                                        onClick={() => handleSort('label')}
                                        className="flex items-center space-x-1 hover:text-white transition-colors"
                                    >
                                        <span>Etiqueta</span>
                                        {sortColumn === 'label' ? (
                                            sortDirection === 'asc' ? <ArrowUp size={10} className="text-blue-400" /> : <ArrowDown size={10} className="text-blue-400" />
                                        ) : (
                                            <ArrowUpDown size={10} className="opacity-50" />
                                        )}
                                    </button>
                                </th>
                                {hasAnyComparison && !isStockMetric && (
                                    <th className="p-2 font-semibold text-slate-500 uppercase text-[10px] text-right">Ant Uds</th>
                                )}
                                <th className="p-2 font-semibold text-slate-400 uppercase text-[10px] text-right">
                                    <button
                                        onClick={() => handleSort('units')}
                                        className="flex items-center justify-end space-x-1 hover:text-white transition-colors w-full"
                                    >
                                        <span>{isStockMetric ? 'Stock' : 'Uds'}</span>
                                        {sortColumn === 'units' ? (
                                            sortDirection === 'asc' ? <ArrowUp size={10} className="text-blue-400" /> : <ArrowDown size={10} className="text-blue-400" />
                                        ) : (
                                            <ArrowUpDown size={10} className="opacity-50" />
                                        )}
                                    </button>
                                </th>
                                {!isStockMetric && (
                                    <>
                                        {hasAnyComparison && (
                                            <th className="p-2 font-semibold text-slate-500 uppercase text-[10px] text-right">Ant $</th>
                                        )}
                                        <th className="p-2 font-semibold text-slate-400 uppercase text-[10px] text-right">
                                            <button
                                                onClick={() => handleSort('sales')}
                                                className="flex items-center justify-end space-x-1 hover:text-white transition-colors w-full"
                                            >
                                                <span>Venta</span>
                                                {sortColumn === 'sales' ? (
                                                    sortDirection === 'asc' ? <ArrowUp size={10} className="text-blue-400" /> : <ArrowDown size={10} className="text-blue-400" />
                                                ) : (
                                                    <ArrowUpDown size={10} className="opacity-50" />
                                                )}
                                            </button>
                                        </th>
                                        <th className="p-2 font-semibold text-slate-400 uppercase text-[10px] text-right">
                                            <button
                                                onClick={() => handleSort('utility')}
                                                className="flex items-center justify-end space-x-1 hover:text-white transition-colors w-full"
                                            >
                                                <span>Util</span>
                                                {sortColumn === 'utility' ? (
                                                    sortDirection === 'asc' ? <ArrowUp size={10} className="text-blue-400" /> : <ArrowDown size={10} className="text-blue-400" />
                                                ) : (
                                                    <ArrowUpDown size={10} className="opacity-50" />
                                                )}
                                            </button>
                                        </th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {sortedData.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-800/20 transition-colors">
                                    <td className="p-2 text-white font-medium truncate max-w-[140px] text-sm">{item.label || 'N/A'}</td>
                                    {hasAnyComparison && !isStockMetric && (
                                        <td className="p-2 text-right">
                                            <ValueCell value={item.unitsAnterior || 0} />
                                        </td>
                                    )}
                                    <td className="p-2 text-right">
                                        {isStockMetric ? (
                                            <ValueCell value={item.units} color="text-cyan-400" />
                                        ) : (
                                            <ValueWithVariation value={item.units} anterior={item.unitsAnterior} />
                                        )}
                                    </td>
                                    {!isStockMetric && (
                                        <>
                                            {hasAnyComparison && (
                                                <td className="p-2 text-right">
                                                    <ValueCell value={item.salesAnterior || 0} isMoney />
                                                </td>
                                            )}
                                            <td className="p-2 text-right">
                                                <ValueWithVariation value={item.sales} anterior={item.salesAnterior} isMoney />
                                            </td>
                                            <td className="p-2 text-right tabular-nums text-sm">
                                                <span className={item.utility >= 0 ? "text-emerald-500" : "text-red-500"}>
                                                    {Math.round(item.utility)}%
                                                </span>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-800/20 font-bold border-t border-slate-800 sticky bottom-0">
                            <tr>
                                <td className="p-2 text-slate-400 text-sm">TOTAL</td>
                                {hasAnyComparison && !isStockMetric && (
                                    <td className="p-2 text-right">
                                        <ValueCell value={totalUnitsAnterior} />
                                    </td>
                                )}
                                <td className="p-2 text-right">
                                    {isStockMetric ? (
                                        <span className="tabular-nums font-bold text-sm text-cyan-400">{Math.round(totalUnits).toLocaleString()}</span>
                                    ) : (
                                        <ValueWithVariation value={totalUnits} anterior={totalUnitsAnterior} colorNeutral="text-white" />
                                    )}
                                </td>
                                {!isStockMetric && (
                                    <>
                                        {hasAnyComparison && (
                                            <td className="p-2 text-right">
                                                <ValueCell value={totalSalesAnterior} isMoney />
                                            </td>
                                        )}
                                        <td className="p-2 text-right">
                                            <ValueWithVariation value={totalSales} anterior={totalSalesAnterior} isMoney />
                                        </td>
                                        <td className="p-2"></td>
                                    </>
                                )}
                            </tr>
                        </tfoot>
                    </table>
                )}
            </div>
        </motion.div>
    );
}
