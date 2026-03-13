'use client';

import React, { useRef, useCallback } from 'react';
import { Home, Store, Tags, LayoutGrid, Users, Truck, ChevronLeft, ChevronRight, BarChart2, MessageSquareText, TrendingDown, PieChart, Bell, PackageX } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type NavItemId = 'home' | 'tiendas' | 'marcas' | 'clases' | 'generos' | 'proveedores' | 'comparativo' | 'price-actions' | 'stadiumgpt' | 'sell-out' | 'incidencias' | 'stock-sin-ventas';

interface NavItem {
    icon: any;
    label: string;
    shortLabel?: string;
    id: NavItemId;
    href?: string;
    highlight?: boolean;
    subtitle?: string;
    badge?: string;
}

interface NavGroup {
    label: string;
    items: NavItem[];
}

const navGroups: NavGroup[] = [
    {
        label: 'Filtros',
        items: [
            { icon: Store, label: 'Tiendas', id: 'tiendas' },
            { icon: Tags, label: 'Marcas', id: 'marcas' },
            { icon: LayoutGrid, label: 'Clases', id: 'clases' },
            { icon: Users, label: 'Géneros', id: 'generos' },
            { icon: Truck, label: 'Proveedores', shortLabel: 'Proveed.', id: 'proveedores' },
        ],
    },
    {
        label: 'Reportes y Utilidades',
        items: [
            { icon: Home, label: 'General', id: 'home', href: '/' },
            { icon: PieChart, label: 'Sell Out', id: 'sell-out', href: '/sell-out', subtitle: 'Análisis de rotación' },
            { icon: PackageX, label: 'Stock sin Ventas', shortLabel: 'Stock s/V', id: 'stock-sin-ventas', href: '/stock-sin-ventas', subtitle: 'Artículos estancados', badge: 'NEW' },
            { icon: BarChart2, label: 'Comparativo', shortLabel: 'Compar.', id: 'comparativo' },
            { icon: TrendingDown, label: 'Price Actions', shortLabel: 'Precios', id: 'price-actions', href: '/price-actions', subtitle: 'Gestión de precios' },
            { icon: Bell, label: 'Incidencias', shortLabel: 'Alertas', id: 'incidencias', subtitle: 'Alertas del director' },
        ],
    },
];

const stadiumGPTItem: NavItem = {
    icon: MessageSquareText,
    label: 'StadiumGPT',
    shortLabel: 'GPT',
    id: 'stadiumgpt',
    href: '/chat',
    highlight: true,
    subtitle: 'Chatea con los datos',
};

interface SidebarProps {
    onItemClick?: (id: NavItemId) => void;
    activeId?: NavItemId;
}

export function Sidebar({ onItemClick, activeId }: SidebarProps) {
    const [isCollapsed, setIsCollapsed] = React.useState(true);
    const [isHoverExpanded, setIsHoverExpanded] = React.useState(false);
    const pathname = usePathname();
    const collapseTimer = useRef<NodeJS.Timeout | null>(null);
    const expandTimer = useRef<NodeJS.Timeout | null>(null);

    const isExpanded = !isCollapsed || isHoverExpanded;

    const handleMouseEnter = useCallback(() => {
        if (!isCollapsed) return;
        if (collapseTimer.current) {
            clearTimeout(collapseTimer.current);
            collapseTimer.current = null;
        }
        expandTimer.current = setTimeout(() => {
            setIsHoverExpanded(true);
        }, 200);
    }, [isCollapsed]);

    const handleMouseLeave = useCallback(() => {
        if (!isCollapsed) return;
        if (expandTimer.current) {
            clearTimeout(expandTimer.current);
            expandTimer.current = null;
        }
        collapseTimer.current = setTimeout(() => {
            setIsHoverExpanded(false);
        }, 300);
    }, [isCollapsed]);

    const renderNavItem = (item: NavItem) => {
        const isActive = item.href ? pathname === item.href : false;
        const isHighlighted = item.highlight;

        const Content = (
            <>
                <div className="flex flex-col items-center shrink-0">
                    <item.icon size={20} className={cn(
                        "transition-colors",
                        isHighlighted && !isActive ? "text-purple-400" : "",
                        isActive ? "text-blue-500" : "group-hover:text-blue-500"
                    )} />
                    {!isExpanded && (
                        <span className={cn(
                            "text-[9px] mt-0.5 text-center leading-tight truncate w-14",
                            isActive ? "text-blue-400 font-semibold" : "text-slate-500",
                            isHighlighted && !isActive ? "text-purple-400/70" : ""
                        )}>
                            {item.shortLabel || item.label}
                        </span>
                    )}
                </div>
                {isExpanded && (
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
                {isExpanded && item.badge && (
                    <span className="ml-auto bg-blue-600/20 text-blue-400 text-[10px] px-2 py-0.5 rounded-full font-bold">{item.badge}</span>
                )}
                {isExpanded && isHighlighted && (
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
                        "w-full flex items-center rounded-xl transition-all duration-200 group",
                        isExpanded ? "p-3 space-x-4" : "p-2 py-2.5 justify-center",
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
                    "w-full flex items-center rounded-xl transition-all duration-200 group hover:bg-slate-800/50 hover:text-white",
                    isExpanded ? "p-3 space-x-4" : "p-2 py-2.5 justify-center"
                )}
            >
                {Content}
            </button>
        );
    };

    return (
        <div
            className={cn(
                "h-screen bg-[#0f172a] text-slate-400 transition-all duration-300 flex flex-col border-r border-slate-800 fixed left-0 top-0 z-50",
                isExpanded ? "w-64" : "w-20"
            )}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <div className="p-6 flex items-center justify-between">
                <Link href="/" className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
                        <span className="text-white font-bold">S</span>
                    </div>
                    {isExpanded && <h1 className="text-xl font-bold text-white tracking-tight">Stadium</h1>}
                </Link>
            </div>

            <div className="mt-2 flex-1 px-3 overflow-y-auto">
                {navGroups.map((group, groupIdx) => (
                    <div key={group.label} className={groupIdx > 0 ? "mt-2" : ""}>
                        {isExpanded && (
                            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">
                                {group.label}
                            </p>
                        )}
                        {!isExpanded && groupIdx > 0 && (
                            <div className="border-t border-slate-700/50 my-2 mx-2" />
                        )}
                        <nav className="space-y-0.5">
                            {group.items.map((item) => renderNavItem(item))}
                        </nav>
                    </div>
                ))}

                {/* StadiumGPT - Seccion especial */}
                <div className="mt-2">
                    {isExpanded && (
                        <p className="text-[10px] font-semibold text-purple-500/70 uppercase tracking-wider mb-2 px-2">
                            Asistente IA
                        </p>
                    )}
                    {!isExpanded && <div className="border-t border-slate-700/50 my-2 mx-2" />}
                    <nav className="space-y-0.5">
                        {renderNavItem(stadiumGPTItem)}
                    </nav>
                </div>
            </div>

            <div className="p-4 border-t border-slate-800">
                <button
                    onClick={() => { setIsCollapsed(!isCollapsed); setIsHoverExpanded(false); }}
                    className="w-full h-10 flex items-center justify-center hover:bg-slate-800 rounded-lg transition-colors text-slate-500"
                >
                    {isExpanded ? <div className="flex items-center space-x-2"><ChevronLeft size={20} /> <span>Contraer</span></div> : <ChevronRight size={20} />}
                </button>
            </div>
        </div>
    );
}
