'use client';

import React from 'react';
import { Rocket, CheckCircle, Turtle, Flame, HelpCircle, Package, Archive, AlertTriangle } from 'lucide-react';
import {
  ProductoEstado,
  StockStatus,
  SalesPerformance,
  PRODUCT_STATUS_CONFIG,
  STOCK_STATUS_CONFIG,
} from '@/types/sell-out';

interface ProductStatusBadgeProps {
  estado: ProductoEstado;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showTooltip?: boolean;
}

const ICON_MAP = {
  Rocket,
  CheckCircle,
  Turtle,
  Flame,
  HelpCircle,
};

// Iconos para Estado de Stock (Dimensión B)
const STOCK_ICON_MAP = {
  Package,
  Archive,
  AlertTriangle,
};

const SIZE_CLASSES = {
  sm: {
    badge: 'px-1.5 py-0.5 text-xs',
    icon: 14,
    gap: 'gap-1',
  },
  md: {
    badge: 'px-2 py-1 text-sm',
    icon: 16,
    gap: 'gap-1.5',
  },
  lg: {
    badge: 'px-3 py-1.5 text-base',
    icon: 18,
    gap: 'gap-2',
  },
};

const COLOR_CLASSES = {
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  gray: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

export function ProductStatusBadge({
  estado,
  size = 'md',
  showLabel = true,
  showTooltip = true,
}: ProductStatusBadgeProps) {
  const config = PRODUCT_STATUS_CONFIG[estado];
  const IconComponent = ICON_MAP[config.icon];
  const sizeConfig = SIZE_CLASSES[size];
  const colorClass = COLOR_CLASSES[config.color];

  return (
    <div className="relative group inline-flex">
      <span
        className={`
          inline-flex items-center rounded-full font-medium
          ${sizeConfig.badge}
          ${sizeConfig.gap}
          ${colorClass}
        `}
      >
        <IconComponent size={sizeConfig.icon} />
        {showLabel && <span>{config.label}</span>}
      </span>

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
          <div className="font-semibold">{config.label}</div>
          <div className="text-gray-300">{config.descripcion}</div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}

// Badge de saldo (stock < 30)
export function SaldoBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const sizeConfig = SIZE_CLASSES[size];

  return (
    <span
      className={`
        inline-flex items-center rounded-full font-medium
        bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400
        ${sizeConfig.badge}
      `}
    >
      Saldo
    </span>
  );
}

// Componente combinado para mostrar estado + saldo si aplica (legacy)
export function ProductStatusWithSaldo({
  estado,
  esSaldo,
  size = 'md',
}: {
  estado: ProductoEstado;
  esSaldo: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <div className="flex items-center gap-2">
      <ProductStatusBadge estado={estado} size={size} />
      {esSaldo && <SaldoBadge size={size === 'lg' ? 'md' : 'sm'} />}
    </div>
  );
}

// ============================================
// NUEVOS COMPONENTES: Dimensión B (Estado de Stock)
// ============================================

interface StockStatusBadgeProps {
  status: StockStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showTooltip?: boolean;
}

/**
 * Badge para Estado de Stock (Dimensión B)
 * - ACTIVO: Stock normal (no se muestra badge)
 * - SALDO_BAJO_STOCK: Stock residual (<30 unidades)
 * - SALDO_ARRASTRE: Fuera de temporada con stock relevante
 */
export function StockStatusBadge({
  status,
  size = 'sm',
  showLabel = true,
  showTooltip = true,
}: StockStatusBadgeProps) {
  // No mostrar badge para ACTIVO (estado normal)
  if (status === 'ACTIVO') return null;

  const config = STOCK_STATUS_CONFIG[status];
  const IconComponent = STOCK_ICON_MAP[config.icon];
  const sizeConfig = SIZE_CLASSES[size];
  const colorClass = COLOR_CLASSES[config.color];

  return (
    <div className="relative group inline-flex">
      <span
        className={`
          inline-flex items-center rounded-full font-medium
          ${sizeConfig.badge}
          ${sizeConfig.gap}
          ${colorClass}
        `}
      >
        <IconComponent size={sizeConfig.icon} />
        {showLabel && <span>{config.label}</span>}
      </span>

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
          <div className="font-semibold">{config.label}</div>
          <div className="text-gray-300">{config.descripcion}</div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}

interface ProductFullStatusBadgeProps {
  salesPerformance: SalesPerformance;
  stockStatus: StockStatus;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

/**
 * Badge combinado que muestra ambas dimensiones:
 * - Desempeño de Venta (Fast/OK/Slow/Clavo)
 * - Estado de Stock (Activo/Saldo/Arrastre)
 */
export function ProductFullStatusBadge({
  salesPerformance,
  stockStatus,
  size = 'md',
  showTooltip = true,
}: ProductFullStatusBadgeProps) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <ProductStatusBadge
        estado={salesPerformance}
        size={size}
        showTooltip={showTooltip}
      />
      <StockStatusBadge
        status={stockStatus}
        size={size === 'lg' ? 'md' : 'sm'}
        showTooltip={showTooltip}
      />
    </div>
  );
}

/**
 * Badge compacto para tablas - muestra solo iconos con tooltip
 */
export function ProductStatusCompact({
  salesPerformance,
  stockStatus,
}: {
  salesPerformance: SalesPerformance;
  stockStatus: StockStatus;
}) {
  return (
    <div className="flex items-center gap-1">
      <ProductStatusBadge
        estado={salesPerformance}
        size="sm"
        showLabel={false}
        showTooltip={true}
      />
      {stockStatus !== 'ACTIVO' && (
        <StockStatusBadge
          status={stockStatus}
          size="sm"
          showLabel={false}
          showTooltip={true}
        />
      )}
    </div>
  );
}

export default ProductStatusBadge;
