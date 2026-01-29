'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Bell, Filter, RefreshCw, X } from 'lucide-react';
import { IncidenciaCard } from './IncidenciaCard';
import { Incidencia, TipoIncidencia, IncidenciasResponse } from '@/types/sell-out';

interface IncidenciasPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function IncidenciasPanel({ isOpen, onClose }: IncidenciasPanelProps) {
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<TipoIncidencia | 'TODAS'>('TODAS');
  const [filtroSeveridad, setFiltroSeveridad] = useState<string>('todas');

  const fetchIncidencias = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/incidencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) throw new Error('Error al cargar incidencias');

      const data: IncidenciasResponse = await response.json();
      setIncidencias(data.incidencias);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchIncidencias();
    }
  }, [isOpen]);

  const handleAprobar = async (id: string, parametros?: Record<string, unknown>) => {
    try {
      const response = await fetch(`/api/incidencias/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'APROBAR', parametros }),
      });

      if (response.ok) {
        setIncidencias(prev => prev.filter(i => i.id !== id));
      }
    } catch (err) {
      console.error('Error al aprobar incidencia:', err);
    }
  };

  const handleIgnorar = async (id: string, motivo: string) => {
    try {
      const response = await fetch(`/api/incidencias/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'IGNORAR', motivo }),
      });

      if (response.ok) {
        setIncidencias(prev => prev.filter(i => i.id !== id));
      }
    } catch (err) {
      console.error('Error al ignorar incidencia:', err);
    }
  };

  const incidenciasFiltradas = incidencias.filter(i => {
    if (filtroTipo !== 'TODAS' && i.tipo !== filtroTipo) return false;
    if (filtroSeveridad !== 'todas' && i.severidad !== filtroSeveridad) return false;
    return true;
  });

  const contadorPorSeveridad = {
    critica: incidencias.filter(i => i.severidad === 'critica').length,
    alta: incidencias.filter(i => i.severidad === 'alta').length,
    media: incidencias.filter(i => i.severidad === 'media').length,
    baja: incidencias.filter(i => i.severidad === 'baja').length,
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-xl bg-white dark:bg-gray-900 shadow-2xl z-50 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                    <Bell className="text-red-600 dark:text-red-400" size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Incidencias Urgentes
                    </h2>
                    <p className="text-sm text-gray-500">
                      {incidencias.length} pendientes de revisión
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchIncidencias}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                    title="Actualizar"
                  >
                    <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
                  </button>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Resumen de severidades */}
              <div className="flex gap-2 mt-4">
                {contadorPorSeveridad.critica > 0 && (
                  <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full">
                    {contadorPorSeveridad.critica} críticas
                  </span>
                )}
                {contadorPorSeveridad.alta > 0 && (
                  <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded-full">
                    {contadorPorSeveridad.alta} altas
                  </span>
                )}
                {contadorPorSeveridad.media > 0 && (
                  <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full">
                    {contadorPorSeveridad.media} medias
                  </span>
                )}
              </div>

              {/* Filtros */}
              <div className="flex gap-2 mt-4">
                <select
                  value={filtroTipo}
                  onChange={(e) => setFiltroTipo(e.target.value as TipoIncidencia | 'TODAS')}
                  className="px-3 py-1.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                >
                  <option value="TODAS">Todos los tipos</option>
                  <option value="REABASTECIMIENTO">Reabastecimiento</option>
                  <option value="SLOW_MOVER_CRITICO">Slow Mover Crítico</option>
                  <option value="CLAVO_DETECTADO">Clavos</option>
                  <option value="STOCK_DESBALANCEADO">Stock Desbalanceado</option>
                </select>
                <select
                  value={filtroSeveridad}
                  onChange={(e) => setFiltroSeveridad(e.target.value)}
                  className="px-3 py-1.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                >
                  <option value="todas">Todas las severidades</option>
                  <option value="critica">Crítica</option>
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baja">Baja</option>
                </select>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {isLoading ? (
                <div className="flex items-center justify-center h-40">
                  <RefreshCw className="animate-spin text-gray-400" size={32} />
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-40 text-red-500">
                  <AlertCircle size={32} />
                  <p className="mt-2">{error}</p>
                  <button
                    onClick={fetchIncidencias}
                    className="mt-2 text-sm text-blue-600 hover:underline"
                  >
                    Reintentar
                  </button>
                </div>
              ) : incidenciasFiltradas.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                  <AlertCircle size={32} />
                  <p className="mt-2">No hay incidencias pendientes</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {incidenciasFiltradas.map((incidencia) => (
                    <IncidenciaCard
                      key={incidencia.id}
                      incidencia={incidencia}
                      onAprobar={handleAprobar}
                      onIgnorar={handleIgnorar}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default IncidenciasPanel;
