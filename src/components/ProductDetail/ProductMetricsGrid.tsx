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
  ultimoCosto: number;
  fechaUltimaCompra?: string;
  fecha1raVenta?: string;
  fechaUltimaVenta?: string;
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
  ultimoCosto,
  fechaUltimaCompra,
  fecha1raVenta,
  fechaUltimaVenta,
}: ProductMetricsGridProps) {
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
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            {getRitmoIcon()}
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Ritmo de Venta</span>
          </div>
          <div className={`text-xl font-bold ${getRitmoColor()}`}>
            {getRitmoLabel()}
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Días Stock</div>
          <div className={`text-xl font-bold ${
            diasStock !== null && diasStock > 365 ? 'text-red-600' :
            diasStock !== null && diasStock > 180 ? 'text-amber-600' :
            diasStock !== null && diasStock < 30 ? 'text-orange-600' :
            'text-slate-900'
          }`}>
            {diasStock !== null ? Math.round(diasStock) : '-'}
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Pares/día</div>
          <div className="text-xl font-bold text-slate-900">
            {ritmoVenta !== null ? ritmoVenta.toFixed(2) : '-'}
          </div>
        </div>
      </div>

      {/* Fila 2: Margen, Costo, PVP */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`border rounded-xl p-3 ${
          margenBruto !== null && margenBruto >= 40 ? 'bg-emerald-50 border-emerald-200' :
          margenBruto !== null && margenBruto < 20 ? 'bg-red-50 border-red-200' :
          'bg-slate-50 border-slate-200'
        }`}>
          <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Mg Bruto</div>
          <div className={`text-xl font-bold ${
            margenBruto !== null && margenBruto >= 40 ? 'text-emerald-700' :
            margenBruto !== null && margenBruto < 20 ? 'text-red-700' :
            'text-slate-900'
          }`}>
            {formatPercent(margenBruto)}
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Costo</div>
          <div className="text-xl font-bold text-slate-900">
            {formatCurrency(costo)}
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
          <div className="text-[10px] text-emerald-600 uppercase font-semibold mb-1">PVP</div>
          <div className="text-xl font-bold text-emerald-700">
            {formatCurrency(pvp)}
          </div>
        </div>
      </div>

      {/* Fila 3: Fechas */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-2 bg-slate-50 rounded-lg border border-slate-200">
          <div className="text-sm font-bold text-slate-900">
            {fechaUltimaCompra || '-'}
          </div>
          <div className="text-[10px] text-slate-500">Últ.Compra</div>
        </div>

        <div className="text-center p-2 bg-slate-50 rounded-lg border border-slate-200">
          <div className="text-sm font-bold text-slate-900">
            {fecha1raVenta || '-'}
          </div>
          <div className="text-[10px] text-slate-500">1ra Venta</div>
        </div>

        <div className="text-center p-2 bg-slate-50 rounded-lg border border-slate-200">
          <div className="text-sm font-bold text-slate-900">
            {fechaUltimaVenta || '-'}
          </div>
          <div className="text-[10px] text-slate-500">Últ.Venta</div>
        </div>
      </div>

      {/* Fila 4: Resumen grandes */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-blue-700">
            {formatNumber(unidadesVendidas)}
          </div>
          <div className="text-[10px] text-blue-600 font-semibold">Un.Vend. Hist.</div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-slate-700">
            {formatCurrency(ultimoCosto)}
          </div>
          <div className="text-[10px] text-slate-500 font-semibold">Últ.Costo</div>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-emerald-700">
            {formatNumber(stock)}
          </div>
          <div className="text-[10px] text-emerald-600 font-semibold">Stock</div>
        </div>
      </div>
    </div>
  );
}

export default ProductMetricsGrid;
