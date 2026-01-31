'use client';

import React from 'react';
import { Home, Store, Tags, LayoutGrid, Users, Truck, Sparkles, ChevronLeft, ChevronRight, BarChart2, MessageSquareText, TrendingDown, PieChart, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type NavItemId = 'home' | 'tiendas' | 'marcas' | 'clases' | 'generos' | 'proveedores' | 'comparativo' | 'recompra' | 'price-actions' | 'stadiumgpt' | 'sell-out' | 'incidencias';

const navItems: { icon: any, label: string, id: NavItemId, href?: string, highlight?: boolean, subtitle?: string, badge?: string }[] = [
    { icon: Home, label: 'General', id: 'home', href: '/' },
    { icon: Store, label: 'Tiendas', id: 'tiendas' },
    { icon: Tags, label: 'Marcas', id: 'marcas' },
    { icon: LayoutGrid, label: 'Clases', id: 'clases' },
    { icon: Users, label: 'Géneros', id: 'generos' },
    { icon: Truck, label: 'Proveedores', id: 'proveedores' },
    { icon: BarChart2, label: 'Comparativo', id: 'comparativo' },
    { icon: PieChart, label: 'Sell Out', id: 'sell-out', href: '/sell-out', subtitle: 'Análisis de rotación', badge: 'NEW' },
    { icon: Bell, label: 'Incidencias', id: 'incidencias', subtitle: 'Alertas del director' },
    { icon: Sparkles, label: 'Recompra', id: 'recompra', href: '/recompra' },
    { icon: TrendingDown, label: 'Price Actions', id: 'price-actions', href: '/price-actions', subtitle: 'Gestión de precios' },
    { icon: MessageSquareText, label: 'StadiumGPT', id: 'stadiumgpt', href: '/chat', highlight: true, subtitle: 'Chatea con los datos' },
];

interface SidebarProps {
    onItemClick?: (id: NavItemId) => void;
    activeId?: NavItemId;
}

export function Sidebar({ onItemClick, activeId }: SidebarProps) {
    const [isCollapsed, setIsCollapsed] = React.useState(true); // Start collapsed
    const pathname = usePathname();

    return (
        <div className={cn(
            "h-screen bg-[#0f172a] text-slate-400 transition-all duration-300 flex flex-col border-r border-slate-800 fixed left-0 top-0 z-50",
            isCollapsed ? "w-20" : "w-64"
        )}>
            <div className="p-6 flex items-center justify-between">
                <Link href="/" className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
                        <span className="text-white font-bold">S</span>
                    </div>
                    {!isCollapsed && <h1 className="text-xl font-bold text-white tracking-tight">Stadium</h1>}
                </Link>
            </div>

            <div className="mt-8 flex-1 px-4">
                {!isCollapsed && <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-2">Menu</p>}
                <nav className="space-y-1">
                    {navItems.map((item) => {
                        const isActive = item.href ? pathname === item.href : false;
                        const isHighlighted = item.highlight;
                        
                        const Content = (
                            <>
                                <div className="relative">
                                    <item.icon size={22} className={cn(
                                        "transition-colors shrink-0",
                                        isHighlighted && !isActive ? "text-purple-400" : "",
                                        isActive ? "text-blue-500" : "group-hover:text-blue-500"
                                    )} />
                                    {/* Tooltip cuando está colapsado */}
                                    {isCollapsed && (
                                        <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-[100] pointer-events-none shadow-xl border border-slate-700">
                                            <span className="font-medium">{item.label}</span>
                                            {item.subtitle && (
                                                <span className="text-slate-400 text-xs block">{item.subtitle}</span>
                                            )}
                                            {/* Flecha del tooltip */}
                                            <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-800" />
                                        </div>
                                    )}
                                </div>
                                {!isCollapsed && (
                                    <div className="flex flex-col flex-1 min-w-0">
                                        <span className={cn(
                                            "font-medium text-[15px] truncate",
                                            isHighlighted && !isActive ? "text-white" : ""
                                        )}>{item.label}</span>
                                        {item.subtitle && (
                                            <span className="text-[10px] text-slate-500 truncate">{item.subtitle}</span>
                                        )}
                                    </div>
                                )}
                                {!isCollapsed && item.badge && (
                                    <span className="ml-auto bg-blue-600/20 text-blue-400 text-[10px] px-2 py-0.5 rounded-full font-bold">{item.badge}</span>
                                )}
                                {!isCollapsed && isHighlighted && (
                                    <span className="ml-auto bg-gradient-to-r from-purple-600/30 to-blue-600/30 text-purple-300 text-[10px] px-2 py-0.5 rounded-full font-bold border border-purple-500/30">AI</span>
                                )}
                            </>
                        );

                        if (item.href) {
                            return (
                                <Link
                                    key={item.id}
                                    href={item.href}
                                    className={cn(
                                        "w-full flex items-center p-3 rounded-xl transition-all duration-200 group",
                                        isCollapsed ? "justify-center" : "space-x-4",
                                        isActive ? "bg-slate-800/50 text-white" : "hover:bg-slate-800/50 hover:text-white",
                                        isHighlighted && !isActive ? "bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/20" : ""
                                    )}
                                >
                                    {Content}
                                </Link>
                            );
                        }

                        return (
                            <button
                                key={item.id}
                                onClick={() => onItemClick?.(item.id)}
                                className={cn(
                                    "w-full flex items-center p-3 rounded-xl transition-all duration-200 group hover:bg-slate-800/50 hover:text-white",
                                    isCollapsed ? "justify-center" : "space-x-4"
                                )}
                            >
                                {Content}
                            </button>
                        );
                    })}
                </nav>
            </div>

            <div className="p-4 border-t border-slate-800">
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="w-full h-10 flex items-center justify-center hover:bg-slate-800 rounded-lg transition-colors text-slate-500"
                >
                    {isCollapsed ? <ChevronRight size={20} /> : <div className="flex items-center space-x-2"><ChevronLeft size={20} /> <span>Contraer</span></div>}
                </button>
            </div>
        </div>
    );
}
