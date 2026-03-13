'use client';

import React, { useState, useMemo } from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import DatePicker, { registerLocale } from 'react-datepicker';
import { es } from 'date-fns/locale';
import 'react-datepicker/dist/react-datepicker.css';

registerLocale('es', es);

function formatDateLocal(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

interface DatePreset {
    label: string;
    getRange: () => { start: string; end: string };
}

interface MobileDateSelectorProps {
    startDate: string;
    endDate: string;
    onChange: (start: string, end: string) => void;
}

export function MobileDateSelector({ startDate, endDate, onChange }: MobileDateSelectorProps) {
    const [showCustomPicker, setShowCustomPicker] = useState(false);
    const [tempStart, setTempStart] = useState<Date | null>(null);
    const [tempEnd, setTempEnd] = useState<Date | null>(null);

    const presets: DatePreset[] = useMemo(() => {
        const today = new Date();
        return [
            {
                label: 'Hoy',
                getRange: () => {
                    const d = formatDateLocal(today);
                    return { start: d, end: d };
                },
            },
            {
                label: 'Ayer',
                getRange: () => {
                    const yesterday = new Date(today);
                    yesterday.setDate(yesterday.getDate() - 1);
                    const d = formatDateLocal(yesterday);
                    return { start: d, end: d };
                },
            },
            {
                label: 'Esta Semana',
                getRange: () => {
                    const monday = new Date(today);
                    const day = monday.getDay();
                    const diff = day === 0 ? 6 : day - 1; // Monday-based
                    monday.setDate(monday.getDate() - diff);
                    return { start: formatDateLocal(monday), end: formatDateLocal(today) };
                },
            },
            {
                label: 'Este Mes',
                getRange: () => {
                    const first = new Date(today.getFullYear(), today.getMonth(), 1);
                    return { start: formatDateLocal(first), end: formatDateLocal(today) };
                },
            },
            {
                label: 'Mes Pasado',
                getRange: () => {
                    const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                    const last = new Date(today.getFullYear(), today.getMonth(), 0);
                    return { start: formatDateLocal(first), end: formatDateLocal(last) };
                },
            },
        ];
    }, []);

    const activePreset = useMemo(() => {
        for (const p of presets) {
            const { start, end } = p.getRange();
            if (start === startDate && end === endDate) return p.label;
        }
        return null;
    }, [startDate, endDate, presets]);

    const handlePresetClick = (preset: DatePreset) => {
        const { start, end } = preset.getRange();
        onChange(start, end);
        setShowCustomPicker(false);
    };

    const handleCustomApply = () => {
        if (tempStart && tempEnd) {
            onChange(formatDateLocal(tempStart), formatDateLocal(tempEnd));
            setShowCustomPicker(false);
        }
    };

    // Format display date for custom range
    const formatDisplayDate = (dateStr: string) => {
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}`;
    };

    return (
        <div className="px-4">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollSnapType: 'x mandatory' }}>
                {presets.map((preset) => (
                    <button
                        key={preset.label}
                        onClick={() => handlePresetClick(preset)}
                        className={cn(
                            "shrink-0 px-4 py-2.5 rounded-full text-sm font-semibold transition-colors",
                            "min-h-[44px] scroll-snap-align-start",
                            activePreset === preset.label
                                ? "bg-blue-600 text-white"
                                : "bg-slate-800 text-slate-400 border border-slate-700 active:bg-slate-700"
                        )}
                        style={{ scrollSnapAlign: 'start' }}
                    >
                        {preset.label}
                    </button>
                ))}
                <button
                    onClick={() => {
                        setTempStart(new Date(startDate + 'T12:00:00'));
                        setTempEnd(new Date(endDate + 'T12:00:00'));
                        setShowCustomPicker(true);
                    }}
                    className={cn(
                        "shrink-0 px-4 py-2.5 rounded-full text-sm font-semibold transition-colors flex items-center gap-2",
                        "min-h-[44px]",
                        !activePreset && !showCustomPicker
                            ? "bg-blue-600 text-white"
                            : "bg-slate-800 text-slate-400 border border-slate-700 active:bg-slate-700"
                    )}
                    style={{ scrollSnapAlign: 'start' }}
                >
                    <Calendar size={14} />
                    {!activePreset ? `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}` : 'Otro'}
                </button>
            </div>

            {/* Custom Date Picker Modal */}
            {showCustomPicker && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center">
                    <div className="bg-slate-900 w-full max-w-md rounded-t-3xl p-6 pb-8 space-y-4"
                        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 2rem)' }}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-bold text-white">Seleccionar fechas</h3>
                            <button
                                onClick={() => setShowCustomPicker(false)}
                                className="text-slate-400 text-sm font-medium"
                            >
                                Cancelar
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-slate-500 font-medium mb-1 block">Desde</label>
                                <DatePicker
                                    selected={tempStart}
                                    onChange={(date: Date | null) => setTempStart(date)}
                                    locale="es"
                                    dateFormat="dd/MM/yyyy"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-sm text-white"
                                    maxDate={tempEnd || new Date()}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 font-medium mb-1 block">Hasta</label>
                                <DatePicker
                                    selected={tempEnd}
                                    onChange={(date: Date | null) => setTempEnd(date)}
                                    locale="es"
                                    dateFormat="dd/MM/yyyy"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-sm text-white"
                                    minDate={tempStart || undefined}
                                    maxDate={new Date()}
                                />
                            </div>
                        </div>
                        <button
                            onClick={handleCustomApply}
                            disabled={!tempStart || !tempEnd}
                            className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl disabled:opacity-50 active:bg-blue-700 transition-colors"
                        >
                            Aplicar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
