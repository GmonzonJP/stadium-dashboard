/**
 * Calculadora de ritmos de venta (velocity)
 * Calcula ritmo actual, ritmo base, desaceleración, etc.
 */

import { VelocityMetrics, StockMetrics } from '@/types/price-actions';
import { safeDivide, calculateDiasStock } from '@/lib/calculation-utils';

/**
 * Calcula el ritmo actual (unidades/día) en los últimos N días
 */
export function calculateRitmoActual(
    unidadesUltimosNDias: number,
    diasVentana: number
): number {
    return safeDivide(unidadesUltimosNDias, diasVentana, 0) || 0;
}

/**
 * Calcula el ritmo base desde el inicio del ciclo
 */
export function calculateRitmoBase(
    unidadesDesdeInicio: number,
    diasDesdeInicio: number
): number {
    if (diasDesdeInicio <= 0) {
        return 0;
    }
    return safeDivide(unidadesDesdeInicio, diasDesdeInicio, 0) || 0;
}

/**
 * Calcula el índice de desaceleración
 * indice_desaceleracion = ritmo_actual / ritmo_base
 */
export function calculateIndiceDesaceleracion(
    ritmoActual: number,
    ritmoBase: number
): number {
    if (ritmoBase === 0) {
        // Si no hay ritmo base, no hay desaceleración (o es infinito)
        return ritmoActual > 0 ? 1 : 0;
    }
    return ritmoActual / ritmoBase;
}

/**
 * Calcula el índice de ritmo vs cluster
 * indice_ritmo = ritmo_actual / ritmo_cluster
 */
export function calculateIndiceRitmo(
    ritmoActual: number,
    ritmoCluster: number
): number {
    if (ritmoCluster === 0) {
        // Si el cluster no tiene ritmo, retornar 0 o 1 según el caso
        return ritmoActual > 0 ? 1 : 0;
    }
    return ritmoActual / ritmoCluster;
}

/**
 * Calcula métricas de stock
 */
export function calculateStockMetrics(params: {
    stockOnHand: number;
    stockPendiente: number;
    ventaDiaria: number;
    diasDesdeInicio: number;
    cicloTotalDias: number;
}): StockMetrics {
    const stockTotal = params.stockOnHand + Math.max(params.stockPendiente, 0);
    const diasStock = calculateDiasStock(stockTotal, params.ventaDiaria);
    const diasRestantesCiclo = Math.max(0, params.cicloTotalDias - params.diasDesdeInicio);

    return {
        stockOnHand: params.stockOnHand,
        stockPendiente: Math.max(params.stockPendiente, 0),
        stockTotal,
        diasStock,
        diasDesdeInicio: params.diasDesdeInicio,
        diasRestantesCiclo: diasRestantesCiclo > 0 ? diasRestantesCiclo : null
    };
}

/**
 * Calcula todas las métricas de velocidad para un SKU
 */
export function calculateVelocityMetrics(params: {
    unidadesUltimosNDias: number;
    diasVentana: number;
    unidadesDesdeInicio: number;
    diasDesdeInicio: number;
    ritmoCluster: number;
}): VelocityMetrics {
    const ritmoActual = calculateRitmoActual(
        params.unidadesUltimosNDias,
        params.diasVentana
    );

    const ritmoBase = calculateRitmoBase(
        params.unidadesDesdeInicio,
        params.diasDesdeInicio
    );

    const indiceDesaceleracion = calculateIndiceDesaceleracion(ritmoActual, ritmoBase);
    const indiceRitmo = calculateIndiceRitmo(ritmoActual, params.ritmoCluster);

    return {
        ritmoActual,
        ritmoBase,
        indiceDesaceleracion,
        ritmoCluster: params.ritmoCluster,
        indiceRitmo
    };
}

/**
 * Determina la severidad del ritmo basado en índices
 */
export function getSeveridadRitmo(
    indiceRitmo: number,
    thresholds: {
        critico: number;
        bajo: number;
        alto: number;
    }
): 'critico' | 'bajo' | 'normal' | 'alto' {
    if (indiceRitmo < thresholds.critico) {
        return 'critico';
    }
    if (indiceRitmo < thresholds.bajo) {
        return 'bajo';
    }
    if (indiceRitmo >= thresholds.alto) {
        return 'alto';
    }
    return 'normal';
}

/**
 * Calcula la venta diaria promedio a partir de unidades y días
 */
export function calculateVentaDiaria(
    unidades: number,
    dias: number
): number {
    return safeDivide(unidades, dias, 0) || 0;
}
