'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FilterItem } from '@/types';

interface FilterPanelProps {
    title: string;
    isOpen: boolean;
    onClose: () => void;
    items: FilterItem[];
    selectedIds: number[];
    onToggle: (id: number) => void;
    onSelectAll: () => void;
    onClear: () => void;
}

export function FilterPanel({ title, isOpen, onClose, items, selectedIds, onToggle, onSelectAll, onClear }: FilterPanelProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
                    />
                    <motion.div
                        initial={{ x: -400 }}
                        animate={{ x: 0 }}
                        exit={{ x: -400 }}
                        className="fixed left-0 top-0 h-full w-[350px] bg-[#020617] border-r border-slate-800 z-[70] shadow-2xl flex flex-col"
                    >
                        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <Filter className="text-blue-500" size={20} />
                                <h2 className="text-lg font-bold text-white">{title}</h2>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/30">
                            <button
                                onClick={onSelectAll}
                                className="text-xs font-bold text-blue-500 hover:text-blue-400 transition-colors px-2 py-1"
                            >
                                SELECCIONAR TODO
                            </button>
                            <button
                                onClick={onClear}
                                className="text-xs font-bold text-slate-500 hover:text-slate-400 transition-colors px-2 py-1"
                            >
                                LIMPIAR
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
                            {items.map((item) => {
                                const isSelected = selectedIds.includes(item.id);
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => onToggle(item.id)}
                                        className={cn(
                                            "w-full flex items-center justify-between p-3 rounded-xl transition-all group",
                                            isSelected ? "bg-blue-500/10 text-white" : "hover:bg-slate-800/50 text-slate-400 hover:text-slate-200"
                                        )}
                                    >
                                        <span className="text-sm font-medium">{item.label}</span>
                                        <div className={cn(
                                            "w-5 h-5 rounded border transition-all flex items-center justify-center",
                                            isSelected ? "bg-blue-500 border-blue-500" : "border-slate-700 group-hover:border-slate-500"
                                        )}>
                                            {isSelected && <Check size={14} className="text-white" strokeWidth={3} />}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="p-6 border-t border-slate-800">
                            <button
                                onClick={onClose}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]"
                            >
                                APLICAR FILTROS
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
