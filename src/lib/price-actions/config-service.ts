/**
 * Servicio de configuración para Price Actions
 * Lee y gestiona configuración desde la tabla PriceActionsConfig
 */

import { executeQuery } from '@/lib/db';
import { PriceActionsConfig, PriceBand } from '@/types/price-actions';
import sql from 'mssql';

/**
 * Obtiene una configuración por su clave
 */
export async function getConfig(key: string): Promise<PriceActionsConfig | null> {
    try {
        const result = await executeQuery(
            `SELECT * FROM PriceActionsConfig WHERE ConfigKey = @key`,
            [{ name: 'key', type: sql.NVarChar(100), value: key }]
        );

        if (result.recordset.length === 0) {
            return null;
        }

        const row = result.recordset[0];
        return {
            id: row.Id,
            configKey: row.ConfigKey,
            configValue: row.ConfigValue,
            configType: row.ConfigType,
            description: row.Description,
            category: row.Category,
            createdAt: row.CreatedAt,
            updatedAt: row.UpdatedAt
        };
    } catch (error) {
        console.error(`Error obteniendo configuración ${key}:`, error);
        return null;
    }
}

/**
 * Obtiene todas las configuraciones de una categoría
 */
export async function getConfigsByCategory(category: string): Promise<PriceActionsConfig[]> {
    try {
        const result = await executeQuery(
            `SELECT * FROM PriceActionsConfig WHERE Category = @category ORDER BY ConfigKey`,
            [{ name: 'category', type: sql.NVarChar(50), value: category }]
        );

        return result.recordset.map((row: any) => ({
            id: row.Id,
            configKey: row.ConfigKey,
            configValue: row.ConfigValue,
            configType: row.ConfigType,
            description: row.Description,
            category: row.Category,
            createdAt: row.CreatedAt,
            updatedAt: row.UpdatedAt
        }));
    } catch (error) {
        console.error(`Error obteniendo configuraciones de categoría ${category}:`, error);
        return [];
    }
}

/**
 * Obtiene las bandas de precio globales
 */
export async function getGlobalPriceBands(): Promise<PriceBand[]> {
    const config = await getConfig('price_bands_global');
    if (!config || config.configType !== 'json') {
        // Fallback a bandas por defecto
        return [
            { min: 0, max: 1490 },
            { min: 1491, max: 1790 },
            { min: 1791, max: 2090 },
            { min: 2091, max: 2490 },
            { min: 2491, max: 2990 },
            { min: 2991, max: 999999 }
        ];
    }

    try {
        const bands = JSON.parse(config.configValue) as PriceBand[];
        return bands;
    } catch (error) {
        console.error('Error parseando bandas de precio:', error);
        // Fallback
        return [
            { min: 0, max: 1490 },
            { min: 1491, max: 1790 },
            { min: 1791, max: 2090 },
            { min: 2091, max: 2490 },
            { min: 2491, max: 2990 },
            { min: 2991, max: 999999 }
        ];
    }
}

/**
 * Obtiene las bandas de precio para una categoría específica (si existe)
 * Si no existe, retorna las globales
 */
export async function getPriceBandsForCategory(categoryId: number): Promise<PriceBand[]> {
    const categoryConfig = await getConfig(`price_bands_category_${categoryId}`);
    if (categoryConfig && categoryConfig.configType === 'json') {
        try {
            return JSON.parse(categoryConfig.configValue) as PriceBand[];
        } catch (error) {
            console.error(`Error parseando bandas para categoría ${categoryId}:`, error);
        }
    }
    // Fallback a globales
    return getGlobalPriceBands();
}

/**
 * Obtiene un threshold numérico
 */
export async function getThreshold(key: string, defaultValue: number): Promise<number> {
    const config = await getConfig(key);
    if (!config || config.configType !== 'number') {
        return defaultValue;
    }

    const value = parseFloat(config.configValue);
    return isNaN(value) ? defaultValue : value;
}

/**
 * Obtiene el ciclo de venta por defecto
 */
export async function getDefaultCycleDays(): Promise<number> {
    return getThreshold('cycle_days_default', 90);
}

/**
 * Obtiene el ciclo de venta para una categoría específica (si existe)
 */
export async function getCycleDaysForCategory(categoryId: number): Promise<number> {
    const categoryConfig = await getConfig(`cycle_days_category_${categoryId}`);
    if (categoryConfig && categoryConfig.configType === 'number') {
        const value = parseFloat(categoryConfig.configValue);
        if (!isNaN(value)) {
            return value;
        }
    }
    return getDefaultCycleDays();
}

/**
 * Obtiene todos los thresholds relevantes
 */
export async function getThresholds() {
    return {
        earlyDays: await getThreshold('early_days_threshold', 10),
        indiceRitmoCritico: await getThreshold('indice_ritmo_critico', 0.6),
        indiceRitmoBajo: await getThreshold('indice_ritmo_bajo', 0.9),
        indiceRitmoAlto: await getThreshold('indice_ritmo_alto', 1.1),
        indiceDesaceleracion: await getThreshold('indice_desaceleracion', 0.7),
        diasStockAlerta: await getThreshold('dias_stock_alerta', 45),
        ritmoVentanaDias: await getThreshold('ritmo_ventana_dias', 14),
        elasticityFallback: await getThreshold('elasticity_fallback', -1.0),
        margenMinimoAceptable: await getConfig('margen_minimo_aceptable').then(c => {
            if (!c || c.configType !== 'number' || !c.configValue) {
                return null;
            }
            const value = parseFloat(c.configValue);
            return isNaN(value) ? null : value;
        })
    };
}

/**
 * Actualiza una configuración
 */
export async function updateConfig(
    key: string,
    value: string,
    configType: 'string' | 'number' | 'json' = 'string'
): Promise<boolean> {
    try {
        // Verificar si existe
        const existing = await getConfig(key);
        
        if (existing) {
            // Actualizar
            await executeQuery(
                `UPDATE PriceActionsConfig 
                 SET ConfigValue = @value, ConfigType = @type, UpdatedAt = GETDATE()
                 WHERE ConfigKey = @key`,
                [
                    { name: 'key', type: sql.NVarChar(100), value: key },
                    { name: 'value', type: sql.NVarChar(sql.MAX), value: value },
                    { name: 'type', type: sql.NVarChar(50), value: configType }
                ]
            );
        } else {
            // Insertar
            await executeQuery(
                `INSERT INTO PriceActionsConfig (ConfigKey, ConfigValue, ConfigType, CreatedAt, UpdatedAt)
                 VALUES (@key, @value, @type, GETDATE(), GETDATE())`,
                [
                    { name: 'key', type: sql.NVarChar(100), value: key },
                    { name: 'value', type: sql.NVarChar(sql.MAX), value: value },
                    { name: 'type', type: sql.NVarChar(50), value: configType }
                ]
            );
        }
        return true;
    } catch (error) {
        console.error(`Error actualizando configuración ${key}:`, error);
        return false;
    }
}
