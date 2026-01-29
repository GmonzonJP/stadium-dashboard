/**
 * Test Script para StadiumGPT
 * Ejecutar con: npx ts-node scripts/test-stadiumgpt.ts
 */

import { validateSQL, executeSafeSQL, getDatabaseSchema } from '../src/lib/sql-generator';
import { buildChatContext, buildFilterConditions } from '../src/lib/chat-context';
import { checkOllamaHealth, listModels, chat, STADIUM_TOOLS, SYSTEM_PROMPT, ChatMessage } from '../src/lib/llm-service';

const COLORS = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

function log(message: string, color: string = COLORS.reset) {
    console.log(`${color}${message}${COLORS.reset}`);
}

function logSection(title: string) {
    console.log('\n' + '='.repeat(60));
    log(title, COLORS.cyan);
    console.log('='.repeat(60));
}

function logTest(name: string, passed: boolean, details?: string) {
    const icon = passed ? '✓' : '✗';
    const color = passed ? COLORS.green : COLORS.red;
    log(`${icon} ${name}`, color);
    if (details) {
        console.log(`  ${details}`);
    }
}

async function testSQLValidation() {
    logSection('TEST: SQL Validation');

    // Test 1: Valid SELECT
    const validSelect = validateSQL('SELECT * FROM transacciones WHERE Fecha > \'2024-01-01\'');
    logTest('Valid SELECT query', validSelect.isValid);

    // Test 2: Invalid - DROP statement
    const dropStatement = validateSQL('DROP TABLE transacciones');
    logTest('Block DROP statement', !dropStatement.isValid, dropStatement.error);

    // Test 3: Invalid - DELETE statement
    const deleteStatement = validateSQL('DELETE FROM transacciones WHERE 1=1');
    logTest('Block DELETE statement', !deleteStatement.isValid, deleteStatement.error);

    // Test 4: Invalid - INSERT statement
    const insertStatement = validateSQL('INSERT INTO transacciones VALUES (1,2,3)');
    logTest('Block INSERT statement', !insertStatement.isValid, insertStatement.error);

    // Test 5: Invalid - UPDATE statement
    const updateStatement = validateSQL('UPDATE transacciones SET Precio = 0');
    logTest('Block UPDATE statement', !updateStatement.isValid, updateStatement.error);

    // Test 6: Invalid - EXEC/stored procedure
    const execStatement = validateSQL('EXEC sp_help');
    logTest('Block EXEC statement', !execStatement.isValid, execStatement.error);

    // Test 7: Invalid - Multiple statements (SQL injection)
    const multiStatement = validateSQL('SELECT * FROM transacciones; DROP TABLE users;');
    logTest('Block multiple statements', !multiStatement.isValid, multiStatement.error);

    // Test 8: Valid - Complex SELECT with JOIN
    const complexSelect = validateSQL(`
        SELECT T.BaseCol, SUM(T.Cantidad) as Total
        FROM transacciones T
        LEFT JOIN Tiendas Ti ON Ti.IdTienda = T.IdDeposito
        WHERE T.Fecha >= '2024-01-01'
        GROUP BY T.BaseCol
        ORDER BY Total DESC
    `);
    logTest('Valid complex SELECT with JOIN', complexSelect.isValid);

    // Test 9: Invalid - xp_ system proc
    const xpStatement = validateSQL('SELECT * FROM xp_cmdshell');
    logTest('Block xp_ prefix', !xpStatement.isValid, xpStatement.error);

    // Test 10: Sanitization - removes comments
    const withComments = validateSQL('SELECT * FROM transacciones -- WHERE 1=1');
    logTest('Sanitize inline comments', withComments.isValid && !withComments.sanitizedQuery?.includes('--'));
}

async function testContextBuilder() {
    logSection('TEST: Context Builder');

    const testFilters = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        stores: [1, 2, 3],
        brands: [101, 102],
        categories: [],
        genders: [],
        suppliers: []
    };

    // Test 1: Build context
    const context = buildChatContext(testFilters);
    logTest('Context includes date range', context.includes('2024-01-01') && context.includes('2024-01-31'));
    
    // Test 2: Context includes schema
    logTest('Context includes database schema', context.includes('transacciones') && context.includes('UltimaCompra'));

    // Test 3: Build filter conditions
    const conditions = buildFilterConditions(testFilters);
    logTest('Filter conditions for stores', conditions.includes('IdDeposito IN (1,2,3)'));
    logTest('Filter conditions for brands', conditions.includes('IdMarca IN (101,102)'));

    // Test 4: Empty filters
    const emptyFilters = {
        startDate: '',
        endDate: '',
        stores: [],
        brands: []
    };
    const emptyConditions = buildFilterConditions(emptyFilters as any);
    logTest('Empty filters return 1=1', emptyConditions === '1=1');
}

async function testOllamaConnection() {
    logSection('TEST: Ollama Connection');

    // Test 1: Health check
    const isHealthy = await checkOllamaHealth();
    logTest('Ollama health check', isHealthy, isHealthy ? 'Ollama is running' : 'Ollama is NOT running');

    if (!isHealthy) {
        log('\n⚠️  Ollama no está corriendo. Ejecuta "ollama serve" y descarga un modelo con "ollama pull llama3.2"', COLORS.yellow);
        return false;
    }

    // Test 2: List models
    const models = await listModels();
    logTest('List available models', models.length > 0, `Models: ${models.join(', ') || 'None'}`);

    return true;
}

async function testChatFunctionality() {
    logSection('TEST: Chat Functionality');

    const ollamaAvailable = await testOllamaConnection();
    
    if (!ollamaAvailable) {
        log('\n⚠️  Saltando tests de chat porque Ollama no está disponible', COLORS.yellow);
        return;
    }

    // Test simple chat
    try {
        const messages: ChatMessage[] = [
            { role: 'system', content: 'Eres un asistente de prueba. Responde con "OK" si recibes este mensaje.' },
            { role: 'user', content: 'Test de conexión' }
        ];

        log('\nEnviando mensaje de prueba a Ollama...', COLORS.blue);
        const response = await chat(messages);
        
        logTest('Chat response received', !!response.message?.content, 
            `Response: ${response.message?.content?.substring(0, 100)}...`);
        
        logTest('Response has valid structure', 
            response.model !== undefined && response.done !== undefined);

    } catch (error) {
        logTest('Chat functionality', false, `Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
}

async function testToolDefinitions() {
    logSection('TEST: Tool Definitions');

    // Test 1: Tools are defined
    logTest('STADIUM_TOOLS is defined', Array.isArray(STADIUM_TOOLS) && STADIUM_TOOLS.length > 0, 
        `${STADIUM_TOOLS.length} tools defined`);

    // Test 2: Each tool has required properties
    const requiredTools = ['execute_sql_query', 'get_current_metrics', 'analyze_product', 'compare_periods', 'get_top_products', 'get_stock_alerts'];
    
    for (const toolName of requiredTools) {
        const tool = STADIUM_TOOLS.find(t => t.function.name === toolName);
        logTest(`Tool "${toolName}" exists`, !!tool);
        
        if (tool) {
            logTest(`Tool "${toolName}" has description`, !!tool.function.description);
            logTest(`Tool "${toolName}" has parameters`, !!tool.function.parameters);
        }
    }
}

async function testDatabaseQueries() {
    logSection('TEST: Database Queries (if connected)');

    try {
        // Test simple query execution
        const result = await executeSafeSQL('SELECT TOP 1 1 as test');
        
        if (result.success) {
            logTest('Database connection', true, 'Connected to SQL Server');
            logTest('Query execution', result.data?.length === 1);
            logTest('Execution time tracked', result.executionTime !== undefined, 
                `Execution time: ${result.executionTime}ms`);
        } else {
            logTest('Database connection', false, result.error);
        }

        // Test timeout
        log('\nTesting query timeout (should be fast)...', COLORS.blue);
        const timeoutTest = await executeSafeSQL('SELECT TOP 1 1 as test', 1000);
        logTest('Query with timeout', timeoutTest.success);

    } catch (error) {
        log(`\n⚠️  Database tests skipped: ${error instanceof Error ? error.message : 'Unknown error'}`, COLORS.yellow);
    }
}

async function runAllTests() {
    console.log('\n');
    log('╔════════════════════════════════════════════════════════════╗', COLORS.cyan);
    log('║           STADIUM GPT - TEST SUITE                          ║', COLORS.cyan);
    log('╚════════════════════════════════════════════════════════════╝', COLORS.cyan);

    await testSQLValidation();
    await testContextBuilder();
    await testToolDefinitions();
    await testOllamaConnection();
    await testChatFunctionality();
    await testDatabaseQueries();

    logSection('RESUMEN');
    log('\nPara usar StadiumGPT:', COLORS.blue);
    log('1. Instala Ollama: https://ollama.com', COLORS.reset);
    log('2. Ejecuta: ollama serve', COLORS.reset);
    log('3. Descarga un modelo: ollama pull llama3.2', COLORS.reset);
    log('4. Configura .env.local con:', COLORS.reset);
    log('   OLLAMA_BASE_URL=http://localhost:11434', COLORS.reset);
    log('   OLLAMA_MODEL=llama3.2', COLORS.reset);
    log('5. Inicia el dashboard: npm run dev', COLORS.reset);
    log('6. Accede a StadiumGPT desde el sidebar o el botón flotante', COLORS.reset);
    
    console.log('\n');
}

// Run tests
runAllTests().catch(console.error);
