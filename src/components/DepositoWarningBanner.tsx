'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, X, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DepositoValidationResult {
    isValid: boolean;
    totalDepositosChecked: number;
    matchingDepositos: number;
    missingMappings: number[];
    warning: string | null;
    mode: 'tienda' | 'deposito';
}

export function DepositoWarningBanner() {
    const [validation, setValidation] = useState<DepositoValidationResult | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isDismissed, setIsDismissed] = useState(false);
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        // Check if user previously dismissed this warning (stored in localStorage)
        const dismissed = localStorage.getItem('deposito-warning-dismissed');
        if (dismissed) {
            const dismissedAt = new Date(dismissed);
            const hoursSinceDismiss = (Date.now() - dismissedAt.getTime()) / (1000 * 60 * 60);
            // Show again after 24 hours
            if (hoursSinceDismiss < 24) {
                setIsDismissed(true);
                setIsLoading(false);
                return;
            }
        }

        // Fetch validation status
        async function fetchValidation() {
            try {
                const response = await fetch('/api/validation/deposito-tienda');
                if (response.ok) {
                    const data = await response.json();
                    setValidation(data);
                }
            } catch (error) {
                console.error('Error fetching deposito-tienda validation:', error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchValidation();
    }, []);

    const handleDismiss = () => {
        setIsDismissed(true);
        localStorage.setItem('deposito-warning-dismissed', new Date().toISOString());
    };

    // Don't show anything while loading or if dismissed
    if (isLoading || isDismissed) return null;

    // Don't show if validation is valid or no warning
    if (!validation || validation.isValid || !validation.warning) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mb-6"
            >
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 relative">
                    <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                            <AlertTriangle className="text-amber-500" size={20} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-4">
                                <h4 className="text-amber-400 font-semibold text-sm">
                                    Mapeo Depósito → Tienda incompleto
                                </h4>
                                <button
                                    onClick={handleDismiss}
                                    className="text-amber-500/70 hover:text-amber-400 transition-colors p-1"
                                    title="Ocultar por 24 horas"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                            
                            <p className="text-amber-300/80 text-xs mt-1 leading-relaxed">
                                El stock se muestra por depósito porque {validation.missingMappings.length} depósito(s) 
                                no tienen tienda asociada en la base de datos.
                            </p>
                            
                            <button
                                onClick={() => setShowDetails(!showDetails)}
                                className="flex items-center gap-1 text-amber-400/70 hover:text-amber-400 text-xs mt-2 transition-colors"
                            >
                                <Info size={12} />
                                {showDetails ? 'Ocultar detalles' : 'Ver detalles'}
                            </button>
                            
                            <AnimatePresence>
                                {showDetails && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="mt-3 pt-3 border-t border-amber-500/20"
                                    >
                                        <div className="grid grid-cols-2 gap-4 text-xs">
                                            <div>
                                                <span className="text-amber-400/60">Depósitos verificados:</span>
                                                <span className="text-amber-300 ml-2 font-medium">
                                                    {validation.totalDepositosChecked}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-amber-400/60">Con tienda asociada:</span>
                                                <span className="text-amber-300 ml-2 font-medium">
                                                    {validation.matchingDepositos}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        {validation.missingMappings.length > 0 && (
                                            <div className="mt-2">
                                                <span className="text-amber-400/60 text-xs">Depósitos sin mapeo: </span>
                                                <span className="text-amber-300 text-xs font-mono">
                                                    {validation.missingMappings.slice(0, 10).join(', ')}
                                                    {validation.missingMappings.length > 10 && ` (+${validation.missingMappings.length - 10} más)`}
                                                </span>
                                            </div>
                                        )}
                                        
                                        <p className="text-amber-400/50 text-xs mt-3 italic">
                                            Modo actual: <span className="font-medium">{validation.mode === 'deposito' ? 'Por Depósito' : 'Por Tienda'}</span>
                                        </p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
