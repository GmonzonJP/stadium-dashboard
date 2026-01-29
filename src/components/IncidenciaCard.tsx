'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Package,
  TrendingDown,
  Flame,
  Check,
  X,
  Edit2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Incidencia, TipoIncidencia, IncidenciaReabastecimiento } from '@/types/sell-out';

interface IncidenciaCardProps {
  incidencia: Incidencia;
  onAprobar: (id: string, parametros?: Record<string, unknown>) => void;
  onIgnorar: (id: string, motivo: string) => void;
  onModificar?: (id: string, parametros: Record<string, unknown>) => void;
}

const TIPO_ICONS: Record<TipoIncidencia, React.ElementType> = {
  REABASTECIMIENTO: Package,
  SLOW_MOVER_CRITICO: TrendingDown,
  CLAVO_DETECTADO: Flame,
  STOCK_DESBALANCEADO: AlertTriangle,
};

const SEVERIDAD_COLORS = {
  baja: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20',
  media: 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20',
  alta: 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20',
  critica: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20',
};

const SEVERIDAD_BADGE_COLORS = {
  baja: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  media: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  alta: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  critica: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

export function IncidenciaCard({
  incidencia,
  onAprobar,
  onIgnorar,
  onModificar,
}: IncidenciaCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showIgnorarForm, setShowIgnorarForm] = useState(false);
  const [motivoIgnorar, setMotivoIgnorar] = useState('');
  const [editandoCantidad, setEditandoCantidad] = useState(false);
  const [cantidadEditada, setCantidadEditada] = useState<number>(
    (incidencia.datos as IncidenciaReabastecimiento)?.cantidadSugerida || 0
  );

  const IconComponent = TIPO_ICONS[incidencia.tipo];

  const handleAprobar = () => {
    if (incidencia.tipo === 'REABASTECIMIENTO' && editandoCantidad) {
      onAprobar(incidencia.id, { cantidad: cantidadEditada });
    } else {
      onAprobar(incidencia.id, incidencia.accionSugerida?.parametros);
    }
  };

  const handleIgnorar = () => {
    if (motivoIgnorar.trim()) {
      onIgnorar(incidencia.id, motivoIgnorar);
      setShowIgnorarForm(false);
      setMotivoIgnorar('');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-lg border-l-4 ${SEVERIDAD_COLORS[incidencia.severidad]} p-4`}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${SEVERIDAD_BADGE_COLORS[incidencia.severidad]}`}>
            <IconComponent size={20} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-gray-900 dark:text-white">
                {incidencia.titulo}
              </h4>
              <span className={`text-xs px-2 py-0.5 rounded-full ${SEVERIDAD_BADGE_COLORS[incidencia.severidad]}`}>
                {incidencia.severidad.toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {incidencia.mensaje}
            </p>
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
        >
          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      {/* Acción sugerida */}
      {incidencia.accionSugerida && (
        <div className="mt-3 p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Acción sugerida:
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {incidencia.accionSugerida.descripcion}
          </p>

          {/* Editar cantidad para reabastecimiento */}
          {incidencia.tipo === 'REABASTECIMIENTO' && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-gray-500">Cantidad:</span>
              {editandoCantidad ? (
                <input
                  type="number"
                  value={cantidadEditada}
                  onChange={(e) => setCantidadEditada(parseInt(e.target.value) || 0)}
                  className="w-20 px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600"
                  min={1}
                />
              ) : (
                <span className="font-medium">
                  {(incidencia.datos as IncidenciaReabastecimiento).cantidadSugerida} un.
                </span>
              )}
              <button
                onClick={() => setEditandoCantidad(!editandoCantidad)}
                className="p-1 text-blue-600 hover:bg-blue-100 rounded"
              >
                <Edit2 size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Detalles expandidos */}
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700"
        >
          <div className="grid grid-cols-2 gap-2 text-sm">
            {incidencia.tipo === 'REABASTECIMIENTO' && (
              <>
                <div>
                  <span className="text-gray-500">Stock Central:</span>
                  <span className="ml-2 font-medium">
                    {(incidencia.datos as IncidenciaReabastecimiento).stockCentral} un.
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Tienda:</span>
                  <span className="ml-2 font-medium">
                    {(incidencia.datos as IncidenciaReabastecimiento).tiendaNombre}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Días sin venta:</span>
                  <span className="ml-2 font-medium text-red-600">
                    {(incidencia.datos as IncidenciaReabastecimiento).diasDesdeUltimaVenta}
                  </span>
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}

      {/* Acciones */}
      <div className="mt-4 flex items-center gap-2">
        {!showIgnorarForm ? (
          <>
            <button
              onClick={handleAprobar}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <Check size={16} />
              Aprobar
            </button>
            <button
              onClick={() => setShowIgnorarForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              <X size={16} />
              Ignorar
            </button>
          </>
        ) : (
          <div className="flex-1 flex items-center gap-2">
            <input
              type="text"
              value={motivoIgnorar}
              onChange={(e) => setMotivoIgnorar(e.target.value)}
              placeholder="Motivo para ignorar..."
              className="flex-1 px-3 py-1.5 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
            <button
              onClick={handleIgnorar}
              disabled={!motivoIgnorar.trim()}
              className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirmar
            </button>
            <button
              onClick={() => {
                setShowIgnorarForm(false);
                setMotivoIgnorar('');
              }}
              className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default IncidenciaCard;
