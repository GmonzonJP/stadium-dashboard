'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EditablePriceCellProps {
    baseCol: string;
    descripcion: string;
    precio: number | null;
    onPriceEdit: (data: {
        baseCol: string;
        descripcion: string;
        precioActual: number;
        precioNuevo: number;
    }) => void;
    formatCurrency?: (value: number | null) => string;
    className?: string;
}

export function EditablePriceCell({
    baseCol,
    descripcion,
    precio,
    onPriceEdit,
    formatCurrency = (v) => v != null ? `$${v.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '—',
    className
}: EditablePriceCellProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleStartEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (precio == null) return;
        setEditValue(String(precio));
        setIsEditing(true);
    };

    const handleConfirm = () => {
        const newPrice = parseFloat(editValue);
        if (!isNaN(newPrice) && newPrice > 0 && newPrice !== precio && precio != null) {
            onPriceEdit({
                baseCol,
                descripcion,
                precioActual: precio,
                precioNuevo: newPrice
            });
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleConfirm();
        } else if (e.key === 'Escape') {
            setIsEditing(false);
        }
    };

    const handleBlur = () => {
        handleConfirm();
    };

    if (isEditing) {
        return (
            <div className="flex items-center">
                <span className="text-slate-500 mr-1">$</span>
                <input
                    ref={inputRef}
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleBlur}
                    className="w-20 px-2 py-1 bg-slate-900 border border-blue-500 rounded text-white text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    step="1"
                    min="0"
                />
            </div>
        );
    }

    return (
        <div
            className={cn(
                "group/price relative flex items-center justify-end cursor-pointer",
                className
            )}
            onClick={handleStartEdit}
        >
            <span className="font-mono text-slate-300 tabular-nums text-sm">
                {formatCurrency(precio)}
            </span>
            {precio != null && (
                <button
                    onClick={handleStartEdit}
                    className="ml-1.5 opacity-0 group-hover/price:opacity-100 p-1 hover:bg-slate-700 rounded transition-all text-slate-500 hover:text-blue-400"
                    title="Editar precio"
                >
                    <Pencil size={12} />
                </button>
            )}
        </div>
    );
}
