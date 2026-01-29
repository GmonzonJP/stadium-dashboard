'use client';

import React, { useEffect, useState } from 'react';
import { useFilters } from '@/context/FilterContext';
import { DashboardContainer } from '@/components/DashboardContainer';
import { motion } from 'framer-motion';
import { ArrowUpDown, ArrowUp, ArrowDown, Image as ImageIcon, ExternalLink, Calendar, Search } from 'lucide-react';
import { cn, getProductImageUrl } from '@/lib/utils';
import { ProductDetail } from '@/components/ProductDetail';
import { EditablePriceCell } from '@/components/EditablePriceCell';
import { AddToPriceQueueModal } from '@/components/AddToPriceQueueModal';

export default function RecompraPage() {
    const { selectedFilters } = useFilters();
    const [data, setData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

    // Price edit modal state
    const [priceEditData, setPriceEditData] = useState<{
        baseCol: string;
        descripcion: string;
        precioActual: number;
        precioNuevo: number;
    } | null>(null);
    
    // Sorting state: column and direction ('asc' | 'desc')
    const [sortColumn, setSortColumn] = useState<string>('unidades');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    // Calculate period days
    const periodDays = selectedFilters.startDate && selectedFilters.endDate
        ? Math.ceil((new Date(selectedFilters.endDate).getTime() - new Date(selectedFilters.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1
        : 0;

    // Debounce search update
    const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        async function fetchRecompra() {
            setIsLoading(true);
            setError(null);
            try {
                const requestBody = { ...selectedFilters, search: debouncedSearch };
                
                const response = await fetch('/api/recompra', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody),
                    cache: 'no-store'
                });
                const result = await response.json();

                if (result.error) {
                    setError(result.details || result.error);
                } else if (Array.isArray(result)) {
                    setData(result);
                } else {
                    setData([]);
                }
            } catch (err) {
                console.error('Error fetching Recompra:', err);
                setError('Error al conectar con el servidor');
            } finally {
                setIsLoading(false);
            }
        }

        fetchRecompra();
    }, [selectedFilters, debouncedSearch]);

    // Filter data: first by brand (if selected), then by search query
    const filteredData = Array.isArray(data) ? data.filter(item => {
        // If brands are selected, ONLY show items from those brands (strict filtering)
        if (selectedFilters.brands?.length && selectedFilters.brands.length > 0) {
            // Handle both string and number formats for IdMarca
            // Also handle cases where IdMarca might be "009" instead of 9
            let itemBrandId: number | null = null;
            if (item.IdMarca != null) {
                // Try to convert to number, handling strings like "009" -> 9
                const num = Number(item.IdMarca);
                if (!isNaN(num)) {
                    itemBrandId = num;
                } else if (typeof item.IdMarca === 'string') {
                    // Try removing leading zeros
                    const trimmed = item.IdMarca.replace(/^0+/, '');
                    const numTrimmed = Number(trimmed);
                    if (!isNaN(numTrimmed)) {
                        itemBrandId = numTrimmed;
                    }
                }
            }
            
            if (itemBrandId === null) {
                return false; // Exclude items with invalid brand IDs
            }
            
            // STRICT MATCH: Item brand ID must be in the selected brands list
            const isBrandMatch = selectedFilters.brands.some(brandId => {
                const filterBrandId = Number(brandId);
                return filterBrandId === itemBrandId;
            });
            
            if (!isBrandMatch) {
                return false; // Exclude items not matching selected brands
            }
        }
        
        // Then filter by search query if provided
        if (searchQuery.trim()) {
            return item.DescripcionMarca?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                   item.BaseCol?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                   item.descripcionCorta?.toLowerCase().includes(searchQuery.toLowerCase());
        }
        
        return true;
    }) : [];
    
    // Handle column sorting
    const handleSort = (column: string) => {
        if (sortColumn === column) {
            // Toggle direction if clicking the same column
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            // Set new column and default to descending
            setSortColumn(column);
            setSortDirection('desc');
        }
    };
    
    // Sort filtered data
    const sortedData = [...filteredData].sort((a, b) => {
        let aValue: any;
        let bValue: any;
        
        switch (sortColumn) {
            case 'detalles':
                aValue = `${a.DescripcionMarca || ''} ${a.DescripcionClase || ''} ${a.DescripcionGenero || ''} ${a.descripcionCorta || ''}`.toLowerCase();
                bValue = `${b.DescripcionMarca || ''} ${b.DescripcionClase || ''} ${b.DescripcionGenero || ''} ${b.descripcionCorta || ''}`.toLowerCase();
                break;
            case 'baseCol':
                aValue = (a.BaseCol || '').toLowerCase();
                bValue = (b.BaseCol || '').toLowerCase();
                break;
            case 'ultimoCosto':
                aValue = Number(a.ultimoCosto) || 0;
                bValue = Number(b.ultimoCosto) || 0;
                break;
            case 'stock':
                aValue = Number(a.stock) || 0;
                bValue = Number(b.stock) || 0;
                break;
            case 'unidades':
                aValue = Number(a.unidades) || 0;
                bValue = Number(b.unidades) || 0;
                break;
            case 'venta':
                aValue = Number(a.Venta) || 0;
                bValue = Number(b.Venta) || 0;
                break;
            case 'costoVenta':
                aValue = Number(a.costoVenta) || 0;
                bValue = Number(b.costoVenta) || 0;
                break;
            case 'margenBruto':
                aValue = Number(a.margenBruto) || 0;
                bValue = Number(b.margenBruto) || 0;
                break;
            case 'margen':
                aValue = Number(a.margen) || 0;
                bValue = Number(b.margen) || 0;
                break;
            case 'precioUnitarioLista':
                aValue = Number(a.precioUnitarioLista) || 0;
                bValue = Number(b.precioUnitarioLista) || 0;
                break;
            case 'diasStock':
                aValue = Number(a.diasStock) || 0;
                bValue = Number(b.diasStock) || 0;
                break;
            default:
                return 0;
        }
        
        // Compare values
        if (typeof aValue === 'string' && typeof bValue === 'string') {
            if (sortDirection === 'asc') {
                return aValue.localeCompare(bValue);
            } else {
                return bValue.localeCompare(aValue);
            }
        } else {
            if (sortDirection === 'asc') {
                return aValue - bValue;
            } else {
                return bValue - aValue;
            }
        }
    });
    

    return (
        <DashboardContainer>
            <div className="space-y-8 pb-12">

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-extrabold text-white tracking-tight mb-1">Análisis de Recompra</h2>
                    <p className="text-slate-500 text-sm font-medium">
                        {selectedFilters.startDate && selectedFilters.endDate 
                            ? `Período: ${selectedFilters.startDate} - ${selectedFilters.endDate} (${periodDays} días)`
                            : 'Gestión de stock y rotación de productos'
                        }
                    </p>
                </div>

                <div className="relative w-full md:w-80 group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar en tabla..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-slate-200"
                    />
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-400 text-sm font-medium mb-4 flex items-center justify-between">
                    <span>Error: {error}</span>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold transition-colors"
                    >
                        REINTENTAR
                    </button>
                </div>
            )}

            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-sm">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-800/30 border-b border-slate-800">
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest">
                                    <button
                                        onClick={() => handleSort('detalles')}
                                        className="flex items-center space-x-2 hover:text-white transition-colors w-full text-left"
                                    >
                                        <span>Detalles</span>
                                        {sortColumn === 'detalles' ? (
                                            sortDirection === 'asc' ? <ArrowUp size={12} className="text-blue-400" /> : <ArrowDown size={12} className="text-blue-400" />
                                        ) : (
                                            <ArrowUpDown size={12} className="opacity-50" />
                                        )}
                                    </button>
                                </th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest">
                                    <button
                                        onClick={() => handleSort('baseCol')}
                                        className="flex items-center space-x-2 hover:text-white transition-colors w-full text-left"
                                    >
                                        <span>Base Color</span>
                                        {sortColumn === 'baseCol' ? (
                                            sortDirection === 'asc' ? <ArrowUp size={12} className="text-blue-400" /> : <ArrowDown size={12} className="text-blue-400" />
                                        ) : (
                                            <ArrowUpDown size={12} className="opacity-50" />
                                        )}
                                    </button>
                                </th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Imagen</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">
                                    <button
                                        onClick={() => handleSort('ultimoCosto')}
                                        className="flex items-center justify-end space-x-2 hover:text-white transition-colors w-full"
                                    >
                                        <span>Ultimo Costo</span>
                                        {sortColumn === 'ultimoCosto' ? (
                                            sortDirection === 'asc' ? <ArrowUp size={12} className="text-blue-400" /> : <ArrowDown size={12} className="text-blue-400" />
                                        ) : (
                                            <ArrowUpDown size={12} className="opacity-50" />
                                        )}
                                    </button>
                                </th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">
                                    <button
                                        onClick={() => handleSort('stock')}
                                        className="flex items-center justify-end space-x-2 hover:text-white transition-colors w-full"
                                    >
                                        <span>Stock</span>
                                        {sortColumn === 'stock' ? (
                                            sortDirection === 'asc' ? <ArrowUp size={12} className="text-blue-400" /> : <ArrowDown size={12} className="text-blue-400" />
                                        ) : (
                                            <ArrowUpDown size={12} className="opacity-50" />
                                        )}
                                    </button>
                                </th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">
                                    <button
                                        onClick={() => handleSort('unidades')}
                                        className="flex items-center justify-end space-x-2 hover:text-white transition-colors w-full"
                                    >
                                        <span>Unidades Vendidas {periodDays > 0 && `(${periodDays} días)`}</span>
                                        {sortColumn === 'unidades' ? (
                                            sortDirection === 'asc' ? <ArrowUp size={12} className="text-blue-400" /> : <ArrowDown size={12} className="text-blue-400" />
                                        ) : (
                                            <ArrowUpDown size={12} className="opacity-50" />
                                        )}
                                    </button>
                                </th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">
                                    <button
                                        onClick={() => handleSort('venta')}
                                        className="flex items-center justify-end space-x-2 hover:text-white transition-colors w-full"
                                    >
                                        <span>Venta</span>
                                        {sortColumn === 'venta' ? (
                                            sortDirection === 'asc' ? <ArrowUp size={12} className="text-blue-400" /> : <ArrowDown size={12} className="text-blue-400" />
                                        ) : (
                                            <ArrowUpDown size={12} className="opacity-50" />
                                        )}
                                    </button>
                                </th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">
                                    <button
                                        onClick={() => handleSort('costoVenta')}
                                        className="flex items-center justify-end space-x-2 hover:text-white transition-colors w-full"
                                    >
                                        <span>Costo Venta</span>
                                        {sortColumn === 'costoVenta' ? (
                                            sortDirection === 'asc' ? <ArrowUp size={12} className="text-blue-400" /> : <ArrowDown size={12} className="text-blue-400" />
                                        ) : (
                                            <ArrowUpDown size={12} className="opacity-50" />
                                        )}
                                    </button>
                                </th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">
                                    <button
                                        onClick={() => handleSort('margenBruto')}
                                        className="flex items-center justify-end space-x-2 hover:text-white transition-colors w-full"
                                    >
                                        <span>Margen Bruto</span>
                                        {sortColumn === 'margenBruto' ? (
                                            sortDirection === 'asc' ? <ArrowUp size={12} className="text-blue-400" /> : <ArrowDown size={12} className="text-blue-400" />
                                        ) : (
                                            <ArrowUpDown size={12} className="opacity-50" />
                                        )}
                                    </button>
                                </th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">
                                    <button
                                        onClick={() => handleSort('margen')}
                                        className="flex items-center justify-end space-x-2 hover:text-white transition-colors w-full"
                                    >
                                        <span>Margen</span>
                                        {sortColumn === 'margen' ? (
                                            sortDirection === 'asc' ? <ArrowUp size={12} className="text-blue-400" /> : <ArrowDown size={12} className="text-blue-400" />
                                        ) : (
                                            <ArrowUpDown size={12} className="opacity-50" />
                                        )}
                                    </button>
                                </th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">
                                    <button
                                        onClick={() => handleSort('precioUnitarioLista')}
                                        className="flex items-center justify-end space-x-2 hover:text-white transition-colors w-full"
                                    >
                                        <span>Precio Unitario Lista</span>
                                        {sortColumn === 'precioUnitarioLista' ? (
                                            sortDirection === 'asc' ? <ArrowUp size={12} className="text-blue-400" /> : <ArrowDown size={12} className="text-blue-400" />
                                        ) : (
                                            <ArrowUpDown size={12} className="opacity-50" />
                                        )}
                                    </button>
                                </th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-center">
                                    <button
                                        onClick={() => handleSort('diasStock')}
                                        className="flex items-center justify-center space-x-2 hover:text-white transition-colors w-full"
                                    >
                                        <span>Días Stock</span>
                                        {sortColumn === 'diasStock' ? (
                                            sortDirection === 'asc' ? <ArrowUp size={12} className="text-blue-400" /> : <ArrowDown size={12} className="text-blue-400" />
                                        ) : (
                                            <ArrowUpDown size={12} className="opacity-50" />
                                        )}
                                    </button>
                                </th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="p-4"><div className="h-4 w-40 bg-slate-800 rounded mb-2"></div><div className="h-3 w-20 bg-slate-800 rounded"></div></td>
                                        <td className="p-4"><div className="h-4 w-24 bg-slate-800 rounded"></div></td>
                                        <td className="p-4 text-center"><div className="w-12 h-12 bg-slate-800 rounded-lg mx-auto"></div></td>
                                        <td className="p-4 text-right"><div className="h-4 w-16 bg-slate-800 rounded ml-auto"></div></td>
                                        <td className="p-4 text-right"><div className="h-4 w-12 bg-slate-800 rounded ml-auto"></div></td>
                                        <td className="p-4 text-right"><div className="h-4 w-12 bg-slate-800 rounded ml-auto"></div></td>
                                        <td className="p-4 text-right"><div className="h-4 w-16 bg-slate-800 rounded ml-auto"></div></td>
                                        <td className="p-4 text-right"><div className="h-4 w-16 bg-slate-800 rounded ml-auto"></div></td>
                                        <td className="p-4 text-right"><div className="h-4 w-16 bg-slate-800 rounded ml-auto"></div></td>
                                        <td className="p-4 text-right"><div className="h-4 w-12 bg-slate-800 rounded ml-auto"></div></td>
                                        <td className="p-4 text-right"><div className="h-4 w-16 bg-slate-800 rounded ml-auto"></div></td>
                                        <td className="p-4 text-center"><div className="h-4 w-16 bg-slate-800 rounded mx-auto"></div></td>
                                        <td className="p-4 text-center"><div className="w-8 h-8 bg-slate-800 rounded-lg mx-auto"></div></td>
                                    </tr>
                                ))
                            ) : sortedData.length === 0 ? (
                                <tr>
                                    <td colSpan={13} className="p-12 text-center text-slate-500 font-medium italic">No se encontraron productos en este periodo</td>
                                </tr>
                            ) : sortedData
                                // Final validation: Only render items that match selected brands
                                .filter(item => {
                                    if (!selectedFilters.brands?.length) return true;
                                    const itemBrandId = Number(item.IdMarca);
                                    return selectedFilters.brands.some(b => Number(b) === itemBrandId);
                                })
                                .map((item, idx) => {
                                    // Create unique key to avoid React rendering issues with duplicate BaseCol
                                    // Using BaseCol + IdMarca + idx ensures uniqueness
                                    const uniqueKey = `recompra-${item.BaseCol}-${item.IdMarca}-${idx}`;
                                    
                                    return (
                                <motion.tr
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: idx * 0.02 }}
                                    key={uniqueKey}
                                    className="hover:bg-slate-800/20 transition-colors group"
                                >
                                    <td className="p-4">
                                        <button
                                            onClick={() => setSelectedProductId(item.BaseCol)}
                                            className="text-left focus:outline-none group/text"
                                        >
                                            <div className="space-y-1">
                                                <div className="font-bold text-white group-hover/text:text-blue-400 transition-colors">{item.DescripcionMarca || 'N/A'}</div>
                                                <div className="text-xs text-slate-400">{item.DescripcionClase || 'N/A'}</div>
                                                <div className="text-xs text-slate-400">{item.DescripcionGenero || 'N/A'}</div>
                                                <div className="text-xs text-slate-500">{item.descripcionCorta || 'N/A'}</div>
                                            </div>
                                        </button>
                                    </td>
                                    <td className="p-4 font-mono text-xs text-slate-300">{item.BaseCol}</td>
                                    <td className="p-4 text-center">
                                        <button
                                            onClick={() => setSelectedProductId(item.BaseCol)}
                                            className="w-14 h-14 bg-white rounded-xl flex items-center justify-center border border-slate-800 group-hover:border-blue-500/50 transition-all overflow-hidden p-1 shadow-lg shadow-black/20 focus:outline-none mx-auto"
                                        >
                                            <img
                                                src={getProductImageUrl(item.BaseCol)}
                                                alt={item.BaseCol}
                                                className="max-w-full max-h-full object-contain"
                                                onError={(e) => {
                                                    e.currentTarget.src = 'https://placehold.co/100x100/1e293b/475569?text=IMG';
                                                }}
                                            />
                                        </button>
                                    </td>
                                    <td className="p-4 text-right font-mono text-slate-300 tabular-nums">${Number(item.ultimoCosto || 0).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                                    <td className="p-4 text-right font-mono font-bold text-slate-300 tabular-nums">{Number(item.stock || 0).toLocaleString()}</td>
                                    <td className="p-4 text-right font-mono font-bold text-white tabular-nums">{Number(item.unidades || 0).toLocaleString()}</td>
                                    <td className="p-4 text-right font-mono font-bold text-emerald-500 tabular-nums">${Number(item.Venta || 0).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                                    <td className="p-4 text-right font-mono text-slate-400 tabular-nums">${Number(item.costoVenta || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="p-4 text-right font-mono font-bold text-emerald-500 tabular-nums">${Number(item.margenBruto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="p-4 text-right">
                                        <div className="inline-flex items-center space-x-1.5 px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-lg text-xs font-black">
                                            {Number(item.margen || 0).toFixed(1)}%
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <EditablePriceCell
                                            baseCol={item.BaseCol}
                                            descripcion={`${item.DescripcionMarca || ''} ${item.descripcionCorta || ''}`}
                                            precio={Number(item.precioUnitarioLista) || null}
                                            onPriceEdit={setPriceEditData}
                                        />
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={cn(
                                            "text-xs font-bold px-2 py-1 rounded-full border tabular-nums",
                                            Number(item.diasStock || 0) > 180 ? "bg-red-500/10 text-red-400 border-red-500/20" :
                                                Number(item.diasStock || 0) > 90 ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
                                                    "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                        )}>
                                            {Number(item.diasStock || 0).toLocaleString()}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <button
                                            onClick={() => setSelectedProductId(item.BaseCol)}
                                            className="p-2 bg-slate-800/50 hover:bg-blue-600 rounded-xl transition-all text-slate-400 hover:text-white active:scale-95 shadow-lg group-hover:shadow-blue-500/20"
                                        >
                                            <ExternalLink size={16} />
                                        </button>
                                    </td>
                                </motion.tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <ProductDetail
                productId={selectedProductId}
                onClose={() => setSelectedProductId(null)}
            />

            {/* Add to Price Queue Modal */}
            {priceEditData && (
                <AddToPriceQueueModal
                    isOpen={true}
                    onClose={() => setPriceEditData(null)}
                    baseCol={priceEditData.baseCol}
                    descripcion={priceEditData.descripcion}
                    precioActual={priceEditData.precioActual}
                    precioNuevo={priceEditData.precioNuevo}
                    onSuccess={() => setPriceEditData(null)}
                />
            )}
            </div>
        </DashboardContainer>
    );
}
