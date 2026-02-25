/**
 * Reposicion Calculator - Calculador del semáforo de reposición
 * 
 * Implementa el cálculo del semáforo basado en:
 * - Stock actual vs ritmo de ventas
 * - Días desde última compra
 * - Ventana configurable (default 180 días)
 * - Umbral de reposición (default 45 días)
 */

import { executeQuery } from './db';
import { safeDivide } from './calculation-utils';
import reposicionConfig from './reposicion-config.json';

export type SemaphoreColor = 'red' | 'green' | 'black' | 'white';

export interface ReposicionConfig {
    ventanaRitmoDias: number;
    umbralReposicionDias: number;
    stockObjetivoDias?: number;
}

export interface ReposicionResult {
    color: SemaphoreColor;
    diasReales: number | null;
    diasEsperados: number | null;
    ritmoDiario: number | null;
    stockTotal: number | null;
    unidades180: number | null;
    ultimaCompraFecha: string | null;
    diasDesdeCompra: number | null;
    ventanaUsada: number;
    umbralUsado: number;
    explanation: string;
}

/**
 * Obtiene la configuración de reposición para una categoría/proveedor específico
 */
export function getReposicionConfig(
    categoriaId?: number | null,
    proveedorId?: number | null
): ReposicionConfig {
    // Intentar obtener config por proveedor primero (más específico)
    if (proveedorId && (reposicionConfig.porProveedor as Record<string, any>)[String(proveedorId)]) {
        return (reposicionConfig.porProveedor as Record<string, any>)[String(proveedorId)];
    }

    // Luego por categoría
    if (categoriaId && (reposicionConfig.porCategoria as Record<string, any>)[String(categoriaId)]) {
        const catConfig = (reposicionConfig.porCategoria as Record<string, any>)[String(categoriaId)];
        return {
            ventanaRitmoDias: catConfig.ventanaRitmoDias,
            umbralReposicionDias: catConfig.umbralReposicionDias,
            stockObjetivoDias: catConfig.stockObjetivoDias
        };
    }

    // Default
    return reposicionConfig.default;
}

/**
 * Calcula el semáforo de reposición para un producto (BaseCol)
 * 
 * Algoritmo:
 * 1. Obtener fecha de última compra
 * 2. Calcular unidades vendidas en los últimos N días (ventana) antes de última compra
 * 3. Calcular ritmo diario = unidades_ventana / días_ventana
 * 4. Calcular días reales = stock_total / ritmo_diario
 * 5. Calcular días esperados = ventana - días_desde_compra
 * 6. Determinar color del semáforo
 * 
 * @param baseCol - Código base del producto
 * @param stockTotal - Stock total actual (ya calculado)
 * @param ultimaCompraFecha - Fecha de última compra (ya obtenida)
 * @param categoriaId - ID de categoría para config personalizada
 * @param proveedorId - ID de proveedor para config personalizada
 * @returns Resultado del semáforo con explicación
 */
export async function calculateReposicionSemaphore(
    baseCol: string,
    stockTotal: number | null,
    ultimaCompraFecha: Date | string | null,
    categoriaId?: number | null,
    proveedorId?: number | null
): Promise<ReposicionResult> {
    const config = getReposicionConfig(categoriaId, proveedorId);
    const { ventanaRitmoDias, umbralReposicionDias } = config;

    // Base result template
    const baseResult = {
        ventanaUsada: ventanaRitmoDias,
        umbralUsado: umbralReposicionDias,
        stockTotal,
        ultimaCompraFecha: ultimaCompraFecha ? new Date(ultimaCompraFecha).toISOString().split('T')[0] : null
    };

    // Caso: sin datos de última compra
    if (!ultimaCompraFecha) {
        return {
            ...baseResult,
            color: 'white',
            diasReales: null,
            diasEsperados: null,
            ritmoDiario: null,
            unidades180: null,
            diasDesdeCompra: null,
            explanation: 'Sin fecha de última compra disponible. No es posible calcular el semáforo de reposición.'
        };
    }

    // Caso: sin stock
    if (stockTotal == null || stockTotal <= 0) {
        return {
            ...baseResult,
            color: 'green',
            diasReales: 0,
            diasEsperados: null,
            ritmoDiario: null,
            unidades180: null,
            diasDesdeCompra: null,
            explanation: 'Stock agotado o sin datos. Se recomienda reposición inmediata.'
        };
    }

    try {
        const fechaUltimaCompra = new Date(ultimaCompraFecha);
        const hoy = new Date();
        const diasDesdeCompra = Math.floor((hoy.getTime() - fechaUltimaCompra.getTime()) / (1000 * 60 * 60 * 24));

        // Calcular fecha inicio de ventana (N días antes de última compra)
        const fechaInicioVentana = new Date(fechaUltimaCompra);
        fechaInicioVentana.setDate(fechaInicioVentana.getDate() - ventanaRitmoDias);

        // Obtener unidades vendidas en la ventana
        const ventasQuery = `
            SELECT ISNULL(SUM(Cantidad), 0) as unidades
            FROM Transacciones
            WHERE BaseCol = '${baseCol.replace(/'/g, "''")}'
            AND Fecha >= '${fechaInicioVentana.toISOString().split('T')[0]}'
            AND Fecha < '${fechaUltimaCompra.toISOString().split('T')[0]}'
            AND Cantidad > 0
        `;

        const ventasResult = await executeQuery(ventasQuery);
        const unidadesVentana = Number(ventasResult.recordset[0]?.unidades) || 0;

        // Caso: sin ventas en la ventana
        if (unidadesVentana <= 0) {
            return {
                ...baseResult,
                color: 'white',
                diasReales: null,
                diasEsperados: ventanaRitmoDias - diasDesdeCompra,
                ritmoDiario: 0,
                unidades180: 0,
                diasDesdeCompra,
                explanation: `Sin ventas registradas en los ${ventanaRitmoDias} días previos a la última compra. No es posible estimar el ritmo de ventas.`
            };
        }

        // Calcular ritmo diario
        const ritmoDiario = unidadesVentana / ventanaRitmoDias;

        // Calcular días reales de stock
        const diasReales = safeDivide(stockTotal, ritmoDiario);

        // Calcular días esperados
        const diasEsperados = ventanaRitmoDias - diasDesdeCompra;

        // Determinar color del semáforo
        let color: SemaphoreColor;
        let explanation: string;

        if (diasReales === null) {
            color = 'white';
            explanation = 'No fue posible calcular los días de stock.';
        } else if (diasReales > diasEsperados && diasEsperados > 0) {
            // ROJO: Sobrestock - más días de stock de los esperados
            color = 'red';
            explanation = `SOBRESTOCK: Tienes ${Math.round(diasReales)} días de stock pero se esperaban máximo ${Math.round(diasEsperados)} días. ` +
                `Han pasado ${diasDesdeCompra} días desde la última compra (${fechaUltimaCompra.toLocaleDateString('es-AR')}). ` +
                `Ritmo: ${ritmoDiario.toFixed(2)} unidades/día.`;
        } else if (diasReales < umbralReposicionDias) {
            // VERDE: Reponer pronto - menos de N días de stock
            color = 'green';
            explanation = `REPONER PRONTO: Solo quedan ~${Math.round(diasReales)} días de stock (umbral: ${umbralReposicionDias} días). ` +
                `Ritmo actual: ${ritmoDiario.toFixed(2)} unidades/día. Stock: ${stockTotal} unidades.`;
        } else {
            // NEGRO: Normal
            color = 'black';
            explanation = `NORMAL: ${Math.round(diasReales)} días de stock. ` +
                `Última compra: ${fechaUltimaCompra.toLocaleDateString('es-AR')} (hace ${diasDesdeCompra} días). ` +
                `Ritmo: ${ritmoDiario.toFixed(2)} unidades/día.`;
        }

        return {
            ...baseResult,
            color,
            diasReales: diasReales ? Math.round(diasReales) : null,
            diasEsperados: Math.round(diasEsperados),
            ritmoDiario: Math.round(ritmoDiario * 100) / 100,
            unidades180: unidadesVentana,
            diasDesdeCompra,
            explanation
        };

    } catch (error) {
        console.error('Error calculating reposicion semaphore:', error);
        return {
            ...baseResult,
            color: 'white',
            diasReales: null,
            diasEsperados: null,
            ritmoDiario: null,
            unidades180: null,
            diasDesdeCompra: null,
            explanation: `Error al calcular semáforo: ${error instanceof Error ? error.message : 'Error desconocido'}`
        };
    }
}

/**
 * Calcula el semáforo de forma simplificada cuando ya tenemos los datos
 * (evita hacer queries adicionales)
 *
 * @param ritmoDiarioOverride - Si se provee, usa este ritmo en vez de calcular
 *   desde unidadesVentana/ventana. Esto permite usar la misma velocidad que
 *   Par/Día (basada en ventas desde última compra) para evitar inconsistencias
 *   con productos estacionales o de aceleración reciente.
 */
export function calculateSemaphoreFromData(
    stockTotal: number | null,
    unidadesVentana: number,
    diasDesdeCompra: number,
    ultimaCompraFecha: string | null,
    config?: Partial<ReposicionConfig> & { ritmoDiarioOverride?: number }
): ReposicionResult {
    const ventanaRitmoDias = config?.ventanaRitmoDias ?? reposicionConfig.default.ventanaRitmoDias;
    const umbralReposicionDias = config?.umbralReposicionDias ?? reposicionConfig.default.umbralReposicionDias;

    const baseResult = {
        ventanaUsada: ventanaRitmoDias,
        umbralUsado: umbralReposicionDias,
        stockTotal,
        ultimaCompraFecha,
        diasDesdeCompra
    };

    // Sin stock
    if (stockTotal == null || stockTotal <= 0) {
        return {
            ...baseResult,
            color: 'green',
            diasReales: 0,
            diasEsperados: null,
            ritmoDiario: null,
            unidades180: null,
            explanation: 'Stock agotado. Reposición inmediata recomendada.'
        };
    }

    // Sin ventas (solo si no hay override)
    if (unidadesVentana <= 0 && !config?.ritmoDiarioOverride) {
        return {
            ...baseResult,
            color: 'white',
            diasReales: null,
            diasEsperados: ventanaRitmoDias - diasDesdeCompra,
            ritmoDiario: 0,
            unidades180: 0,
            explanation: 'Sin ventas en la ventana de análisis.'
        };
    }

    // Usar ritmo override (desde última compra) si está disponible, sino calcular desde ventana
    const ritmoDiario = config?.ritmoDiarioOverride ?? (unidadesVentana / ventanaRitmoDias);

    if (ritmoDiario <= 0) {
        return {
            ...baseResult,
            color: 'white',
            diasReales: null,
            diasEsperados: ventanaRitmoDias - diasDesdeCompra,
            ritmoDiario: 0,
            unidades180: unidadesVentana,
            explanation: 'Sin ventas suficientes para estimar ritmo.'
        };
    }

    const diasReales = stockTotal / ritmoDiario;
    const diasEsperados = ventanaRitmoDias - diasDesdeCompra;

    let color: SemaphoreColor;
    let explanation: string;

    if (diasReales > diasEsperados && diasEsperados > 0) {
        color = 'red';
        explanation = `Sobrestock: ${Math.round(diasReales)} días vs ${Math.round(diasEsperados)} esperados`;
    } else if (diasReales < umbralReposicionDias) {
        color = 'green';
        explanation = `Reponer: ${Math.round(diasReales)} días de stock`;
    } else {
        color = 'black';
        explanation = `Normal: ${Math.round(diasReales)} días de stock`;
    }

    return {
        ...baseResult,
        color,
        diasReales: Math.round(diasReales),
        diasEsperados: Math.round(diasEsperados),
        ritmoDiario: Math.round(ritmoDiario * 100) / 100,
        unidades180: unidadesVentana,
        explanation
    };
}

/**
 * Obtiene el color del semáforo como clase CSS de Tailwind
 */
export function getSemaphoreColorClass(color: SemaphoreColor): string {
    switch (color) {
        case 'red':
            return 'bg-red-500';
        case 'green':
            return 'bg-emerald-500';
        case 'black':
            return 'bg-slate-700';
        case 'white':
        default:
            return 'bg-white border border-slate-400';
    }
}

/**
 * Obtiene el texto del color del semáforo
 */
export function getSemaphoreColorText(color: SemaphoreColor): string {
    switch (color) {
        case 'red':
            return 'Sobrestock';
        case 'green':
            return 'Reponer';
        case 'black':
            return 'Normal';
        case 'white':
        default:
            return 'Sin Info';
    }
}
