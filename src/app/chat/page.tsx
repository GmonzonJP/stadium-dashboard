'use client';

import React from 'react';
import { DashboardContainer } from '@/components/DashboardContainer';
import { ChatPanel } from '@/components/ChatPanel';
import { motion } from 'framer-motion';
import { Sparkles, Database, MessageSquare, Zap } from 'lucide-react';

export default function ChatPage() {
    return (
        <DashboardContainer>
            <div className="h-[calc(100vh-120px)] flex flex-col lg:flex-row gap-6">
                {/* Panel de Chat Principal */}
                <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex-1 min-h-0"
                >
                    <ChatPanel isFloating={false} className="h-full rounded-2xl" />
                </motion.div>

                {/* Panel Lateral de Información */}
                <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="w-full lg:w-80 space-y-4 lg:overflow-y-auto"
                >
                    {/* Card: Acerca de StadiumGPT */}
                    <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/20 rounded-2xl p-5">
                        <div className="flex items-center space-x-3 mb-4">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                                <Sparkles className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-white">StadiumGPT</h3>
                                <p className="text-xs text-blue-300">Asistente IA de Datos</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-300 leading-relaxed">
                            Tu asistente inteligente para análisis de datos del negocio. 
                            Pregunta sobre ventas, productos, stock y más.
                        </p>
                    </div>

                    {/* Card: Capacidades */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
                        <h4 className="font-semibold text-white mb-3 flex items-center space-x-2">
                            <Zap className="w-4 h-4 text-yellow-500" />
                            <span>Capacidades</span>
                        </h4>
                        <ul className="space-y-2.5 text-sm text-slate-400">
                            <li className="flex items-start space-x-2">
                                <span className="text-blue-400">•</span>
                                <span>Consultas de ventas y métricas en tiempo real</span>
                            </li>
                            <li className="flex items-start space-x-2">
                                <span className="text-green-400">•</span>
                                <span>Análisis de productos y tendencias</span>
                            </li>
                            <li className="flex items-start space-x-2">
                                <span className="text-purple-400">•</span>
                                <span>Comparación entre períodos</span>
                            </li>
                            <li className="flex items-start space-x-2">
                                <span className="text-orange-400">•</span>
                                <span>Alertas de stock e inventario</span>
                            </li>
                            <li className="flex items-start space-x-2">
                                <span className="text-pink-400">•</span>
                                <span>Generación de SQL personalizado</span>
                            </li>
                        </ul>
                    </div>

                    {/* Card: Ejemplos de Preguntas */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
                        <h4 className="font-semibold text-white mb-3 flex items-center space-x-2">
                            <MessageSquare className="w-4 h-4 text-blue-400" />
                            <span>Ejemplos de Preguntas</span>
                        </h4>
                        <div className="space-y-2">
                            {[
                                "¿Cuáles son los productos más vendidos?",
                                "¿Cómo van las ventas vs el año pasado?",
                                "Muéstrame productos con stock bajo",
                                "¿Qué marcas tienen mejor margen?",
                                "Analiza las ventas por tienda"
                            ].map((question, i) => (
                                <button
                                    key={i}
                                    className="w-full text-left text-sm px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg text-slate-300 hover:text-white transition-colors border border-slate-700/50"
                                    onClick={() => {
                                        // Copiar al portapapeles como ayuda
                                        navigator.clipboard?.writeText(question);
                                    }}
                                >
                                    &quot;{question}&quot;
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-slate-500 mt-3">
                            Click para copiar al portapapeles
                        </p>
                    </div>

                    {/* Card: Conexión a Datos */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
                        <h4 className="font-semibold text-white mb-3 flex items-center space-x-2">
                            <Database className="w-4 h-4 text-green-400" />
                            <span>Datos Conectados</span>
                        </h4>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between items-center py-1.5 border-b border-slate-800">
                                <span className="text-slate-400">Transacciones</span>
                                <span className="text-green-400 text-xs">Conectado</span>
                            </div>
                            <div className="flex justify-between items-center py-1.5 border-b border-slate-800">
                                <span className="text-slate-400">Stock</span>
                                <span className="text-green-400 text-xs">Conectado</span>
                            </div>
                            <div className="flex justify-between items-center py-1.5 border-b border-slate-800">
                                <span className="text-slate-400">Precios</span>
                                <span className="text-green-400 text-xs">Conectado</span>
                            </div>
                            <div className="flex justify-between items-center py-1.5">
                                <span className="text-slate-400">Costos</span>
                                <span className="text-green-400 text-xs">Conectado</span>
                            </div>
                        </div>
                    </div>

                    {/* Nota de Privacidad */}
                    <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-800">
                        <p className="text-xs text-slate-500 leading-relaxed">
                            <strong className="text-slate-400">🔒 Privacidad:</strong> Toda la comunicación 
                            ocurre en tus servidores. Los datos nunca salen de tu infraestructura.
                        </p>
                    </div>
                </motion.div>
            </div>
        </DashboardContainer>
    );
}
