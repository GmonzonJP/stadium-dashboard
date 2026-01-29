'use client';

import React, { useState } from 'react';
import { DashboardContainer } from '@/components/DashboardContainer';
import { WatchlistTable } from '@/components/price-actions/WatchlistTable';
import { PriceSimulator } from '@/components/price-actions/PriceSimulator';
import { ProposalsQueue } from '@/components/price-actions/ProposalsQueue';
import { List, Calculator, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WatchlistItem, PriceSimulationResult } from '@/types/price-actions';

type TabId = 'watchlist' | 'simulator' | 'queue';

const tabs = [
    { id: 'watchlist' as TabId, label: 'Watchlist', icon: List, description: 'Detección de candidatos' },
    { id: 'simulator' as TabId, label: 'Simulador', icon: Calculator, description: 'Simular cambio de precio' },
    { id: 'queue' as TabId, label: 'Bandeja', icon: Inbox, description: 'Propuestas de cambio' }
];

export default function PriceActionsPage() {
    const [activeTab, setActiveTab] = useState<TabId>('watchlist');
    const [selectedProduct, setSelectedProduct] = useState<WatchlistItem | null>(null);

    const handleSimulatePrice = (item: WatchlistItem) => {
        setSelectedProduct(item);
        setActiveTab('simulator');
    };

    const handleAddToQueue = async (result: PriceSimulationResult) => {
        try {
            const response = await fetch('/api/price-actions/proposals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    baseCol: result.baseCol,
                    descripcion: selectedProduct?.descripcionCorta,
                    precioActual: result.precioActual,
                    precioPropuesto: result.precioPropuesto,
                    motivo: selectedProduct?.motivo[0] || 'Otro',
                    notas: `Simulación: ${result.sellOutProyectadoPorcentaje.toFixed(1)}% sell-out, ${result.margenTotal > 0 ? '+' : ''}${result.margenTotal.toFixed(0)} margen`,
                    estado: 'pendiente',
                    sellOutProyectado: result.sellOutProyectadoPorcentaje,
                    margenTotalProyectado: result.margenTotal,
                    costoCastigo: result.costoCastigo,
                    confianzaElasticidad: result.elasticidad.confidence,
                    usuarioNombre: 'Usuario' // TODO: obtener del contexto de auth
                })
            });

            if (!response.ok) throw new Error('Error al agregar propuesta');

            alert('Propuesta agregada a la bandeja');
            setActiveTab('queue');
            setSelectedProduct(null);
        } catch (err) {
            console.error('Error adding to queue:', err);
            alert('Error al agregar propuesta');
        }
    };

    return (
        <DashboardContainer>
            <div className="space-y-6 pb-12">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold text-white tracking-tight mb-1">
                            Price Actions
                        </h1>
                        <p className="text-slate-500 text-sm">
                            Gestión de precios y rotación - Maximizar sell-out manteniendo rentabilidad
                        </p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="border-b border-slate-800">
                    <nav className="flex space-x-1" aria-label="Tabs">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        "flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors border-b-2",
                                        isActive
                                            ? "border-blue-500 text-blue-400"
                                            : "border-transparent text-slate-500 hover:text-slate-400 hover:border-slate-700"
                                    )}
                                >
                                    <Icon size={18} />
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Tab Content */}
                <div className="mt-6">
                    {activeTab === 'watchlist' && (
                        <WatchlistTable onSimulatePrice={handleSimulatePrice} />
                    )}

                    {activeTab === 'simulator' && (
                        <PriceSimulator product={selectedProduct} onAddToQueue={handleAddToQueue} />
                    )}

                    {activeTab === 'queue' && (
                        <ProposalsQueue />
                    )}
                </div>
            </div>
        </DashboardContainer>
    );
}
