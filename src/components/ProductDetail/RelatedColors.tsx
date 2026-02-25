'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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

const VISIBLE_COUNT = 3;

export function RelatedColors({
  colors,
  currentBaseCol,
  onSelectColor,
}: RelatedColorsProps) {
  // Filter out the current color from the list
  const otherColors = colors.filter(c => c.baseCol !== currentBaseCol);

  const [startIndex, setStartIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset index when colors change
  useEffect(() => {
    setStartIndex(0);
  }, [currentBaseCol]);

  // Don't render if no other colors
  if (otherColors.length === 0) return null;

  const hasSlider = otherColors.length > VISIBLE_COUNT;
  const visibleColors = hasSlider
    ? otherColors.slice(startIndex, startIndex + VISIBLE_COUNT)
    : otherColors;

  const canGoBack = startIndex > 0;
  const canGoForward = startIndex + VISIBLE_COUNT < otherColors.length;

  const handlePrev = () => {
    if (canGoBack) {
      setStartIndex(prev => Math.max(0, prev - 1));
    }
  };

  const handleNext = () => {
    if (canGoForward) {
      setStartIndex(prev => Math.min(otherColors.length - VISIBLE_COUNT, prev + 1));
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
      <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase mb-3">
        Otros colores
      </p>

      <div className="relative" ref={containerRef}>
        {/* Navigation buttons */}
        {hasSlider && (
          <>
            <button
              onClick={handlePrev}
              disabled={!canGoBack}
              className={cn(
                "absolute -left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all",
                "bg-white dark:bg-slate-700 shadow-lg border border-slate-200 dark:border-slate-600",
                canGoBack
                  ? "hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200"
                  : "opacity-40 cursor-not-allowed text-slate-400 dark:text-slate-500"
              )}
              aria-label="Ver colores anteriores"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              onClick={handleNext}
              disabled={!canGoForward}
              className={cn(
                "absolute -right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all",
                "bg-white dark:bg-slate-700 shadow-lg border border-slate-200 dark:border-slate-600",
                canGoForward
                  ? "hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200"
                  : "opacity-40 cursor-not-allowed text-slate-400 dark:text-slate-500"
              )}
              aria-label="Ver más colores"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Colors grid */}
        <div className={cn(
          "flex gap-3 overflow-hidden",
          hasSlider && "mx-4"
        )}>
          <AnimatePresence mode="popLayout">
            {visibleColors.map((variant) => (
              <motion.button
                key={variant.baseCol}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onSelectColor(variant.baseCol)}
                className={cn(
                  "relative w-20 h-20 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0",
                  "border-slate-200 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500",
                  variant.stock === 0 && "opacity-60"
                )}
                title={`${variant.color} - Stock: ${variant.stock}`}
              >
                <img
                  src={variant.imageUrl}
                  alt={variant.color}
                  loading="lazy"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = 'https://placehold.co/80x80/e5e7eb/9ca3af?text=?';
                  }}
                />

                {/* Badge de stock 0 */}
                {variant.stock === 0 && (
                  <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
                    <span className="text-[10px] text-white font-bold">SIN STOCK</span>
                  </div>
                )}
              </motion.button>
            ))}
          </AnimatePresence>
        </div>

        {/* Pagination dots */}
        {hasSlider && (
          <div className="flex justify-center gap-1.5 mt-3">
            {Array.from({ length: Math.ceil(otherColors.length / VISIBLE_COUNT) }).map((_, idx) => {
              const isActive = Math.floor(startIndex / VISIBLE_COUNT) === idx ||
                (idx === 0 && startIndex < VISIBLE_COUNT);
              return (
                <button
                  key={idx}
                  onClick={() => setStartIndex(idx * VISIBLE_COUNT)}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    isActive
                      ? "bg-blue-500 w-4"
                      : "bg-slate-300 dark:bg-slate-600 hover:bg-slate-400 dark:hover:bg-slate-500"
                  )}
                  aria-label={`Página ${idx + 1}`}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default RelatedColors;
