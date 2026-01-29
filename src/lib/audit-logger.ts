/**
 * Audit Logger - Sistema de logs de auditoría para Text-to-SQL
 * Registra todas las consultas, resultados y errores
 */

import * as fs from 'fs';
import * as path from 'path';

export interface AuditLogEntry {
    id: string;
    timestamp: string;
    type: 'text-to-sql' | 'validation' | 'execution' | 'error';
    userId?: string;
    question?: string;
    sql?: string;
    executionMs?: number;
    rowCount?: number;
    tablesUsed?: string[];
    error?: string;
    warnings?: string[];
    filters?: Record<string, any>;
    ip?: string;
}

// Directorio de logs
const LOGS_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE_PREFIX = 'text-to-sql-audit';

// Buffer de logs en memoria para batch writing
let logBuffer: AuditLogEntry[] = [];
const BUFFER_FLUSH_SIZE = 10;
const BUFFER_FLUSH_INTERVAL_MS = 30000; // 30 segundos

// Intervalo de flush
let flushInterval: NodeJS.Timeout | null = null;

/**
 * Genera un ID único para cada entrada de log
 */
function generateLogId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Obtiene la ruta del archivo de log actual (por fecha)
 */
function getCurrentLogFilePath(): string {
    const date = new Date().toISOString().split('T')[0];
    return path.join(LOGS_DIR, `${LOG_FILE_PREFIX}-${date}.json`);
}

/**
 * Asegura que el directorio de logs exista
 */
function ensureLogsDirectory(): void {
    try {
        if (!fs.existsSync(LOGS_DIR)) {
            fs.mkdirSync(LOGS_DIR, { recursive: true });
        }
    } catch (error) {
        console.error('Error creating logs directory:', error);
    }
}

/**
 * Escribe los logs pendientes al archivo
 */
async function flushLogs(): Promise<void> {
    if (logBuffer.length === 0) return;

    const logsToWrite = [...logBuffer];
    logBuffer = [];

    try {
        ensureLogsDirectory();
        const filePath = getCurrentLogFilePath();

        // Read existing logs
        let existingLogs: AuditLogEntry[] = [];
        if (fs.existsSync(filePath)) {
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                existingLogs = JSON.parse(content);
            } catch (e) {
                // If file is corrupted, start fresh
                existingLogs = [];
            }
        }

        // Append new logs
        const allLogs = [...existingLogs, ...logsToWrite];

        // Write back
        fs.writeFileSync(filePath, JSON.stringify(allLogs, null, 2));

    } catch (error) {
        console.error('Error flushing audit logs:', error);
        // Put logs back in buffer for next attempt
        logBuffer = [...logsToWrite, ...logBuffer];
    }
}

/**
 * Inicia el intervalo de flush automático
 */
function startFlushInterval(): void {
    if (flushInterval) return;
    flushInterval = setInterval(() => {
        flushLogs().catch(console.error);
    }, BUFFER_FLUSH_INTERVAL_MS);
}

/**
 * Registra una entrada de auditoría
 */
export async function logAudit(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<string> {
    const logEntry: AuditLogEntry = {
        id: generateLogId(),
        timestamp: new Date().toISOString(),
        ...entry
    };

    logBuffer.push(logEntry);
    startFlushInterval();

    // Flush immediately if buffer is full
    if (logBuffer.length >= BUFFER_FLUSH_SIZE) {
        await flushLogs();
    }

    return logEntry.id;
}

/**
 * Registra una consulta Text-to-SQL exitosa
 */
export async function logTextToSQLQuery(params: {
    question: string;
    sql: string;
    executionMs: number;
    rowCount: number;
    tablesUsed: string[];
    warnings?: string[];
    filters?: Record<string, any>;
    userId?: string;
    ip?: string;
}): Promise<string> {
    return logAudit({
        type: 'text-to-sql',
        ...params
    });
}

/**
 * Registra un error
 */
export async function logTextToSQLError(params: {
    question?: string;
    sql?: string;
    error: string;
    userId?: string;
    ip?: string;
}): Promise<string> {
    return logAudit({
        type: 'error',
        ...params
    });
}

/**
 * Registra una validación de SQL
 */
export async function logSQLValidation(params: {
    sql: string;
    isValid: boolean;
    errors?: string[];
    warnings?: string[];
    userId?: string;
}): Promise<string> {
    return logAudit({
        type: 'validation',
        sql: params.sql,
        error: params.isValid ? undefined : params.errors?.join(', '),
        warnings: params.warnings,
        userId: params.userId
    });
}

/**
 * Obtiene los logs de un rango de fechas
 */
export async function getAuditLogs(params?: {
    startDate?: string;
    endDate?: string;
    type?: AuditLogEntry['type'];
    limit?: number;
}): Promise<AuditLogEntry[]> {
    // Flush pending logs first
    await flushLogs();

    try {
        ensureLogsDirectory();
        const files = fs.readdirSync(LOGS_DIR)
            .filter(f => f.startsWith(LOG_FILE_PREFIX) && f.endsWith('.json'))
            .sort()
            .reverse(); // Most recent first

        let allLogs: AuditLogEntry[] = [];

        for (const file of files) {
            // Check date range
            const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})/);
            if (dateMatch) {
                const fileDate = dateMatch[1];
                if (params?.startDate && fileDate < params.startDate) continue;
                if (params?.endDate && fileDate > params.endDate) continue;
            }

            const filePath = path.join(LOGS_DIR, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            const logs: AuditLogEntry[] = JSON.parse(content);

            // Filter by type
            const filtered = params?.type 
                ? logs.filter(l => l.type === params.type)
                : logs;

            allLogs = [...allLogs, ...filtered];

            // Check limit
            if (params?.limit && allLogs.length >= params.limit) {
                break;
            }
        }

        // Sort by timestamp descending and apply limit
        allLogs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        
        if (params?.limit) {
            allLogs = allLogs.slice(0, params.limit);
        }

        return allLogs;

    } catch (error) {
        console.error('Error reading audit logs:', error);
        return [];
    }
}

/**
 * Obtiene estadísticas de auditoría
 */
export async function getAuditStats(daysBack: number = 7): Promise<{
    totalQueries: number;
    totalErrors: number;
    avgExecutionMs: number;
    topTablesUsed: { table: string; count: number }[];
    queriesByDay: { date: string; count: number }[];
}> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const logs = await getAuditLogs({
        startDate: startDate.toISOString().split('T')[0]
    });

    const queries = logs.filter(l => l.type === 'text-to-sql');
    const errors = logs.filter(l => l.type === 'error');

    // Average execution time
    const execTimes = queries.map(q => q.executionMs).filter(t => t !== undefined) as number[];
    const avgExecutionMs = execTimes.length > 0 
        ? Math.round(execTimes.reduce((a, b) => a + b, 0) / execTimes.length)
        : 0;

    // Top tables
    const tableCount = new Map<string, number>();
    for (const q of queries) {
        for (const table of (q.tablesUsed || [])) {
            tableCount.set(table, (tableCount.get(table) || 0) + 1);
        }
    }
    const topTablesUsed = Array.from(tableCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([table, count]) => ({ table, count }));

    // Queries by day
    const dayCount = new Map<string, number>();
    for (const q of queries) {
        const day = q.timestamp.split('T')[0];
        dayCount.set(day, (dayCount.get(day) || 0) + 1);
    }
    const queriesByDay = Array.from(dayCount.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, count]) => ({ date, count }));

    return {
        totalQueries: queries.length,
        totalErrors: errors.length,
        avgExecutionMs,
        topTablesUsed,
        queriesByDay
    };
}

/**
 * Limpia logs antiguos (más de N días)
 */
export async function cleanOldLogs(daysToKeep: number = 30): Promise<number> {
    try {
        ensureLogsDirectory();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        const cutoffStr = cutoffDate.toISOString().split('T')[0];

        const files = fs.readdirSync(LOGS_DIR)
            .filter(f => f.startsWith(LOG_FILE_PREFIX) && f.endsWith('.json'));

        let deletedCount = 0;

        for (const file of files) {
            const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})/);
            if (dateMatch && dateMatch[1] < cutoffStr) {
                fs.unlinkSync(path.join(LOGS_DIR, file));
                deletedCount++;
            }
        }

        return deletedCount;

    } catch (error) {
        console.error('Error cleaning old logs:', error);
        return 0;
    }
}
