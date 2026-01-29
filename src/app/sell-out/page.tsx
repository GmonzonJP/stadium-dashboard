'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart2,
  Package,
  TrendingDown,
  Flame,
  RefreshCw,
  Filter,
  Download,
} from 'lucide-react';
import { DashboardContainer } from '@/components/DashboardContainer';
import { ProductStatusBadge, SaldoBadge } from '@/components/ProductStatusBadge';
import { useFilters } from '@/context/FilterContext';
import { SellOutResponse, SellOutByBrand, SellOutByProduct, ProductoEstado } from '@/types/sell-out';

type TabId = 'marca' | 'producto' | 'slow-movers' | 'clavos';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'marca', label: 'Por Marca', icon: BarChart2 },
  { id: 'producto', label: 'Por Producto', icon: Package },
  { id: 'slow-movers', label: 'Slow Movers', icon: TrendingDown },
  { id: 'clavos', label: 'Clavos / Burn', icon: Flame },
];

const formatNumber = (n: number) => new Intl.NumberFormat('es-UY').format(n);
const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU', maximumFractionDigits: 0 }).format(n);

export default function SellOutPage() {
  const { selectedFilters } = useFilters();
  const [activeTab, setActiveTab] = useState<TabId>('marca');
  const [data, setData] = useState<SellOutResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedBrand, setExpandedBrand] = useState<number | null>(null);

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

  const slowMovers = data?.byProduct.filter(p => p.estado === 'SLOW_MOVER') || [];
  const clavos = data?.byProduct.filter(p => p.estado === 'CLAVO') || [];

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

  const renderMarcaTab = () => {
    if (!data) return null;

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold">Marca</th>
              <th className="px-4 py-3 text-right text-sm font-semibold">Productos</th>
              <th className="px-4 py-3 text-right text-sm font-semibold">Unidades</th>
              <th className="px-4 py-3 text-right text-sm font-semibold">Venta</th>
              <th className="px-4 py-3 text-right text-sm font-semibold">Stock</th>
              <th className="px-4 py-3 text-center text-sm font-semibold">Fast</th>
              <th className="px-4 py-3 text-center text-sm font-semibold">OK</th>
              <th className="px-4 py-3 text-center text-sm font-semibold">Slow</th>
              <th className="px-4 py-3 text-center text-sm font-semibold">Clavo</th>
              <th className="px-4 py-3 text-right text-sm font-semibold">% Slow</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {data.byBrand.map((marca) => (
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
                    marca.porcentajeSlowMovers > 30 ? 'text-red-600' :
                    marca.porcentajeSlowMovers > 15 ? 'text-amber-600' : 'text-gray-600'
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
                                <tr key={p.BaseCol} className="border-b dark:border-gray-600">
                                  <td className="py-2">{p.BaseCol}</td>
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
          </tbody>
        </table>
      </div>
    );
  };

  const renderProductoTab = (productos: SellOutByProduct[], title?: string) => {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        {title && (
          <div className="px-4 py-3 border-b dark:border-gray-700">
            <h3 className="font-semibold">{title}</h3>
          </div>
        )}
        <div className="max-h-[600px] overflow-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Código</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Marca</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Descripción</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Unidades</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Venta</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Stock</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Pares/Día</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Días Stock</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {productos.map((p) => (
                <tr key={p.BaseCol} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 font-mono text-sm">{p.BaseCol}</td>
                  <td className="px-4 py-3">{p.descripcionMarca}</td>
                  <td className="px-4 py-3 max-w-xs truncate">{p.descripcionCorta}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(p.unidadesVendidas)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(p.ventaTotal)}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(p.stockTotal)}</td>
                  <td className="px-4 py-3 text-right">
                    {p.paresPorDia !== null ? p.paresPorDia.toFixed(2) : '-'}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${
                    p.diasStock !== null && p.diasStock > 365 ? 'text-red-600' :
                    p.diasStock !== null && p.diasStock > 180 ? 'text-amber-600' : ''
                  }`}>
                    {p.diasStock !== null ? Math.round(p.diasStock) : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <ProductStatusBadge estado={p.estado} size="sm" showLabel={false} />
                      {p.esSaldo && <SaldoBadge size="sm" />}
                    </div>
                  </td>
                </tr>
              ))}
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
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
            Actualizar
          </button>
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
                <span className="text-sm text-red-600">Slow Movers:</span>
                <span className="ml-2 font-semibold text-red-700">
                  {formatCurrency(data.resumen.valorInventarioSlowMovers)}
                </span>
              </div>
              <div>
                <span className="text-sm text-red-600">Clavos:</span>
                <span className="ml-2 font-semibold text-red-700">
                  {formatCurrency(data.resumen.valorInventarioClavos)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b dark:border-gray-700">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const count = tab.id === 'slow-movers' ? slowMovers.length :
                         tab.id === 'clavos' ? clavos.length : null;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                  isActive
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon size={18} />
                {tab.label}
                {count !== null && count > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    tab.id === 'clavos' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
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
            {activeTab === 'slow-movers' && renderProductoTab(slowMovers, `Slow Movers (${slowMovers.length} productos)`)}
            {activeTab === 'clavos' && renderProductoTab(clavos, `Clavos / Burn (${clavos.length} productos)`)}
          </motion.div>
        )}
      </div>
    </DashboardContainer>
  );
}
