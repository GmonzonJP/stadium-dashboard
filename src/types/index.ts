export interface DashboardMetric {
    id: number;
    label: string;
    value: number;
    previousValue: number;
    growth: number;
}

export interface SalesMetrics {
    totalUnits: DashboardMetric;
    totalSales: DashboardMetric;
    retailUtility: number;
    wholesaleUtility: number;
}

export interface FilterItem {
    id: number;
    label: string;
}

export interface FilterData {
    stores: FilterItem[];
    brands: FilterItem[];
    categories: FilterItem[];
    genders: FilterItem[];
    suppliers: FilterItem[];
}

export type ComparisonMode = '52weeks' | 'calendar';

export interface FilterParams {
    startDate: string;
    endDate: string;
    stores?: number[];
    brands?: number[];
    categories?: number[];
    genders?: number[];
    suppliers?: number[];
    search?: string;
    comparisonMode?: ComparisonMode;
}

// Exportar tipos de Price Actions
export * from './price-actions';
