'use client';

import React, { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { useFilters } from '@/context/FilterContext';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import DatePicker, { registerLocale } from 'react-datepicker';
import { es } from 'date-fns/locale';
import 'react-datepicker/dist/react-datepicker.css';

registerLocale('es', es);

export function DateRangePicker() {
    const { selectedFilters, setSelectedFilters } = useFilters();
    const [isOpen, setIsOpen] = useState(false);
    const [showCustomRange, setShowCustomRange] = useState(false);

    // Internal state for custom range before applying
    const [tempStart, setTempStart] = useState(selectedFilters.startDate);
    const [tempEnd, setTempEnd] = useState(selectedFilters.endDate);

    const applyPreset = (preset: string) => {
        const today = new Date();
        const year = today.getFullYear();
        let start = new Date();
        let end = new Date();

        switch (preset) {
            case 'Hoy':
                break; // start/end are already today
            case 'Ayer':
                start.setDate(today.getDate() - 1);
                end.setDate(today.getDate() - 1);
                break;
            case 'Ultimos 7 Dias':
                start.setDate(today.getDate() - 6);
                break;
            case 'Ultimos 90 Dias':
                start.setDate(today.getDate() - 89);
                break;
            case 'Este Mes':
                start = new Date(year, today.getMonth(), 1);
                end = new Date(year, today.getMonth() + 1, 0);
                break;
            case 'Mes Pasado':
                start = new Date(year, today.getMonth() - 1, 1);
                end = new Date(year, today.getMonth(), 0);
                break;
            case 'Q1':
                start = new Date(year, 0, 1);
                end = new Date(year, 2, 31);
                break;
            case 'Q2':
                start = new Date(year, 3, 1);
                end = new Date(year, 5, 30);
                break;
            case 'Q3':
                start = new Date(year, 6, 1);
                end = new Date(year, 8, 30);
                break;
            case 'Q4':
                start = new Date(year, 9, 1);
                end = new Date(year, 11, 31);
                break;
            case 'Fechas Especificas':
                setShowCustomRange(true);
                return; // Don't apply yet
        }

        if (preset !== 'Fechas Especificas') {
            setSelectedFilters(prev => ({
                ...prev,
                startDate: start.toISOString().split('T')[0],
                endDate: end.toISOString().split('T')[0]
            }));
            setIsOpen(false);
            setShowCustomRange(false);
        }
    };

    const handleApplyCustom = () => {
        setSelectedFilters(prev => ({
            ...prev,
            startDate: tempStart,
            endDate: tempEnd
        }));
        setIsOpen(false);
    };

    const handleClear = () => {
        const today = new Date().toISOString().split('T')[0];
        setSelectedFilters(prev => ({
            ...prev,
            startDate: today,
            endDate: today
        }));
        setIsOpen(false);
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center space-x-2 bg-slate-900/50 border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    isOpen ? "text-white border-blue-500/50" : "text-slate-400 hover:text-white"
                )}
            >
                <Calendar size={14} />
                <span>
                    {new Date(selectedFilters.startDate).toLocaleDateString('es-ES')} - {new Date(selectedFilters.endDate).toLocaleDateString('es-ES')}
                </span>
                <ChevronDown size={12} className={cn("transition-transform", isOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute right-0 top-full mt-2 w-56 bg-[#020617] border border-slate-800 rounded-xl shadow-2xl z-50 flex flex-col"
                        >
                            {!showCustomRange ? (
                                <div className="py-1">
                                    {['Hoy', 'Ayer', 'Ultimos 7 Dias', 'Ultimos 90 Dias', 'Este Mes', 'Mes Pasado', 'Q1', 'Q2', 'Q3', 'Q4'].map((preset) => (
                                        <button
                                            key={preset}
                                            onClick={() => applyPreset(preset)}
                                            className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                                        >
                                            {preset}
                                        </button>
                                    ))}
                                    <div className="h-px bg-slate-800 my-1" />
                                    <button
                                        onClick={() => applyPreset('Fechas Especificas')}
                                        className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                                    >
                                        Fechas Especificas
                                    </button>
                                </div>
                            ) : (
                                <div className="p-4 space-y-3">
                                    <button
                                        onClick={() => setShowCustomRange(false)}
                                        className="text-xs text-slate-500 hover:text-white mb-2 flex items-center"
                                    >
                                        <ChevronDown className="rotate-90 mr-1" size={12} /> Volver
                                    </button>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Desde</label>
                                        <DatePicker
                                            selected={tempStart ? new Date(tempStart + 'T00:00:00') : null}
                                            onChange={(date: Date | null) => setTempStart(date ? date.toISOString().split('T')[0] : '')}
                                            locale="es"
                                            dateFormat="dd/MM/yyyy"
                                            maxDate={tempEnd ? new Date(tempEnd + 'T00:00:00') : undefined}
                                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-sm text-white"
                                            calendarClassName="dark-calendar"
                                            popperPlacement="bottom-start"
                                            showPopperArrow={false}
                                            portalId="datepicker-portal"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hasta</label>
                                        <DatePicker
                                            selected={tempEnd ? new Date(tempEnd + 'T00:00:00') : null}
                                            onChange={(date: Date | null) => setTempEnd(date ? date.toISOString().split('T')[0] : '')}
                                            locale="es"
                                            dateFormat="dd/MM/yyyy"
                                            minDate={tempStart ? new Date(tempStart + 'T00:00:00') : undefined}
                                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-sm text-white"
                                            calendarClassName="dark-calendar"
                                            popperPlacement="bottom-start"
                                            showPopperArrow={false}
                                            portalId="datepicker-portal"
                                        />
                                    </div>
                                    <div className="pt-2 flex gap-2">
                                        <button
                                            onClick={handleApplyCustom}
                                            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-1.5 rounded"
                                        >
                                            Filtrar
                                        </button>
                                        <button
                                            onClick={handleClear}
                                            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-1.5 rounded"
                                        >
                                            Limpiar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
