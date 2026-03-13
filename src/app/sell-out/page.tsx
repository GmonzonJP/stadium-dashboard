'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart2,
  Package,
  TrendingDown,
  Flame,
  RefreshCw,
  Tag,
  DollarSign,
  Info,
  Rocket,
  CheckCircle,
  HelpCircle,
  X,
} from 'lucide-react';
import { DashboardContainer } from '@/components/DashboardContainer';
import { ProductStatusBadge, SaldoBadge } from '@/components/ProductStatusBadge';
import { useFilters } from '@/context/FilterContext';
import { SellOutResponse, SellOutByBrand, SellOutByProduct, ProductoEstado, UMBRALES } from '@/types/sell-out';
import { ProductDetail } from '@/components/ProductDetail';
import { AddToPriceQueueModal } from '@/components/AddToPriceQueueModal';
import { getProductImageUrl } from '@/lib/utils';
import { exportToXlsx, exportMultiSheet, ExportColumn } from '@/lib/export-xlsx';
import { ExportButton } from '@/components/ExportButton';
import { SmartColumnHeader, ColumnSort, ColumnFilter } from '@/components/SmartColumnHeader';

type TabId = 'marca' | 'producto' | 'fast-movers' | 'slow-movers' | 'clavos' | 'saldos';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'marca', label: 'Por Marca', icon: BarChart2 },
  { id: 'producto', label: 'Por Producto', icon: Package },
  { id: 'fast-movers', label: 'Fast Movers', icon: Rocket },
  { id: 'slow-movers', label: 'Slow Movers', icon: TrendingDown },
  { id: 'clavos', label: 'Clavos / Burn', icon: Flame },
  { id: 'saldos', label: 'Saldos', icon: Tag },
];

const formatNumber = (n: number) => new Intl.NumberFormat('es-UY').format(n);
const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU', maximumFractionDigits: 0 }).format(n);

// Leyenda de clasificación
const CLASIFICACION_INFO = [
  {
    estado: 'FAST_MOVER' as ProductoEstado,
    icon: Rocket,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    label: 'Fast Mover',
    descripcion: 'Producto que se venderá antes del plazo esperado (menos de 90 días para marcas premium, 180 días estándar)',
    criterio: 'Días estimados para agotar stock < Días esperados de compra',
  },
  {
    estado: 'OK' as ProductoEstado,
    icon: CheckCircle,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    label: 'OK',
    descripcion: 'Producto con ritmo de venta normal, se venderá dentro del plazo esperado',
    criterio: 'Días estimados para agotar stock ≤ Plazo máximo (180 días)',
  },
  {
    estado: 'SLOW_MOVER' as ProductoEstado,
    icon: TrendingDown,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-200 dark:border-amber-800',
    label: 'Slow Mover',
    descripcion: 'Producto lento que tardará más del plazo estándar en venderse',
    criterio: `Días estimados > ${UMBRALES.diasSlowMover} días y ≤ ${UMBRALES.diasClavo} días`,
  },
  {
    estado: 'CLAVO' as ProductoEstado,
    icon: Flame,
    color: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
    label: 'Clavo / Burn',
    descripcion: 'Producto crítico que tardará más de 1 año en venderse. Requiere acción de liquidación',
    criterio: `Días estimados > ${UMBRALES.diasClavo} días`,
  },
  {
    estado: 'SIN_DATOS' as ProductoEstado,
    icon: HelpCircle,
    color: 'text-gray-500',
    bgColor: 'bg-gray-50 dark:bg-gray-800',
    borderColor: 'border-gray-200 dark:border-gray-700',
    label: 'Sin Datos',
    descripcion: 'Producto sin ventas registradas o datos insuficientes para clasificar',
    criterio: 'Sin ventas en el período o sin fecha de última compra',
  },
];

const SALDO_INFO = {
  icon: Tag,
  color: 'text-purple-600',
  bgColor: 'bg-purple-50 dark:bg-purple-900/20',
  borderColor: 'border-purple-200 dark:border-purple-800',
  label: 'Saldo',
  descripcion: `Producto con stock menor a ${UMBRALES.stockMinimoLiquidacion} unidades totales. Se marca como saldo independientemente de su velocidad de venta`,
  criterio: `Stock total < ${UMBRALES.stockMinimoLiquidacion} unidades`,
};

export default function SellOutPage() {
  const { selectedFilters } = useFilters();
  const [activeTab, setActiveTab] = useState<TabId>('marca');
  const [data, setData] = useState<SellOutResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedBrand, setExpandedBrand] = useState<number | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [priceEditData, setPriceEditData] = useState<{
    baseCol: string;
    descripcion: string;
    precioActual: number;
    precioNuevo: number;
  } | null>(null);

  // Column sort/filter state for product tables
  const [productSort, setProductSort] = useState<ColumnSort | null>(null);
  const [productFilters, setProductFilters] = useState<Map<string, Set<string>>>(new Map());
  // Column sort/filter state for brand table
  const [brandSort, setBrandSort] = useState<ColumnSort | null>(null);
  const [brandFilters, setBrandFilters] = useState<Map<string, Set<string>>>(new Map());

  const handleProductSort = useCallback((key: string, direction: 'asc' | 'desc' | null) => {
    setProductSort(direction ? { key, direction } : null);
  }, []);

  const handleProductFilter = useCallback((key: string, values: Set<string>) => {
    setProductFilters(prev => {
      const next = new Map(prev);
      if (values.size === 0) next.delete(key);
      else next.set(key, values);
      return next;
    });
  }, []);

  const handleBrandSort = useCallback((key: string, direction: 'asc' | 'desc' | null) => {
    setBrandSort(direction ? { key, direction } : null);
  }, []);

  const handleBrandFilter = useCallback((key: string, values: Set<string>) => {
    setBrandFilters(prev => {
      const next = new Map(prev);
      if (values.size === 0) next.delete(key);
      else next.set(key, values);
      return next;
    });
  }, []);

  // Reset sort/filters when tab changes
  useEffect(() => {
    setProductSort(null);
    setProductFilters(new Map());
    setBrandSort(null);
    setBrandFilters(new Map());
  }, [activeTab]);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/sell-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedFilters),
      });

      if (!response.ok) throw new Error('Error al cargar datos');

      const result: SellOutResponse = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedFilters]);

  const fastMovers = data?.byProduct.filter(p => p.estado === 'FAST_MOVER') || [];
  const slowMovers = data?.byProduct.filter(p => p.estado === 'SLOW_MOVER') || [];
  const clavos = data?.byProduct.filter(p => p.estado === 'CLAVO') || [];
  const saldos = data?.byProduct.filter(p => p.esSaldo && p.estado !== 'FAST_MOVER') || [];

  const handleExport = () => {
    if (!data) return;

    const brandCols: ExportColumn<SellOutByBrand>[] = [
      { header: 'Marca', accessor: r => r.descripcionMarca },
      { header: 'Productos', accessor: r => r.cantidadProductos },
      { header: 'Unidades', accessor: r => r.totalUnidades },
      { header: 'Venta $', accessor: r => Math.round(r.totalVenta) },
      { header: 'Stock', accessor: r => r.totalStock },
      { header: 'Fast Movers', accessor: r => r.cantidadFastMovers },
      { header: 'OK', accessor: r => r.cantidadOK },
      { header: 'Slow Movers', accessor: r => r.cantidadSlowMovers },
      { header: 'Clavos', accessor: r => r.cantidadClavos },
      { header: '% Slow', accessor: r => Number(r.porcentajeSlowMovers.toFixed(1)) },
    ];

    const productCols: ExportColumn<SellOutByProduct>[] = [
      { header: 'Código', accessor: r => r.BaseCol },
      { header: 'Marca', accessor: r => r.descripcionMarca },
      { header: 'Descripción', accessor: r => r.descripcionCorta },
      { header: 'Unidades', accessor: r => r.unidadesVendidas },
      { header: 'Venta $', accessor: r => Math.round(r.ventaTotal) },
      { header: 'PVP', accessor: r => r.pvp != null ? Math.round(r.pvp) : '' },
      { header: 'Costo', accessor: r => r.ultimoCosto != null ? Math.round(r.ultimoCosto) : '' },
      { header: 'Margen %', accessor: r => r.margen != null ? Number(r.margen.toFixed(1)) : '' },
      { header: 'Stock', accessor: r => r.stockTotal },
      { header: 'Pares/Día', accessor: r => r.paresPorDia != null ? Number(r.paresPorDia.toFixed(2)) : '' },
      { header: 'Días Stock', accessor: r => r.diasStock != null ? Math.round(r.diasStock) : '' },
      { header: 'Últ. Compra', accessor: r => r.fechaUltimaCompra ? new Date(r.fechaUltimaCompra as string).toLocaleDateString('es-AR') : '' },
      { header: 'Carryover', accessor: r => r.esCarryover ? 'Sí' : '' },
      { header: 'Estado', accessor: r => r.estado },
      { header: 'Saldo', accessor: r => r.esSaldo ? 'Sí' : '' },
    ];

    if (activeTab === 'marca') {
      exportToXlsx(data.byBrand, brandCols, 'sell-out-marcas', 'Por Marca');
    } else {
      const productos = activeTab === 'producto' ? data.byProduct :
                        activeTab === 'fast-movers' ? fastMovers :
                        activeTab === 'slow-movers' ? slowMovers :
                        activeTab === 'clavos' ? clavos : saldos;
      const tabName = activeTab === 'producto' ? 'Todos' :
                      activeTab === 'fast-movers' ? 'Fast Movers' :
                      activeTab === 'slow-movers' ? 'Slow Movers' :
                      activeTab === 'clavos' ? 'Clavos' : 'Saldos';
      exportToXlsx(productos, productCols, `sell-out-${activeTab}`, tabName);
    }
  };

  const renderResumen = () => {
    if (!data) return null;

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatNumber(data.resumen.totalProductos)}
          </div>
          <div className="text-sm text-gray-500">Total Productos</div>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4 shadow-sm">
          <div className="text-2xl font-bold text-emerald-600">{formatNumber(data.resumen.totalFastMovers)}</div>
          <div className="text-sm text-emerald-600">Fast Movers</div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 shadow-sm">
          <div className="text-2xl font-bold text-blue-600">{formatNumber(data.resumen.totalOK)}</div>
          <div className="text-sm text-blue-600">OK</div>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 shadow-sm">
          <div className="text-2xl font-bold text-amber-600">{formatNumber(data.resumen.totalSlowMovers)}</div>
          <div className="text-sm text-amber-600">Slow Movers</div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 shadow-sm">
          <div className="text-2xl font-bold text-red-600">{formatNumber(data.resumen.totalClavos)}</div>
          <div className="text-sm text-red-600">Clavos</div>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 shadow-sm">
          <div className="text-2xl font-bold text-purple-600">{formatNumber(data.resumen.totalSaldos)}</div>
          <div className="text-sm text-purple-600">Saldos</div>
        </div>
      </div>
    );
  };

  const renderLegendModal = () => {
    if (!showLegend) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white dark:bg-gray-800 rounded-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-auto shadow-2xl">
          <div className="sticky top-0 bg-white dark:bg-gray-800 px-6 py-4 border-b dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Info size={24} className="text-blue-500" />
              Criterios de Clasificación
            </h2>
            <button
              onClick={() => setShowLegend(false)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Los productos se clasifican según su <strong>velocidad de venta estimada</strong>, calculada a partir
              del ritmo de ventas desde la última compra y el stock actual.
            </p>

            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <strong>Fórmulas:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li><strong>Pares/Día</strong> = Unidades vendidas desde última compra / Días transcurridos</li>
                <li><strong>Días Stock</strong> = Stock actual / Pares por día</li>
              </ul>
            </div>

            {CLASIFICACION_INFO.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.estado}
                  className={`p-4 rounded-lg border ${item.bgColor} ${item.borderColor}`}
                >
                  <div className="flex items-start gap-3">
                    <Icon className={`${item.color} mt-0.5`} size={20} />
                    <div className="flex-1">
                      <h3 className={`font-semibold ${item.color}`}>{item.label}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{item.descripcion}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-2 font-mono bg-white/50 dark:bg-gray-800/50 px-2 py-1 rounded">
                        {item.criterio}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className={`p-4 rounded-lg border ${SALDO_INFO.bgColor} ${SALDO_INFO.borderColor}`}>
              <div className="flex items-start gap-3">
                <Tag className={SALDO_INFO.color} size={20} />
                <div className="flex-1">
                  <h3 className={`font-semibold ${SALDO_INFO.color}`}>{SALDO_INFO.label}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{SALDO_INFO.descripcion}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-2 font-mono bg-white/50 dark:bg-gray-800/50 px-2 py-1 rounded">
                    {SALDO_INFO.criterio}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Brand table helpers
  const getBrandSortValue = (m: SellOutByBrand, key: string): number | string => {
    switch (key) {
      case 'marca': return m.descripcionMarca;
      case 'productos': return m.cantidadProductos;
      case 'unidades': return m.totalUnidades;
      case 'venta': return m.totalVenta;
      case 'stock': return m.totalStock;
      case 'fast': return m.cantidadFastMovers;
      case 'ok': return m.cantidadOK;
      case 'slow': return m.cantidadSlowMovers;
      case 'clavo': return m.cantidadClavos;
      case 'pctSlow': return m.porcentajeSlowMovers;
      default: return 0;
    }
  };

  const applyBrandFiltersAndSort = (brands: SellOutByBrand[]): SellOutByBrand[] => {
    let result = [...brands];
    Array.from(brandFilters.entries()).forEach(([key, values]) => {
      if (key === 'marca') result = result.filter(m => values.has(m.descripcionMarca));
    });
    if (brandSort && brandSort.direction) {
      const { key, direction } = brandSort;
      result.sort((a, b) => {
        const va = getBrandSortValue(a, key);
        const vb = getBrandSortValue(b, key);
        const cmp = typeof va === 'string' ? va.localeCompare(vb as string, 'es') : (va as number) - (vb as number);
        return direction === 'asc' ? cmp : -cmp;
      });
    }
    return result;
  };

  const renderMarcaTab = () => {
    if (!data) return null;

    const brands = applyBrandFiltersAndSort(data.byBrand);
    const hasActiveFilters = brandFilters.size > 0 || brandSort !== null;
    const brandNames = data.byBrand.map(b => b.descripcionMarca).sort((a, b) => a.localeCompare(b, 'es'));

    return (
      <div className="bg-white dark:bg-slate-900/50 rounded-lg dark:rounded-3xl shadow-sm dark:shadow-2xl overflow-hidden dark:border dark:border-slate-800">
        {hasActiveFilters && (
          <div className="px-4 py-3 border-b dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Por Marca
              {brandFilters.size > 0 && (
                <span className="ml-2 text-xs font-normal text-blue-500">
                  ({brands.length} de {data.byBrand.length})
                </span>
              )}
            </h3>
            <button
              onClick={() => { setBrandSort(null); setBrandFilters(new Map()); }}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            >
              <X size={12} />
              Limpiar filtros
            </button>
          </div>
        )}
        <div className="max-h-[75vh] overflow-auto">
          <table className="w-full">
            <thead className="bg-[#0c1425] sticky top-0 z-20 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
              <tr className="border-b-2 border-blue-500/30">
                <SmartColumnHeader label="Marca" columnKey="marca" align="left" sortable filterable
                  currentSort={brandSort} onSort={handleBrandSort}
                  filterValues={brandNames}
                  activeFilter={brandFilters.get('marca')} onFilter={handleBrandFilter} />
                <SmartColumnHeader label="Productos" columnKey="productos" align="right"
                  currentSort={brandSort} onSort={handleBrandSort} />
                <SmartColumnHeader label="Unidades" columnKey="unidades" align="right"
                  currentSort={brandSort} onSort={handleBrandSort} />
                <SmartColumnHeader label="Venta" columnKey="venta" align="right"
                  currentSort={brandSort} onSort={handleBrandSort} />
                <SmartColumnHeader label="Stock" columnKey="stock" align="right"
                  currentSort={brandSort} onSort={handleBrandSort} />
                <SmartColumnHeader label="Fast" columnKey="fast" align="center"
                  currentSort={brandSort} onSort={handleBrandSort} />
                <SmartColumnHeader label="OK" columnKey="ok" align="center"
                  currentSort={brandSort} onSort={handleBrandSort} />
                <SmartColumnHeader label="Slow" columnKey="slow" align="center"
                  currentSort={brandSort} onSort={handleBrandSort} />
                <SmartColumnHeader label="Clavo" columnKey="clavo" align="center"
                  currentSort={brandSort} onSort={handleBrandSort} />
                <SmartColumnHeader label="% Slow" columnKey="pctSlow" align="right"
                  currentSort={brandSort} onSort={handleBrandSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {brands.map((marca) => (
                <React.Fragment key={marca.idMarca}>
                  <tr
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                    onClick={() => setExpandedBrand(expandedBrand === marca.idMarca ? null : marca.idMarca)}
                  >
                    <td className="px-4 py-3 font-medium">{marca.descripcionMarca}</td>
                    <td className="px-4 py-3 text-right">{marca.cantidadProductos}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(marca.totalUnidades)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(marca.totalVenta)}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(marca.totalStock)}</td>
                    <td className="px-4 py-3 text-center text-emerald-600">{marca.cantidadFastMovers}</td>
                    <td className="px-4 py-3 text-center text-blue-600">{marca.cantidadOK}</td>
                    <td className="px-4 py-3 text-center text-amber-600">{marca.cantidadSlowMovers}</td>
                    <td className="px-4 py-3 text-center text-red-600">{marca.cantidadClavos}</td>
                    <td className={`px-4 py-3 text-right font-medium ${
                      marca.porcentajeSlowMovers > 30 ? 'text-red-600 dark:text-red-400' :
                      marca.porcentajeSlowMovers > 15 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {marca.porcentajeSlowMovers.toFixed(1)}%
                    </td>
                  </tr>
                  {expandedBrand === marca.idMarca && (
                    <tr>
                      <td colSpan={10} className="bg-gray-50 dark:bg-gray-700/30 px-4 py-2">
                        <div className="text-sm text-gray-500 mb-2">
                          Productos de {marca.descripcionMarca}:
                        </div>
                        <div className="max-h-60 overflow-auto">
                          <table className="w-full text-sm">
                            <tbody>
                              {data.byProduct
                                .filter(p => p.descripcionMarca === marca.descripcionMarca)
                                .slice(0, 20)
                                .map((p) => (
                                  <tr
                                    key={p.BaseCol}
                                    className="border-b dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600/50 cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedProductId(p.BaseCol);
                                    }}
                                  >
                                    <td className="py-2 w-12">
                                      <img
                                        src={getProductImageUrl(p.BaseCol)}
                                        alt={p.descripcionCorta}
                                        className="w-10 h-10 object-cover rounded"
                                        onError={(e) => {
                                          e.currentTarget.src = 'https://placehold.co/40x40/1e293b/475569?text=IMG';
                                        }}
                                      />
                                    </td>
                                    <td className="py-2 font-mono">{p.BaseCol}</td>
                                    <td className="py-2">{p.descripcionCorta}</td>
                                    <td className="py-2 text-right">{p.stockTotal}</td>
                                    <td className="py-2">
                                      <ProductStatusBadge estado={p.estado} size="sm" />
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {brands.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-gray-400 dark:text-slate-500">
                    No hay marcas que coincidan con los filtros aplicados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Helper: get string value for filtering from a product row
  const getProductFilterValue = (p: SellOutByProduct, key: string): string => {
    switch (key) {
      case 'marca': return p.descripcionMarca || '';
      case 'estado': return p.estado;
      default: return '';
    }
  };

  // Helper: get numeric/string value for sorting from a product row
  const getProductSortValue = (p: SellOutByProduct, key: string): number | string => {
    switch (key) {
      case 'marca': return p.descripcionMarca || '';
      case 'descripcion': return p.descripcionCorta || '';
      case 'unidades': return p.unidadesPeriodo ?? p.unidadesVendidas;
      case 'stock': return p.stockTotal;
      case 'costo': return p.ultimoCosto || 0;
      case 'pvp': return p.pvp || 0;
      case 'venta': return p.ventaTotal;
      case 'margen': return p.margen ?? -9999;
      case 'parDia': return p.paresPorDia ?? -9999;
      case 'diasStock': return p.diasStock ?? 999999;
      case 'ultCompra': return p.fechaUltimaCompra ? new Date(p.fechaUltimaCompra as string).getTime() : 0;
      case 'estado': return p.estado;
      default: return 0;
    }
  };

  // Apply filters and sort to product list
  const applyProductFiltersAndSort = (productos: SellOutByProduct[]): SellOutByProduct[] => {
    let result = [...productos];

    // Apply filters
    Array.from(productFilters.entries()).forEach(([key, values]) => {
      result = result.filter(p => values.has(getProductFilterValue(p, key)));
    });

    // Apply sort
    if (productSort && productSort.direction) {
      const { key, direction } = productSort;
      result.sort((a, b) => {
        const va = getProductSortValue(a, key);
        const vb = getProductSortValue(b, key);
        const cmp = typeof va === 'string' ? va.localeCompare(vb as string, 'es') : (va as number) - (vb as number);
        return direction === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  };

  // Get unique values for product filter dropdowns
  const getProductUniqueValues = (productos: SellOutByProduct[], key: string): string[] => {
    const vals = new Set<string>();
    for (const p of productos) {
      const v = getProductFilterValue(p, key);
      if (v) vals.add(v);
    }
    return Array.from(vals).sort((a, b) => a.localeCompare(b, 'es'));
  };

  const renderProductoTab = (productos: SellOutByProduct[], title?: string) => {
    const processed = applyProductFiltersAndSort(productos);
    const hasActiveFilters = productFilters.size > 0 || productSort !== null;

    return (
      <div className="bg-white dark:bg-slate-900/50 rounded-lg dark:rounded-3xl shadow-sm dark:shadow-2xl overflow-hidden dark:border dark:border-slate-800">
        {(title || hasActiveFilters) && (
          <div className="px-4 py-3 border-b dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {title || 'Productos'}
              {productFilters.size > 0 && (
                <span className="ml-2 text-xs font-normal text-blue-500">
                  ({processed.length} de {productos.length})
                </span>
              )}
            </h3>
            {hasActiveFilters && (
              <button
                onClick={() => { setProductSort(null); setProductFilters(new Map()); }}
                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
              >
                <X size={12} />
                Limpiar filtros
              </button>
            )}
          </div>
        )}
        <div className="max-h-[75vh] overflow-auto">
          <table className="w-full min-w-[1200px]">
            <thead className="bg-[#0c1425] sticky top-0 z-20 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
              <tr className="border-b-2 border-blue-500/30">
                <th className="p-1 text-xs font-bold text-slate-500 uppercase tracking-wider w-24">Img</th>
                <SmartColumnHeader label="Artículo" columnKey="marca" align="left" sortable filterable
                  currentSort={productSort} onSort={handleProductSort}
                  filterValues={getProductUniqueValues(productos, 'marca')}
                  activeFilter={productFilters.get('marca')} onFilter={handleProductFilter} />
                <SmartColumnHeader label="Unid." columnKey="unidades" align="right"
                  currentSort={productSort} onSort={handleProductSort} />
                <SmartColumnHeader label="Stock" columnKey="stock" align="right"
                  currentSort={productSort} onSort={handleProductSort} />
                <SmartColumnHeader label="Costo" columnKey="costo" align="right"
                  currentSort={productSort} onSort={handleProductSort} />
                <SmartColumnHeader label="PVP" columnKey="pvp" align="right"
                  currentSort={productSort} onSort={handleProductSort} />
                <SmartColumnHeader label="Venta $" columnKey="venta" align="right"
                  currentSort={productSort} onSort={handleProductSort} />
                <SmartColumnHeader label="Margen" columnKey="margen" align="right"
                  currentSort={productSort} onSort={handleProductSort} />
                <SmartColumnHeader label="Par/Día" columnKey="parDia" align="center"
                  currentSort={productSort} onSort={handleProductSort} />
                <SmartColumnHeader label="Días Stock" columnKey="diasStock" align="center"
                  currentSort={productSort} onSort={handleProductSort} />
                <SmartColumnHeader label="Últ. Compra" columnKey="ultCompra" align="center"
                  currentSort={productSort} onSort={handleProductSort} />
                <SmartColumnHeader label="Estado" columnKey="estado" align="center" sortable filterable
                  currentSort={productSort} onSort={handleProductSort}
                  filterValues={getProductUniqueValues(productos, 'estado')}
                  activeFilter={productFilters.get('estado')} onFilter={handleProductFilter} />
                <th className="px-3 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-800/50">
              {processed.map((p) => (
                <tr
                  key={p.BaseCol}
                  className="hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer group"
                  onClick={() => setSelectedProductId(p.BaseCol)}
                >
                  <td className="p-1">
                    <div className="w-20 h-20 bg-white rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700 group-hover:border-blue-500/50 transition-all shadow-sm">
                      <img
                        src={getProductImageUrl(p.BaseCol)}
                        alt={p.descripcionCorta}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          e.currentTarget.src = 'https://placehold.co/128x128/1e293b/475569?text=IMG';
                        }}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors text-sm">
                      {p.descripcionMarca}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-slate-400 truncate max-w-[200px]">
                      {p.descripcionCorta}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-slate-600 font-mono">{p.BaseCol}</div>
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-gray-900 dark:text-white tabular-nums" title={`Total histórico: ${formatNumber(p.unidadesVendidas)}`}>
                    {formatNumber(p.unidadesPeriodo ?? p.unidadesVendidas)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className={`font-mono tabular-nums font-bold ${
                      p.stockTotal > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-slate-500'
                    }`}>
                      {formatNumber(p.stockTotal)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-gray-500 dark:text-slate-400 tabular-nums text-sm">
                    {p.ultimoCosto ? formatCurrency(p.ultimoCosto) : '-'}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400 tabular-nums text-sm font-medium">
                    {p.pvp ? formatCurrency(p.pvp) : '-'}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-gray-900 dark:text-white tabular-nums text-sm font-medium">
                    {formatCurrency(p.ventaTotal)}
                  </td>
                  <td className={`px-3 py-3 text-right font-mono tabular-nums text-sm font-medium ${
                    p.margen != null && p.margen >= 30 ? 'text-emerald-600' :
                    p.margen != null && p.margen >= 15 ? 'text-blue-600' : 'text-red-600'
                  }`}>
                    {p.margen != null ? `${p.margen.toFixed(1)}%` : '-'}
                  </td>
                  <td className="px-3 py-3 text-center font-mono text-gray-600 dark:text-slate-400 tabular-nums text-sm">
                    {p.paresPorDia !== null ? p.paresPorDia.toFixed(2) : '-'}
                  </td>
                  <td className={`px-3 py-3 text-center font-mono tabular-nums text-sm font-medium ${
                    p.diasStock !== null && p.diasStock > 365 ? 'text-red-600' :
                    p.diasStock !== null && p.diasStock > 180 ? 'text-amber-600' : 'text-gray-600 dark:text-slate-400'
                  }`}>
                    {p.diasStock !== null ? Math.round(p.diasStock) : '-'}
                  </td>
                  <td className="px-3 py-3 text-center text-xs text-gray-500 dark:text-slate-500">
                    {p.fechaUltimaCompra
                      ? new Date(p.fechaUltimaCompra as string).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
                      : '-'}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <ProductStatusBadge estado={p.estado} size="sm" showLabel={false} />
                      {p.esSaldo && <SaldoBadge size="sm" />}
                      {p.esCarryover && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded">CO</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPriceEditData({
                          baseCol: p.BaseCol,
                          descripcion: p.descripcionCorta,
                          precioActual: p.pvp || 0,
                          precioNuevo: p.pvp ? Math.round(p.pvp * 0.8) : 0,
                        });
                      }}
                      className="p-1.5 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 rounded-lg transition-colors"
                      title="Editar Precio"
                    >
                      <DollarSign size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {processed.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-gray-400 dark:text-slate-500">
                    No hay productos que coincidan con los filtros aplicados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <DashboardContainer>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Análisis Sell Out</h1>
            <p className="text-gray-500 dark:text-gray-400">
              Clasificación de productos según velocidad de venta
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton
              onClick={handleExport}
              variant="button"
              label="Exportar Excel"
              disabled={!data || isLoading}
            />
            <button
              onClick={() => setShowLegend(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              <Info size={18} />
              Leyenda
            </button>
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
              Actualizar
            </button>
          </div>
        </div>

        {/* Resumen */}
        {renderResumen()}

        {/* Valor en riesgo */}
        {data && (data.resumen.valorInventarioSlowMovers > 0 || data.resumen.valorInventarioClavos > 0) && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2">
              Valor de Inventario en Riesgo
            </h3>
            <div className="flex gap-6">
              <div>
                <span className="text-sm text-red-600 dark:text-red-400">Slow Movers:</span>
                <span className="ml-2 font-semibold text-red-700 dark:text-red-300">
                  {formatCurrency(data.resumen.valorInventarioSlowMovers)}
                </span>
              </div>
              <div>
                <span className="text-sm text-red-600 dark:text-red-400">Clavos:</span>
                <span className="ml-2 font-semibold text-red-700 dark:text-red-300">
                  {formatCurrency(data.resumen.valorInventarioClavos)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b dark:border-gray-700 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const count = tab.id === 'fast-movers' ? fastMovers.length :
                         tab.id === 'slow-movers' ? slowMovers.length :
                         tab.id === 'clavos' ? clavos.length :
                         tab.id === 'saldos' ? saldos.length : null;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 rounded-t-lg transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-700 dark:text-blue-400 font-semibold'
                    : 'border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
                }`}
              >
                <Icon size={18} />
                {tab.label}
                {count !== null && count > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    tab.id === 'fast-movers' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' :
                    tab.id === 'clavos' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' :
                    tab.id === 'saldos' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' :
                    'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="animate-spin text-gray-400" size={32} />
          </div>
        ) : error ? (
          <div className="text-center text-red-500 py-12">
            <p>{error}</p>
            <button onClick={fetchData} className="mt-4 text-blue-600 hover:underline">
              Reintentar
            </button>
          </div>
        ) : (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {activeTab === 'marca' && renderMarcaTab()}
            {activeTab === 'producto' && data && renderProductoTab(data.byProduct)}
            {activeTab === 'fast-movers' && renderProductoTab(fastMovers, `Fast Movers (${fastMovers.length} productos)`)}
            {activeTab === 'slow-movers' && renderProductoTab(slowMovers, `Slow Movers (${slowMovers.length} productos)`)}
            {activeTab === 'clavos' && renderProductoTab(clavos, `Clavos / Burn (${clavos.length} productos)`)}
            {activeTab === 'saldos' && renderProductoTab(saldos, `Saldos (${saldos.length} productos)`)}
          </motion.div>
        )}
      </div>

      {/* Legend Modal */}
      {renderLegendModal()}

      {/* Product Detail Modal */}
      <ProductDetail
        productId={selectedProductId}
        onClose={() => setSelectedProductId(null)}
        initialStartDate={selectedFilters.startDate}
        initialEndDate={selectedFilters.endDate}
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
    </DashboardContainer>
  );
}
