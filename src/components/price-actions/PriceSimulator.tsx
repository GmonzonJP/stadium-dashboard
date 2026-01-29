'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { PriceSimulationInput, PriceSimulationResult, WatchlistItem } from '@/types/price-actions';
import { motion } from 'framer-motion';
import { Calculator, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Loader2, Plus, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercent, formatNumber } from '@/lib/calculation-utils';
import * as echarts from 'echarts';

// Tooltip component using Portal
function SimTooltip({ text }: { text: string }) {
    const [show, setShow] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0 });
    const btnRef = useRef<HTMLButtonElement>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleEnter = () => {
        if (btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect();
            setPos({
                top: rect.bottom + 8,
                left: Math.max(130, Math.min(rect.left, window.innerWidth - 150))
            });
            setShow(true);
        }
    };

    const tooltip = show && mounted ? createPortal(
        <div
            style={{
                position: 'fixed',
                top: pos.top,
                left: pos.left,
                zIndex: 99999,
            }}
            className="bg-slate-800 border border-slate-600 rounded-lg shadow-2xl px-3 py-2.5 text-xs text-slate-200 w-64 text-left"
        >
            {text}
        </div>,
        document.body
    ) : null;

    return (
        <>
            <button
                ref={btnRef}
                type="button"
                onMouseEnter={handleEnter}
                onMouseLeave={() => setShow(false)}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEnter(); }}
                className="ml-1.5 text-slate-500 hover:text-blue-400 focus:outline-none inline-flex"
            >
                <Info size={14} />
            </button>
            {tooltip}
        </>
    );
}

// Metric info definitions
const METRIC_INFO = {
    sellOut: "Porcentaje del stock que se proyecta vender en el horizonte definido. 100% = vender todo el stock.",
    margenTotal: "Ganancia total proyectada = (Precio - Costo) × Unidades vendidas. Puede ser negativo si el precio está bajo el costo.",
    costoCastigo: "Dinero que se 'deja de ganar' por bajar el precio. = (Precio actual - Precio nuevo) × Unidades proyectadas. Es el costo de oportunidad.",
    confianza: "Nivel de confianza en la elasticidad calculada. ALTA = muchos datos históricos de productos similares. BAJA = pocos datos, la proyección es menos precisa.",
    observaciones: "Cantidad de transacciones históricas usadas para calcular la elasticidad. Más observaciones = mayor confianza.",
    elasticidad: "Sensibilidad de la demanda al precio. Ej: -1.5 significa que si bajas 10% el precio, las ventas suben 15%.",
    horizonte: "Cantidad de días hacia el futuro para proyectar las ventas con el nuevo precio.",
    precioPropuesto: "Nuevo precio de venta que quieres simular. Puede ser mayor o menor al actual."
};

interface PriceSimulatorProps {
    product?: WatchlistItem | null;
    onAddToQueue?: (result: PriceSimulationResult) => void;
}

export function PriceSimulator({ product, onAddToQueue }: PriceSimulatorProps) {
    const [precioPropuesto, setPrecioPropuesto] = useState<number>(0);
    const [horizonteDias, setHorizonteDias] = useState<number>(90);
    const [simulation, setSimulation] = useState<PriceSimulationResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [chartRef, setChartRef] = useState<HTMLDivElement | null>(null);
    const [chartInstance, setChartInstance] = useState<echarts.ECharts | null>(null);

    useEffect(() => {
        if (product) {
            setPrecioPropuesto(product.precioActual);
        }
    }, [product]);

    // Initialize chart
    useEffect(() => {
        if (chartRef && simulation) {
            if (chartInstance) {
                chartInstance.dispose();
            }

            const chart = echarts.init(chartRef);
            setChartInstance(chart);

            // Generate projection data
            const days = Array.from({ length: simulation.horizonteDias }, (_, i) => i + 1);
            const unidadesAcumuladas = days.map(day => {
                const unidades = Math.min(
                    simulation.ritmoProyectado * day,
                    simulation.stockTotal
                );
                return unidades;
            });

            const option = {
                backgroundColor: 'transparent',
                textStyle: { color: '#e2e8f0' },
                grid: { left: '10%', right: '10%', top: '15%', bottom: '15%' },
                xAxis: {
                    type: 'category',
                    data: days,
                    name: 'Días',
                    nameTextStyle: { color: '#94a3b8' },
                    axisLine: { lineStyle: { color: '#334155' } },
                    axisLabel: { color: '#94a3b8' }
                },
                yAxis: {
                    type: 'value',
                    name: 'Unidades',
                    nameTextStyle: { color: '#94a3b8' },
                    axisLine: { lineStyle: { color: '#334155' } },
                    axisLabel: { color: '#94a3b8' },
                    splitLine: { lineStyle: { color: '#1e293b' } }
                },
                series: [{
                    data: unidadesAcumuladas,
                    type: 'line',
                    smooth: true,
                    lineStyle: { color: '#3b82f6', width: 2 },
                    areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
                        { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
                        { offset: 1, color: 'rgba(59, 130, 246, 0.05)' }
                    ]}},
                    markLine: {
                        data: [{ yAxis: simulation.stockTotal, name: 'Stock Total' }],
                        lineStyle: { color: '#ef4444', type: 'dashed' },
                        label: { formatter: 'Stock: {c}', color: '#ef4444' }
                    }
                }],
                tooltip: {
                    trigger: 'axis',
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    borderColor: '#334155',
                    textStyle: { color: '#e2e8f0' }
                }
            };

            chart.setOption(option);

            const handleResize = () => chart.resize();
            window.addEventListener('resize', handleResize);

            return () => {
                window.removeEventListener('resize', handleResize);
                chart.dispose();
            };
        }
    }, [chartRef, simulation]);

    const handleSimulate = async () => {
        if (!product) return;

        setIsLoading(true);
        setError(null);

        try {
            const input: PriceSimulationInput = {
                baseCol: product.baseCol,
                precioActual: product.precioActual,
                precioPropuesto: precioPropuesto,
                horizonteDias: horizonteDias
            };

            const response = await fetch('/api/price-actions/simulator', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input }),
                cache: 'no-store'
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.details || errorData.error || 'Error al simular');
            }

            const result = await response.json();
            setSimulation(result);
        } catch (err) {
            console.error('Error simulating:', err);
            setError(err instanceof Error ? err.message : 'Error al simular');
        } finally {
            setIsLoading(false);
        }
    };

    if (!product) {
        return (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 text-center">
                <p className="text-slate-500">Selecciona un producto de la watchlist para simular</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Product Info */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Producto: {product.baseCol}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <span className="text-slate-500">Precio Actual</span>
                        <p className="text-white font-medium">{formatCurrency(product.precioActual)}</p>
                    </div>
                    <div>
                        <span className="text-slate-500">Costo</span>
                        <p className="text-white font-medium">{formatCurrency(product.costo)}</p>
                    </div>
                    <div>
                        <span className="text-slate-500">Stock Total</span>
                        <p className="text-white font-medium">{formatNumber(product.stockTotal)}</p>
                    </div>
                    <div>
                        <span className="text-slate-500">Ritmo Actual</span>
                        <p className="text-white font-medium">{formatNumber(product.ritmoActual, 2)}/día</p>
                    </div>
                </div>
            </div>

            {/* Inputs */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Parámetros de Simulación</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="flex items-center text-sm font-medium text-slate-400 mb-2">
                            Precio Propuesto
                            <SimTooltip text={METRIC_INFO.precioPropuesto} />
                        </label>
                        <input
                            type="number"
                            value={precioPropuesto}
                            onChange={(e) => setPrecioPropuesto(Number(e.target.value))}
                            className="w-full px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            min="0"
                            step="0.01"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            Cambio: {precioPropuesto && product.precioActual ? 
                                formatPercent(((precioPropuesto - product.precioActual) / product.precioActual) * 100) : '—'}
                        </p>
                    </div>
                    <div>
                        <label className="flex items-center text-sm font-medium text-slate-400 mb-2">
                            Horizonte (días)
                            <SimTooltip text={METRIC_INFO.horizonte} />
                        </label>
                        <input
                            type="number"
                            value={horizonteDias}
                            onChange={(e) => setHorizonteDias(Number(e.target.value))}
                            className="w-full px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            min="1"
                        />
                    </div>
                </div>
                <button
                    onClick={handleSimulate}
                    disabled={isLoading || !precioPropuesto}
                    className={cn(
                        "mt-4 px-6 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2",
                        isLoading || !precioPropuesto
                            ? "bg-slate-800 text-slate-600 cursor-not-allowed"
                            : "bg-blue-600 hover:bg-blue-500 text-white"
                    )}
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Simulando...</span>
                        </>
                    ) : (
                        <>
                            <Calculator className="w-4 h-4" />
                            <span>Simular</span>
                        </>
                    )}
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg">
                    <p className="text-red-400 text-sm">{error}</p>
                </div>
            )}

            {/* Results */}
            {simulation && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                >
                    {/* Chart */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4">Proyección de Unidades</h3>
                        <div ref={setChartRef} className="w-full h-64" />
                    </div>

                    {/* Key Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                            <div className="text-sm text-slate-500 mb-1 flex items-center">
                                Sell-out Proyectado
                                <SimTooltip text={METRIC_INFO.sellOut} />
                            </div>
                            <div className="text-2xl font-bold text-white">
                                {formatPercent(simulation.sellOutProyectadoPorcentaje)}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                                {formatNumber(simulation.unidadesProyectadasCap)} / {formatNumber(simulation.stockTotal)} unidades
                            </div>
                        </div>
                        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                            <div className="text-sm text-slate-500 mb-1 flex items-center">
                                Margen Total
                                <SimTooltip text={METRIC_INFO.margenTotal} />
                            </div>
                            <div className="text-2xl font-bold text-white">
                                {formatCurrency(simulation.margenTotal)}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                                Unitario: {formatCurrency(simulation.margenUnitario)}
                            </div>
                        </div>
                        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                            <div className="text-sm text-slate-500 mb-1 flex items-center">
                                Costo del Castigo
                                <SimTooltip text={METRIC_INFO.costoCastigo} />
                            </div>
                            <div className="text-2xl font-bold text-orange-400">
                                {formatCurrency(simulation.costoCastigo)}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                                Diferencia de precio × unidades
                            </div>
                        </div>
                        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                            <div className="text-sm text-slate-500 mb-1 flex items-center">
                                Confianza Elasticidad
                                <SimTooltip text={METRIC_INFO.confianza} />
                            </div>
                            <div className={cn(
                                "text-2xl font-bold",
                                simulation.elasticidad?.confidence === 'alta' ? "text-green-400" :
                                simulation.elasticidad?.confidence === 'media' ? "text-yellow-400" :
                                "text-orange-400"
                            )}>
                                {simulation.elasticidad?.confidence?.toUpperCase() || 'BAJA'}
                            </div>
                            <div className="text-xs text-slate-500 mt-1 flex items-center">
                                {simulation.elasticidad?.observations || 0} observaciones
                                <SimTooltip text={METRIC_INFO.observaciones} />
                            </div>
                        </div>
                    </div>

                    {/* Warnings */}
                    {simulation.warnings.length > 0 && (
                        <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg">
                            <div className="flex items-start space-x-2">
                                <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-yellow-400 font-medium mb-2">Advertencias</p>
                                    <ul className="list-disc list-inside text-sm text-yellow-300 space-y-1">
                                        {simulation.warnings.map((warning, idx) => (
                                            <li key={idx}>{warning}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Add to Queue Button */}
                    {onAddToQueue && (
                        <button
                            onClick={() => onAddToQueue(simulation)}
                            className="w-full px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center space-x-2"
                        >
                            <Plus className="w-5 h-5" />
                            <span>Agregar a Bandeja de Propuestas</span>
                        </button>
                    )}
                </motion.div>
            )}
        </div>
    );
}
