'use client';

import React, { useEffect, useState } from 'react';
import { useFilters } from '@/context/FilterContext';
import { DashboardContainer } from '@/components/DashboardContainer';
import { MetricCard } from '@/components/MetricCard';
import { PinnedMetricTable } from '@/components/PinnedMetricTable';
import { ComparisonChart } from '@/components/ComparisonChart';
import { ProductDetail } from '@/components/ProductDetail';
import { ShoppingBag, DollarSign, Percent, Package, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ActiveFiltersTags } from '@/components/ActiveFiltersTags';
import { ProductAnalysisTable } from '@/components/ProductAnalysisTable';
import { DepositoWarningBanner } from '@/components/DepositoWarningBanner';

export default function Dashboard() {
  const { selectedFilters, filterData, toggleFilter, comparisonMode } = useFilters();
  const [metrics, setMetrics] = useState<any>(null);
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingComparison, setIsLoadingComparison] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [alertsData, setAlertsData] = useState<any>(null);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(true);

  // State for pinned detail tables
  const [pinnedTables, setPinnedTables] = useState<{ id: string, title: string, groupBy: string, groupByLabel: string, isNew: boolean }[]>([]);

  useEffect(() => {
    async function fetchMetrics() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...selectedFilters, comparisonMode }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.details || errorData.error || 'Failed to fetch metrics');
        }

        const data = await response.json();
        setMetrics(data);
      } catch (err) {
        console.error('Error fetching metrics:', err);
        setError(err instanceof Error ? err.message : 'Error al cargar los datos');
      } finally {
        setIsLoading(false);
      }
    }

    async function fetchComparison() {
      setIsLoadingComparison(true);
      try {
        const response = await fetch('/api/metrics/comparison', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...selectedFilters, comparisonMode }),
        });

        if (!response.ok) throw new Error('Failed to fetch comparison');

        const data = await response.json();
        setComparisonData(data);
      } catch (err) {
        console.error('Error fetching comparison:', err);
      } finally {
        setIsLoadingComparison(false);
      }
    }

    async function fetchAlerts() {
      setIsLoadingAlerts(true);
      try {
        const response = await fetch('/api/insights/stock-alerts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          },
          body: JSON.stringify(selectedFilters),
          cache: 'no-store'
        });

        if (!response.ok) {
          setAlertsData({
            alerts: [],
            totalProductsAnalyzed: 0,
            dateRange: {
              start: selectedFilters.startDate || '',
              end: selectedFilters.endDate || ''
            }
          });
          return;
        }

        const result = await response.json();
        setAlertsData(result);
      } catch (err) {
        console.error('Error fetching alerts:', err);
        setAlertsData({
          alerts: [],
          totalProductsAnalyzed: 0,
          dateRange: {
            start: selectedFilters.startDate || '',
            end: selectedFilters.endDate || ''
          }
        });
      } finally {
        setIsLoadingAlerts(false);
      }
    }

    fetchMetrics();
    fetchComparison();
    fetchAlerts();
  }, [selectedFilters, comparisonMode]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
    return `$${value.toFixed(2)}`;
  };

  const handleGroup = (metricTitle: string, groupByType: string) => {
    const groupLabels: Record<string, string> = {
      'stores': 'Tienda',
      'brands': 'Marca',
      'genders': 'Genero',
      'sections': 'Seccion',
      'categories': 'Clase',
      'products': 'Articulo',
      'price': 'Precio',
      'hour': 'Hora',
      'all': 'Todo'
    };

    const newId = `${metricTitle}-${groupByType}-${Date.now()}`;
    // Mark all existing tables as not new
    setPinnedTables(prev => [
      { id: newId, title: metricTitle, groupBy: groupByType, groupByLabel: groupLabels[groupByType] || groupByType, isNew: true },
      ...prev.map(t => ({ ...t, isNew: false }))
    ]);
  };

  const removePinnedTable = (id: string) => {
    setPinnedTables(prev => prev.filter(t => t.id !== id));
  };


  return (
    <DashboardContainer alertsData={alertsData} isLoadingAlerts={isLoadingAlerts}>
      <div className="space-y-8 pb-12">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div className="flex-1">
          <h2 className="text-3xl font-extrabold text-white tracking-tight mb-1">Dashboard de Ventas</h2>
          <div className="flex items-center space-x-2 text-slate-500 text-sm font-medium mb-2">
            <span>Periodo actual: {selectedFilters.startDate}</span>
            <span className="text-slate-700">•</span>
            <span>{selectedFilters.endDate}</span>
          </div>
          <ActiveFiltersTags
            selectedFilters={selectedFilters}
            filterData={filterData}
            onRemoveFilter={toggleFilter}
          />
        </div>
      </motion.div>

      {/* Banner de advertencia de mapeo Depósito→Tienda */}
      <DepositoWarningBanner />

      {error ? (
        <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-2xl text-center">
          <p className="text-red-400 font-bold">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
          >
            REINTENTAR
          </button>
        </div>
      ) : (
        <>
          {/* KPIs Principales - Período Seleccionado */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-400 uppercase tracking-wider">Período Seleccionado</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricCard
                title="Ventas $"
                value={formatCurrency(metrics?.current?.sales || 0)}
                growth={metrics?.growthLY?.sales != null ? metrics?.growthLY?.sales : metrics?.growth?.sales}
                icon={DollarSign}
                loading={isLoading}
                subtitle={metrics?.lastYear?.hasData 
                  ? `vs mismo período año anterior: ${metrics?.growthLY?.sales != null ? `${metrics?.growthLY?.sales >= 0 ? '+' : ''}${metrics?.growthLY?.sales.toFixed(1)}%` : 'N/A'}`
                  : "Variación vs año anterior no disponible"}
                onGroup={(type) => handleGroup("Ventas $", type)}
              />
              <MetricCard
                title="Unidades"
                value={metrics?.current?.units?.toLocaleString() || '0'}
                growth={metrics?.growthLY?.units != null ? metrics?.growthLY?.units : metrics?.growth?.units}
                icon={ShoppingBag}
                loading={isLoading}
                subtitle={metrics?.lastYear?.hasData 
                  ? `vs mismo período año anterior: ${metrics?.growthLY?.units != null ? `${metrics?.growthLY?.units >= 0 ? '+' : ''}${metrics?.growthLY?.units.toFixed(1)}%` : 'N/A'}`
                  : "Variación vs año anterior no disponible"}
                onGroup={(type) => handleGroup("Unidades", type)}
              />
              <MetricCard
                title="Margen (%)"
                value={metrics?.current?.margin != null ? `${metrics?.current?.margin.toFixed(2)}%` : 'N/A'}
                growth={metrics?.growthLY?.margin != null ? metrics?.growthLY?.margin : (metrics?.growth?.margin != null ? metrics?.growth?.margin : undefined)}
                icon={Percent}
                loading={isLoading}
                subtitle="(Precio - Costo) / Precio × 100"
                onGroup={(type) => handleGroup("Margen", type)}
              />
              <MetricCard
                title="Markup (%)"
                value={metrics?.current?.markup != null ? `${metrics?.current?.markup.toFixed(2)}%` : 'N/A'}
                growth={metrics?.growthLY?.markup != null ? metrics?.growthLY?.markup : (metrics?.growth?.markup != null ? metrics?.growth?.markup : undefined)}
                icon={Percent}
                loading={isLoading}
                subtitle="(Precio - Costo) / Costo × 100"
                onGroup={(type) => handleGroup("Markup", type)}
              />
            </div>
          </div>

          {/* KPIs YTD - Acumulados (ignoran período) */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-400 uppercase tracking-wider">
              Acumulado YTD 
              <span className="text-xs text-slate-600 ml-2 font-normal">(ignora filtro de período)</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricCard
                title="Ventas $ YTD"
                value={formatCurrency(metrics?.ytd?.sales || 0)}
                growth={metrics?.growthYTD?.sales}
                icon={DollarSign}
                loading={isLoading}
                subtitle={metrics?.ytdLastYear?.hasData 
                  ? `vs YTD año anterior: ${metrics?.growthYTD?.sales != null ? `${metrics?.growthYTD?.sales >= 0 ? '+' : ''}${metrics?.growthYTD?.sales.toFixed(1)}%` : 'N/A'}`
                  : "Comparación YTD año anterior no disponible"}
                onGroup={(type) => handleGroup("Ventas $ YTD", type)}
                ignoresFilters={['período']}
                emptyReason="Sin datos para el año en curso"
              />
              <MetricCard
                title="Unidades YTD"
                value={metrics?.ytd?.units?.toLocaleString() || '0'}
                growth={metrics?.growthYTD?.units}
                icon={ShoppingBag}
                loading={isLoading}
                subtitle={metrics?.ytdLastYear?.hasData 
                  ? `vs YTD año anterior: ${metrics?.growthYTD?.units != null ? `${metrics?.growthYTD?.units >= 0 ? '+' : ''}${metrics?.growthYTD?.units.toFixed(1)}%` : 'N/A'}`
                  : "Comparación YTD año anterior no disponible"}
                onGroup={(type) => handleGroup("Unidades YTD", type)}
                ignoresFilters={['período']}
                emptyReason="Sin datos para el año en curso"
              />
              <MetricCard
                title="Margen YTD (%)"
                value={metrics?.ytd?.margin != null ? `${metrics?.ytd?.margin.toFixed(2)}%` : 'N/A'}
                growth={metrics?.growthYTD?.margin != null ? metrics?.growthYTD?.margin : undefined}
                icon={Percent}
                loading={isLoading}
                subtitle="Margen acumulado año en curso"
                onGroup={(type) => handleGroup("Margen YTD", type)}
                ignoresFilters={['período']}
                emptyReason="Sin costos disponibles para calcular margen"
              />
              <MetricCard
                title="Stock Estimado"
                value={metrics?.stock?.toLocaleString() || '0'}
                icon={Package}
                loading={isLoading}
                subtitle="Stock total desde MovStockTotalResumen"
                onGroup={(type) => handleGroup("Stock Estimado", type)}
                appliedFilters={['marca (si seleccionada)']}
                emptyReason="Sin datos de stock en MovStockTotalResumen"
              />
            </div>
          </div>

          {/* Pinned Tables Area - Aparece debajo de las tarjetas KPI, antes de Análisis de Productos */}
          <AnimatePresence>
            {pinnedTables.length > 0 && (
              <div className="space-y-6">
                {pinnedTables.map(table => (
                  <PinnedMetricTable
                    key={table.id}
                    id={table.id}
                    title={table.title}
                    groupBy={table.groupBy}
                    groupByLabel={table.groupByLabel}
                    onClose={removePinnedTable}
                    isNew={table.isNew}
                  />
                ))}
              </div>
            )}
          </AnimatePresence>

          {/* Tabla de Análisis de Productos */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-400 uppercase tracking-wider">
              Análisis de Productos
              <span className="text-xs text-slate-600 ml-2 font-normal">(período seleccionado)</span>
            </h3>
            <ProductAnalysisTable />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl h-[450px] shadow-xl flex flex-col"
            >
              {isLoadingComparison || !comparisonData ? (
                <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-800/50 rounded-2xl bg-slate-900/30">
                  <p className="text-slate-600 text-sm font-medium italic tracking-tight">Cargando visualización ECharts...</p>
                </div>
              ) : (
                <ComparisonChart
                  title="Unidades Venta vs 52 Semanas Atrás"
                  currentData={comparisonData.current?.data || []}
                  previousData={comparisonData.previous?.data || []}
                  currentTotal={comparisonData.current?.totalUnits || 0}
                  previousTotal={comparisonData.previous?.totalUnits || 0}
                  percentage={comparisonData.percentages?.units || 0}
                  type="unidades"
                  isLoading={isLoadingComparison}
                />
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl h-[450px] shadow-xl flex flex-col"
            >
              {isLoadingComparison || !comparisonData ? (
                <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-800/50 rounded-2xl bg-slate-900/30">
                  <p className="text-slate-600 text-sm font-medium italic tracking-tight">Cargando visualización ECharts...</p>
                </div>
              ) : (
                <ComparisonChart
                  title="Importe Venta (M) vs 52 Semanas Atrás"
                  currentData={comparisonData.current?.data || []}
                  previousData={comparisonData.previous?.data || []}
                  currentTotal={comparisonData.current?.totalImporte || 0}
                  previousTotal={comparisonData.previous?.totalImporte || 0}
                  percentage={comparisonData.percentages?.importe || 0}
                  type="importe"
                  isLoading={isLoadingComparison}
                />
              )}
            </motion.div>
          </div>

          {/* Product Detail Modal */}
          <ProductDetail
            productId={selectedProductId}
            onClose={() => setSelectedProductId(null)}
            initialStartDate={selectedFilters.startDate}
            initialEndDate={selectedFilters.endDate}
          />
        </>
      )}
      </div>
    </DashboardContainer>
  );
}
