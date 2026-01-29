'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { JobStatusResponse, JobStatus } from '@/types/price-actions';

interface WatchlistProgressModalProps {
    jobId: string | null;
    isOpen: boolean;
    onClose: () => void;
    onComplete: (jobId: string) => void;
    onError?: (error: string) => void;
}

export function WatchlistProgressModal({
    jobId,
    isOpen,
    onClose,
    onComplete,
    onError
}: WatchlistProgressModalProps) {
    const [status, setStatus] = useState<JobStatusResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isCancelling, setIsCancelling] = useState(false);
    const pollingRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);

    // Polling para obtener estado del job
    const fetchStatus = useCallback(async () => {
        if (!jobId) return;

        try {
            const response = await fetch(`/api/price-actions/watchlist/status/${jobId}`);
            
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Error al obtener estado');
            }

            const data: JobStatusResponse = await response.json();
            setStatus(data);

            // Si el job completó, notificar y dejar de hacer polling
            if (data.status === 'completed') {
                if (pollingRef.current) {
                    clearInterval(pollingRef.current);
                    pollingRef.current = null;
                }
                // Pequeño delay para mostrar el 100% antes de cerrar
                setTimeout(() => {
                    onComplete(jobId);
                }, 500);
            } else if (data.status === 'failed') {
                if (pollingRef.current) {
                    clearInterval(pollingRef.current);
                    pollingRef.current = null;
                }
                setError(data.errorMessage || 'Error desconocido');
                onError?.(data.errorMessage || 'Error desconocido');
            } else if (data.status === 'cancelled') {
                if (pollingRef.current) {
                    clearInterval(pollingRef.current);
                    pollingRef.current = null;
                }
            }
        } catch (err) {
            console.error('Error fetching job status:', err);
            setError(err instanceof Error ? err.message : 'Error al obtener estado');
        }
    }, [jobId, onComplete, onError]);

    // Iniciar polling cuando se abre el modal
    useEffect(() => {
        if (isOpen && jobId) {
            startTimeRef.current = Date.now();
            setElapsedTime(0);
            setError(null);
            setStatus(null);
            setIsCancelling(false);

            // Fetch inicial
            fetchStatus();

            // Polling cada 1.5 segundos
            pollingRef.current = setInterval(fetchStatus, 1500);

            // Timer para mostrar tiempo transcurrido
            const timerInterval = setInterval(() => {
                if (startTimeRef.current) {
                    setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
                }
            }, 1000);

            return () => {
                if (pollingRef.current) {
                    clearInterval(pollingRef.current);
                    pollingRef.current = null;
                }
                clearInterval(timerInterval);
            };
        }
    }, [isOpen, jobId, fetchStatus]);

    // Cancelar job
    const handleCancel = async () => {
        if (!jobId || isCancelling) return;

        setIsCancelling(true);
        try {
            const response = await fetch(`/api/price-actions/watchlist/cancel/${jobId}`, {
                method: 'POST'
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Error al cancelar');
            }

            // Refetch status
            await fetchStatus();
        } catch (err) {
            console.error('Error cancelling job:', err);
            setError(err instanceof Error ? err.message : 'Error al cancelar');
        } finally {
            setIsCancelling(false);
        }
    };

    // Formatear tiempo
    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    };

    // Obtener color e icono según estado
    const getStatusInfo = (jobStatus: JobStatus | undefined) => {
        switch (jobStatus) {
            case 'completed':
                return { 
                    icon: <CheckCircle className="text-green-400" size={24} />, 
                    color: 'text-green-400',
                    bgColor: 'bg-green-500'
                };
            case 'failed':
                return { 
                    icon: <XCircle className="text-red-400" size={24} />, 
                    color: 'text-red-400',
                    bgColor: 'bg-red-500'
                };
            case 'cancelled':
                return { 
                    icon: <AlertTriangle className="text-yellow-400" size={24} />, 
                    color: 'text-yellow-400',
                    bgColor: 'bg-yellow-500'
                };
            case 'running':
                return { 
                    icon: <Loader2 className="text-blue-400 animate-spin" size={24} />, 
                    color: 'text-blue-400',
                    bgColor: 'bg-blue-500'
                };
            default:
                return { 
                    icon: <Clock className="text-slate-400" size={24} />, 
                    color: 'text-slate-400',
                    bgColor: 'bg-slate-500'
                };
        }
    };

    const statusInfo = getStatusInfo(status?.status);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                        onClick={() => {
                            if (status?.status !== 'running' && status?.status !== 'pending') {
                                onClose();
                            }
                        }}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    >
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    {statusInfo.icon}
                                    <h2 className="text-lg font-bold text-white">
                                        {status?.status === 'completed' ? 'Cálculo Completado' :
                                         status?.status === 'failed' ? 'Error en Cálculo' :
                                         status?.status === 'cancelled' ? 'Cálculo Cancelado' :
                                         'Calculando Watchlist'}
                                    </h2>
                                </div>
                                {(status?.status === 'completed' || status?.status === 'failed' || status?.status === 'cancelled') && (
                                    <button
                                        onClick={onClose}
                                        className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                )}
                            </div>

                            {/* Content */}
                            <div className="p-6 space-y-6">
                                {/* Progress Bar */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-400">Progreso</span>
                                        <span className={cn("font-bold", statusInfo.color)}>
                                            {status?.progress || 0}%
                                        </span>
                                    </div>
                                    <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                                        <motion.div
                                            className={cn("h-full rounded-full", statusInfo.bgColor)}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${status?.progress || 0}%` }}
                                            transition={{ duration: 0.3, ease: 'easeOut' }}
                                        />
                                    </div>
                                </div>

                                {/* Current Step */}
                                <div className="bg-slate-800/50 rounded-xl p-4">
                                    <p className="text-sm text-slate-300">
                                        {status?.currentStep || 'Iniciando...'}
                                    </p>
                                </div>

                                {/* Stats */}
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-white">
                                            {status?.processedItems || 0}
                                        </div>
                                        <div className="text-xs text-slate-500">Procesados</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-white">
                                            {status?.totalItems || '—'}
                                        </div>
                                        <div className="text-xs text-slate-500">Total</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-white">
                                            {formatTime(elapsedTime)}
                                        </div>
                                        <div className="text-xs text-slate-500">Tiempo</div>
                                    </div>
                                </div>

                                {/* Error Message */}
                                {error && (
                                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                                        <p className="text-sm text-red-400">{error}</p>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 border-t border-slate-800 flex justify-end space-x-3">
                                {(status?.status === 'running' || status?.status === 'pending') && (
                                    <button
                                        onClick={handleCancel}
                                        disabled={isCancelling}
                                        className={cn(
                                            "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                                            isCancelling
                                                ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                                                : "bg-red-600 hover:bg-red-500 text-white"
                                        )}
                                    >
                                        {isCancelling ? 'Cancelando...' : 'Cancelar'}
                                    </button>
                                )}

                                {(status?.status === 'completed' || status?.status === 'failed' || status?.status === 'cancelled') && (
                                    <button
                                        onClick={onClose}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                                    >
                                        Cerrar
                                    </button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
