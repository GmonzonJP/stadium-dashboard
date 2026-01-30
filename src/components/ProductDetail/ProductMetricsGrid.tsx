'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Activity, Package, Calendar, DollarSign, Percent } from 'lucide-react';

interface ProductMetricsGridProps {
  ritmoVenta: number | null; // pares por día
  diasStock: number | null;
  stock: number;
  margenBruto: number | null;
  costo: number;
  pvp: number;
  unidadesVendidas: number;
  unidadesCompradas?: number; // Total comprado en la última compra
  ultimoCosto: number;
  fechaUltimaCompra?: string;
  fecha1raVenta?: string;
  fechaUltimaVenta?: string;
  // Métricas desde última compra
  ventasImporte?: number; // Ventas $ desde última compra
  utilidadVenta?: number; // Utilidad = Ventas - Costo desde última compra
}

const formatCurrency = (value: number | null): string => {
  if (value === null || value === undefined) return '-';
  return `$${value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const formatNumber = (value: number | null): string => {
  if (value === null || value === undefined) return '-';
  return value.toLocaleString('es-AR');
};

const formatPercent = (value: number | null): string => {
  if (value === null || value === undefined) return '-';
  return `${value.toFixed(1)}%`;
};

export function ProductMetricsGrid({
  ritmoVenta,
  diasStock,
  stock,
  margenBruto,
  costo,
  pvp,
  unidadesVendidas,
  unidadesCompradas,
  ultimoCosto,
  fechaUltimaCompra,
  fecha1raVenta,
  fechaUltimaVenta,
  ventasImporte,
  utilidadVenta,
}: ProductMetricsGridProps) {
  // Calcular % vendido vs comprado
  const porcentajeVendido = unidadesCompradas && unidadesCompradas > 0
    ? (unidadesVendidas / unidadesCompradas) * 100
    : null;
  // Determinar ritmo de venta
  const getRitmoLabel = () => {
    if (ritmoVenta === null) return 'N/A';
    if (ritmoVenta >= 2) return 'ALTO';
    if (ritmoVenta >= 0.5) return 'MEDIO';
    return 'BAJO';
  };

  const getRitmoColor = () => {
    if (ritmoVenta === null) return 'text-slate-500';
    if (ritmoVenta >= 2) return 'text-emerald-600';
    if (ritmoVenta >= 0.5) return 'text-amber-600';
    return 'text-red-600';
  };

  const getRitmoIcon = () => {
    if (ritmoVenta === null) return <Activity className="text-slate-400" size={18} />;
    if (ritmoVenta >= 2) return <TrendingUp className="text-emerald-500" size={18} />;
    if (ritmoVenta >= 0.5) return <Activity className="text-amber-500" size={18} />;
    return <TrendingDown className="text-red-500" size={18} />;
  };

  return (
    <div className="space-y-4">
      {/* Fila 1: Ritmo, Días Stock, Pares/Día */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            {getRitmoIcon()}
            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">Ritmo de Venta</span>
          </div>
          <div className={`text-xl font-bold ${getRitmoColor()}`}>
            {getRitmoLabel()}
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
          <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold mb-1">Días Stock</div>
          <div className={`text-xl font-bold ${
            diasStock !== null && diasStock > 365 ? 'text-red-600 dark:text-red-400' :
            diasStock !== null && diasStock > 180 ? 'text-amber-600 dark:text-amber-400' :
            diasStock !== null && diasStock < 30 ? 'text-orange-600 dark:text-orange-400' :
            'text-slate-900 dark:text-white'
          }`}>
            {diasStock !== null ? Math.round(diasStock) : '-'}
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
          <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold mb-1">Pares/día</div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">
            {ritmoVenta !== null ? ritmoVenta.toFixed(2) : '-'}
          </div>
        </div>
      </div>

      {/* Fila 2: Margen, Costo, PVP */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`border rounded-xl p-3 ${
          margenBruto !== null && margenBruto >= 40 ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' :
          margenBruto !== null && margenBruto < 20 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' :
          'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
        }`}>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold mb-1">Mg Bruto</div>
          <div className={`text-xl font-bold ${
            margenBruto !== null && margenBruto >= 40 ? 'text-emerald-700 dark:text-emerald-400' :
            margenBruto !== null && margenBruto < 20 ? 'text-red-700 dark:text-red-400' :
            'text-slate-900 dark:text-white'
          }`}>
            {formatPercent(margenBruto)}
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
          <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold mb-1">Costo</div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(costo)}
          </div>
        </div>

        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3">
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-semibold mb-1">PVP</div>
          <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
            {formatCurrency(pvp)}
          </div>
        </div>
      </div>

      {/* Fila 3: Fechas */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="text-sm font-bold text-slate-900 dark:text-white">
            {fechaUltimaCompra || '-'}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">Últ.Compra</div>
        </div>

        <div className="text-center p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="text-sm font-bold text-slate-900 dark:text-white">
            {fecha1raVenta || '-'}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">1ra Venta</div>
        </div>

        <div className="text-center p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="text-sm font-bold text-slate-900 dark:text-white">
            {fechaUltimaVenta || '-'}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">Últ.Venta</div>
        </div>
      </div>

      {/* Fila 4: Ventas y Utilidad del período */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
            {formatNumber(unidadesVendidas)}
          </div>
          <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">Unidades</div>
          <div className="text-[9px] text-blue-400">desde ult. compra</div>
        </div>

        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
            {ventasImporte !== undefined ? formatCurrency(ventasImporte) : '-'}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Ventas $</div>
          <div className="text-[9px] text-emerald-400">desde ult. compra</div>
        </div>

        <div className={`border rounded-xl p-3 text-center ${
          utilidadVenta !== undefined && utilidadVenta > 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' :
          utilidadVenta !== undefined && utilidadVenta < 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' :
          'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
        }`}>
          <div className={`text-2xl font-bold ${
            utilidadVenta !== undefined && utilidadVenta > 0 ? 'text-emerald-700 dark:text-emerald-400' :
            utilidadVenta !== undefined && utilidadVenta < 0 ? 'text-red-700 dark:text-red-400' :
            'text-slate-700 dark:text-slate-300'
          }`}>
            {utilidadVenta !== undefined ? formatCurrency(utilidadVenta) : '-'}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Utilidad</div>
          <div className="text-[9px] text-slate-400">desde ult. compra</div>
        </div>
      </div>

      {/* Fila 5: Resumen Stock y Compra */}
      <div className="grid grid-cols-4 gap-3">
        <div className={`border rounded-xl p-3 text-center ${
          porcentajeVendido !== null && porcentajeVendido >= 80 ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' :
          porcentajeVendido !== null && porcentajeVendido >= 50 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' :
          porcentajeVendido !== null && porcentajeVendido < 50 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' :
          'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
        }`}>
          <div className={`text-xl font-bold ${
            porcentajeVendido !== null && porcentajeVendido >= 80 ? 'text-emerald-700 dark:text-emerald-400' :
            porcentajeVendido !== null && porcentajeVendido >= 50 ? 'text-amber-700 dark:text-amber-400' :
            porcentajeVendido !== null && porcentajeVendido < 50 ? 'text-red-700 dark:text-red-400' :
            'text-slate-700 dark:text-slate-300'
          }`}>
            {porcentajeVendido !== null ? `${porcentajeVendido.toFixed(0)}%` : '-'}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">% Vendido</div>
          {unidadesCompradas && (
            <div className="text-[9px] text-slate-400 dark:text-slate-500">
              de {formatNumber(unidadesCompradas)} comp.
            </div>
          )}
        </div>

        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-slate-700 dark:text-slate-300">
            {formatCurrency(ultimoCosto)}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Últ.Costo</div>
        </div>

        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
            {formatNumber(stock)}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Stock</div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-slate-700 dark:text-slate-300">
            {formatNumber(unidadesCompradas || 0)}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Compradas</div>
        </div>
      </div>
    </div>
  );
}

export default ProductMetricsGrid;
