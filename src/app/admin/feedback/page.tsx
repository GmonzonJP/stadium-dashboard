'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, Trash2, Clock, Search, Filter } from 'lucide-react';

interface FeedbackItem {
  id: string;
  timestamp: string;
  user: string;
  type: 'mejora' | 'bug' | 'solicitud' | 'otro';
  title: string;
  description: string;
  page: string;
  status: 'pendiente' | 'en_revision' | 'implementado' | 'descartado';
}

const TYPE_CONFIG = {
  mejora:    { label: 'Mejora',     color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  bug:       { label: 'Bug',        color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  solicitud: { label: 'Solicitud',  color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  otro:      { label: 'Otro',       color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
};

const STATUS_CONFIG = {
  pendiente:    { label: 'Pendiente',    color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  en_revision:  { label: 'En Revisión',  color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  implementado: { label: 'Implementado', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  descartado:   { label: 'Descartado',   color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
};

export default function FeedbackAdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user?.rol !== 'admin') {
      router.replace('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    fetch('/api/feedback')
      .then(r => r.json())
      .then(data => { setItems(Array.isArray(data) ? data : []); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  }, []);

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/feedback/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: status as FeedbackItem['status'] } : i));
  };

  const deleteItem = async (id: string) => {
    if (!confirm('¿Eliminar este feedback?')) return;
    await fetch(`/api/feedback/${id}`, { method: 'DELETE' });
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const filtered = items.filter(i => {
    if (filterType !== 'all' && i.type !== filterType) return false;
    if (filterStatus !== 'all' && i.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!i.title.toLowerCase().includes(q) && !i.description.toLowerCase().includes(q) && !i.user.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const counts = {
    pendiente: items.filter(i => i.status === 'pendiente').length,
    en_revision: items.filter(i => i.status === 'en_revision').length,
  };

  if (authLoading) return null;
  if (user?.rol !== 'admin') return null;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#020617]/90 backdrop-blur-xl border-b border-slate-800 px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-white">Feedback de Usuarios</h1>
          <p className="text-xs text-slate-500">{items.length} entradas totales · {counts.pendiente} pendientes · {counts.en_revision} en revisión</p>
        </div>
      </div>

      <div className="p-6 max-w-5xl mx-auto">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-48">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-500" />
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Todos los tipos</option>
              <option value="mejora">Mejora</option>
              <option value="bug">Bug</option>
              <option value="solicitud">Solicitud</option>
              <option value="otro">Otro</option>
            </select>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="en_revision">En Revisión</option>
              <option value="implementado">Implementado</option>
              <option value="descartado">Descartado</option>
            </select>
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4 animate-pulse h-24" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <p className="text-lg">No hay feedback{search || filterType !== 'all' || filterStatus !== 'all' ? ' que coincida' : ' registrado'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(item => {
              const typeConf = TYPE_CONFIG[item.type];
              const statusConf = STATUS_CONFIG[item.status];
              const isOpen = expanded === item.id;
              const date = new Date(item.timestamp);
              const dateStr = date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
              const timeStr = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

              return (
                <div
                  key={item.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden transition-all"
                >
                  <div
                    className="flex items-start gap-3 p-4 cursor-pointer hover:bg-slate-800/50 transition-colors"
                    onClick={() => setExpanded(isOpen ? null : item.id)}
                  >
                    {/* Type badge */}
                    <span className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded border ${typeConf.color}`}>
                      {typeConf.label}
                    </span>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{item.title}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-slate-500">{item.user}</span>
                        <span className="text-xs text-slate-600">·</span>
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock size={10} />{dateStr} {timeStr}
                        </span>
                        {item.page && (
                          <>
                            <span className="text-xs text-slate-600">·</span>
                            <span className="text-xs text-slate-600 font-mono truncate max-w-32">{item.page}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Status badge */}
                    <span className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded border ${statusConf.color}`}>
                      {statusConf.label}
                    </span>
                  </div>

                  {/* Expanded */}
                  {isOpen && (
                    <div className="border-t border-slate-800 p-4 space-y-4">
                      <p className="text-sm text-slate-300 whitespace-pre-wrap">{item.description}</p>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-slate-500 font-medium uppercase">Cambiar estado:</span>
                        {(['pendiente', 'en_revision', 'implementado', 'descartado'] as const).map(s => (
                          <button
                            key={s}
                            onClick={() => updateStatus(item.id, s)}
                            className={`text-xs px-3 py-1 rounded-lg border font-medium transition-all ${
                              item.status === s
                                ? STATUS_CONFIG[s].color
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                            }`}
                          >
                            {STATUS_CONFIG[s].label}
                          </button>
                        ))}
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="ml-auto text-xs px-3 py-1 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 flex items-center gap-1 transition-colors"
                        >
                          <Trash2 size={12} /> Eliminar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
