'use client';

import React from 'react';
import { Rocket, CheckCircle, Turtle, Flame, HelpCircle } from 'lucide-react';
import { ProductoEstado, PRODUCT_STATUS_CONFIG } from '@/types/sell-out';

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

// Componente combinado para mostrar estado + saldo si aplica
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

export default ProductStatusBadge;
