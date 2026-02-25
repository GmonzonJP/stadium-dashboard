'use client';

import React, { useState, useCallback } from 'react';
import { Download, FileSpreadsheet, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExportButtonProps {
    onClick: () => void;
    label?: string;
    variant?: 'icon' | 'button';
    disabled?: boolean;
    className?: string;
}

export function ExportButton({
    onClick,
    label,
    variant = 'icon',
    disabled = false,
    className
}: ExportButtonProps) {
    const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');

    const handleClick = useCallback(async () => {
        if (status !== 'idle' || disabled) return;
        setStatus('loading');
        try {
            // Small delay to show loading state
            await new Promise(r => setTimeout(r, 100));
            onClick();
            setStatus('success');
            setTimeout(() => setStatus('idle'), 1500);
        } catch {
            setStatus('idle');
        }
    }, [onClick, status, disabled]);

    if (variant === 'button') {
        return (
            <button
                onClick={handleClick}
                disabled={disabled || status === 'loading'}
                className={cn(
                    "flex items-center space-x-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-all",
                    status === 'success'
                        ? "bg-emerald-600"
                        : "bg-green-600 hover:bg-green-500",
                    disabled && "opacity-50 cursor-not-allowed",
                    className
                )}
            >
                {status === 'loading' ? (
                    <Loader2 size={16} className="animate-spin" />
                ) : status === 'success' ? (
                    <Check size={16} />
                ) : (
                    <FileSpreadsheet size={16} />
                )}
                <span>{status === 'success' ? 'Descargado' : (label || 'Exportar Excel')}</span>
            </button>
        );
    }

    // Icon variant
    return (
        <div className="relative group">
            <button
                onClick={handleClick}
                disabled={disabled || status === 'loading'}
                className={cn(
                    "p-2 rounded-lg transition-all",
                    status === 'success'
                        ? "text-emerald-400 bg-emerald-500/10"
                        : "text-slate-500 hover:text-emerald-400 hover:bg-slate-800",
                    disabled && "opacity-50 cursor-not-allowed",
                    className
                )}
            >
                {status === 'loading' ? (
                    <Loader2 size={16} className="animate-spin" />
                ) : status === 'success' ? (
                    <Check size={16} />
                ) : (
                    <Download size={16} />
                )}
            </button>
            {status === 'idle' && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[11px] rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-slate-700 shadow-lg">
                    Descargar Excel
                </div>
            )}
        </div>
    );
}
