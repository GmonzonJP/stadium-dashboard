'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar, NavItemId } from './Sidebar';
import { TopBar } from './TopBar';
import { FilterPanel } from './FilterPanel';
import { CategoryFilterPanel } from './CategoryFilterPanel';
import { UserManagement } from './UserManagement';
import { ChatPanel } from './ChatPanel';
import { AboutDefinitions } from './AboutDefinitions';
import { useFilters } from '@/context/FilterContext';
import { FilterItem, FilterParams } from '@/types';

export function DashboardContainer({ 
    children, 
    alertsData, 
    isLoadingAlerts 
}: { 
    children: React.ReactNode;
    alertsData?: any;
    isLoadingAlerts?: boolean;
}) {
    const [showUserManagement, setShowUserManagement] = useState(false);
    const pathname = usePathname();
    const isOnChatPage = pathname === '/chat';
    const {
        activeFilterId,
        setActiveFilterId,
        filterData,
        selectedFilters,
        setSelectedFilters,
        toggleFilter
    } = useFilters();

    const handleSidebarClick = (id: NavItemId) => {
        if (['tiendas', 'marcas', 'clases', 'generos', 'proveedores'].includes(id)) {
            setActiveFilterId(id);
        } else {
            setActiveFilterId(null);
        }
    };

    const getActiveFilterData = (): { title: string, items: FilterItem[], category: keyof FilterParams } | null => {
        switch (activeFilterId) {
            case 'tiendas': return { title: 'Seleccionar Tiendas', items: filterData.stores, category: 'stores' };
            case 'marcas': return { title: 'Seleccionar Marcas', items: filterData.brands, category: 'brands' };
            case 'generos': return { title: 'Seleccionar Géneros', items: filterData.genders, category: 'genders' };
            case 'proveedores': return { title: 'Seleccionar Proveedores', items: filterData.suppliers, category: 'suppliers' };
            default: return null;
        }
    };

    const activeData = activeFilterId !== 'clases' ? getActiveFilterData() : null;

    return (
        <div className="min-h-screen overflow-x-hidden">
            <Sidebar activeId={activeFilterId || 'home'} onItemClick={handleSidebarClick} />
            <div className="ml-20 flex flex-col min-h-screen overflow-hidden">
                <TopBar
                    onOpenUserManagement={() => setShowUserManagement(true)}
                    alertsData={alertsData}
                    isLoadingAlerts={isLoadingAlerts}
                />
                <main className="flex-1 overflow-x-hidden overflow-y-auto">
                    <div className="p-4 md:p-6">
                        {children}
                    </div>
                </main>
            </div>

            {activeFilterId === 'clases' && (
                <CategoryFilterPanel
                    isOpen={true}
                    onClose={() => setActiveFilterId(null)}
                    sections={filterData.sections}
                    selectedIds={(selectedFilters.categories as number[]) || []}
                    onToggle={(id) => toggleFilter('categories', id)}
                    onToggleSection={(catIds, select, sectionId) => setSelectedFilters(prev => {
                        const currentCats = (prev.categories as number[]) || [];
                        const currentSections = (prev.sections as number[]) || [];
                        let nextCats: number[];
                        let nextSections: number[];
                        if (select) {
                            nextCats = Array.from(new Set([...currentCats, ...catIds]));
                            nextSections = sectionId ? Array.from(new Set([...currentSections, sectionId])) : currentSections;
                        } else {
                            const removeSet = new Set(catIds);
                            nextCats = currentCats.filter(id => !removeSet.has(id));
                            nextSections = sectionId ? currentSections.filter(id => id !== sectionId) : currentSections;
                        }
                        return { ...prev, categories: nextCats, sections: nextSections };
                    })}
                    onSelectAll={() => setSelectedFilters(prev => ({
                        ...prev,
                        categories: filterData.categories.map(i => i.id),
                        sections: filterData.sections.map(s => s.id)
                    }))}
                    onClear={() => setSelectedFilters(prev => ({ ...prev, categories: [], sections: [] }))}
                />
            )}

            {activeData && (
                <FilterPanel
                    title={activeData.title}
                    isOpen={!!activeFilterId}
                    onClose={() => setActiveFilterId(null)}
                    items={activeData.items}
                    selectedIds={selectedFilters[activeData.category] as number[]}
                    onToggle={(id) => toggleFilter(activeData.category, id)}
                    onSelectAll={() => setSelectedFilters(prev => ({ ...prev, [activeData.category]: activeData.items.map(i => i.id) }))}
                    onClear={() => setSelectedFilters(prev => ({ ...prev, [activeData.category]: [] }))}
                />
            )}

            {/* User Management Modal - Fuera del header */}
            <UserManagement isOpen={showUserManagement} onClose={() => setShowUserManagement(false)} />

            {/* Floating Chat Panel - Solo en páginas que no son /chat */}
            {!isOnChatPage && <ChatPanel isFloating={true} />}

            {/* About / Definiciones - Botón flotante */}
            <AboutDefinitions />
        </div>
    );
}
