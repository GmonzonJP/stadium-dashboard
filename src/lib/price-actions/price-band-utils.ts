/**
 * Utilidades para manejo de bandas de precio
 */

import { PriceBand } from '@/types/price-actions';

/**
 * Obtiene la banda de precio a la que pertenece un precio dado
 */
export function getPriceBand(precio: number, bands: PriceBand[]): string {
    for (const band of bands) {
        if (precio >= band.min && precio <= band.max) {
            return `${band.min}-${band.max}`;
        }
    }
    // Si no encuentra banda, retornar la última o "unknown"
    if (bands.length > 0) {
        const lastBand = bands[bands.length - 1];
        if (precio > lastBand.max) {
            return `${lastBand.max + 1}+`;
        }
    }
    return 'unknown';
}

/**
 * Valida que una banda de precio sea válida (min < max)
 */
export function validatePriceBand(band: PriceBand): boolean {
    return band.min >= 0 && band.max > band.min;
}

/**
 * Valida que un array de bandas no tenga solapamientos y esté ordenado
 */
export function validatePriceBands(bands: PriceBand[]): { valid: boolean; error?: string } {
    if (bands.length === 0) {
        return { valid: false, error: 'Debe haber al menos una banda de precio' };
    }

    // Ordenar por min
    const sorted = [...bands].sort((a, b) => a.min - b.min);

    // Verificar que no haya solapamientos
    for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].max >= sorted[i + 1].min) {
            return {
                valid: false,
                error: `Las bandas se solapan: [${sorted[i].min}-${sorted[i].max}] y [${sorted[i + 1].min}-${sorted[i + 1].max}]`
            };
        }
    }

    // Verificar que todas las bandas sean válidas
    for (const band of sorted) {
        if (!validatePriceBand(band)) {
            return {
                valid: false,
                error: `Banda inválida: [${band.min}-${band.max}]`
            };
        }
    }

    return { valid: true };
}

/**
 * Parsea una cadena de banda de precio (ej: "0-1490") a objeto PriceBand
 */
export function parsePriceBandString(bandString: string): PriceBand | null {
    const match = bandString.match(/^(\d+)-(\d+)$/);
    if (!match) {
        return null;
    }
    const min = parseInt(match[1], 10);
    const max = parseInt(match[2], 10);
    if (isNaN(min) || isNaN(max) || min >= max) {
        return null;
    }
    return { min, max };
}

/**
 * Formatea una banda de precio para mostrar en UI
 */
export function formatPriceBand(band: PriceBand | string): string {
    if (typeof band === 'string') {
        return band;
    }
    if (band.max >= 999999) {
        return `$${band.min}+`;
    }
    return `$${band.min} - $${band.max}`;
}
