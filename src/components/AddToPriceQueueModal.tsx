'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingCart, Tag, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProposalMotivo } from '@/types/price-actions';

export interface AddToPriceQueueModalProps {
    isOpen: boolean;
    onClose: () => void;
    baseCol: string;
    descripcion: string;
    precioActual: number;
    precioNuevo: number;
    onSuccess?: () => void;
}

const MOTIVOS: { value: ProposalMotivo; label: string }[] = [
    { value: 'Early', label: 'Early (Fracaso temprano)' },
    { value: 'Desacelera', label: 'Desacelera' },
    { value: 'Sobrestock', label: 'Sobrestock' },
    { value: 'Sin tracción', label: 'Sin tracción' },
    { value: 'Otro', label: 'Otro' }
];

export function AddToPriceQueueModal({
    isOpen,
    onClose,
    baseCol,
    descripcion,
    precioActual,
    precioNuevo: initialPrecioNuevo,
    onSuccess
}: AddToPriceQueueModalProps) {
    const [precioPropuesto, setPrecioPropuesto] = useState(initialPrecioNuevo);
    const [usarPrecioAntesAhora, setUsarPrecioAntesAhora] = useState(false);
    const [precioAntes, setPrecioAntes] = useState(precioActual);
    const [motivo, setMotivo] = useState<ProposalMotivo>('Sobrestock');
    const [notas, setNotas] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setPrecioPropuesto(initialPrecioNuevo);
            setPrecioAntes(precioActual);
            setUsarPrecioAntesAhora(false);
            setMotivo('Sobrestock');
            setNotas('');
            setError(null);
            setSuccess(false);
        }
    }, [isOpen, initialPrecioNuevo, precioActual]);

    const formatCurrency = (value: number) => {
        return `$${value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    };

    const calculateChange = () => {
        const base = usarPrecioAntesAhora ? precioAntes : precioActual;
        const change = ((precioPropuesto - base) / base) * 100;
        return change;
    };

    const handleSubmit = async () => {
        setError(null);
        setIsSubmitting(true);

        try {
            const payload = {
                baseCol,
                descripcion,
                precioActual,
                precioPropuesto,
                precioAntes: usarPrecioAntesAhora ? precioAntes : undefined,
                usarPrecioAntesAhora,
                motivo,
                notas: notas.trim() || undefined,
                usuarioNombre: 'Usuario' // TODO: Get from auth context
            };

            const response = await fetch('/api/price-actions/proposals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Error al crear propuesta');
            }

            setSuccess(true);
            setTimeout(() => {
                onSuccess?.();
                onClose();
            }, 1500);
        } catch (err) {
            console.error('Error submitting proposal:', err);
            setError(err instanceof Error ? err.message : 'Error al crear propuesta');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={onClose}
                />

                {/* Modal */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-5 border-b border-slate-800">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center">
                                <ShoppingCart className="text-blue-400" size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-white">Agregar a Bandeja de Precios</h3>
                                <p className="text-xs text-slate-500">Crear propuesta de cambio de precio</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-5 space-y-5 flex-1 overflow-y-auto">
                        {/* Product Info */}
                        <div className="bg-slate-800/50 rounded-xl p-4">
                            <div className="text-xs text-slate-500 mb-1">Producto</div>
                            <div className="font-mono text-sm text-slate-300">{baseCol}</div>
                            <div className="text-sm text-white mt-1 line-clamp-2">{descripcion}</div>
                        </div>

                        {/* Prices Section */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* Precio Actual */}
                            <div className="space-y-2">
                                <label className="text-xs text-slate-500">Precio Actual</label>
                                <div className="bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3">
                                    <span className="text-lg font-bold text-slate-400">{formatCurrency(precioActual)}</span>
                                </div>
                            </div>

                            {/* Precio Nuevo */}
                            <div className="space-y-2">
                                <label className="text-xs text-slate-500">Precio Nuevo</label>
                                <div className="flex items-center bg-slate-800/50 border border-slate-700 focus-within:border-blue-500 rounded-lg px-4 py-2">
                                    <span className="text-slate-500 mr-1">$</span>
                                    <input
                                        type="number"
                                        value={precioPropuesto}
                                        onChange={(e) => setPrecioPropuesto(Number(e.target.value))}
                                        className="flex-1 bg-transparent text-lg font-bold text-white focus:outline-none"
                                        min="0"
                                        step="1"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Precio Antes/Ahora Checkbox */}
                        <div className="space-y-3">
                            <label className="flex items-center space-x-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={usarPrecioAntesAhora}
                                    onChange={(e) => setUsarPrecioAntesAhora(e.target.checked)}
                                    className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900"
                                />
                                <span className="text-sm text-white flex items-center space-x-2">
                                    <Tag size={16} className="text-purple-400" />
                                    <span>Usar precio antes/ahora (promociones)</span>
                                </span>
                            </label>

                            {/* Precio Antes (conditional) */}
                            <AnimatePresence>
                                {usarPrecioAntesAhora && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 space-y-3">
                                            <div className="flex items-center space-x-2">
                                                <Tag size={14} className="text-purple-400" />
                                                <span className="text-xs text-purple-300">
                                                    Configurar precio &quot;antes&quot; para etiqueta de promocion
                                                </span>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs text-slate-500">Precio Antes (tachado)</label>
                                                <div className="flex items-center bg-slate-900/50 border border-slate-700 focus-within:border-purple-500 rounded-lg px-4 py-2">
                                                    <span className="text-slate-500 mr-1">$</span>
                                                    <input
                                                        type="number"
                                                        value={precioAntes}
                                                        onChange={(e) => setPrecioAntes(Number(e.target.value))}
                                                        className="flex-1 bg-transparent text-lg font-bold text-white focus:outline-none"
                                                        min="0"
                                                        step="1"
                                                    />
                                                </div>
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                Se mostrara como: <span className="line-through text-purple-400">{formatCurrency(precioAntes)}</span> <span className="text-green-400 font-bold">{formatCurrency(precioPropuesto)}</span>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Change Preview */}
                        <div className={cn(
                            "flex items-center justify-center py-3 px-4 rounded-xl text-sm font-medium",
                            calculateChange() < 0 ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"
                        )}>
                            {usarPrecioAntesAhora ? (
                                <span>
                                    Antes: <span className="line-through">{formatCurrency(precioAntes)}</span> | Ahora: {formatCurrency(precioPropuesto)} ({calculateChange().toFixed(1)}%)
                                </span>
                            ) : (
                                <span>
                                    {formatCurrency(precioActual)} → {formatCurrency(precioPropuesto)} ({calculateChange().toFixed(1)}%)
                                </span>
                            )}
                        </div>

                        {/* Motivo */}
                        <div className="space-y-2">
                            <label className="text-xs text-slate-500">Motivo</label>
                            <select
                                value={motivo}
                                onChange={(e) => setMotivo(e.target.value as ProposalMotivo)}
                                className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {MOTIVOS.map(m => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Notas */}
                        <div className="space-y-2">
                            <label className="text-xs text-slate-500">Notas (opcional)</label>
                            <textarea
                                value={notas}
                                onChange={(e) => setNotas(e.target.value)}
                                placeholder="Agregar comentarios sobre esta propuesta..."
                                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                rows={3}
                            />
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="flex items-center space-x-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                                <AlertCircle className="text-red-400" size={18} />
                                <span className="text-sm text-red-400">{error}</span>
                            </div>
                        )}

                        {/* Success */}
                        {success && (
                            <div className="flex items-center space-x-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                                <CheckCircle className="text-green-400" size={18} />
                                <span className="text-sm text-green-400">Propuesta agregada exitosamente</span>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end space-x-3 p-5 border-t border-slate-800 bg-slate-900/50">
                        <button
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting || success || precioPropuesto <= 0}
                            className={cn(
                                "flex items-center space-x-2 px-5 py-2 rounded-lg text-sm font-bold transition-all",
                                isSubmitting || success || precioPropuesto <= 0
                                    ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                                    : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25"
                            )}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="animate-spin" size={16} />
                                    <span>Agregando...</span>
                                </>
                            ) : (
                                <>
                                    <ShoppingCart size={16} />
                                    <span>Agregar a Bandeja</span>
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
