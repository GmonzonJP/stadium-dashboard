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

// Formatear fecha local sin conversión a UTC (evita bugs de zona horaria)
const formatDateLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Generar temporadas (AW = Autumn/Winter: Mar-Aug, SS = Spring/Summer: Sep-Feb)
function getSeasonPresets(): { label: string; startDate: Date; endDate: Date }[] {
    const today = new Date();
    const currentYear = today.getFullYear();
    const seasons: { label: string; startDate: Date; endDate: Date }[] = [];

    for (let year = currentYear; year >= currentYear - 1; year--) {
        seasons.push({
            label: `AW${String(year).slice(-2)}`,
            startDate: new Date(year, 2, 1),
            endDate: new Date(year, 7, 31)
        });
        seasons.push({
            label: `SS${String(year).slice(-2)}`,
            startDate: new Date(year - 1, 8, 1),
            endDate: new Date(year, 1, 28)
        });
    }

    seasons.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
    return seasons.slice(0, 4);
}

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
                end = today;
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
            default: {
                // Check if it's a season preset (AW/SS)
                const seasons = getSeasonPresets();
                const season = seasons.find(s => s.label === preset);
                if (season) {
                    start = season.startDate;
                    end = season.endDate;
                }
                break;
            }
        }

        if (preset !== 'Fechas Especificas') {
            setSelectedFilters(prev => ({
                ...prev,
                startDate: formatDateLocal(start),
                endDate: formatDateLocal(end)
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
        const today = formatDateLocal(new Date());
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
                    {new Date(selectedFilters.startDate + 'T00:00:00').toLocaleDateString('es-ES')} - {new Date(selectedFilters.endDate + 'T00:00:00').toLocaleDateString('es-ES')}
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
                                    {['Hoy', 'Ayer', 'Ultimos 7 Dias', 'Ultimos 90 Dias', 'Este Mes', 'Mes Pasado'].map((preset) => (
                                        <button
                                            key={preset}
                                            onClick={() => applyPreset(preset)}
                                            className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                                        >
                                            {preset}
                                        </button>
                                    ))}
                                    <div className="h-px bg-slate-800 my-1" />
                                    <div className="px-4 py-1 text-[10px] text-slate-600 uppercase font-bold">Temporadas</div>
                                    {getSeasonPresets().map((season) => (
                                        <button
                                            key={season.label}
                                            onClick={() => applyPreset(season.label)}
                                            className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                                        >
                                            {season.label}
                                        </button>
                                    ))}
                                    <div className="h-px bg-slate-800 my-1" />
                                    <div className="px-4 py-1 text-[10px] text-slate-600 uppercase font-bold">Trimestres</div>
                                    {['Q1', 'Q2', 'Q3', 'Q4'].map((preset) => (
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
