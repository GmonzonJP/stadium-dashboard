'use client';

import React, { useState, useEffect } from 'react';
import { Search, Bell, User, Calendar, Settings, LogOut, ChevronDown, Users, Sun, Moon, Lightbulb, CalendarDays, RotateCcw, ArrowDownAZ, TrendingUp } from 'lucide-react';
import { DateRangePicker } from './DateRangePicker';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useFilters } from '@/context/FilterContext';
import { motion, AnimatePresence } from 'framer-motion';
import { NotificationsMenu } from './NotificationsMenu';

export function TopBar({ 
    onOpenUserManagement,
    alertsData,
    isLoadingAlerts
}: { 
    onOpenUserManagement?: () => void;
    alertsData?: any;
    isLoadingAlerts?: boolean;
}) {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { comparisonMode, setComparisonMode, filterSortOrder, setFilterSortOrder } = useFilters();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showSettingsMenu, setShowSettingsMenu] = useState(false);
    const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);
    const alertsCount = alertsData?.alerts?.length || 0;

    const getInitials = (nombre?: string, usuario?: string) => {
        if (nombre) {
            return nombre.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        }
        if (usuario) {
            return usuario.substring(0, 2).toUpperCase();
        }
        return 'U';
    };

    const getRolLabel = (rol?: string) => {
        const labels: Record<string, string> = {
            admin: 'Administrador',
            usuario: 'Usuario',
            viewer: 'Visualizador'
        };
        return labels[rol || 'usuario'] || 'Usuario';
    };


    return (
        <header className="h-16 border-b border-slate-800 bg-[#020617]/50 backdrop-blur-xl sticky top-0 z-40 px-8 flex items-center justify-between ml-20 lg:ml-64 transition-all duration-300">
            <div className="flex items-center flex-1 max-w-xl">
                <div className="relative w-full group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por artículo, marca o depósito..."
                        className="w-full bg-slate-900/50 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all text-slate-200"
                    />
                </div>
            </div>

            <div className="flex items-center space-x-6">
                <DateRangePicker />

                <div className="flex items-center space-x-4 border-l border-slate-800 pl-6">
                    {/* Notificaciones de Alertas */}
                    <div className="relative">
                        <button 
                            onClick={() => setShowNotificationsMenu(!showNotificationsMenu)}
                            className="relative p-2 text-slate-400 hover:text-white transition-colors"
                        >
                            {isLoadingAlerts ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-400 border-t-transparent" />
                            ) : (
                                <>
                                    <Bell size={20} />
                                    {alertsCount > 0 && (
                                        <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-[#020617]">
                                            {alertsCount > 99 ? '99+' : alertsCount}
                                        </span>
                                    )}
                                </>
                            )}
                        </button>
                        <NotificationsMenu
                            isOpen={showNotificationsMenu}
                            onClose={() => setShowNotificationsMenu(false)}
                            alertsCount={alertsCount}
                            alertsData={alertsData}
                            isLoadingAlerts={isLoadingAlerts}
                        />
                    </div>

                    {/* Menú de Configuración */}
                    <div className="relative">
                        <button
                            onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                            className="p-2 text-slate-400 hover:text-white transition-colors"
                        >
                            <Settings size={20} />
                        </button>

                        <AnimatePresence>
                            {showSettingsMenu && (
                                <>
                                    <div
                                        className="fixed inset-0 z-10"
                                        onClick={() => setShowSettingsMenu(false)}
                                    />
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20"
                                    >
                                        <div className="p-2">
                                            {/* Switch de Tema */}
                                            <button
                                                onClick={toggleTheme}
                                                className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded transition-colors"
                                            >
                                                <div className="flex items-center space-x-2">
                                                    <Lightbulb size={16} className={theme === 'light' ? 'text-yellow-400' : 'text-slate-400'} />
                                                    <span>Modo {theme === 'dark' ? 'Oscuro' : 'Claro'}</span>
                                                </div>
                                                <div className={`relative w-10 h-5 rounded-full transition-colors ${theme === 'light' ? 'bg-yellow-500' : 'bg-slate-600'}`}>
                                                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${theme === 'light' ? 'translate-x-5' : 'translate-x-0.5'}`}>
                                                        {theme === 'light' ? (
                                                            <Sun size={12} className="text-yellow-500 m-0.5" />
                                                        ) : (
                                                            <Moon size={12} className="text-slate-600 m-0.5" />
                                                        )}
                                                    </div>
                                                </div>
                                            </button>

                                            {/* Switch de Comparativo */}
                                            <button
                                                onClick={() => setComparisonMode(comparisonMode === '52weeks' ? 'calendar' : '52weeks')}
                                                className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded transition-colors"
                                            >
                                                <div className="flex items-center space-x-2">
                                                    {comparisonMode === '52weeks' ? (
                                                        <RotateCcw size={16} className="text-blue-400" />
                                                    ) : (
                                                        <CalendarDays size={16} className="text-green-400" />
                                                    )}
                                                    <span className="text-xs">
                                                        {comparisonMode === '52weeks' ? '52 Semanas' : 'Calendario'}
                                                    </span>
                                                </div>
                                                <div className={`relative w-10 h-5 rounded-full transition-colors ${comparisonMode === 'calendar' ? 'bg-green-500' : 'bg-blue-500'}`}>
                                                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${comparisonMode === 'calendar' ? 'translate-x-5' : 'translate-x-0.5'}`}>
                                                        {comparisonMode === 'calendar' ? (
                                                            <CalendarDays size={10} className="text-green-500 m-0.5" />
                                                        ) : (
                                                            <RotateCcw size={10} className="text-blue-500 m-0.5" />
                                                        )}
                                                    </div>
                                                </div>
                                            </button>

                                            {/* Switch de Orden de Filtros */}
                                            <button
                                                onClick={() => setFilterSortOrder(filterSortOrder === 'sales' ? 'alphabetical' : 'sales')}
                                                className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded transition-colors"
                                            >
                                                <div className="flex items-center space-x-2">
                                                    {filterSortOrder === 'sales' ? (
                                                        <TrendingUp size={16} className="text-emerald-400" />
                                                    ) : (
                                                        <ArrowDownAZ size={16} className="text-purple-400" />
                                                    )}
                                                    <span className="text-xs">
                                                        {filterSortOrder === 'sales' ? 'Por Ventas' : 'A-Z'}
                                                    </span>
                                                </div>
                                                <div className={`relative w-10 h-5 rounded-full transition-colors ${filterSortOrder === 'alphabetical' ? 'bg-purple-500' : 'bg-emerald-500'}`}>
                                                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${filterSortOrder === 'alphabetical' ? 'translate-x-5' : 'translate-x-0.5'}`}>
                                                        {filterSortOrder === 'alphabetical' ? (
                                                            <ArrowDownAZ size={10} className="text-purple-500 m-0.5" />
                                                        ) : (
                                                            <TrendingUp size={10} className="text-emerald-500 m-0.5" />
                                                        )}
                                                    </div>
                                                </div>
                                            </button>

                                            {user?.rol === 'admin' && (
                                                <>
                                                    <div className="border-t border-slate-700 my-2" />
                                                    <button
                                                        onClick={() => {
                                                            onOpenUserManagement?.();
                                                            setShowSettingsMenu(false);
                                                        }}
                                                        className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded transition-colors"
                                                    >
                                                        <Users size={16} />
                                                        <span>Gestión de Usuarios</span>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                    <div className="relative">
                        <button
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            className="flex items-center space-x-3 pl-2 hover:bg-slate-800/50 rounded-lg px-2 py-1 transition-colors"
                        >
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs ring-2 ring-blue-500/20">
                                {getInitials(user?.nombre, user?.usuario)}
                            </div>
                            <div className="hidden lg:block text-left">
                                <p className="text-xs font-bold text-white">{user?.nombre || user?.usuario || 'Usuario'}</p>
                                <p className="text-[10px] text-slate-500 uppercase tracking-tighter">{getRolLabel(user?.rol)}</p>
                            </div>
                            <ChevronDown size={16} className="text-slate-400" />
                        </button>

                        <AnimatePresence>
                            {showUserMenu && (
                                <>
                                    <div
                                        className="fixed inset-0 z-10"
                                        onClick={() => setShowUserMenu(false)}
                                    />
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20"
                                    >
                                        <div className="p-2">
                                            <div className="px-3 py-2 border-b border-slate-700">
                                                <p className="text-sm font-semibold text-white">{user?.nombre || user?.usuario}</p>
                                                <p className="text-xs text-slate-400">{user?.email || ''}</p>
                                            </div>
                                            <button
                                                onClick={async () => {
                                                    await logout();
                                                    setShowUserMenu(false);
                                                }}
                                                className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                            >
                                                <LogOut size={16} />
                                                <span>Cerrar Sesión</span>
                                            </button>
                                        </div>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </header>
    );
}
