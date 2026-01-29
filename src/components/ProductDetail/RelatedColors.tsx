'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ColorVariant {
  baseCol: string;
  color: string;
  imageUrl: string;
  stock: number;
}

interface RelatedColorsProps {
  colors: ColorVariant[];
  currentBaseCol: string;
  onSelectColor: (baseCol: string) => void;
}

export function RelatedColors({
  colors,
  currentBaseCol,
  onSelectColor,
}: RelatedColorsProps) {
  if (colors.length <= 1) return null;

  return (
    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
      <p className="text-xs text-slate-500 font-semibold uppercase mb-3">Otros colores</p>
      <div className="flex flex-wrap gap-2">
        {colors.map((variant) => {
          const isActive = variant.baseCol === currentBaseCol;

          return (
            <motion.button
              key={variant.baseCol}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => !isActive && onSelectColor(variant.baseCol)}
              className={cn(
                "relative w-14 h-14 rounded-lg overflow-hidden border-2 transition-all",
                isActive
                  ? "border-blue-500 ring-2 ring-blue-200"
                  : "border-slate-200 hover:border-slate-400",
                variant.stock === 0 && "opacity-50"
              )}
              title={`${variant.color} - Stock: ${variant.stock}`}
            >
              <img
                src={variant.imageUrl}
                alt={variant.color}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = 'https://placehold.co/56x56/e5e7eb/9ca3af?text=?';
                }}
              />

              {/* Badge de stock 0 */}
              {variant.stock === 0 && (
                <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
                  <span className="text-[9px] text-white font-bold">SIN STOCK</span>
                </div>
              )}

              {/* Indicador de selección */}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500" />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

export default RelatedColors;
