/**
 * Calculation Utils - Utilidades de cálculo seguras para evitar divisiones por cero
 * y manejar nulos consistentemente
 */

/**
 * División segura que evita divisiones por cero
 * @param numerator - Numerador
 * @param denominator - Denominador
 * @param defaultValue - Valor por defecto si el denominador es 0 o null
 * @returns Resultado de la división o defaultValue
 */
export function safeDivide(
    numerator: number | null | undefined,
    denominator: number | null | undefined,
    defaultValue: number | null = null
): number | null {
    if (numerator == null || denominator == null || denominator === 0) {
        return defaultValue;
    }
    return numerator / denominator;
}

/**
 * Calcula el Precio Promedio de Venta (ASP - Average Selling Price)
 * ASP = venta_total / unidades
 * @param ventaTotal - Venta total en $ (período)
 * @param unidades - Unidades vendidas (período)
 * @returns ASP o null si no se puede calcular
 */
export function calculateASP(
    ventaTotal: number | null | undefined,
    unidades: number | null | undefined
): number | null {
    return safeDivide(ventaTotal, unidades);
}

/**
 * Calcula los días de stock estimados
 * días_stock = stock_total / venta_diaria
 * @param stockTotal - Stock total actual
 * @param ventaDiaria - Venta diaria promedio (unidades/día)
 * @returns Días de stock o null si no se puede calcular
 */
export function calculateDiasStock(
    stockTotal: number | null | undefined,
    ventaDiaria: number | null | undefined
): number | null {
    return safeDivide(stockTotal, ventaDiaria);
}

/**
 * Calcula los días de stock a partir del stock total, unidades vendidas y días del período
 * días_stock = stock_total / (unidades / días_periodo)
 * @param stockTotal - Stock total actual
 * @param unidades - Unidades vendidas en el período
 * @param diasPeriodo - Número de días del período
 * @returns Días de stock o null si no se puede calcular
 */
export function calculateDiasStockFromPeriod(
    stockTotal: number | null | undefined,
    unidades: number | null | undefined,
    diasPeriodo: number | null | undefined
): number | null {
    if (stockTotal == null || unidades == null || diasPeriodo == null || diasPeriodo === 0 || unidades === 0) {
        return null;
    }
    const ventaDiaria = unidades / diasPeriodo;
    if (ventaDiaria === 0) return null;
    return stockTotal / ventaDiaria;
}

/**
 * Calcula pares (unidades) por día
 * pares_por_dia = unidades / días_periodo
 * @param unidades - Unidades vendidas
 * @param diasPeriodo - Número de días del período
 * @returns Pares por día o null si no se puede calcular
 */
export function calculateParesPorDia(
    unidades: number | null | undefined,
    diasPeriodo: number | null | undefined
): number | null {
    return safeDivide(unidades, diasPeriodo);
}

/**
 * Calcula el margen
 * margen = (precio / costo) - 1, expresado en %
 * Ejemplo: Costo=100, Venta=150 → 50%
 * @param precio - Precio de venta (ASP)
 * @param costo - Costo (con IVA si corresponde)
 * @returns Margen en porcentaje o null si no se puede calcular
 */
export function calculateMargen(
    precio: number | null | undefined,
    costo: number | null | undefined
): number | null {
    if (precio == null || costo == null || costo === 0) {
        return null;
    }
    return ((precio - costo) / costo) * 100;
}

/**
 * Calcula el markup
 * markup = (precio - costo) / costo * 100
 * @param precio - Precio de venta
 * @param costo - Costo (con IVA si corresponde)
 * @returns Markup en porcentaje o null si no se puede calcular
 */
export function calculateMarkup(
    precio: number | null | undefined,
    costo: number | null | undefined
): number | null {
    if (precio == null || costo == null || costo === 0) {
        return null;
    }
    return ((precio - costo) / costo) * 100;
}

/**
 * Calcula el sell-through rate
 * sell_through = unidades / (unidades + stock_total) * 100
 * @param unidades - Unidades vendidas
 * @param stockTotal - Stock total actual
 * @returns Sell-through en porcentaje o null si no se puede calcular
 */
export function calculateSellThrough(
    unidades: number | null | undefined,
    stockTotal: number | null | undefined
): number | null {
    if (unidades == null || stockTotal == null) {
        return null;
    }
    const total = unidades + stockTotal;
    if (total === 0) return null;
    return (unidades / total) * 100;
}

/**
 * Calcula el stock-to-sales ratio
 * stock_to_sales = stock_total / unidades
 * @param stockTotal - Stock total actual
 * @param unidades - Unidades vendidas
 * @returns Stock-to-sales ratio o null si no se puede calcular
 */
export function calculateStockToSales(
    stockTotal: number | null | undefined,
    unidades: number | null | undefined
): number | null {
    return safeDivide(stockTotal, unidades);
}

/**
 * Calcula la variación porcentual entre dos valores
 * variacion = ((nuevo - anterior) / anterior) * 100
 * @param valorNuevo - Valor actual/nuevo
 * @param valorAnterior - Valor anterior/base
 * @returns Variación en porcentaje o null si no se puede calcular
 */
export function calculateVariation(
    valorNuevo: number | null | undefined,
    valorAnterior: number | null | undefined
): number | null {
    if (valorNuevo == null || valorAnterior == null || valorAnterior === 0) {
        return null;
    }
    return ((valorNuevo - valorAnterior) / valorAnterior) * 100;
}

/**
 * Calcula la participación porcentual
 * participacion = (valor / total) * 100
 * @param valor - Valor individual
 * @param total - Valor total
 * @returns Participación en porcentaje o null si no se puede calcular
 */
export function calculateParticipacion(
    valor: number | null | undefined,
    total: number | null | undefined
): number | null {
    if (valor == null || total == null || total === 0) {
        return null;
    }
    return (valor / total) * 100;
}

/**
 * Formatea un número para mostrar en UI, manejando nulos
 * @param value - Valor a formatear
 * @param decimals - Decimales a mostrar
 * @param defaultDisplay - Texto por defecto si el valor es null
 * @returns String formateado
 */
export function formatNumber(
    value: number | null | undefined,
    decimals: number = 0,
    defaultDisplay: string = '—'
): string {
    if (value == null) {
        return defaultDisplay;
    }
    return value.toLocaleString('es-AR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

/**
 * Formatea un valor como moneda
 * @param value - Valor a formatear
 * @param decimals - Decimales a mostrar
 * @param defaultDisplay - Texto por defecto si el valor es null
 * @returns String formateado con símbolo de moneda
 */
export function formatCurrency(
    value: number | null | undefined,
    decimals: number = 2,
    defaultDisplay: string = '—'
): string {
    if (value == null) {
        return defaultDisplay;
    }
    return `$${formatNumber(value, decimals)}`;
}

/**
 * Formatea un valor como porcentaje
 * @param value - Valor a formatear (ya en formato porcentaje, ej: 25.5 para 25.5%)
 * @param decimals - Decimales a mostrar
 * @param defaultDisplay - Texto por defecto si el valor es null
 * @returns String formateado con símbolo de porcentaje
 */
export function formatPercent(
    value: number | null | undefined,
    decimals: number = 1,
    defaultDisplay: string = '—'
): string {
    if (value == null) {
        return defaultDisplay;
    }
    return `${formatNumber(value, decimals)}%`;
}

/**
 * Valida que un número sea positivo, retornando null si no lo es
 * @param value - Valor a validar
 * @returns El valor si es positivo, null en caso contrario
 */
export function ensurePositive(value: number | null | undefined): number | null {
    if (value == null || value <= 0) {
        return null;
    }
    return value;
}

/**
 * Convierte un valor a número de forma segura
 * @param value - Valor a convertir
 * @returns Número o null si no se puede convertir
 */
export function toNumber(value: unknown): number | null {
    if (value == null) return null;
    const num = Number(value);
    return isNaN(num) ? null : num;
}
