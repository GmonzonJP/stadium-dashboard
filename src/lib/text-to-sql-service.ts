/**
 * Text-to-SQL Service
 * Servicio para generar SQL a partir de preguntas en lenguaje natural
 * con guardrails de seguridad, validación y retrieval de esquema
 */

import * as fs from 'fs';
import * as path from 'path';
import { chat, ChatMessage, checkOllamaHealth } from './llm-service';
import { executeQuery } from './db';

// ============================================================================
// TIPOS
// ============================================================================

export interface TableSchema {
    schemaName: string;
    tableName: string;
    columns: ColumnSchema[];
    description?: string;
    isAllowed: boolean;
}

export interface ColumnSchema {
    name: string;
    dataType: string;
    maxLength: number;
    precision: number;
    scale: number;
    isNullable: boolean;
    isIdentity: boolean;
    isPrimaryKey: boolean;
    order: number;
}

export interface SchemaCache {
    tables: TableSchema[];
    loadedAt: Date;
    csvPath: string;
}

export interface TextToSQLRequest {
    question: string;
    filters?: {
        startDate?: string;
        endDate?: string;
        tiendas?: number[];
        marcas?: number[];
    };
    mode: 'table' | 'summary';
}

export interface TextToSQLResponse {
    sql: string;
    resultPreview: any[];
    explanation: string;
    meta: {
        tablesUsed: string[];
        executionMs: number;
        rowCount: number;
        warnings: string[];
        queryLimited: boolean;
    };
}

export interface SQLValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    sanitizedSQL?: string;
}

// ============================================================================
// CONSTANTES
// ============================================================================

// Tablas permitidas para consultas
const ALLOWED_TABLES = new Set([
    'transacciones',
    'ultimacompra',
    'articuloprecio',
    'movstocktotalresumen',
    'tiendas',
    'articulos',
    'colores'
]);

// Palabras clave prohibidas (case-insensitive)
const FORBIDDEN_KEYWORDS = [
    'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE',
    'EXEC', 'EXECUTE', 'GRANT', 'REVOKE', 'DENY', 'BACKUP', 'RESTORE',
    'SHUTDOWN', 'KILL', 'MERGE', 'BULK', 'OPENROWSET', 'OPENDATASOURCE',
    'sp_', 'xp_', 'fn_', 'DBCC', 'WAITFOR', 'RECONFIGURE'
];

// Límite de filas por defecto
const DEFAULT_ROW_LIMIT = 500;
const MAX_ROW_LIMIT = 1000;

// Timeout de query en milisegundos
const QUERY_TIMEOUT_MS = 15000;

// ============================================================================
// CACHE DE ESQUEMA
// ============================================================================

let schemaCache: SchemaCache | null = null;

/**
 * Carga el esquema desde el archivo CSV
 */
export async function loadSchemaFromCSV(csvPath?: string): Promise<TableSchema[]> {
    const defaultPath = path.join(process.cwd(), 'tablas anysys.csv');
    const filePath = csvPath || defaultPath;

    // Si tenemos cache válido (menos de 1 hora), usarlo
    if (schemaCache && schemaCache.csvPath === filePath) {
        const cacheAge = Date.now() - schemaCache.loadedAt.getTime();
        if (cacheAge < 60 * 60 * 1000) {
            return schemaCache.tables;
        }
    }

    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());
        
        // Skip header
        const dataLines = lines.slice(1);
        
        // Parse CSV
        const tableMap = new Map<string, TableSchema>();
        
        for (const line of dataLines) {
            const cols = parseCSVLine(line);
            if (cols.length < 11) continue;

            const [schemaName, tableName, columnOrder, columnName, dataType, 
                   maxLength, precision, scale, isNullable, isIdentity, isPrimaryKey] = cols;
            
            const fullTableName = `${schemaName}.${tableName}`;
            
            if (!tableMap.has(fullTableName)) {
                tableMap.set(fullTableName, {
                    schemaName,
                    tableName,
                    columns: [],
                    isAllowed: ALLOWED_TABLES.has(tableName.toLowerCase())
                });
            }
            
            const table = tableMap.get(fullTableName)!;
            table.columns.push({
                name: columnName,
                dataType,
                maxLength: parseInt(maxLength) || 0,
                precision: parseInt(precision) || 0,
                scale: parseInt(scale) || 0,
                isNullable: isNullable === '1',
                isIdentity: isIdentity === '1',
                isPrimaryKey: isPrimaryKey === '1',
                order: parseInt(columnOrder) || 0
            });
        }

        // Sort columns by order
        for (const table of Array.from(tableMap.values())) {
            table.columns.sort((a, b) => a.order - b.order);
        }

        const tables = Array.from(tableMap.values());
        
        // Update cache
        schemaCache = {
            tables,
            loadedAt: new Date(),
            csvPath: filePath
        };

        return tables;

    } catch (error) {
        console.error('Error loading schema CSV:', error);
        throw new Error(`No se pudo cargar el esquema desde ${filePath}: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
}

/**
 * Parsea una línea CSV manejando comillas
 */
function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    
    return result;
}

/**
 * Obtiene solo las tablas permitidas
 */
export function getAllowedTables(tables: TableSchema[]): TableSchema[] {
    return tables.filter(t => t.isAllowed);
}

/**
 * Busca tablas/columnas relevantes para una pregunta
 */
export function retrieveRelevantTables(
    question: string, 
    tables: TableSchema[]
): TableSchema[] {
    const questionLower = question.toLowerCase();
    const relevantTables: TableSchema[] = [];
    const scores = new Map<string, number>();

    // Keywords por tabla
    const tableKeywords: Record<string, string[]> = {
        'transacciones': ['venta', 'ventas', 'vendido', 'cantidad', 'precio', 'unidades', 'importe', 'fecha', 'tienda', 'marca', 'producto', 'categoría', 'género', 'proveedor'],
        'ultimacompra': ['compra', 'costo', 'última', 'proveedor', 'cantidad comprada'],
        'articuloprecio': ['precio', 'pvp', 'precio lista'],
        'movstocktotalresumen': ['stock', 'inventario', 'existencia', 'disponible', 'pendiente'],
        'tiendas': ['tienda', 'sucursal', 'local', 'depósito'],
        'articulos': ['artículo', 'producto', 'descripción', 'talla', 'color', 'marca']
    };

    const allowedTables = getAllowedTables(tables);

    for (const table of allowedTables) {
        const tableNameLower = table.tableName.toLowerCase();
        let score = 0;

        // Check table name match
        if (questionLower.includes(tableNameLower)) {
            score += 10;
        }

        // Check column name matches
        for (const col of table.columns) {
            if (questionLower.includes(col.name.toLowerCase())) {
                score += 5;
            }
        }

        // Check keyword matches
        const keywords = tableKeywords[tableNameLower] || [];
        for (const keyword of keywords) {
            if (questionLower.includes(keyword)) {
                score += 3;
            }
        }

        if (score > 0) {
            scores.set(tableNameLower, score);
            relevantTables.push(table);
        }
    }

    // Sort by relevance score
    relevantTables.sort((a, b) => {
        const scoreA = scores.get(a.tableName.toLowerCase()) || 0;
        const scoreB = scores.get(b.tableName.toLowerCase()) || 0;
        return scoreB - scoreA;
    });

    // Si no encontramos relevantes, incluir Transacciones por defecto
    if (relevantTables.length === 0) {
        const transacciones = allowedTables.find(t => t.tableName.toLowerCase() === 'transacciones');
        if (transacciones) {
            relevantTables.push(transacciones);
        }
    }

    // Limitar a las 4 tablas más relevantes
    return relevantTables.slice(0, 4);
}

// ============================================================================
// VALIDACIÓN SQL
// ============================================================================

/**
 * Valida una consulta SQL
 */
export function validateSQL(sql: string): SQLValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!sql || typeof sql !== 'string') {
        return { isValid: false, errors: ['SQL vacío o inválido'], warnings: [] };
    }

    const sqlUpper = sql.toUpperCase().trim();
    const sqlClean = sql.trim();

    // Must start with SELECT
    if (!sqlUpper.startsWith('SELECT')) {
        errors.push('Solo se permiten consultas SELECT');
    }

    // Check forbidden keywords
    for (const keyword of FORBIDDEN_KEYWORDS) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (regex.test(sql)) {
            errors.push(`Palabra clave prohibida: ${keyword}`);
        }
    }

    // Check for multiple statements
    const statements = sqlClean.split(';').filter(s => s.trim());
    if (statements.length > 1) {
        errors.push('No se permiten múltiples sentencias SQL');
    }

    // Check for dangerous patterns
    if (sql.includes('--') || sql.includes('/*') || sql.includes('*/')) {
        warnings.push('Se detectaron comentarios SQL que serán removidos');
    }

    // Check for UNION (potential SQL injection)
    if (/\bUNION\b/i.test(sql)) {
        warnings.push('UNION detectado - revisar que sea intencional');
    }

    // Sanitize
    let sanitizedSQL = sqlClean
        .replace(/--.*$/gm, '')         // Remove line comments
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
        .trim();

    // Remove trailing semicolon
    if (sanitizedSQL.endsWith(';')) {
        sanitizedSQL = sanitizedSQL.slice(0, -1).trim();
    }

    // Add TOP if not present
    if (!sanitizedSQL.toUpperCase().includes('TOP ')) {
        sanitizedSQL = sanitizedSQL.replace(
            /^SELECT\s+/i,
            `SELECT TOP ${DEFAULT_ROW_LIMIT} `
        );
        warnings.push(`Se agregó límite TOP ${DEFAULT_ROW_LIMIT}`);
    } else {
        // Validate existing TOP is not too high
        const topMatch = sanitizedSQL.match(/TOP\s+(\d+)/i);
        if (topMatch) {
            const topValue = parseInt(topMatch[1]);
            if (topValue > MAX_ROW_LIMIT) {
                sanitizedSQL = sanitizedSQL.replace(
                    /TOP\s+\d+/i,
                    `TOP ${MAX_ROW_LIMIT}`
                );
                warnings.push(`Límite reducido de ${topValue} a ${MAX_ROW_LIMIT}`);
            }
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        sanitizedSQL: errors.length === 0 ? sanitizedSQL : undefined
    };
}

// ============================================================================
// GENERACIÓN SQL CON LLM
// ============================================================================

/**
 * Genera el prompt para el LLM
 */
function buildSQLPrompt(
    question: string,
    relevantTables: TableSchema[],
    filters?: TextToSQLRequest['filters']
): string {
    // Build schema section
    let schemaSection = '## TABLAS DISPONIBLES:\n\n';
    
    for (const table of relevantTables) {
        schemaSection += `### ${table.schemaName}.${table.tableName}\n`;
        schemaSection += `Columnas:\n`;
        for (const col of table.columns) {
            schemaSection += `- ${col.name} (${col.dataType}${col.isPrimaryKey ? ', PK' : ''})\n`;
        }
        schemaSection += '\n';
    }

    // Build filter hints
    let filterHints = '';
    if (filters) {
        filterHints = '\n## FILTROS A APLICAR:\n';
        if (filters.startDate) filterHints += `- Fecha desde: ${filters.startDate}\n`;
        if (filters.endDate) filterHints += `- Fecha hasta: ${filters.endDate}\n`;
        if (filters.tiendas?.length) filterHints += `- Tiendas: ${filters.tiendas.join(', ')}\n`;
        if (filters.marcas?.length) filterHints += `- Marcas: ${filters.marcas.join(', ')}\n`;
    }

    return `Eres un experto en SQL Server. Genera SOLO la consulta SQL, sin explicaciones.

${schemaSection}
## RELACIONES CONOCIDAS:
- Transacciones.BaseCol = Articulos.Base (código base del producto)
- Para UltimaCompra: JOIN Articulos A ON A.IdArticulo = UltimaCompra.BaseArticulo, luego usar A.Base para relacionar con Transacciones.BaseCol
- Para MovStockTotalResumen: JOIN Articulos A ON A.IdArticulo = MovStockTotalResumen.IdArticulo, luego usar A.Base para relacionar con Transacciones.BaseCol
- Transacciones.IdDeposito = Tiendas.IdTienda
- Los costos en UltimaCompra no incluyen IVA (multiplicar por 1.22)
- IMPORTANTE: NO usar SUBSTRING para obtener código base, usar JOIN con Articulos
${filterHints}
## REGLAS:
1. SOLO consultas SELECT
2. Siempre incluir TOP para limitar resultados
3. Usar alias claros para las columnas
4. Agrupar cuando sea necesario (GROUP BY)
5. Formatear números con CAST(... as decimal(18,2))
6. Para stock, SIEMPRE usar MovStockTotalResumen

## PREGUNTA:
${question}

## SQL:`;
}

/**
 * Genera SQL a partir de una pregunta usando el LLM
 */
export async function generateSQL(
    question: string,
    relevantTables: TableSchema[],
    filters?: TextToSQLRequest['filters']
): Promise<{ sql: string; explanation: string }> {
    // Check Ollama availability
    const isHealthy = await checkOllamaHealth();
    if (!isHealthy) {
        throw new Error('Servicio LLM no disponible');
    }

    const prompt = buildSQLPrompt(question, relevantTables, filters);

    const messages: ChatMessage[] = [
        { role: 'user', content: prompt }
    ];

    const response = await chat(messages, undefined, {
        temperature: 0.1, // Low temperature for deterministic SQL
        max_tokens: 1024
    });

    // Extract SQL from response
    let sql = response.message.content.trim();
    
    // Remove markdown code blocks if present
    if (sql.startsWith('```sql')) {
        sql = sql.replace(/^```sql\n?/, '').replace(/\n?```$/, '');
    } else if (sql.startsWith('```')) {
        sql = sql.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    return {
        sql: sql.trim(),
        explanation: `Consulta generada para: "${question}"`
    };
}

// ============================================================================
// EJECUCIÓN SEGURA
// ============================================================================

/**
 * Ejecuta una consulta SQL validada con timeout
 */
export async function executeValidatedSQL(
    sql: string,
    timeoutMs: number = QUERY_TIMEOUT_MS
): Promise<{ data: any[]; rowCount: number; executionMs: number }> {
    const validation = validateSQL(sql);
    
    if (!validation.isValid) {
        throw new Error(`SQL inválido: ${validation.errors.join(', ')}`);
    }

    const sanitizedSQL = validation.sanitizedSQL!;
    const startTime = Date.now();

    try {
        // Execute with timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error(`Query timeout: excedió ${timeoutMs}ms`)), timeoutMs);
        });

        const queryPromise = executeQuery(sanitizedSQL);
        const result = await Promise.race([queryPromise, timeoutPromise]);

        const executionMs = Date.now() - startTime;

        return {
            data: result.recordset || [],
            rowCount: result.recordset?.length || 0,
            executionMs
        };

    } catch (error) {
        const executionMs = Date.now() - startTime;
        console.error('Error executing SQL:', error);
        throw new Error(`Error ejecutando query (${executionMs}ms): ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
}

// ============================================================================
// API PRINCIPAL
// ============================================================================

/**
 * Procesa una solicitud Text-to-SQL completa
 */
export async function processTextToSQL(
    request: TextToSQLRequest
): Promise<TextToSQLResponse> {
    const warnings: string[] = [];
    const startTime = Date.now();

    try {
        // 1. Load schema
        const tables = await loadSchemaFromCSV();
        
        // 2. Find relevant tables
        const relevantTables = retrieveRelevantTables(request.question, tables);
        
        if (relevantTables.length === 0) {
            throw new Error('No se encontraron tablas relevantes para la pregunta');
        }

        // 3. Generate SQL with LLM
        const { sql, explanation } = await generateSQL(
            request.question,
            relevantTables,
            request.filters
        );

        // 4. Validate SQL
        const validation = validateSQL(sql);
        
        if (!validation.isValid) {
            throw new Error(`SQL generado inválido: ${validation.errors.join(', ')}`);
        }

        warnings.push(...validation.warnings);

        // 5. Execute SQL
        const { data, rowCount, executionMs } = await executeValidatedSQL(
            validation.sanitizedSQL!
        );

        // 6. Determine if limited
        const queryLimited = rowCount >= DEFAULT_ROW_LIMIT;
        if (queryLimited) {
            warnings.push(`Resultados limitados a ${DEFAULT_ROW_LIMIT} filas`);
        }

        // 7. Build response
        const tablesUsed = relevantTables.map(t => `${t.schemaName}.${t.tableName}`);

        return {
            sql: validation.sanitizedSQL!,
            resultPreview: request.mode === 'summary' ? data.slice(0, 10) : data,
            explanation,
            meta: {
                tablesUsed,
                executionMs,
                rowCount,
                warnings,
                queryLimited
            }
        };

    } catch (error) {
        const executionMs = Date.now() - startTime;
        throw new Error(`Error procesando solicitud (${executionMs}ms): ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
}

/**
 * Obtiene el esquema para mostrar al usuario
 */
export async function getSchemaForDisplay(): Promise<{
    allowedTables: { name: string; columns: string[]; description?: string }[];
    totalTables: number;
}> {
    const tables = await loadSchemaFromCSV();
    const allowed = getAllowedTables(tables);

    return {
        allowedTables: allowed.map(t => ({
            name: `${t.schemaName}.${t.tableName}`,
            columns: t.columns.map(c => `${c.name} (${c.dataType})`),
            description: t.description
        })),
        totalTables: tables.length
    };
}
