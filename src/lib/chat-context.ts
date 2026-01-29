/**
 * Chat Context Builder - Constructor de contexto para el LLM
 * Extrae información del estado actual del dashboard para contextualizar respuestas
 */

import { FilterParams, FilterData } from '@/types';
import { getDatabaseSchema, getQueryExamples } from './sql-generator';

export interface DashboardContext {
    filters: FilterParams;
    filterLabels: FilterLabels;
    currentMetrics?: CurrentMetrics;
    dateRange: {
        start: string;
        end: string;
        daysSelected: number;
    };
}

export interface FilterLabels {
    stores: string[];
    brands: string[];
    categories: string[];
    genders: string[];
    suppliers: string[];
}

export interface CurrentMetrics {
    sales: number;
    units: number;
    margin: number | null;
    markup: number | null;
    stock: number;
    ytdSales: number;
    ytdUnits: number;
}

/**
 * Construye el contexto completo para el LLM
 */
export function buildChatContext(
    filters: FilterParams,
    filterData?: FilterData,
    metrics?: CurrentMetrics
): string {
    const parts: string[] = [];

    // Información del período seleccionado
    parts.push('### Período Seleccionado:');
    parts.push(`- Fecha inicio: ${filters.startDate}`);
    parts.push(`- Fecha fin: ${filters.endDate}`);
    
    const startDate = new Date(filters.startDate);
    const endDate = new Date(filters.endDate);
    const daysSelected = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    parts.push(`- Días seleccionados: ${daysSelected}`);
    parts.push('');

    // Filtros activos
    parts.push('### Filtros Activos:');
    
    if (filters.stores?.length && filterData) {
        const storeNames = filters.stores
            .map(id => filterData.stores.find(s => s.id === id)?.label)
            .filter(Boolean);
        parts.push(`- Tiendas (${filters.stores.length}): ${storeNames.join(', ') || 'IDs: ' + filters.stores.join(', ')}`);
    } else {
        parts.push('- Tiendas: Todas');
    }

    if (filters.brands?.length && filterData) {
        const brandNames = filters.brands
            .map(id => filterData.brands.find(b => b.id === id)?.label)
            .filter(Boolean);
        parts.push(`- Marcas (${filters.brands.length}): ${brandNames.join(', ') || 'IDs: ' + filters.brands.join(', ')}`);
    } else {
        parts.push('- Marcas: Todas');
    }

    if (filters.categories?.length && filterData) {
        const categoryNames = filters.categories
            .map(id => filterData.categories.find(c => c.id === id)?.label)
            .filter(Boolean);
        parts.push(`- Categorías (${filters.categories.length}): ${categoryNames.join(', ') || 'IDs: ' + filters.categories.join(', ')}`);
    } else {
        parts.push('- Categorías: Todas');
    }

    if (filters.genders?.length && filterData) {
        const genderNames = filters.genders
            .map(id => filterData.genders.find(g => g.id === id)?.label)
            .filter(Boolean);
        parts.push(`- Géneros (${filters.genders.length}): ${genderNames.join(', ') || 'IDs: ' + filters.genders.join(', ')}`);
    } else {
        parts.push('- Géneros: Todos');
    }

    if (filters.suppliers?.length && filterData) {
        const supplierNames = filters.suppliers
            .map(id => filterData.suppliers.find(s => s.id === id)?.label)
            .filter(Boolean);
        parts.push(`- Proveedores (${filters.suppliers.length}): ${supplierNames.join(', ') || 'IDs: ' + filters.suppliers.join(', ')}`);
    } else {
        parts.push('- Proveedores: Todos');
    }

    if (filters.search) {
        parts.push(`- Búsqueda: "${filters.search}"`);
    }
    parts.push('');

    // Métricas actuales si están disponibles
    if (metrics) {
        parts.push('### Métricas Actuales del Dashboard:');
        parts.push(`- Ventas período: $${formatNumber(metrics.sales)}`);
        parts.push(`- Unidades período: ${formatNumber(metrics.units)}`);
        if (metrics.margin !== null) {
            parts.push(`- Margen: ${metrics.margin.toFixed(2)}%`);
        }
        if (metrics.markup !== null) {
            parts.push(`- Markup: ${metrics.markup.toFixed(2)}%`);
        }
        parts.push(`- Stock total: ${formatNumber(metrics.stock)}`);
        parts.push(`- Ventas YTD: $${formatNumber(metrics.ytdSales)}`);
        parts.push(`- Unidades YTD: ${formatNumber(metrics.ytdUnits)}`);
        parts.push('');
    }

    // Esquema de base de datos
    parts.push('### Esquema de Base de Datos:');
    parts.push(getDatabaseSchema());
    parts.push('');

    // Ejemplos de queries
    parts.push('### Ejemplos de Consultas SQL:');
    parts.push(getQueryExamples());

    return parts.join('\n');
}

/**
 * Construye las condiciones WHERE SQL basadas en los filtros activos
 */
export function buildFilterConditions(filters: FilterParams, tableAlias: string = 'T'): string {
    const conditions: string[] = [];
    const prefix = tableAlias ? `${tableAlias}.` : '';

    if (filters.startDate) {
        conditions.push(`${prefix}Fecha >= '${filters.startDate}'`);
    }

    if (filters.endDate) {
        conditions.push(`${prefix}Fecha <= '${filters.endDate}'`);
    }

    if (filters.stores?.length) {
        conditions.push(`${prefix}IdDeposito IN (${filters.stores.join(',')})`);
    }

    if (filters.brands?.length) {
        conditions.push(`${prefix}IdMarca IN (${filters.brands.join(',')})`);
    }

    if (filters.categories?.length) {
        conditions.push(`${prefix}IdClase IN (${filters.categories.join(',')})`);
    }

    if (filters.genders?.length) {
        conditions.push(`${prefix}idGenero IN (${filters.genders.join(',')})`);
    }

    if (filters.suppliers?.length) {
        const formattedSuppliers = filters.suppliers.map(s => typeof s === 'string' ? `'${s}'` : s);
        conditions.push(`${prefix}idProveedor IN (${formattedSuppliers.join(',')})`);
    }

    return conditions.length > 0 ? conditions.join(' AND ') : '1=1';
}

/**
 * Formatea números grandes para mostrar
 */
function formatNumber(value: number): string {
    if (value >= 1000000) {
        return `${(value / 1000000).toFixed(2)}M`;
    }
    if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toLocaleString('es-AR');
}

/**
 * Genera un resumen ejecutivo del contexto
 */
export function getContextSummary(filters: FilterParams): string {
    const startDate = new Date(filters.startDate);
    const endDate = new Date(filters.endDate);
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const filterCount = [
        filters.stores?.length || 0,
        filters.brands?.length || 0,
        filters.categories?.length || 0,
        filters.genders?.length || 0,
        filters.suppliers?.length || 0
    ].reduce((a, b) => a + (b > 0 ? 1 : 0), 0);

    return `Período: ${days} días (${filters.startDate} a ${filters.endDate}). Filtros activos: ${filterCount}`;
}
