/**
 * Simulador de impacto de cambio de precio
 * Calcula proyecciones de sell-out, margen, costo del castigo
 */

import { PriceSimulationInput, PriceSimulationResult, ElasticityInfo } from '@/types/price-actions';
import { calculateClusterElasticity, calculateCategoryElasticity } from './elasticity-service';
import { identifyCluster } from './cluster-service';
import { getThresholds } from './config-service';
import { calculateMargen, calculateMarkup } from '@/lib/calculation-utils';

/**
 * Simula el impacto de un cambio de precio
 */
export async function simulatePriceChange(params: {
    input: PriceSimulationInput;
    stockTotal: number;
    costo: number;
    cluster?: {
        idClase: number;
        idGenero: number;
        idMarca: number;
        precio: number;
    };
}): Promise<PriceSimulationResult> {
    const { input, stockTotal, costo, cluster } = params;

    // Calcular % cambio de precio
    const deltaPrecioPorcentaje = (input.precioPropuesto - input.precioActual) / input.precioActual;

    // Obtener elasticidad
    let elasticity: ElasticityInfo;
    if (input.elasticidad !== undefined) {
        // Elasticidad proporcionada manualmente
        elasticity = {
            value: input.elasticidad,
            confidence: 'media',
            observations: 0,
            method: 'fallback'
        };
    } else if (cluster) {
        // Calcular elasticidad del cluster
        const clusterObj = await identifyCluster(cluster);
        elasticity = await calculateClusterElasticity({ cluster: clusterObj });
    } else {
        // Fallback a elasticidad por defecto
        const thresholds = await getThresholds();
        elasticity = {
            value: thresholds.elasticityFallback,
            confidence: 'baja',
            observations: 0,
            method: 'fallback',
            warning: 'No se pudo identificar el cluster. Usando elasticidad conservadora.'
        };
    }

    // Calcular ritmo proyectado
    // ritmo_proyectado = ritmo_actual * (1 + elasticidad * %delta_precio)
    // Necesitamos el ritmo actual - esto debería venir del input o calcularse antes
    // Por ahora asumimos que viene en el input o lo calculamos
    // En la implementación real, esto vendrá del watchlist item
    const ritmoActual = 0; // TODO: obtener del contexto

    const ritmoProyectado = Math.max(0, ritmoActual * (1 + elasticity.value * deltaPrecioPorcentaje));

    // Calcular unidades proyectadas
    const unidadesProyectadas = ritmoProyectado * input.horizonteDias;
    const unidadesProyectadasCap = Math.min(unidadesProyectadas, stockTotal);

    // Calcular métricas financieras
    const ingresoProyectado = unidadesProyectadasCap * input.precioPropuesto;
    const margenUnitario = input.precioPropuesto - costo;
    const margenTotal = unidadesProyectadasCap * margenUnitario;
    const costoCastigo = (input.precioActual - input.precioPropuesto) * unidadesProyectadasCap;

    // Sell-out proyectado
    const sellOutProyectadoPorcentaje = stockTotal > 0
        ? (unidadesProyectadasCap / stockTotal) * 100
        : 0;

    // Warnings
    const warnings: string[] = [];
    if (margenUnitario < 0) {
        warnings.push('⚠️ El margen unitario queda negativo con este precio');
    }
    if (elasticity.confidence === 'baja') {
        warnings.push(`⚠️ Elasticidad estimada con baja confianza (${elasticity.observations} observaciones)`);
    }
    if (sellOutProyectadoPorcentaje < 50 && stockTotal > 0) {
        warnings.push(`⚠️ Sell-out proyectado bajo (${sellOutProyectadoPorcentaje.toFixed(1)}%)`);
    }

    // Break-even (precio mínimo para margen objetivo)
    // Esto se calcularía si hay un margen mínimo configurado
    const thresholds = await getThresholds();
    let breakEvenPrecio: number | undefined;
    if (thresholds.margenMinimoAceptable !== null && stockTotal > 0) {
        // Precio mínimo = costo / (1 - margen_minimo/100)
        breakEvenPrecio = costo / (1 - thresholds.margenMinimoAceptable / 100);
    }

    return {
        baseCol: input.baseCol,
        precioActual: input.precioActual,
        precioPropuesto: input.precioPropuesto,
        deltaPrecioPorcentaje: deltaPrecioPorcentaje * 100, // En porcentaje
        elasticidad: elasticity,
        ritmoActual,
        ritmoProyectado,
        unidadesProyectadas,
        unidadesProyectadasCap,
        ingresoProyectado,
        costo,
        margenUnitario,
        margenTotal,
        costoCastigo,
        sellOutProyectadoPorcentaje,
        stockTotal,
        horizonteDias: input.horizonteDias,
        warnings,
        breakEvenPrecio
    };
}

/**
 * Versión simplificada que acepta ritmo actual directamente
 */
export async function simulatePriceChangeWithRitmo(params: {
    input: PriceSimulationInput;
    ritmoActual: number;
    stockTotal: number;
    costo: number;
    elasticity: ElasticityInfo;
}): Promise<PriceSimulationResult> {
    const { input, ritmoActual, stockTotal, costo, elasticity } = params;

    // Calcular % cambio de precio
    const deltaPrecioPorcentaje = (input.precioPropuesto - input.precioActual) / input.precioActual;

    // Calcular ritmo proyectado
    const ritmoProyectado = Math.max(0, ritmoActual * (1 + elasticity.value * deltaPrecioPorcentaje));

    // Calcular unidades proyectadas
    const unidadesProyectadas = ritmoProyectado * input.horizonteDias;
    const unidadesProyectadasCap = Math.min(unidadesProyectadas, stockTotal);

    // Calcular métricas financieras
    const ingresoProyectado = unidadesProyectadasCap * input.precioPropuesto;
    const margenUnitario = input.precioPropuesto - costo;
    const margenTotal = unidadesProyectadasCap * margenUnitario;
    const costoCastigo = (input.precioActual - input.precioPropuesto) * unidadesProyectadasCap;

    // Sell-out proyectado
    const sellOutProyectadoPorcentaje = stockTotal > 0
        ? (unidadesProyectadasCap / stockTotal) * 100
        : 0;

    // Warnings
    const warnings: string[] = [];
    if (margenUnitario < 0) {
        warnings.push('⚠️ El margen unitario queda negativo con este precio');
    }
    if (elasticity.confidence === 'baja') {
        warnings.push(`⚠️ Elasticidad estimada con baja confianza (${elasticity.observations} observaciones)`);
    }
    if (sellOutProyectadoPorcentaje < 50 && stockTotal > 0) {
        warnings.push(`⚠️ Sell-out proyectado bajo (${sellOutProyectadoPorcentaje.toFixed(1)}%)`);
    }

    // Break-even
    const thresholds = await getThresholds();
    let breakEvenPrecio: number | undefined;
    if (thresholds.margenMinimoAceptable !== null && stockTotal > 0) {
        breakEvenPrecio = costo / (1 - thresholds.margenMinimoAceptable / 100);
    }

    return {
        baseCol: input.baseCol,
        precioActual: input.precioActual,
        precioPropuesto: input.precioPropuesto,
        deltaPrecioPorcentaje: deltaPrecioPorcentaje * 100,
        elasticidad: elasticity,
        ritmoActual,
        ritmoProyectado,
        unidadesProyectadas,
        unidadesProyectadasCap,
        ingresoProyectado,
        costo,
        margenUnitario,
        margenTotal,
        costoCastigo,
        sellOutProyectadoPorcentaje,
        stockTotal,
        horizonteDias: input.horizonteDias,
        warnings,
        breakEvenPrecio
    };
}
