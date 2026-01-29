/**
 * Deposito-Tienda Validator
 * Valida el mapeo entre IdDeposito (de MovStockTotalResumen) e IdTienda (de Tiendas)
 * 
 * Problema: MovStockTotalResumen usa IdDeposito pero no hay tabla de depósitos.
 * Asumimos inicialmente que IdDeposito == IdTienda, pero validamos esto.
 */

import { executeQuery } from './db';

export interface DepositoTiendaValidationResult {
    isValid: boolean;
    totalDepositosChecked: number;
    matchingDepositos: number;
    missingMappings: number[];
    warning: string | null;
    validatedAt: Date;
    mode: 'tienda' | 'deposito';
}

// Cache de validación (válido por 24 horas)
let cachedValidation: DepositoTiendaValidationResult | null = null;
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Valida el mapeo entre IdDeposito (MovStockTotalResumen) e IdTienda (Tiendas)
 * Toma una muestra de 20 IdDeposito distintos y verifica si existen en Tiendas
 * 
 * @param forceRefresh - Si true, ignora el caché y fuerza una nueva validación
 * @returns Resultado de la validación
 */
export async function validateDepositoTiendaMapping(
    forceRefresh: boolean = false
): Promise<DepositoTiendaValidationResult> {
    // Retornar caché si es válido
    if (!forceRefresh && cachedValidation) {
        const cacheAge = Date.now() - cachedValidation.validatedAt.getTime();
        if (cacheAge < CACHE_DURATION_MS) {
            return cachedValidation;
        }
    }

    try {
        // Obtener 20 IdDeposito distintos de MovStockTotalResumen
        const depositosQuery = `
            SELECT DISTINCT TOP 20 idDeposito
            FROM MovStockTotalResumen
            WHERE idDeposito IS NOT NULL
            ORDER BY idDeposito
        `;
        
        const depositosResult = await executeQuery(depositosQuery);
        const depositos = depositosResult.recordset.map((r: any) => r.idDeposito);
        
        if (depositos.length === 0) {
            const result: DepositoTiendaValidationResult = {
                isValid: false,
                totalDepositosChecked: 0,
                matchingDepositos: 0,
                missingMappings: [],
                warning: 'No se encontraron depósitos en MovStockTotalResumen',
                validatedAt: new Date(),
                mode: 'deposito'
            };
            cachedValidation = result;
            return result;
        }

        // Verificar cuáles existen en Tiendas
        const tiendasQuery = `
            SELECT IdTienda
            FROM Tiendas
            WHERE IdTienda IN (${depositos.join(',')})
        `;
        
        const tiendasResult = await executeQuery(tiendasQuery);
        const tiendasEncontradas = new Set(
            tiendasResult.recordset.map((r: any) => r.IdTienda)
        );

        // Calcular depósitos que no tienen mapeo
        const missingMappings = depositos.filter(
            (d: number) => !tiendasEncontradas.has(d)
        );

        const matchRate = tiendasEncontradas.size / depositos.length;
        const isValid = matchRate >= 0.8; // 80% de coincidencia mínima

        let warning: string | null = null;
        if (!isValid) {
            warning = `Falta mapeo Depósito→Tienda: ${missingMappings.length} de ${depositos.length} depósitos no tienen tienda asociada. ` +
                `El stock se mostrará por depósito en lugar de por tienda. ` +
                `Depósitos sin mapeo: ${missingMappings.slice(0, 5).join(', ')}${missingMappings.length > 5 ? '...' : ''}`;
        } else if (missingMappings.length > 0) {
            warning = `Aviso: ${missingMappings.length} depósito(s) sin tienda asociada: ${missingMappings.join(', ')}`;
        }

        const result: DepositoTiendaValidationResult = {
            isValid,
            totalDepositosChecked: depositos.length,
            matchingDepositos: tiendasEncontradas.size,
            missingMappings,
            warning,
            validatedAt: new Date(),
            mode: isValid ? 'tienda' : 'deposito'
        };

        cachedValidation = result;
        return result;

    } catch (error) {
        console.error('Error validating deposito-tienda mapping:', error);
        
        const result: DepositoTiendaValidationResult = {
            isValid: false,
            totalDepositosChecked: 0,
            matchingDepositos: 0,
            missingMappings: [],
            warning: `Error al validar mapeo: ${error instanceof Error ? error.message : 'Error desconocido'}`,
            validatedAt: new Date(),
            mode: 'deposito'
        };
        
        cachedValidation = result;
        return result;
    }
}

/**
 * Obtiene el resultado cacheado sin hacer una nueva validación
 * @returns Resultado cacheado o null si no hay caché
 */
export function getCachedValidation(): DepositoTiendaValidationResult | null {
    return cachedValidation;
}

/**
 * Limpia el caché de validación
 */
export function clearValidationCache(): void {
    cachedValidation = null;
}

/**
 * Obtiene los nombres de las tiendas/depósitos según el modo de validación
 * @param ids - Lista de IDs a buscar
 * @returns Mapa de ID a descripción
 */
export async function getLocationNames(
    ids: number[]
): Promise<Map<number, string>> {
    const result = new Map<number, string>();
    
    if (ids.length === 0) return result;

    try {
        const query = `
            SELECT IdTienda as id, Descripcion as nombre
            FROM Tiendas
            WHERE IdTienda IN (${ids.join(',')})
        `;
        
        const queryResult = await executeQuery(query);
        queryResult.recordset.forEach((r: any) => {
            result.set(r.id, r.nombre);
        });

        // Para IDs sin nombre, usar "Depósito X"
        ids.forEach(id => {
            if (!result.has(id)) {
                result.set(id, `Depósito ${id}`);
            }
        });

    } catch (error) {
        console.error('Error getting location names:', error);
        // Fallback: usar "Depósito X" para todos
        ids.forEach(id => {
            result.set(id, `Depósito ${id}`);
        });
    }

    return result;
}
