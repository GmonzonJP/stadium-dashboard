/**
 * SQL Generator - Generador y validador de SQL inteligente
 * Convierte consultas del LLM en SQL seguro y las valida
 */

import { executeQuery } from './db';

// Palabras clave prohibidas en queries
// Palabras prohibidas que se verifican con límites de palabra
const FORBIDDEN_KEYWORDS = [
    'DROP', 'DELETE', 'INSERT', 'UPDATE', 'ALTER', 'CREATE', 'TRUNCATE',
    'EXEC', 'EXECUTE', 'GRANT', 'REVOKE', 'DENY', 'BACKUP', 'RESTORE',
    'SHUTDOWN', 'KILL', 'MERGE', 'BULK', 'OPENROWSET', 'OPENDATASOURCE'
];

// Patrones literales que se verifican con includes (no regex)
const FORBIDDEN_PATTERNS = [
    'xp_', 'sp_', 'fn_', '--', ';--', '/*', '*/'
];

// Tablas permitidas para consultas
const ALLOWED_TABLES = [
    'transacciones',
    'UltimaCompra',
    'ArticuloPrecio', 
    'MovStockTotalResumen',
    'Tiendas',
    'Usuarios'
];

export interface SQLValidationResult {
    isValid: boolean;
    error?: string;
    sanitizedQuery?: string;
}

export interface SQLExecutionResult {
    success: boolean;
    data?: any[];
    rowCount?: number;
    error?: string;
    executionTime?: number;
}

/**
 * Valida que una query SQL sea segura para ejecutar
 */
export function validateSQL(query: string): SQLValidationResult {
    if (!query || typeof query !== 'string') {
        return { isValid: false, error: 'Query vacía o inválida' };
    }

    const upperQuery = query.toUpperCase().trim();

    // Verificar que sea SELECT
    if (!upperQuery.startsWith('SELECT')) {
        return { isValid: false, error: 'Solo se permiten consultas SELECT' };
    }

    // Verificar palabras prohibidas (con límites de palabra)
    for (const keyword of FORBIDDEN_KEYWORDS) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (regex.test(query)) {
            return { isValid: false, error: `Palabra clave prohibida detectada: ${keyword}` };
        }
    }

    // Verificar patrones literales prohibidos (sin regex, usando includes)
    for (const pattern of FORBIDDEN_PATTERNS) {
        if (query.includes(pattern)) {
            return { isValid: false, error: `Patrón prohibido detectado: ${pattern}` };
        }
    }

    // Verificar caracteres peligrosos de inyección
    if (query.includes(';') && query.indexOf(';') < query.length - 1) {
        return { isValid: false, error: 'No se permiten múltiples sentencias SQL' };
    }

    // Sanitizar la query (remover comentarios inline)
    let sanitizedQuery = query
        .replace(/--.*$/gm, '') // Comentarios de línea
        .replace(/\/\*[\s\S]*?\*\//g, '') // Comentarios de bloque
        .trim();

    // Remover punto y coma final si existe
    if (sanitizedQuery.endsWith(';')) {
        sanitizedQuery = sanitizedQuery.slice(0, -1).trim();
    }

    return { isValid: true, sanitizedQuery };
}

/**
 * Ejecuta una query SQL validada con timeout
 */
export async function executeSafeSQL(
    query: string,
    timeoutMs: number = 30000
): Promise<SQLExecutionResult> {
    // Validar primero
    const validation = validateSQL(query);
    if (!validation.isValid) {
        return { success: false, error: validation.error };
    }

    const sanitizedQuery = validation.sanitizedQuery!;
    const startTime = Date.now();

    try {
        // Agregar TOP si no existe para limitar resultados
        let limitedQuery = sanitizedQuery;
        if (!sanitizedQuery.toUpperCase().includes('TOP ')) {
            limitedQuery = sanitizedQuery.replace(
                /^SELECT\s+/i,
                'SELECT TOP 1000 '
            );
        }

        // Ejecutar con timeout usando Promise.race
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Query timeout: excedió el límite de tiempo')), timeoutMs);
        });

        const queryPromise = executeQuery(limitedQuery);
        const result = await Promise.race([queryPromise, timeoutPromise]);

        const executionTime = Date.now() - startTime;

        return {
            success: true,
            data: result.recordset,
            rowCount: result.recordset?.length || 0,
            executionTime
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido al ejecutar query',
            executionTime: Date.now() - startTime
        };
    }
}

/**
 * Genera el esquema de la base de datos para el contexto del LLM
 */
export function getDatabaseSchema(): string {
    return `
## Tablas Disponibles:

### transacciones
Tabla principal de ventas/transacciones.
Columnas:
- Fecha (date): Fecha de la transacción
- IdDeposito (int): ID de la tienda/depósito
- IdMarca (int): ID de la marca
- DescripcionMarca (varchar): Nombre de la marca
- IdClase (int): ID de la clase/categoría
- DescripcionClase (varchar): Nombre de la clase
- idGenero (int): ID del género
- DescripcionGenero (varchar): Nombre del género (Hombre, Mujer, Niño, etc.)
- idProveedor (int): ID del proveedor
- NombreProveedor (varchar): Nombre del proveedor
- BaseCol (varchar(13)): Código base del producto (primeros 13 caracteres)
- Descripcion (varchar): Descripción completa del producto
- DescripcionCorta (varchar): Descripción corta
- Cantidad (int): Cantidad vendida (puede ser negativa para devoluciones)
- Precio (decimal): Precio de venta
- Talla (varchar): Talla del producto

### UltimaCompra
Información del último costo de compra.
Columnas:
- BaseArticulo (varchar): Código del artículo
- UltimoCosto (decimal): Último costo de compra
- FechaUltimaCompra (date): Fecha de última compra
- CantidadUltimaCompra (int): Cantidad de última compra

### ArticuloPrecio
Precios de lista de productos.
Columnas:
- IdArticulo (varchar): Código del artículo
- Precio (decimal): Precio de lista (PVP)

### MovStockTotalResumen
Stock actual por artículo.
Columnas:
- IdArticulo (varchar): Código del artículo
- TotalStock (int): Stock total disponible
- Pendiente (int): Stock pendiente de recibir

### Tiendas
Catálogo de tiendas/depósitos.
Columnas:
- IdTienda (int): ID de la tienda
- Descripcion (varchar): Nombre de la tienda

## Notas Importantes:
- BaseCol en Transacciones = Base en Articulos (código base del producto, longitud variable)
- Para relacionar tablas con IdArticulo (UltimaCompra, MovStockTotalResumen), usar JOIN con Articulos para obtener Base
- Los costos tienen un factor de 1.22 (IVA incluido)
- Margen = (Precio - Costo) / Costo * 100
- Markup = (Precio - Costo) / Costo * 100
`;
}

/**
 * Ejemplos de queries comunes para ayudar al LLM
 */
export function getQueryExamples(): string {
    return `
## Ejemplos de Consultas SQL Válidas:

### Ventas por marca (últimos 30 días):
SELECT 
    DescripcionMarca as Marca,
    SUM(Cantidad) as Unidades,
    CAST(SUM(Precio) as decimal(18,2)) as Ventas
FROM Transacciones
WHERE Fecha >= DATEADD(DAY, -30, GETDATE())
AND Cantidad > 0
GROUP BY DescripcionMarca
ORDER BY Ventas DESC

### Top 10 productos más vendidos:
SELECT TOP 10
    BaseCol,
    MAX(Descripcion) as Producto,
    MAX(DescripcionMarca) as Marca,
    SUM(Cantidad) as UnidadesVendidas,
    CAST(SUM(Precio) as decimal(18,2)) as VentaTotal
FROM Transacciones
WHERE Fecha >= DATEADD(DAY, -30, GETDATE())
AND Cantidad > 0
GROUP BY BaseCol
ORDER BY UnidadesVendidas DESC

### Stock actual de una marca (usando JOIN con Articulos):
SELECT 
    A.Base as BaseCol,
    SUM(MS.TotalStock) as Stock
FROM MovStockTotalResumen MS
INNER JOIN Articulos A ON A.IdArticulo = MS.IdArticulo
WHERE A.IdMarca = 1 -- ID de marca
GROUP BY A.Base
HAVING SUM(MS.TotalStock) > 0

### Ventas por tienda:
SELECT 
    T.IdDeposito,
    Ti.Descripcion as Tienda,
    SUM(T.Cantidad) as Unidades,
    CAST(SUM(T.Precio) as decimal(18,2)) as Ventas
FROM Transacciones T
LEFT JOIN Tiendas Ti ON Ti.IdTienda = T.IdDeposito
WHERE T.Fecha >= DATEADD(DAY, -7, GETDATE())
GROUP BY T.IdDeposito, Ti.Descripcion
ORDER BY Ventas DESC

### Análisis de margen por producto (usando JOIN con Articulos para costos):
SELECT TOP 20
    T.BaseCol,
    MAX(T.DescripcionArticulo) as Producto,
    SUM(T.Cantidad) as Unidades,
    CAST(SUM(T.Precio) as decimal(18,2)) as Venta,
    CAST(SUM(CAST(T.Cantidad as decimal(18,2)) * (1.22 * ISNULL(UC.ultimoCosto, 0))) as decimal(18,2)) as Costo,
    CASE 
        WHEN SUM(T.Precio) > 0 
        THEN CAST(((SUM(T.Precio) - SUM(CAST(T.Cantidad as decimal(18,2)) * (1.22 * ISNULL(UC.ultimoCosto, 0)))) / SUM(T.Precio)) * 100 as decimal(5,2))
        ELSE 0
    END as MargenPct
FROM Transacciones T
LEFT JOIN (
    SELECT A.Base as BaseCol, MAX(UC.UltimoCosto) as ultimoCosto 
    FROM UltimaCompra UC
    INNER JOIN Articulos A ON A.IdArticulo = UC.BaseArticulo
    GROUP BY A.Base
) UC ON UC.BaseCol = T.BaseCol
WHERE T.Fecha >= DATEADD(DAY, -30, GETDATE())
AND T.Cantidad > 0
GROUP BY T.BaseCol
HAVING SUM(T.Cantidad) >= 5
ORDER BY MargenPct DESC
`;
}
