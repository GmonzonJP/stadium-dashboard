'use client';

import React, { useEffect, useState } from 'react';
import { PriceChangeProposal, ProposalStatus } from '@/types/price-actions';
import { motion } from 'framer-motion';
import {
    Inbox, CheckCircle, XCircle, Clock,
    Edit, Trash2, Download, FileText, FileSpreadsheet,
    Loader2, Search, Filter, Tag
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercent } from '@/lib/calculation-utils';

export function ProposalsQueue() {
    const [proposals, setProposals] = useState<PriceChangeProposal[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(25);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [selectedStatus, setSelectedStatus] = useState<ProposalStatus | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editPrecio, setEditPrecio] = useState<number>(0);
    const [editNotas, setEditNotas] = useState<string>('');

    useEffect(() => {
        fetchProposals();
    }, [page, selectedStatus, searchQuery]);

    const fetchProposals = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                page: String(page),
                pageSize: String(pageSize),
                ...(selectedStatus !== 'all' && { estado: selectedStatus }),
                ...(searchQuery && { search: searchQuery })
            });

            const response = await fetch(`/api/price-actions/proposals?${params}`, {
                cache: 'no-store'
            });

            if (!response.ok) {
                throw new Error('Error al cargar propuestas');
            }

            const result = await response.json();
            setProposals(result.proposals);
            setTotal(result.total);
            setTotalPages(result.totalPages);
        } catch (err) {
            console.error('Error fetching proposals:', err);
            setError(err instanceof Error ? err.message : 'Error al cargar propuestas');
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateStatus = async (id: number, newStatus: ProposalStatus) => {
        try {
            const response = await fetch(`/api/price-actions/proposals/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    estado: newStatus,
                    usuario: 'Usuario' // TODO: obtener del contexto de auth
                })
            });

            if (!response.ok) throw new Error('Error al actualizar estado');

            fetchProposals();
        } catch (err) {
            console.error('Error updating status:', err);
            alert('Error al actualizar estado');
        }
    };

    const handleEdit = (proposal: PriceChangeProposal) => {
        setEditingId(proposal.id!);
        setEditPrecio(proposal.precioPropuesto);
        setEditNotas(proposal.notas || '');
    };

    const handleSaveEdit = async (id: number) => {
        try {
            const response = await fetch(`/api/price-actions/proposals/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    precioPropuesto: editPrecio,
                    notas: editNotas,
                    usuario: 'Usuario'
                })
            });

            if (!response.ok) throw new Error('Error al guardar cambios');

            setEditingId(null);
            fetchProposals();
        } catch (err) {
            console.error('Error saving edit:', err);
            alert('Error al guardar cambios');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Estás seguro de eliminar esta propuesta?')) return;

        try {
            const response = await fetch(`/api/price-actions/proposals/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usuario: 'Usuario' })
            });

            if (!response.ok) throw new Error('Error al eliminar');

            fetchProposals();
        } catch (err) {
            console.error('Error deleting:', err);
            alert('Error al eliminar propuesta');
        }
    };

    const handleExportPDF = async () => {
        try {
            const response = await fetch('/api/price-actions/export/pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    estado: selectedStatus !== 'all' ? [selectedStatus] : undefined
                })
            });

            if (!response.ok) throw new Error('Error al exportar PDF');

            const html = await response.text();
            // Abrir en nueva ventana para imprimir/guardar como PDF
            const newWindow = window.open('', '_blank');
            if (newWindow) {
                newWindow.document.write(html);
                newWindow.document.close();
            }
        } catch (err) {
            console.error('Error exporting PDF:', err);
            alert('Error al exportar reporte');
        }
    };

    const handleExportExcel = async () => {
        try {
            const response = await fetch('/api/price-actions/export/excel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    estado: selectedStatus !== 'all' ? [selectedStatus] : undefined
                })
            });

            if (!response.ok) throw new Error('Error al exportar Excel');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `price-actions-${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Error exporting Excel:', err);
            alert('Error al exportar Excel');
        }
    };

    const getStatusColor = (status: ProposalStatus) => {
        switch (status) {
            case 'aprobado': return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'descartado': return 'bg-red-500/20 text-red-400 border-red-500/30';
            default: return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
        }
    };

    const getStatusIcon = (status: ProposalStatus) => {
        switch (status) {
            case 'aprobado': return <CheckCircle size={16} />;
            case 'descartado': return <XCircle size={16} />;
            default: return <Clock size={16} />;
        }
    };

    if (isLoading && proposals.length === 0) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header with Filters and Export */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar propuestas..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-900/50 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter className="text-slate-500" size={18} />
                        <select
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value as ProposalStatus | 'all')}
                            className="px-4 py-2 bg-slate-900/50 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">Todos los estados</option>
                            <option value="pendiente">Pendiente</option>
                            <option value="aprobado">Aprobado</option>
                            <option value="descartado">Descartado</option>
                        </select>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExportPDF}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        <FileText size={16} />
                        <span>Exportar PDF</span>
                    </button>
                    <button
                        onClick={handleExportExcel}
                        className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        <FileSpreadsheet size={16} />
                        <span>Exportar Excel</span>
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-800/50 border-b border-slate-800">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">SKU</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Tipo</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Precio</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Motivo</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Impacto</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Estado</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {proposals.map((proposal) => (
                                <motion.tr
                                    key={proposal.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="hover:bg-slate-800/30 transition-colors"
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-white text-sm">{proposal.baseCol}</span>
                                            {proposal.descripcionCorta && (
                                                <span className="text-xs text-slate-500">{proposal.descripcionCorta}</span>
                                            )}
                                        </div>
                                    </td>
                                    {/* Tipo */}
                                    <td className="px-4 py-3">
                                        {proposal.usarPrecioAntesAhora ? (
                                            <span className="inline-flex items-center space-x-1 px-2 py-1 bg-purple-500/20 text-purple-400 border border-purple-500/30 text-xs rounded-full">
                                                <Tag size={12} />
                                                <span>Antes/Ahora</span>
                                            </span>
                                        ) : (
                                            <span className="px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded-full">
                                                Simple
                                            </span>
                                        )}
                                    </td>
                                    {/* Precio */}
                                    <td className="px-4 py-3">
                                        {editingId === proposal.id ? (
                                            <div className="flex items-center space-x-2">
                                                <input
                                                    type="number"
                                                    value={editPrecio}
                                                    onChange={(e) => setEditPrecio(Number(e.target.value))}
                                                    className="w-24 px-2 py-1 bg-slate-900 border border-slate-800 rounded text-white text-sm"
                                                    step="0.01"
                                                />
                                                <button
                                                    onClick={() => handleSaveEdit(proposal.id!)}
                                                    className="px-2 py-1 bg-green-600 hover:bg-green-500 text-white text-xs rounded"
                                                >
                                                    Guardar
                                                </button>
                                                <button
                                                    onClick={() => setEditingId(null)}
                                                    className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded"
                                                >
                                                    Cancelar
                                                </button>
                                            </div>
                                        ) : proposal.usarPrecioAntesAhora && proposal.precioAntes ? (
                                            <div className="flex flex-col text-sm">
                                                <div className="flex items-center space-x-2">
                                                    <span className="text-slate-500">Antes:</span>
                                                    <span className="text-purple-400 line-through">{formatCurrency(proposal.precioAntes)}</span>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <span className="text-slate-500">Ahora:</span>
                                                    <span className="text-green-400 font-medium">{formatCurrency(proposal.precioPropuesto)}</span>
                                                    <span className="text-slate-500 text-xs">
                                                        ({formatPercent(((proposal.precioPropuesto - proposal.precioAntes) / proposal.precioAntes) * 100)})
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center space-x-2 text-sm">
                                                <span className="text-slate-400">{formatCurrency(proposal.precioActual)}</span>
                                                <span className="text-slate-600">→</span>
                                                <span className="text-white font-medium">{formatCurrency(proposal.precioPropuesto)}</span>
                                                <span className="text-slate-500 text-xs">
                                                    ({formatPercent(((proposal.precioPropuesto - proposal.precioActual) / proposal.precioActual) * 100)})
                                                </span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded">
                                            {proposal.motivo}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col text-xs">
                                            {proposal.sellOutProyectado && (
                                                <span className="text-slate-300">
                                                    Sell-out: {formatPercent(proposal.sellOutProyectado)}
                                                </span>
                                            )}
                                            {proposal.margenTotalProyectado && (
                                                <span className="text-slate-500">
                                                    Margen: {formatCurrency(proposal.margenTotalProyectado)}
                                                </span>
                                            )}
                                            {proposal.costoCastigo && (
                                                <span className="text-orange-400">
                                                    Castigo: {formatCurrency(proposal.costoCastigo)}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={cn(
                                            "inline-flex items-center space-x-1 px-2 py-1 rounded-full border text-xs",
                                            getStatusColor(proposal.estado)
                                        )}>
                                            {getStatusIcon(proposal.estado)}
                                            <span>{proposal.estado}</span>
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center space-x-2">
                                            {proposal.estado === 'pendiente' && (
                                                <>
                                                    <button
                                                        onClick={() => handleEdit(proposal)}
                                                        className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                                                        title="Editar"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleUpdateStatus(proposal.id!, 'aprobado')}
                                                        className="p-1.5 hover:bg-green-600/20 rounded text-green-400 hover:text-green-300 transition-colors"
                                                        title="Aprobar"
                                                    >
                                                        <CheckCircle size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleUpdateStatus(proposal.id!, 'descartado')}
                                                        className="p-1.5 hover:bg-red-600/20 rounded text-red-400 hover:text-red-300 transition-colors"
                                                        title="Descartar"
                                                    >
                                                        <XCircle size={16} />
                                                    </button>
                                                </>
                                            )}
                                            <button
                                                onClick={() => handleDelete(proposal.id!)}
                                                className="p-1.5 hover:bg-red-600/20 rounded text-red-400 hover:text-red-300 transition-colors"
                                                title="Eliminar"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between">
                        <div className="text-sm text-slate-500">
                            Mostrando {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, total)} de {total}
                        </div>
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg transition-colors text-sm",
                                    page === 1
                                        ? "bg-slate-800/50 text-slate-600 cursor-not-allowed"
                                        : "bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                                )}
                            >
                                Anterior
                            </button>
                            <span className="text-sm text-slate-400">
                                Página {page} de {totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg transition-colors text-sm",
                                    page === totalPages
                                        ? "bg-slate-800/50 text-slate-600 cursor-not-allowed"
                                        : "bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                                )}
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {proposals.length === 0 && !isLoading && (
                <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-xl">
                    <Inbox className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-500 text-sm">No hay propuestas</p>
                </div>
            )}
        </div>
    );
}
