'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Info, X, Database, Calculator, TrendingUp, 
    Package, Calendar, AlertTriangle, ChevronDown, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DefinitionSection {
    id: string;
    title: string;
    icon: React.ReactNode;
    content: React.ReactNode;
}

export function AboutDefinitions() {
    const [isOpen, setIsOpen] = useState(false);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['stock', 'kpis']));

    const toggleSection = (id: string) => {
        setExpandedSections(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const sections: DefinitionSection[] = [
        {
            id: 'stock',
            title: 'Stock - Fuente de Verdad',
            icon: <Package size={16} className="text-emerald-400" />,
            content: (
                <div className="space-y-3 text-sm">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                        <p className="text-emerald-400 font-medium">
                            Tabla: <code className="bg-emerald-500/20 px-1 rounded">dbo.MovStockTotalResumen</code>
                        </p>
                    </div>
                    <div className="text-slate-400 space-y-2">
                        <p>
                            <strong className="text-slate-300">Campos utilizados:</strong>
                        </p>
                        <ul className="list-disc list-inside pl-2 space-y-1">
                            <li><code className="text-blue-400">TotalStock</code> - Stock disponible actual</li>
                            <li><code className="text-blue-400">Pendientes</code> - Stock pendiente de recibir</li>
                            <li><code className="text-blue-400">IdArticulo</code> - Código del artículo (primeros 13 caracteres = BaseCol)</li>
                            <li><code className="text-blue-400">IdDeposito</code> - ID del depósito/tienda</li>
                        </ul>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-amber-400 text-xs">
                        <AlertTriangle size={14} className="inline mr-1" />
                        <strong>Importante:</strong> NO se usa <code>Transacciones.stockSKU</code> ni <code>stockBaseColor</code> para cálculos de stock.
                    </div>
                </div>
            )
        },
        {
            id: 'kpis',
            title: 'KPIs y Fórmulas',
            icon: <Calculator size={16} className="text-blue-400" />,
            content: (
                <div className="space-y-4 text-sm">
                    {/* ASP */}
                    <div className="border border-slate-700 rounded-lg p-3">
                        <h4 className="text-blue-400 font-medium mb-2">ASP (Precio Promedio de Venta)</h4>
                        <code className="text-white bg-slate-800 px-2 py-1 rounded block mb-2">
                            ASP = Venta Total ($) / Unidades Vendidas
                        </code>
                        <p className="text-slate-500 text-xs">
                            Representa el precio promedio al que se vendieron los productos en el período.
                        </p>
                    </div>

                    {/* Margen */}
                    <div className="border border-slate-700 rounded-lg p-3">
                        <h4 className="text-emerald-400 font-medium mb-2">Margen (%)</h4>
                        <code className="text-white bg-slate-800 px-2 py-1 rounded block mb-2">
                            Margen = (Precio - Costo) / Precio × 100
                        </code>
                        <p className="text-slate-500 text-xs">
                            Porcentaje de ganancia sobre el precio de venta. Un margen del 40% significa que el 40% del precio es ganancia.
                        </p>
                    </div>

                    {/* Markup */}
                    <div className="border border-slate-700 rounded-lg p-3">
                        <h4 className="text-purple-400 font-medium mb-2">Markup (%)</h4>
                        <code className="text-white bg-slate-800 px-2 py-1 rounded block mb-2">
                            Markup = (Precio - Costo) / Costo × 100
                        </code>
                        <p className="text-slate-500 text-xs">
                            Porcentaje de recargo sobre el costo. Un markup del 100% significa que el precio es el doble del costo.
                        </p>
                    </div>

                    {/* Días de Stock */}
                    <div className="border border-slate-700 rounded-lg p-3">
                        <h4 className="text-orange-400 font-medium mb-2">Días de Stock</h4>
                        <code className="text-white bg-slate-800 px-2 py-1 rounded block mb-2">
                            Días Stock = Stock Total / (Unidades Vendidas / Días del Período)
                        </code>
                        <p className="text-slate-500 text-xs">
                            Estimación de cuántos días durará el stock actual al ritmo de venta del período seleccionado.
                        </p>
                    </div>

                    {/* Comparación Margen vs Markup */}
                    <div className="bg-slate-800/50 rounded-lg p-3">
                        <h4 className="text-slate-300 font-medium mb-2">Ejemplo: Margen vs Markup</h4>
                        <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                                <p className="text-slate-500">Costo: $100</p>
                                <p className="text-slate-500">Precio: $150</p>
                            </div>
                            <div>
                                <p className="text-emerald-400">Margen: 33.3%</p>
                                <p className="text-purple-400">Markup: 50%</p>
                            </div>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'ytd',
            title: 'YTD (Year To Date)',
            icon: <Calendar size={16} className="text-amber-400" />,
            content: (
                <div className="space-y-3 text-sm text-slate-400">
                    <p>
                        Los KPIs marcados como <span className="text-amber-400 font-medium">YTD</span> muestran 
                        datos acumulados desde el 1 de enero del año en curso hasta hoy.
                    </p>
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                        <p className="text-amber-400 font-medium text-xs">
                            <AlertTriangle size={12} className="inline mr-1" />
                            YTD <strong>ignora el filtro de período</strong> pero respeta los demás filtros 
                            (tienda, marca, categoría, etc.)
                        </p>
                    </div>
                    <p className="text-slate-500 text-xs">
                        La comparación &quot;vs YTD año anterior&quot; compara el mismo período (1 enero - fecha actual) 
                        pero del año pasado.
                    </p>
                </div>
            )
        },
        {
            id: 'semaforo',
            title: 'Semáforo de Reposición',
            icon: <TrendingUp size={16} className="text-red-400" />,
            content: (
                <div className="space-y-3 text-sm">
                    <p className="text-slate-400">
                        El semáforo indica el estado de reposición basado en el ritmo de ventas 
                        de los últimos 180 días y el stock actual.
                    </p>
                    
                    <div className="space-y-2">
                        <div className="flex items-center gap-3 p-2 bg-slate-800/50 rounded-lg">
                            <div className="w-4 h-4 bg-red-500 rounded-full" />
                            <div>
                                <span className="text-red-400 font-medium">ROJO - Sobrestock</span>
                                <p className="text-xs text-slate-500">Días reales de stock superan los esperados</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-3 p-2 bg-slate-800/50 rounded-lg">
                            <div className="w-4 h-4 bg-emerald-500 rounded-full" />
                            <div>
                                <span className="text-emerald-400 font-medium">VERDE - Reponer</span>
                                <p className="text-xs text-slate-500">Menos de 45 días de stock. Recompra recomendada</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-3 p-2 bg-slate-800/50 rounded-lg">
                            <div className="w-4 h-4 bg-slate-600 rounded-full" />
                            <div>
                                <span className="text-slate-300 font-medium">NEGRO - Normal</span>
                                <p className="text-xs text-slate-500">Stock dentro de parámetros esperados</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-3 p-2 bg-slate-800/50 rounded-lg">
                            <div className="w-4 h-4 bg-white border border-slate-500 rounded-full" />
                            <div>
                                <span className="text-slate-300 font-medium">BLANCO - Sin Info</span>
                                <p className="text-xs text-slate-500">Faltan datos para calcular (sin última compra o sin ventas)</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-800/50 rounded-lg p-3 text-xs text-slate-500">
                        <p className="mb-1"><strong className="text-slate-400">Cálculo:</strong></p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>Ritmo diario = Unidades vendidas (180d) / 180</li>
                            <li>Días reales = Stock actual / Ritmo diario</li>
                            <li>Días esperados = 180 - Días desde última compra</li>
                        </ul>
                    </div>
                </div>
            )
        }
    ];

    return (
        <>
            {/* Floating Button */}
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-20 right-6 z-40 p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-lg shadow-blue-500/30 transition-all hover:scale-105 group"
                title="Definiciones y Ayuda"
            >
                <Info size={24} />
                <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                    Definiciones
                </span>
            </button>

            {/* Modal */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                        />
                        <motion.div
                            initial={{ opacity: 0, x: 100 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 100 }}
                            className="fixed right-0 top-0 h-full w-full max-w-lg bg-[#0f172a] border-l border-slate-800 z-50 shadow-2xl flex flex-col"
                        >
                            {/* Header */}
                            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-500/10 rounded-lg">
                                        <Info className="text-blue-500" size={20} />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-white">Definiciones</h2>
                                        <p className="text-xs text-slate-500">Fórmulas y fuentes de datos</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                                {sections.map((section) => (
                                    <div 
                                        key={section.id}
                                        className="border border-slate-800 rounded-xl overflow-hidden"
                                    >
                                        <button
                                            onClick={() => toggleSection(section.id)}
                                            className="w-full p-4 flex items-center justify-between bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                {section.icon}
                                                <span className="font-medium text-white">{section.title}</span>
                                            </div>
                                            {expandedSections.has(section.id) ? (
                                                <ChevronDown size={16} className="text-slate-500" />
                                            ) : (
                                                <ChevronRight size={16} className="text-slate-500" />
                                            )}
                                        </button>
                                        
                                        <AnimatePresence>
                                            {expandedSections.has(section.id) && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="p-4 border-t border-slate-800">
                                                        {section.content}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                ))}
                            </div>

                            {/* Footer */}
                            <div className="p-4 border-t border-slate-800 bg-slate-900/50">
                                <p className="text-xs text-slate-600 text-center">
                                    Dashboard de Productos · Stadium
                                </p>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
