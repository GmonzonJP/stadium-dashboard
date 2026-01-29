/**
 * Calculadora de score para priorización de candidatos en watchlist
 * Score combina: severidad de índice_ritmo, días_reales vs días_restantes, margen, stock
 */

import { WatchlistItem, WatchlistReason } from '@/types/price-actions';
import { getThresholds } from './config-service';

export interface ScoreComponents {
    indiceRitmoScore: number; // 0-40 puntos
    diasStockScore: number; // 0-30 puntos
    margenScore: number; // 0-20 puntos
    stockScore: number; // 0-10 puntos
    total: number; // 0-100
}

/**
 * Calcula el score de priorización para un item de watchlist
 */
export async function calculateWatchlistScore(item: WatchlistItem): Promise<{
    score: number;
    components: ScoreComponents;
    explanation: string;
}> {
    const thresholds = await getThresholds();

    // Componente 1: Severidad de índice_ritmo (0-40 puntos)
    let indiceRitmoScore = 0;
    if (item.indiceRitmo < thresholds.indiceRitmoCritico) {
        indiceRitmoScore = 40; // Crítico
    } else if (item.indiceRitmo < thresholds.indiceRitmoBajo) {
        indiceRitmoScore = 25; // Bajo
    } else if (item.indiceRitmo < 1.0) {
        indiceRitmoScore = 10; // Normal-bajo
    } else {
        indiceRitmoScore = 0; // Normal o alto
    }

    // Componente 2: Días de stock vs días restantes (0-30 puntos)
    let diasStockScore = 0;
    if (item.diasStock !== null && item.diasRestantesCiclo !== null) {
        const ratio = item.diasStock / item.diasRestantesCiclo;
        if (ratio > 2.0) {
            diasStockScore = 30; // Stock es más del doble de días restantes
        } else if (ratio > 1.5) {
            diasStockScore = 20;
        } else if (ratio > 1.0) {
            diasStockScore = 10;
        }
    } else if (item.diasStock !== null && item.diasStock > thresholds.diasStockAlerta) {
        diasStockScore = 15; // Días de stock muy alto aunque no sepamos días restantes
    }

    // Componente 3: Margen unitario (cuán doloroso castigar) (0-20 puntos)
    // A mayor margen, más doloroso castigar, más prioridad
    const margenUnitario = item.precioActual - item.costo;
    const margenPorcentaje = item.precioActual > 0 ? (margenUnitario / item.precioActual) * 100 : 0;
    let margenScore = 0;
    if (margenPorcentaje > 50) {
        margenScore = 20; // Margen muy alto, castigar es muy doloroso
    } else if (margenPorcentaje > 30) {
        margenScore = 12;
    } else if (margenPorcentaje > 15) {
        margenScore = 6;
    }

    // Componente 4: Stock total (capital inmovilizado) (0-10 puntos)
    // Más stock = más capital inmovilizado = más prioridad
    let stockScore = 0;
    if (item.stockTotal > 100) {
        stockScore = 10;
    } else if (item.stockTotal > 50) {
        stockScore = 6;
    } else if (item.stockTotal > 20) {
        stockScore = 3;
    }

    const components: ScoreComponents = {
        indiceRitmoScore,
        diasStockScore,
        margenScore,
        stockScore,
        total: indiceRitmoScore + diasStockScore + margenScore + stockScore
    };

    // Generar explicación
    const explanations: string[] = [];
    if (indiceRitmoScore >= 25) {
        explanations.push(`Ritmo ${item.indiceRitmo < thresholds.indiceRitmoCritico ? 'crítico' : 'bajo'} (${item.indiceRitmo.toFixed(2)}x del cluster)`);
    }
    if (diasStockScore >= 10) {
        explanations.push(`Stock alto vs ciclo (${item.diasStock?.toFixed(0) || 'N/A'} días)`);
    }
    if (margenScore >= 6) {
        explanations.push(`Margen alto (${margenPorcentaje.toFixed(1)}%)`);
    }
    if (stockScore >= 3) {
        explanations.push(`Capital inmovilizado (${item.stockTotal} unidades)`);
    }

    const explanation = explanations.length > 0
        ? explanations.join(' • ')
        : 'Prioridad normal';

    return {
        score: components.total,
        components,
        explanation
    };
}

/**
 * Determina los motivos de inclusión en watchlist
 */
export function determineWatchlistReasons(item: {
    diasDesdeInicio: number;
    indiceRitmo: number;
    ritmoActual: number;
    ritmoCluster: number;
    indiceDesaceleracion: number;
    stockTotal: number;
    diasStock: number | null;
    diasRestantesCiclo: number | null;
    unidadesUltimos14: number;
}, thresholds: {
    earlyDays: number;
    indiceRitmoCritico: number;
    indiceDesaceleracion: number;
    diasStockAlerta: number;
}): WatchlistReason[] {
    const reasons: WatchlistReason[] = [];

    // A) Fracaso temprano
    if (item.diasDesdeInicio >= thresholds.earlyDays) {
        if (item.indiceRitmo < 0.7 || item.ritmoActual < 0.6 * item.ritmoCluster) {
            reasons.push('Early');
        }
    }

    // B) Desaceleración
    if (item.indiceDesaceleracion < thresholds.indiceDesaceleracion &&
        item.stockTotal > 0 &&
        (item.diasStock !== null && item.diasStock > thresholds.diasStockAlerta || item.indiceRitmo < 0.8)) {
        reasons.push('Desacelera');
    }

    // C) Sobrestock vs ciclo restante
    if (item.diasRestantesCiclo !== null && item.diasStock !== null) {
        if (item.diasStock > item.diasRestantesCiclo) {
            reasons.push('Sobrestock');
        }
    }

    // D) Sin tracción
    if (item.unidadesUltimos14 === 0 && item.stockTotal > 0) {
        reasons.push('Sin tracción');
    }

    return reasons.length > 0 ? reasons : [];
}
