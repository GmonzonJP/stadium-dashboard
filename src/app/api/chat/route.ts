/**
 * Chat API Route - StadiumGPT
 * Endpoint para chat con LLM conectado al Data Warehouse
 * Streaming con Server-Sent Events, sin dependencias de Vercel
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
    chat, 
    chatStream, 
    createTextStream, 
    checkOllamaHealth,
    ChatMessage, 
    STADIUM_TOOLS, 
    SYSTEM_PROMPT,
    OllamaResponse
} from '@/lib/llm-service';
import { executeSafeSQL, validateSQL } from '@/lib/sql-generator';
import { buildChatContext, buildFilterConditions } from '@/lib/chat-context';
import { executeQuery } from '@/lib/db';
import { FilterParams, FilterData } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Detecta expresiones temporales en la pregunta del usuario
 * y ajusta los filtros de fecha correspondientes
 */
function parseTemporalExpression(question: string, filters: FilterParams): FilterParams {
    const q = question.toLowerCase();
    const today = new Date();
    
    // Patrones para "últimos X días"
    const diasMatch = q.match(/(?:últimos?|ultimos?|pasados?)\s*(\d+)\s*(?:días?|dias?)/i);
    if (diasMatch) {
        const dias = parseInt(diasMatch[1], 10);
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - dias);
        return {
            ...filters,
            startDate: startDate.toISOString().split('T')[0],
            endDate: today.toISOString().split('T')[0]
        };
    }
    
    // Patrones para "última semana" / "últimas X semanas"
    const semanasMatch = q.match(/(?:últimas?|ultimas?|pasadas?)\s*(\d+)?\s*semanas?/i);
    if (semanasMatch) {
        const semanas = semanasMatch[1] ? parseInt(semanasMatch[1], 10) : 1;
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - (semanas * 7));
        return {
            ...filters,
            startDate: startDate.toISOString().split('T')[0],
            endDate: today.toISOString().split('T')[0]
        };
    }
    
    // Patrones para "último mes" / "últimos X meses"
    const mesesMatch = q.match(/(?:últimos?|ultimos?|pasados?)\s*(\d+)?\s*mes(?:es)?/i);
    if (mesesMatch) {
        const meses = mesesMatch[1] ? parseInt(mesesMatch[1], 10) : 1;
        const startDate = new Date(today);
        startDate.setMonth(startDate.getMonth() - meses);
        return {
            ...filters,
            startDate: startDate.toISOString().split('T')[0],
            endDate: today.toISOString().split('T')[0]
        };
    }
    
    // Patrones para "este mes"
    if (q.includes('este mes')) {
        const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        return {
            ...filters,
            startDate: startDate.toISOString().split('T')[0],
            endDate: today.toISOString().split('T')[0]
        };
    }
    
    // Patrones para "este año" o "año actual"
    if (q.includes('este año') || q.includes('año actual')) {
        const startDate = new Date(today.getFullYear(), 0, 1);
        return {
            ...filters,
            startDate: startDate.toISOString().split('T')[0],
            endDate: today.toISOString().split('T')[0]
        };
    }
    
    // Patrones para "ayer"
    if (q.includes('ayer')) {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().split('T')[0];
        return {
            ...filters,
            startDate: dateStr,
            endDate: dateStr
        };
    }
    
    // Patrones para "hoy"
    if (q.match(/\bhoy\b/)) {
        const dateStr = today.toISOString().split('T')[0];
        return {
            ...filters,
            startDate: dateStr,
            endDate: dateStr
        };
    }
    
    // Si el período del dashboard es de un solo día y es hoy, extender a 30 días por defecto
    if (filters.startDate === filters.endDate) {
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 30);
        console.log('Auto-extending single-day filter to 30 days');
        return {
            ...filters,
            startDate: startDate.toISOString().split('T')[0],
            endDate: today.toISOString().split('T')[0]
        };
    }
    
    return filters;
}

interface DashboardSnapshot {
    periodo: { inicio: string; fin: string };
    filtrosActivos: {
        tiendas: string[] | string;
        marcas: string[] | string;
        categorias: string[] | string;
        generos: string[] | string;
    };
    metricas: {
        periodoActual: { ventas: number; unidades: number; margen: number | null; markup: number | null };
        periodoAnterior: { ventas: number; unidades: number };
        variacionVsAnoAnterior: { ventas: number | null; unidades: number | null };
        ytd: { ventas: number; unidades: number; margen: number | null };
        stock: number;
    } | null;
    comparacionSemanal: {
        semanaActual: number;
        semanaAnterior: number;
        variacion: number | null;
    } | null;
    topMarcas: Array<{ marca: string; ventas: number; unidades: number; margen: number | null }>;
    topProductos: Array<{ producto: string; ventas: number; unidades: number }>;
}

interface ChatRequest {
    messages: ChatMessage[];
    filters: FilterParams;
    filterData?: FilterData;
    dashboardSnapshot?: DashboardSnapshot;
    stream?: boolean;
}

/**
 * POST /api/chat
 * Procesa mensajes de chat con el LLM
 */
export async function POST(req: NextRequest) {
    try {
        const body: ChatRequest = await req.json();
        const { messages, filters, filterData, dashboardSnapshot, stream } = body;
        const shouldStream = stream !== false;

        // Validar request
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return NextResponse.json(
                { error: 'Se requiere al menos un mensaje' },
                { status: 400 }
            );
        }

        // Verificar salud de Ollama
        const ollamaHealthy = await checkOllamaHealth();
        if (!ollamaHealthy) {
            return NextResponse.json(
                { error: 'Servicio de IA no disponible. Verifica que Ollama esté corriendo.' },
                { status: 503 }
            );
        }

        // Obtener la última pregunta del usuario para pre-cargar datos relevantes
        const lastUserMessage = messages[messages.length - 1]?.content || '';
        console.log('=== CHAT REQUEST ===');
        console.log('User question:', lastUserMessage);
        console.log('Filters:', JSON.stringify(filters));
        
        // Pre-cargar datos relevantes según la pregunta
        const preloadedData = await preloadRelevantData(lastUserMessage, filters);
        console.log('Preloaded data length:', preloadedData?.length || 0);
        console.log('Preloaded data preview:', preloadedData?.substring(0, 500));
        
        // CONSTRUIR CONTEXTO DESDE EL DASHBOARD SNAPSHOT + DATOS PRE-CARGADOS
        let dashboardContext = formatDashboardSnapshot(dashboardSnapshot);
        
        // Agregar datos pre-cargados si hay
        if (preloadedData) {
            const maxPreloadedChars = Number(process.env.CHAT_MAX_PRELOADED_CHARS || 4000);
            const trimmedPreloaded = preloadedData.length > maxPreloadedChars
                ? `${preloadedData.slice(0, maxPreloadedChars)}\n... [Datos truncados]`
                : preloadedData;
            dashboardContext += '\n\n## DATOS CONSULTADOS DE LA BASE DE DATOS (USAR ESTOS DATOS):\n' + trimmedPreloaded;
        }

        const maxContextChars = Number(process.env.CHAT_MAX_CONTEXT_CHARS || 6000);
        if (dashboardContext.length > maxContextChars) {
            dashboardContext = `${dashboardContext.slice(0, maxContextChars)}\n\n[Contexto truncado]`;
        }

        console.log('Final context length:', dashboardContext.length);
        console.log('Context preview:', dashboardContext.substring(0, 800));
        
        // Construir system prompt con el contexto del dashboard
        const systemPrompt = SYSTEM_PROMPT.replace('{CONTEXT}', dashboardContext);

        // Preparar mensajes con el system prompt
        const fullMessages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            ...messages
        ];

        // ESTRATEGIA: Generar respuesta DIRECTA con datos reales
        // El LLM pequeño (llama3.2) tiende a alucinar, así que generamos la respuesta nosotros
        const directResponse = await generateDirectResponse(lastUserMessage, filters, dashboardSnapshot);
        
        if (directResponse) {
            // Tenemos una respuesta directa con datos reales
            console.log('Using direct response with real data');
            if (shouldStream) {
                const directStream = new ReadableStream<string>({
                    start(controller) {
                        controller.enqueue(directResponse);
                        controller.close();
                    }
                });
                return createSSEResponse(directStream);
            }
            return NextResponse.json({
                message: { role: 'assistant', content: directResponse },
                content: directResponse
            });
        }
        
        // Si no podemos generar respuesta directa, usar el LLM con contexto estricto
        console.log('Falling back to LLM');
        if (shouldStream) {
            return handleStreamingResponse(fullMessages, filters);
        }
        return handleSimpleChat(fullMessages);

    } catch (error) {
        console.error('Chat API Error:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

/**
 * Formatea el snapshot del dashboard en texto legible para el LLM
 */
function formatDashboardSnapshot(snapshot?: DashboardSnapshot): string {
    if (!snapshot) return 'No hay datos del dashboard disponibles.';
    
    const parts: string[] = [];
    
    // Período
    parts.push(`## PERÍODO CONSULTADO: ${snapshot.periodo.inicio} al ${snapshot.periodo.fin}`);
    parts.push('');
    
    // Filtros activos
    parts.push('## FILTROS APLICADOS:');
    const filtros = snapshot.filtrosActivos;
    parts.push(`- Tiendas: ${Array.isArray(filtros.tiendas) ? filtros.tiendas.join(', ') : filtros.tiendas}`);
    parts.push(`- Marcas: ${Array.isArray(filtros.marcas) ? filtros.marcas.join(', ') : filtros.marcas}`);
    parts.push(`- Categorías: ${Array.isArray(filtros.categorias) ? filtros.categorias.join(', ') : filtros.categorias}`);
    parts.push(`- Géneros: ${Array.isArray(filtros.generos) ? filtros.generos.join(', ') : filtros.generos}`);
    parts.push('');
    
    // Métricas principales
    if (snapshot.metricas) {
        const m = snapshot.metricas;
        parts.push('## MÉTRICAS DEL PERÍODO (datos reales del dashboard):');
        parts.push(`- Ventas: $${formatMoney(m.periodoActual.ventas)}`);
        parts.push(`- Unidades vendidas: ${formatNumber(m.periodoActual.unidades)}`);
        if (m.periodoActual.margen !== null) parts.push(`- Margen: ${m.periodoActual.margen.toFixed(1)}%`);
        if (m.periodoActual.markup !== null) parts.push(`- Markup: ${m.periodoActual.markup.toFixed(1)}%`);
        parts.push(`- Stock disponible: ${formatNumber(m.stock)}`);
        parts.push('');
        
        // Comparación con año anterior
        if (m.variacionVsAnoAnterior.ventas !== null) {
            parts.push('## VS AÑO ANTERIOR:');
            parts.push(`- Ventas año anterior: $${formatMoney(m.periodoAnterior.ventas)}`);
            parts.push(`- Variación ventas: ${m.variacionVsAnoAnterior.ventas >= 0 ? '+' : ''}${m.variacionVsAnoAnterior.ventas.toFixed(1)}%`);
            if (m.variacionVsAnoAnterior.unidades !== null) {
                parts.push(`- Variación unidades: ${m.variacionVsAnoAnterior.unidades >= 0 ? '+' : ''}${m.variacionVsAnoAnterior.unidades.toFixed(1)}%`);
            }
            parts.push('');
        }
        
        // YTD
        parts.push('## AÑO A LA FECHA (YTD):');
        parts.push(`- Ventas YTD: $${formatMoney(m.ytd.ventas)}`);
        parts.push(`- Unidades YTD: ${formatNumber(m.ytd.unidades)}`);
        if (m.ytd.margen !== null) parts.push(`- Margen YTD: ${m.ytd.margen.toFixed(1)}%`);
        parts.push('');
    }
    
    // Comparación semanal
    if (snapshot.comparacionSemanal) {
        const c = snapshot.comparacionSemanal;
        parts.push('## COMPARACIÓN SEMANAL:');
        parts.push(`- Semana actual: ${formatNumber(c.semanaActual)} unidades`);
        parts.push(`- Semana anterior: ${formatNumber(c.semanaAnterior)} unidades`);
        if (c.variacion !== null) {
            parts.push(`- Variación: ${c.variacion >= 0 ? '+' : ''}${c.variacion.toFixed(1)}%`);
        }
        parts.push('');
    }
    
    // Top Marcas
    if (snapshot.topMarcas && snapshot.topMarcas.length > 0) {
        const totalVentas = snapshot.topMarcas.reduce((sum, m) => sum + (m.ventas || 0), 0);
        parts.push('## TOP MARCAS (datos reales - NO mencionar otras):');
        snapshot.topMarcas.forEach((marca, i) => {
            const pct = totalVentas > 0 ? ((marca.ventas / totalVentas) * 100).toFixed(1) : '0';
            parts.push(`${i + 1}. **${marca.marca}**: $${formatMoney(marca.ventas)} (${pct}%) | ${formatNumber(marca.unidades)} uds${marca.margen !== null ? ` | Margen ${marca.margen.toFixed(1)}%` : ''}`);
        });
        parts.push('(Lista completa de marcas con ventas en el período. NO inventes otras marcas.)');
        parts.push('');
    }
    
    // Top Productos
    if (snapshot.topProductos && snapshot.topProductos.length > 0) {
        parts.push('## TOP PRODUCTOS (datos reales):');
        snapshot.topProductos.forEach((prod, i) => {
            parts.push(`${i + 1}. **${prod.producto}**: $${formatMoney(prod.ventas)} | ${formatNumber(prod.unidades)} uds`);
        });
        parts.push('');
    }
    
    return parts.join('\n');
}

/**
 * GENERA RESPUESTA DIRECTA CON DATOS REALES
 * Esta función analiza la pregunta y devuelve una respuesta formateada
 * con datos reales de la base de datos, sin depender del LLM
 */
async function generateDirectResponse(
    question: string, 
    filters: FilterParams, 
    snapshot?: DashboardSnapshot
): Promise<string | null> {
    const q = question.toLowerCase();
    
    // Lista de marcas conocidas de Stadium
    const MARCAS_CONOCIDAS = [
        'adidas', 'puma', 'umbro', 'nike', 'reebok', 'fila', 'topper',
        'new balance', 'converse', 'vans', 'havaianas', 'miss carol', 
        'mini miss carol', 'freeway', 'tiffosi', 'lacoste', 'levis',
        'wrangler', 'cat', 'caterpillar', 'skechers', 'crocs'
    ];
    
    // Palabras a ignorar (no son marcas)
    const STOP_WORDS = [
        'mas', 'más', 'los', 'las', 'de', 'del', 'la', 'el', 'un', 'una',
        'que', 'con', 'por', 'para', 'en', 'son', 'es', 'fue', 'hay',
        'ayer', 'hoy', 'semana', 'mes', 'año', 'dia', 'días', 'todos',
        'todas', 'todo', 'toda', 'cual', 'cuál', 'cuales', 'cuáles',
        'como', 'cómo', 'donde', 'dónde', 'cuando', 'cuándo', 'quien',
        'vendidos', 'vendido', 'vendidas', 'vendida', 'productos', 'producto',
        'articulo', 'artículo', 'articulos', 'artículos', 'marca', 'marcas'
    ];
    
    try {
        // Aplicar expresiones temporales de la pregunta (ej: "últimos 90 días")
        const adjustedFilters = parseTemporalExpression(question, filters);
        const whereClause = buildFilterConditions(adjustedFilters);
        
        console.log('Adjusted filters:', JSON.stringify(adjustedFilters));
        
        // Detectar si menciona una marca específica conocida
        let marcaDetectada: string | null = null;
        for (const marca of MARCAS_CONOCIDAS) {
            if (q.includes(marca)) {
                marcaDetectada = marca;
                break;
            }
        }
        
        // ============================================
        // PREGUNTAS SOBRE PRODUCTOS MÁS VENDIDOS (GENERAL o TODAS LAS MARCAS)
        // ============================================
        if (!marcaDetectada && 
            ((q.includes('producto') && (q.includes('más vendid') || q.includes('mas vendid') || q.includes('top'))) ||
             q.includes('qué se vende') || q.includes('que se vende') ||
             q.includes('de todas las marcas') || q.includes('todas las marcas') ||
             (q.includes('vendido') && !marcaDetectada))) {
            
            const result = await executeSafeSQL(`
                SELECT TOP 15
                    T.BaseCol as Codigo,
                    MAX(T.DescripcionArticulo) as Producto,
                    MAX(T.DescripcionMarca) as Marca,
                    SUM(T.Cantidad) as Unidades,
                    CAST(SUM(T.PRECIO) as decimal(18,2)) as Ventas,
                    CAST(SUM(T.PRECIO) / NULLIF(SUM(T.Cantidad), 0) as decimal(18,2)) as TicketPromedio,
                    CAST(AVG(T.MargenPorc) as decimal(5,2)) as Margen
                FROM Transacciones T
                WHERE ${whereClause} AND T.Cantidad > 0
                GROUP BY T.BaseCol
                ORDER BY Ventas DESC
            `);
            
            if (result.success && result.data && result.data.length > 0) {
                const totalVentas = result.data.reduce((sum: number, r: any) => sum + (r.Ventas || 0), 0);
                
                let response = `## 🏆 Top Productos Más Vendidos\n\n`;
                response += `**Período:** ${adjustedFilters.startDate} a ${adjustedFilters.endDate}\n\n`;
                
                result.data.forEach((row: any, i: number) => {
                    const pct = ((row.Ventas / totalVentas) * 100).toFixed(1);
                    response += `**${i + 1}. ${row.Producto}** (${row.Marca})\n`;
                    response += `   - Código: \`${row.Codigo}\`\n`;
                    response += `   - Ventas: **$${formatMoney(row.Ventas)}** (${pct}%)\n`;
                    response += `   - Unidades: ${formatNumber(row.Unidades)}\n`;
                    response += `   - Ticket: $${formatMoney(row.TicketPromedio || 0)}\n`;
                    if (row.Margen) response += `   - Margen: ${row.Margen}%\n`;
                    response += `\n`;
                });
                
                response += `\n**Total ventas período:** $${formatMoney(totalVentas)} (UYU)`;
                return response;
            }
        }
        
        // ============================================
        // PREGUNTAS SOBRE PRODUCTOS DE UNA MARCA ESPECÍFICA
        // ============================================
        if (marcaDetectada) {
            console.log('=== BUSQUEDA POR MARCA ===');
            console.log('Marca detectada:', marcaDetectada);
            console.log('Where clause:', whereClause);
            console.log('Adjusted filters:', JSON.stringify(adjustedFilters));
            
            // Buscar productos de esa marca en la base de datos
            const querySQL = `
                SELECT TOP 50
                    T.BaseCol as Codigo,
                    MAX(T.DescripcionArticulo) as Producto,
                    MAX(T.DescripcionMarca) as Marca,
                    SUM(T.Cantidad) as Unidades,
                    CAST(SUM(T.PRECIO) as decimal(18,2)) as Ventas,
                    CAST(SUM(T.PRECIO) / NULLIF(SUM(T.Cantidad), 0) as decimal(18,2)) as TicketPromedio,
                    CAST(AVG(T.MargenPorc) as decimal(5,2)) as Margen,
                    COALESCE(MAX(MS.Stock), 0) as Stock
                FROM Transacciones T
                LEFT JOIN (
                    SELECT A.Base as BaseCol, SUM(MS.TotalStock) as Stock
                    FROM MovStockTotalResumen MS
                    INNER JOIN Articulos A ON A.IdArticulo = MS.IdArticulo
                    GROUP BY A.Base
                ) MS ON MS.BaseCol = T.BaseCol
                WHERE ${whereClause} 
                AND T.Cantidad > 0 
                AND LOWER(T.DescripcionMarca) LIKE '%${marcaDetectada.toLowerCase()}%'
                GROUP BY T.BaseCol
                ORDER BY Ventas DESC
            `;
            console.log('SQL Query:', querySQL);
            
            const result = await executeSafeSQL(querySQL);
            console.log('Query result success:', result.success);
            console.log('Query result error:', result.error);
            console.log('Query result data length:', result.data?.length || 0);
            if (result.data && result.data.length > 0) {
                console.log('First result:', JSON.stringify(result.data[0]));
            }
            
            if (result.success && result.data && result.data.length > 0) {
                const marca = result.data[0].Marca;
                const totalVentas = result.data.reduce((sum: number, r: any) => sum + (r.Ventas || 0), 0);
                const totalUnidades = result.data.reduce((sum: number, r: any) => sum + (r.Unidades || 0), 0);
                
                let response = `## 🏷️ Productos de ${marca} más vendidos\n\n`;
                response += `**Período:** ${adjustedFilters.startDate} a ${adjustedFilters.endDate}\n\n`;
                response += `**Totales ${marca}:**\n`;
                response += `- 💰 Ventas: **$${formatMoney(totalVentas)}** (UYU)\n`;
                response += `- 📦 Unidades: **${formatNumber(totalUnidades)}**\n\n`;
                response += `### Top ${result.data.length} productos:\n\n`;
                
                result.data.forEach((row: any, i: number) => {
                    const pctVentas = totalVentas > 0 ? ((row.Ventas / totalVentas) * 100).toFixed(1) : '0';
                    response += `**${i + 1}. ${row.Producto}**\n`;
                    response += `   - Código: \`${row.Codigo}\`\n`;
                    response += `   - Ventas: **$${formatMoney(row.Ventas)}** (${pctVentas}%)\n`;
                    response += `   - Unidades: ${formatNumber(row.Unidades)}\n`;
                    response += `   - Ticket: $${formatMoney(row.TicketPromedio || 0)}\n`;
                    if (row.Margen) response += `   - Margen: ${row.Margen}%\n`;
                    if (row.Stock > 0) response += `   - Stock: ${formatNumber(row.Stock)} uds\n`;
                    response += `\n`;
                });
                
                return response;
            } else {
                // Si hay error en la query, mostrarlo
                if (!result.success && result.error) {
                    console.error('Error en query de marca:', result.error);
                    return `Error al buscar productos de "${marcaDetectada}": ${result.error}`;
                }
                
                // No hay datos, intentar query más simple para diagnóstico
                const simpleCheck = await executeSafeSQL(`
                    SELECT TOP 5 DISTINCT DescripcionMarca 
                    FROM Transacciones 
                    WHERE Fecha >= '${adjustedFilters.startDate}' 
                    AND Fecha <= '${adjustedFilters.endDate}'
                    AND Cantidad > 0
                    AND DescripcionMarca IS NOT NULL
                `);
                console.log('Marcas disponibles en el período:', simpleCheck.data?.map((r: any) => r.DescripcionMarca));
                
                return `No encontré productos de la marca "${marcaDetectada}" en el período seleccionado (${adjustedFilters.startDate} a ${adjustedFilters.endDate}).\n\nLas marcas principales de Stadium son: Miss Carol, Adidas, Puma, Umbro, New Balance, Converse, Freeway, Tiffosi, Mini Miss Carol, Havaianas.`;
            }
        }
        
        // ============================================
        // PREGUNTAS SOBRE MARCA MÁS VENDIDA
        // ============================================
        if ((q.includes('marca') && (q.includes('más vendid') || q.includes('top') || q.includes('mejor'))) ||
            q.includes('cuál es la marca') || q.includes('cual es la marca')) {
            
            const result = await executeSafeSQL(`
                SELECT TOP 10
                    T.DescripcionMarca as Marca,
                    SUM(T.Cantidad) as Unidades,
                    CAST(SUM(T.PRECIO) as decimal(18,2)) as Ventas,
                    CAST(SUM(T.PRECIO) / NULLIF(SUM(T.Cantidad), 0) as decimal(18,2)) as TicketPromedio,
                    CAST(AVG(T.MargenPorc) as decimal(5,2)) as Margen,
                    COUNT(DISTINCT T.BaseCol) as ProductosDistintos
                FROM Transacciones T
                WHERE ${whereClause} AND T.Cantidad > 0 AND T.DescripcionMarca IS NOT NULL
                GROUP BY T.DescripcionMarca
                ORDER BY Ventas DESC
            `);
            
            if (result.success && result.data && result.data.length > 0) {
                const totalVentas = result.data.reduce((sum: number, r: any) => sum + (r.Ventas || 0), 0);
                const top = result.data[0];
                const pctTop = ((top.Ventas / totalVentas) * 100).toFixed(1);
                
                let response = `## Ranking de Marcas por Ventas\n\n`;
                response += `**Período:** ${adjustedFilters.startDate} a ${adjustedFilters.endDate}\n\n`;
                response += `🏆 **La marca más vendida es ${top.Marca}** con **$${formatMoney(top.Ventas)}** (${pctTop}% del total)\n\n`;
                response += `### Top 10 marcas:\n\n`;
                
                result.data.forEach((row: any, i: number) => {
                    const pct = ((row.Ventas / totalVentas) * 100).toFixed(1);
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                    response += `${medal} **${row.Marca}**\n`;
                    response += `   - Ventas: $${formatMoney(row.Ventas)} (${pct}%)\n`;
                    response += `   - Unidades: ${formatNumber(row.Unidades)}\n`;
                    response += `   - Ticket promedio: $${formatMoney(row.TicketPromedio || 0)}\n`;
                    if (row.Margen) response += `   - Margen: ${row.Margen}%\n`;
                    response += `\n`;
                });
                
                response += `\n**Total ventas del período:** $${formatMoney(totalVentas)} (UYU)`;
                
                return response;
            }
        }
        
        // ============================================
        // PREGUNTAS SOBRE RESUMEN / VENTAS GENERALES
        // ============================================
        if (q.includes('resumen') || q.includes('cómo va') || q.includes('como va') || 
            q.includes('cómo están') || q.includes('como estan') || q.includes('situación') ||
            (q.includes('venta') && (q.includes('total') || q.includes('general')))) {
            
            const result = await executeSafeSQL(`
                SELECT 
                    SUM(T.Cantidad) as Unidades,
                    CAST(SUM(T.PRECIO) as decimal(18,2)) as Ventas,
                    CAST(SUM(T.PRECIO) / NULLIF(SUM(T.Cantidad), 0) as decimal(18,2)) as TicketPromedio,
                    CAST(AVG(T.MargenPorc) as decimal(5,2)) as MargenPromedio,
                    CAST(SUM(T.MargenMonto) as decimal(18,2)) as MargenTotal,
                    COUNT(DISTINCT T.BaseCol) as ProductosVendidos,
                    COUNT(DISTINCT T.DescripcionMarca) as MarcasActivas,
                    COUNT(DISTINCT T.IdDeposito) as TiendasActivas
                FROM Transacciones T
                WHERE ${whereClause} AND T.Cantidad > 0
            `);
            
            if (result.success && result.data && result.data[0]) {
                const d = result.data[0];
                
                let response = `## Resumen Ejecutivo de Ventas\n\n`;
                response += `**Período:** ${adjustedFilters.startDate} a ${adjustedFilters.endDate}\n\n`;
                response += `### Métricas Principales:\n\n`;
                response += `- 💰 **Ventas totales:** $${formatMoney(d.Ventas)} (UYU)\n`;
                response += `- 📦 **Unidades vendidas:** ${formatNumber(d.Unidades)}\n`;
                response += `- 🎫 **Ticket promedio:** $${formatMoney(d.TicketPromedio || 0)}\n`;
                if (d.MargenPromedio) response += `- 📊 **Margen promedio:** ${d.MargenPromedio}%\n`;
                if (d.MargenTotal) response += `- 💵 **Margen total:** $${formatMoney(d.MargenTotal)}\n`;
                response += `\n### Alcance:\n\n`;
                response += `- 🏷️ **Productos distintos vendidos:** ${formatNumber(d.ProductosVendidos)}\n`;
                response += `- 🏪 **Marcas activas:** ${formatNumber(d.MarcasActivas)}\n`;
                response += `- 🏬 **Tiendas con ventas:** ${formatNumber(d.TiendasActivas)}\n`;
                
                return response;
            }
        }
        
        // ============================================
        // PREGUNTAS SOBRE TIENDAS
        // ============================================
        if (q.includes('tienda') || q.includes('sucursal') || q.includes('local')) {
            const result = await executeSafeSQL(`
                SELECT TOP 10
                    T.IdDeposito,
                    ISNULL(Ti.Descripcion, CAST(T.IdDeposito as varchar)) as Tienda,
                    SUM(T.Cantidad) as Unidades,
                    CAST(SUM(T.PRECIO) as decimal(18,2)) as Ventas,
                    CAST(SUM(T.PRECIO) / NULLIF(SUM(T.Cantidad), 0) as decimal(18,2)) as TicketPromedio,
                    CAST(AVG(T.MargenPorc) as decimal(5,2)) as Margen
                FROM Transacciones T
                LEFT JOIN Tiendas Ti ON Ti.IdTienda = T.IdDeposito
                WHERE ${whereClause} AND T.Cantidad > 0
                GROUP BY T.IdDeposito, Ti.Descripcion
                ORDER BY Ventas DESC
            `);
            
            if (result.success && result.data && result.data.length > 0) {
                const totalVentas = result.data.reduce((sum: number, r: any) => sum + (r.Ventas || 0), 0);
                
                let response = `## Ranking de Tiendas por Ventas\n\n`;
                response += `**Período:** ${adjustedFilters.startDate} a ${adjustedFilters.endDate}\n\n`;
                
                result.data.forEach((row: any, i: number) => {
                    const pct = ((row.Ventas / totalVentas) * 100).toFixed(1);
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                    response += `${medal} **${row.Tienda}**\n`;
                    response += `   - Ventas: $${formatMoney(row.Ventas)} (${pct}%)\n`;
                    response += `   - Unidades: ${formatNumber(row.Unidades)}\n`;
                    response += `   - Ticket: $${formatMoney(row.TicketPromedio || 0)}\n`;
                    if (row.Margen) response += `   - Margen: ${row.Margen}%\n`;
                    response += `\n`;
                });
                
                return response;
            }
        }
        
        // No se pudo generar respuesta directa
        return null;
        
    } catch (error) {
        console.error('Error generating direct response:', error);
        return null;
    }
}

/**
 * Pre-carga datos relevantes basados en la pregunta del usuario
 */
async function preloadRelevantData(question: string, filters: FilterParams): Promise<string | null> {
    const q = question.toLowerCase();
    const parts: string[] = [];
    
    try {
        // Aplicar expresiones temporales de la pregunta (ej: "últimos 90 días")
        const adjustedFilters = parseTemporalExpression(question, filters);
        const whereClause = buildFilterConditions(adjustedFilters);
        
        // Detectar tipo de pregunta y cargar datos relevantes
        
        // Preguntas sobre marcas
        if (q.includes('marca') || q.includes('brand')) {
            const result = await executeSafeSQL(`
                SELECT TOP 10
                    T.DescripcionMarca as Marca,
                    SUM(T.Cantidad) as Unidades,
                    CAST(SUM(T.Precio) as decimal(18,2)) as Ventas,
                    CAST(SUM(T.Precio) / NULLIF(SUM(T.Cantidad), 0) as decimal(18,2)) as TicketPromedio,
                    CAST(SUM(CAST(T.Cantidad as decimal(18,2)) * (1.22 * ISNULL(UC.ultimoCosto, 0))) as decimal(18,2)) as Costo
                FROM Transacciones T
                LEFT JOIN (
                    SELECT A.Base as BaseCol, MAX(UC.UltimoCosto) as ultimoCosto 
                    FROM UltimaCompra UC
                    INNER JOIN Articulos A ON A.IdArticulo = UC.BaseArticulo
                    GROUP BY A.Base
                ) UC ON UC.BaseCol = T.BaseCol
                WHERE ${whereClause} AND T.Cantidad > 0 AND T.DescripcionMarca IS NOT NULL
                GROUP BY T.DescripcionMarca
                ORDER BY Ventas DESC
            `);
            if (result.success && result.data?.length) {
                // Calcular total para porcentajes
                const totalVentas = result.data.reduce((sum: number, r: any) => sum + (r.Ventas || 0), 0);
                
                parts.push('### Marcas (LISTA COMPLETA - no mencionar otras):');
                result.data.forEach((row: any, i: number) => {
                    const pctTotal = totalVentas > 0 ? ((row.Ventas / totalVentas) * 100).toFixed(1) : 0;
                    const margen = row.Ventas > 0 && row.Costo > 0 
                        ? (((row.Ventas - row.Costo) / row.Ventas) * 100).toFixed(1) 
                        : 'N/D';
                    parts.push(`${i + 1}. **${row.Marca}**: Ventas $${formatMoney(row.Ventas)} (${pctTotal}%) | ${formatNumber(row.Unidades)} uds | Ticket $${formatMoney(row.TicketPromedio || 0)} | Margen ${margen}%`);
                });
                parts.push(`\nTotal ventas: $${formatMoney(totalVentas)}`);
                parts.push('(Esta es la lista completa de marcas con ventas. NO menciones marcas que no estén aquí.)');
            }
        }
        
        // Preguntas sobre productos (incluyendo códigos, colores, tallas)
        if (q.includes('producto') || q.includes('artículo') || q.includes('articulo') || q.includes('vendido') || 
            q.includes('código') || q.includes('codigo') || q.includes('color') || q.includes('talla') || q.includes('ref')) {
            
            // Obtener productos con TODOS los detalles incluyendo código base
            const result = await executeSafeSQL(`
                SELECT TOP 15
                    T.BaseCol as CodigoBase,
                    MAX(T.DescripcionArticulo) as Producto,
                    MAX(T.DescripcionArticulo) as NombreCorto,
                    MAX(T.DescripcionMarca) as Marca,
                    SUM(T.Cantidad) as Unidades,
                    CAST(SUM(T.Precio) as decimal(18,2)) as Ventas,
                    CAST(SUM(T.Precio) / NULLIF(SUM(T.Cantidad), 0) as decimal(18,2)) as PrecioPromedio,
                    MAX(UC.ultimoCosto) as CostoUnitario,
                    COALESCE(MAX(MS.Stock), 0) as StockActual
                FROM Transacciones T
                LEFT JOIN (
                    SELECT A.Base as BaseCol, MAX(UC.UltimoCosto) as ultimoCosto 
                    FROM UltimaCompra UC
                    INNER JOIN Articulos A ON A.IdArticulo = UC.BaseArticulo
                    GROUP BY A.Base
                ) UC ON UC.BaseCol = T.BaseCol
                LEFT JOIN (
                    SELECT A.Base as BaseCol, SUM(MS.TotalStock) as Stock
                    FROM MovStockTotalResumen MS
                    INNER JOIN Articulos A ON A.IdArticulo = MS.IdArticulo
                    GROUP BY A.Base
                ) MS ON MS.BaseCol = T.BaseCol
                WHERE ${whereClause} AND T.Cantidad > 0
                GROUP BY T.BaseCol
                ORDER BY Ventas DESC
            `);
            
            if (result.success && result.data?.length) {
                parts.push('### Top Productos Más Vendidos (con códigos):');
                result.data.forEach((row: any, i: number) => {
                    const margen = row.PrecioPromedio > 0 && row.CostoUnitario > 0 
                        ? (((row.PrecioPromedio - row.CostoUnitario * 1.22) / row.PrecioPromedio) * 100).toFixed(1)
                        : 'N/D';
                    parts.push(`${i + 1}. **${row.Producto}** (${row.Marca})`);
                    parts.push(`   - Código Base: ${row.CodigoBase}`);
                    parts.push(`   - Ventas: $${formatMoney(row.Ventas)} | Unidades: ${formatNumber(row.Unidades)}`);
                    parts.push(`   - Precio Promedio: $${formatMoney(row.PrecioPromedio || 0)} | Margen: ${margen}%`);
                    parts.push(`   - Stock Actual: ${formatNumber(row.StockActual)} unidades`);
                });
            }

            // Si preguntan específicamente por tallas o colores, cargar ese detalle
            if (q.includes('talla') || q.includes('color')) {
                const tallasResult = await executeSafeSQL(`
                    SELECT TOP 20
                        T.BaseCol as CodigoBase,
                        MAX(T.DescripcionArticulo) as Producto,
                        T.CodTalle,
                        SUM(T.Cantidad) as Unidades,
                        CAST(SUM(T.Precio) as decimal(18,2)) as Ventas,
                        COALESCE(MAX(MS.Stock), 0) as Stock
                    FROM Transacciones T
                    LEFT JOIN (
                        SELECT IdArticulo, SUM(TotalStock) as Stock
                        FROM MovStockTotalResumen GROUP BY IdArticulo
                    ) MS ON MS.IdArticulo = T.IdArticulo
                    WHERE ${whereClause} AND T.Cantidad > 0 AND T.CodTalle IS NOT NULL
                    GROUP BY T.BaseCol, T.CodTalle
                    ORDER BY Ventas DESC
                `);
                
                if (tallasResult.success && tallasResult.data?.length) {
                    parts.push('');
                    parts.push('### Detalle por Talla de los Productos Más Vendidos:');
                    tallasResult.data.forEach((row: any) => {
                        parts.push(`- **${row.Producto}** | Talla: ${row.Talla} | Ventas: $${formatMoney(row.Ventas)} | Uds: ${formatNumber(row.Unidades)} | Stock: ${formatNumber(row.Stock)}`);
                    });
                }
            }
        }
        
        // Preguntas sobre tiendas
        if (q.includes('tienda') || q.includes('local') || q.includes('sucursal')) {
            const result = await executeSafeSQL(`
                SELECT TOP 10
                    T.IdDeposito,
                    ISNULL(Ti.Descripcion, CAST(T.IdDeposito as varchar)) as Tienda,
                    SUM(T.Cantidad) as Unidades,
                    CAST(SUM(T.Precio) as decimal(18,2)) as Ventas
                FROM Transacciones T
                LEFT JOIN Tiendas Ti ON Ti.IdTienda = T.IdDeposito
                WHERE ${whereClause} AND T.Cantidad > 0
                GROUP BY T.IdDeposito, Ti.Descripcion
                ORDER BY Ventas DESC
            `);
            if (result.success && result.data?.length) {
                parts.push('### Top Tiendas por Ventas:');
                result.data.forEach((row: any, i: number) => {
                    parts.push(`${i + 1}. ${row.Tienda}: $${formatMoney(row.Ventas)} (${formatNumber(row.Unidades)} uds)`);
                });
            }
        }
        
        // Preguntas sobre ventas generales o métricas
        if (q.includes('venta') || q.includes('métrica') || q.includes('total') || q.includes('resumen') || q.includes('cómo va') || q.includes('como va')) {
            const result = await executeSafeSQL(`
                SELECT 
                    SUM(T.Cantidad) as Unidades,
                    CAST(SUM(T.Precio) as decimal(18,2)) as Ventas,
                    CAST(SUM(T.Precio) / NULLIF(SUM(T.Cantidad), 0) as decimal(18,2)) as TicketPromedio,
                    CAST(SUM(CAST(T.Cantidad as decimal(18,2)) * (1.22 * ISNULL(UC.ultimoCosto, 0))) as decimal(18,2)) as CostoTotal,
                    COUNT(DISTINCT T.BaseCol) as ProductosVendidos,
                    COUNT(DISTINCT T.DescripcionMarca) as MarcasVendidas,
                    COUNT(DISTINCT T.IdDeposito) as TiendasActivas
                FROM Transacciones T
                LEFT JOIN (
                    SELECT A.Base as BaseCol, MAX(UC.UltimoCosto) as ultimoCosto 
                    FROM UltimaCompra UC
                    INNER JOIN Articulos A ON A.IdArticulo = UC.BaseArticulo
                    GROUP BY A.Base
                ) UC ON UC.BaseCol = T.BaseCol
                WHERE ${whereClause} AND T.Cantidad > 0
            `);
            if (result.success && result.data?.[0]) {
                const d = result.data[0];
                const margen = d.Ventas > 0 && d.CostoTotal > 0 
                    ? (((d.Ventas - d.CostoTotal) / d.Ventas) * 100).toFixed(1) 
                    : 'N/D';
                const markup = d.CostoTotal > 0 
                    ? (((d.Ventas - d.CostoTotal) / d.CostoTotal) * 100).toFixed(1) 
                    : 'N/D';
                    
                parts.push('### Resumen Ejecutivo del Período:');
                parts.push(`- **Ventas totales**: $${formatMoney(d.Ventas)}`);
                parts.push(`- **Unidades vendidas**: ${formatNumber(d.Unidades)}`);
                parts.push(`- **Ticket promedio**: $${formatMoney(d.TicketPromedio || 0)}`);
                parts.push(`- **Costo total**: $${formatMoney(d.CostoTotal || 0)}`);
                parts.push(`- **Margen bruto**: ${margen}%`);
                parts.push(`- **Markup**: ${markup}%`);
                parts.push(`- **Productos vendidos**: ${formatNumber(d.ProductosVendidos)} SKUs distintos`);
                parts.push(`- **Marcas activas**: ${formatNumber(d.MarcasVendidas)}`);
                parts.push(`- **Tiendas con ventas**: ${formatNumber(d.TiendasActivas)}`);
            }
        }
        
        // Preguntas sobre stock
        if (q.includes('stock') || q.includes('inventario') || q.includes('disponible')) {
            const result = await executeSafeSQL(`
                SELECT TOP 10
                    A.Base as BaseCol,
                    SUM(MS.TotalStock) as Stock
                FROM MovStockTotalResumen MS
                INNER JOIN Articulos A ON A.IdArticulo = MS.IdArticulo
                WHERE MS.TotalStock > 0
                GROUP BY A.Base
                ORDER BY Stock DESC
            `);
            if (result.success && result.data?.length) {
                parts.push('### Productos con Mayor Stock:');
                result.data.forEach((row: any, i: number) => {
                    parts.push(`${i + 1}. Código ${row.BaseCol}: ${formatNumber(row.Stock)} unidades`);
                });
            }
        }
        
        // Detectar menciones de marcas específicas (Adidas, Nike, Puma, etc.)
        const marcasConocidas = ['adidas', 'nike', 'puma', 'reebok', 'under armour', 'fila', 'topper', 'converse', 'vans', 'new balance'];
        const marcaMencionada = marcasConocidas.find(m => q.includes(m));
        
        if (marcaMencionada) {
            const result = await executeSafeSQL(`
                SELECT TOP 15
                    T.BaseCol as CodigoBase,
                    MAX(T.DescripcionArticulo) as Producto,
                    MAX(T.DescripcionMarca) as Marca,
                    MAX(T.DescripcionClase) as Categoria,
                    SUM(T.Cantidad) as Unidades,
                    CAST(SUM(T.Precio) as decimal(18,2)) as Ventas,
                    CAST(SUM(T.Precio) / NULLIF(SUM(T.Cantidad), 0) as decimal(18,2)) as PrecioPromedio,
                    COALESCE(MAX(MS.Stock), 0) as StockActual
                FROM Transacciones T
                LEFT JOIN (
                    SELECT A.Base as BaseCol, SUM(MS.TotalStock) as Stock
                    FROM MovStockTotalResumen MS
                    INNER JOIN Articulos A ON A.IdArticulo = MS.IdArticulo
                    GROUP BY A.Base
                ) MS ON MS.BaseCol = T.BaseCol
                WHERE ${whereClause} AND T.Cantidad > 0 
                AND LOWER(T.DescripcionMarca) LIKE '%${marcaMencionada}%'
                GROUP BY T.BaseCol
                ORDER BY Ventas DESC
            `);
            
            if (result.success && result.data?.length) {
                parts.push(`### Productos de ${marcaMencionada.toUpperCase()} Más Vendidos:`);
                result.data.forEach((row: any, i: number) => {
                    parts.push(`${i + 1}. **${row.Producto}**`);
                    parts.push(`   - Código: ${row.CodigoBase} | Categoría: ${row.Categoria || 'N/D'}`);
                    parts.push(`   - Ventas: $${formatMoney(row.Ventas)} | Unidades: ${formatNumber(row.Unidades)}`);
                    parts.push(`   - Precio Promedio: $${formatMoney(row.PrecioPromedio || 0)} | Stock: ${formatNumber(row.StockActual)}`);
                });
                
                // Resumen de la marca
                const resumenResult = await executeSafeSQL(`
                    SELECT 
                        SUM(T.Cantidad) as TotalUnidades,
                        CAST(SUM(T.Precio) as decimal(18,2)) as TotalVentas,
                        COUNT(DISTINCT T.BaseCol) as TotalProductos,
                        COUNT(DISTINCT T.DescripcionClase) as TotalCategorias
                    FROM Transacciones T
                    WHERE ${whereClause} AND T.Cantidad > 0 
                    AND LOWER(T.DescripcionMarca) LIKE '%${marcaMencionada}%'
                `);
                
                if (resumenResult.success && resumenResult.data?.[0]) {
                    const r = resumenResult.data[0];
                    parts.push('');
                    parts.push(`### Resumen de ${marcaMencionada.toUpperCase()}:`);
                    parts.push(`- Total Ventas: $${formatMoney(r.TotalVentas)}`);
                    parts.push(`- Total Unidades: ${formatNumber(r.TotalUnidades)}`);
                    parts.push(`- Productos Distintos: ${formatNumber(r.TotalProductos)}`);
                    parts.push(`- Categorías: ${formatNumber(r.TotalCategorias)}`);
                }
            }
        }

        // Preguntas sobre categorías/clases
        if (q.includes('categoría') || q.includes('categoria') || q.includes('clase')) {
            const result = await executeSafeSQL(`
                SELECT TOP 10
                    DescripcionClase as Categoria,
                    SUM(Cantidad) as Unidades,
                    CAST(SUM(Precio) as decimal(18,2)) as Ventas
                FROM Transacciones
                WHERE ${whereClause} AND Cantidad > 0 AND DescripcionClase IS NOT NULL
                GROUP BY DescripcionClase
                ORDER BY Ventas DESC
            `);
            if (result.success && result.data?.length) {
                parts.push('### Top Categorías por Ventas:');
                result.data.forEach((row: any, i: number) => {
                    parts.push(`${i + 1}. ${row.Categoria}: $${formatMoney(row.Ventas)} (${formatNumber(row.Unidades)} uds)`);
                });
            }
        }
        
        // Si no se detectó un tema específico, cargar resumen general
        if (parts.length === 0) {
            const result = await executeSafeSQL(`
                SELECT 
                    SUM(Cantidad) as Unidades,
                    CAST(SUM(Precio) as decimal(18,2)) as Ventas
                FROM Transacciones
                WHERE ${whereClause} AND Cantidad > 0
            `);
            if (result.success && result.data?.[0]) {
                const data = result.data[0];
                parts.push('### Datos del Período Seleccionado:');
                parts.push(`- Ventas: $${formatMoney(data.Ventas)}`);
                parts.push(`- Unidades: ${formatNumber(data.Unidades)}`);
            }
        }
        
        return parts.length > 0 ? parts.join('\n') : null;
        
    } catch (error) {
        console.error('Error preloading data:', error);
        return null;
    }
}

/**
 * Formatea número a formato legible
 */
function formatNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num?.toLocaleString('es-AR') || '0';
}

/**
 * Formatea dinero a formato legible
 */
function formatMoney(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || '0';
}

/**
 * Maneja respuesta simple sin streaming y SIN TOOLS (más confiable con llama3.2)
 */
async function handleSimpleChat(messages: ChatMessage[]): Promise<NextResponse> {
    try {
        console.log('=== handleSimpleChat ===');
        console.log('Sending', messages.length, 'messages to LLM');
        
        // Llamar a Ollama SIN tools para evitar problemas de compatibilidad
        const response = await chat(messages);
        
        console.log('LLM Response:', {
            hasContent: !!response.message?.content,
            contentLength: response.message?.content?.length || 0,
            preview: response.message?.content?.substring(0, 200)
        });
        
        const content = response.message?.content || 'No pude generar una respuesta. Por favor intenta de nuevo.';
        
        return NextResponse.json({
            message: response.message,
            content: content
        });

    } catch (error) {
        console.error('handleSimpleChat error:', error);
        return NextResponse.json({
            message: { role: 'assistant', content: 'Lo siento, hubo un error procesando tu consulta. Por favor intenta de nuevo.' },
            content: 'Lo siento, hubo un error procesando tu consulta. Por favor intenta de nuevo.'
        });
    }
}

/**
 * Maneja respuesta simple sin streaming (más confiable)
 */
async function handleSimpleResponse(messages: ChatMessage[]): Promise<NextResponse> {
    try {
        const response = await chat(messages);
        
        return NextResponse.json({
            message: response.message,
            content: response.message.content
        });

    } catch (error) {
        console.error('Chat error:', error);
        return NextResponse.json({
            message: { role: 'assistant', content: 'Lo siento, hubo un error procesando tu consulta. Por favor intenta de nuevo.' },
            content: 'Lo siento, hubo un error procesando tu consulta. Por favor intenta de nuevo.'
        });
    }
}

/**
 * Maneja respuestas con streaming
 */
async function handleStreamingResponse(messages: ChatMessage[], filters: FilterParams): Promise<Response> {
    try {
        // Primero intentamos obtener respuesta con tools (sin streaming)
        // ya que Ollama no soporta streaming + tools simultáneamente
        const response = await chat(messages, STADIUM_TOOLS);
        
        // Verificar si hay tool calls
        if (response.message.tool_calls && response.message.tool_calls.length > 0) {
            // Procesar tool calls
            const toolResults = await processToolCalls(response.message.tool_calls, filters);
            
            // Agregar resultados de tools al contexto
            const messagesWithTools: ChatMessage[] = [
                ...messages,
                response.message,
                ...toolResults
            ];

            // Obtener respuesta final con streaming
            const finalStream = await chatStream(messagesWithTools);
            const textStream = createTextStream(finalStream);

            // Convertir a SSE stream
            return createSSEResponse(textStream);
        }

        // Sin tool calls, hacer streaming directo
        const directStream = await chatStream(messages);
        const textStream = createTextStream(directStream);
        return createSSEResponse(textStream);

    } catch (error) {
        console.error('Streaming error:', error);
        // Fallback a respuesta sin streaming
        return handleNonStreamingResponse(messages, filters);
    }
}

/**
 * Detecta si el contenido es una llamada a herramienta en formato JSON
 * Algunos modelos como llama3.2 devuelven tool calls como JSON en content
 */
function parseToolCallFromContent(content: string): { name: string; parameters: any } | null {
    if (!content) return null;
    try {
        const trimmed = content.trim();
        // Buscar patrones de JSON con "name" y "parameters"
        if (trimmed.startsWith('{') && trimmed.includes('"name"')) {
            const parsed = JSON.parse(trimmed);
            if (parsed.name && typeof parsed.name === 'string') {
                return {
                    name: parsed.name,
                    parameters: parsed.parameters || parsed.arguments || {}
                };
            }
        }
    } catch (e) {
        // No es JSON válido, ignorar
    }
    return null;
}

/**
 * Maneja respuestas sin streaming - con soporte para herramientas
 */
async function handleNonStreamingResponse(messages: ChatMessage[], filters: FilterParams): Promise<NextResponse> {
    try {
        console.log('=== Starting chat with tools ===');
        console.log('Messages count:', messages.length);
        
        let response = await chat(messages, STADIUM_TOOLS);
        console.log('LLM Response received:', {
            hasContent: !!response.message?.content,
            contentLength: response.message?.content?.length || 0,
            contentPreview: response.message?.content?.substring(0, 100),
            hasToolCalls: !!response.message?.tool_calls,
            toolCallsCount: response.message?.tool_calls?.length || 0
        });
        
        let iterations = 0;
        const maxIterations = 5; // Prevenir loops infinitos

        // Detectar tool calls en el contenido (formato llama3.2)
        const contentToolCall = parseToolCallFromContent(response.message?.content || '');
        if (contentToolCall && !response.message.tool_calls) {
            console.log('Detected tool call in content:', contentToolCall.name);
            response.message.tool_calls = [{
                id: `call_${Date.now()}`,
                type: 'function',
                function: {
                    name: contentToolCall.name,
                    arguments: JSON.stringify(contentToolCall.parameters)
                }
            }];
        }

        // Procesar tool calls iterativamente
        while (response.message.tool_calls && response.message.tool_calls.length > 0 && iterations < maxIterations) {
            console.log(`Processing ${response.message.tool_calls.length} tool calls (iteration ${iterations + 1})`);
            
            const toolResults = await processToolCalls(response.message.tool_calls, filters);
            
            // Agregar instrucción para que presente los datos de forma ejecutiva
            const presentationPrompt: ChatMessage = {
                role: 'system',
                content: `INSTRUCCIÓN: Los datos han sido obtenidos exitosamente. 
Ahora DEBES responder al usuario en TEXTO PLANO (no JSON, no código) con la información.
Formato requerido:
- Responde en español de forma clara y concisa
- USA **negritas** para números importantes
- NO muestres SQL, JSON, ni código
- NO llames más herramientas, ya tienes los datos
Responde ahora al usuario con los datos obtenidos:`
            };
            
            const messagesWithTools: ChatMessage[] = [
                ...messages,
                response.message,
                ...toolResults,
                presentationPrompt
            ];

            response = await chat(messagesWithTools);
            
            // Detectar tool calls en el contenido nuevamente
            const nextToolCall = parseToolCallFromContent(response.message?.content || '');
            if (nextToolCall && !response.message.tool_calls) {
                console.log('Detected another tool call in content:', nextToolCall.name);
                response.message.tool_calls = [{
                    id: `call_${Date.now()}`,
                    type: 'function',
                    function: {
                        name: nextToolCall.name,
                        arguments: JSON.stringify(nextToolCall.parameters)
                    }
                }];
            }
            
            messages = messagesWithTools;
            iterations++;
        }

        // Limpiar respuesta si contiene SQL o JSON crudo
        let cleanContent = response.message.content || '';
        console.log('Raw LLM content:', cleanContent.substring(0, 500));
        
        // Remover bloques de código SQL si se escaparon
        cleanContent = cleanContent.replace(/```sql[\s\S]*?```/gi, '');
        cleanContent = cleanContent.replace(/```json[\s\S]*?```/gi, '');
        cleanContent = cleanContent.replace(/SELECT\s+.*?FROM\s+.*?(WHERE|GROUP|ORDER|;|$)/gi, '');
        
        // Limpiar espacios múltiples
        cleanContent = cleanContent.replace(/\n{3,}/g, '\n\n').trim();
        
        console.log('Clean content length:', cleanContent.length);
        console.log(`Response generated after ${iterations} tool iterations`);

        return NextResponse.json({
            message: { ...response.message, content: cleanContent },
            content: cleanContent,
            usage: {
                prompt_tokens: response.prompt_eval_count,
                completion_tokens: response.eval_count
            }
        });

    } catch (error) {
        console.error('handleNonStreamingResponse error:', error);
        return NextResponse.json({
            message: { role: 'assistant', content: 'Lo siento, hubo un error procesando tu consulta. Por favor intenta de nuevo.' },
            content: 'Lo siento, hubo un error procesando tu consulta. Por favor intenta de nuevo.'
        });
    }
}

/**
 * Procesa las llamadas a herramientas del LLM
 */
async function processToolCalls(toolCalls: any[], filters: FilterParams): Promise<ChatMessage[]> {
    const results: ChatMessage[] = [];

    for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        let args: any;
        
        try {
            args = typeof toolCall.function.arguments === 'string' 
                ? JSON.parse(toolCall.function.arguments)
                : toolCall.function.arguments;
        } catch {
            args = {};
        }

        let result: string;

        try {
            switch (functionName) {
                case 'execute_sql_query':
                    result = await handleExecuteSQL(args);
                    break;
                case 'get_current_metrics':
                    result = await handleGetMetrics(args, filters);
                    break;
                case 'analyze_product':
                    result = await handleAnalyzeProduct(args, filters);
                    break;
                case 'compare_periods':
                    result = await handleComparePeriods(args, filters);
                    break;
                case 'get_top_products':
                    result = await handleGetTopProducts(args, filters);
                    break;
                case 'get_stock_alerts':
                    result = await handleGetStockAlerts(args);
                    break;
                default:
                    result = JSON.stringify({ error: `Herramienta desconocida: ${functionName}` });
            }
        } catch (error) {
            result = JSON.stringify({ 
                error: `Error ejecutando ${functionName}`, 
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }

        results.push({
            role: 'tool',
            content: result,
            tool_call_id: toolCall.id || `call_${Date.now()}`
        });
    }

    return results;
}

/**
 * Herramienta: Ejecutar SQL
 * Retorna los datos formateados para presentación de negocio
 */
async function handleExecuteSQL(args: { query: string; explanation?: string }): Promise<string> {
    const { query, explanation } = args;
    
    const validation = validateSQL(query);
    if (!validation.isValid) {
        return JSON.stringify({ error: validation.error, message: 'No se pudo ejecutar la consulta' });
    }

    const result = await executeSafeSQL(query);
    
    if (!result.success) {
        return JSON.stringify({ error: result.error, message: 'Error al obtener los datos' });
    }

    // Formatear los datos para presentación de negocio
    const formattedData = result.data?.slice(0, 50).map((row: any) => {
        const formatted: any = {};
        for (const [key, value] of Object.entries(row)) {
            if (typeof value === 'number') {
                // Formatear números grandes
                if (key.toLowerCase().includes('venta') || key.toLowerCase().includes('precio') || key.toLowerCase().includes('costo') || key.toLowerCase().includes('sales')) {
                    formatted[key] = value >= 1000000 ? `$${(value / 1000000).toFixed(2)}M` : 
                                     value >= 1000 ? `$${(value / 1000).toFixed(1)}K` : 
                                     `$${value.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
                } else if (key.toLowerCase().includes('unidad') || key.toLowerCase().includes('cantidad') || key.toLowerCase().includes('stock') || key.toLowerCase().includes('units')) {
                    formatted[key] = value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` :
                                     value >= 1000 ? `${(value / 1000).toFixed(1)}K` :
                                     value.toLocaleString('es-AR');
                } else if (key.toLowerCase().includes('margen') || key.toLowerCase().includes('markup') || key.toLowerCase().includes('pct')) {
                    formatted[key] = `${value.toFixed(1)}%`;
                } else {
                    formatted[key] = value;
                }
            } else {
                formatted[key] = value;
            }
        }
        return formatted;
    });

    return JSON.stringify({
        descripcion: explanation || 'Datos obtenidos de la base de datos',
        cantidadRegistros: result.rowCount,
        datos: formattedData,
        tiempoEjecucion: `${result.executionTime}ms`
    });
}

/**
 * Herramienta: Obtener métricas actuales
 */
async function handleGetMetrics(args: { metric_type: string }, filters: FilterParams): Promise<string> {
    const whereClause = buildFilterConditions(filters);
    
    const query = `
        SELECT 
            SUM(T.Cantidad) as units,
            CAST(SUM(T.Precio) as decimal(18,2)) as sales,
            CAST(SUM(CAST(T.Cantidad as decimal(18,2)) * (1.22 * ISNULL(UC.ultimoCosto, 0))) as decimal(18,2)) as cost
        FROM Transacciones T
        LEFT JOIN (
            SELECT A.Base as BaseCol, MAX(UC.UltimoCosto) as ultimoCosto 
            FROM UltimaCompra UC
            INNER JOIN Articulos A ON A.IdArticulo = UC.BaseArticulo
            GROUP BY A.Base
        ) UC ON UC.BaseCol = T.BaseCol
        WHERE ${whereClause} AND T.Cantidad > 0
    `;

    const result = await executeSafeSQL(query);
    
    if (!result.success) {
        return JSON.stringify({ error: result.error });
    }

    const data = result.data?.[0] || { units: 0, sales: 0, cost: 0 };
    const margin = data.sales > 0 ? ((data.sales - data.cost) / data.sales) * 100 : null;
    const markup = data.cost > 0 ? ((data.sales - data.cost) / data.cost) * 100 : null;

    return JSON.stringify({
        metric_type: args.metric_type,
        units: data.units || 0,
        sales: data.sales || 0,
        cost: data.cost || 0,
        margin: margin?.toFixed(2),
        markup: markup?.toFixed(2)
    });
}

/**
 * Herramienta: Analizar producto
 */
async function handleAnalyzeProduct(args: { product_identifier: string }, filters: FilterParams): Promise<string> {
    const { product_identifier } = args;
    const whereClause = buildFilterConditions(filters);
    
    // Buscar por BaseCol o por descripción
    const searchCondition = product_identifier.length <= 13 
        ? `T.BaseCol = '${product_identifier}'`
        : `(T.DescripcionArticulo LIKE '%${product_identifier}%' OR T.DescripcionArticulo LIKE '%${product_identifier}%')`;

    const query = `
        SELECT TOP 5
            T.BaseCol,
            MAX(T.DescripcionArticulo) as Producto,
            MAX(T.DescripcionMarca) as Marca,
            SUM(T.Cantidad) as UnidadesVendidas,
            CAST(SUM(T.Precio) as decimal(18,2)) as VentaTotal,
            CAST(AVG(T.Precio / NULLIF(T.Cantidad, 0)) as decimal(18,2)) as PrecioPromedio,
            MAX(UC.ultimoCosto) as UltimoCosto,
            MAX(MS.TotalStock) as StockActual
        FROM Transacciones T
        LEFT JOIN (
            SELECT A.Base as BaseCol, MAX(UC.UltimoCosto) as ultimoCosto 
            FROM UltimaCompra UC
            INNER JOIN Articulos A ON A.IdArticulo = UC.BaseArticulo
            GROUP BY A.Base
        ) UC ON UC.BaseCol = T.BaseCol
        LEFT JOIN (
            SELECT A.Base as BaseCol, SUM(MS.TotalStock) as TotalStock
            FROM MovStockTotalResumen MS
            INNER JOIN Articulos A ON A.IdArticulo = MS.IdArticulo
            GROUP BY A.Base
        ) MS ON MS.BaseCol = T.BaseCol
        WHERE ${whereClause} AND ${searchCondition}
        GROUP BY T.BaseCol
        ORDER BY VentaTotal DESC
    `;

    const result = await executeSafeSQL(query);
    
    if (!result.success) {
        return JSON.stringify({ error: result.error });
    }

    return JSON.stringify({
        search: product_identifier,
        products: result.data
    });
}

/**
 * Herramienta: Comparar períodos
 */
async function handleComparePeriods(args: any, filters: FilterParams): Promise<string> {
    const { period1_start, period1_end, period2_start, period2_end, metrics } = args;
    
    // Construir filtros base sin fechas
    const baseFilters = { ...filters };
    delete (baseFilters as any).startDate;
    delete (baseFilters as any).endDate;
    
    const filterConditions = buildFilterConditions({ ...baseFilters, startDate: '', endDate: '' });

    const query = `
        SELECT 
            'period1' as periodo,
            SUM(Cantidad) as units,
            CAST(SUM(Precio) as decimal(18,2)) as sales
        FROM Transacciones
        WHERE Fecha >= '${period1_start}' AND Fecha <= '${period1_end}'
        ${filterConditions !== '1=1' ? `AND ${filterConditions}` : ''}
        UNION ALL
        SELECT 
            'period2' as periodo,
            SUM(Cantidad) as units,
            CAST(SUM(Precio) as decimal(18,2)) as sales
        FROM Transacciones
        WHERE Fecha >= '${period2_start}' AND Fecha <= '${period2_end}'
        ${filterConditions !== '1=1' ? `AND ${filterConditions}` : ''}
    `;

    const result = await executeSafeSQL(query);
    
    if (!result.success) {
        return JSON.stringify({ error: result.error });
    }

    const period1 = result.data?.find(r => r.periodo === 'period1') || { units: 0, sales: 0 };
    const period2 = result.data?.find(r => r.periodo === 'period2') || { units: 0, sales: 0 };

    const calcVariation = (current: number, previous: number) => 
        previous > 0 ? ((current - previous) / previous * 100).toFixed(2) : null;

    return JSON.stringify({
        period1: {
            dates: `${period1_start} a ${period1_end}`,
            units: period1.units,
            sales: period1.sales
        },
        period2: {
            dates: `${period2_start} a ${period2_end}`,
            units: period2.units,
            sales: period2.sales
        },
        variation: {
            units: calcVariation(period1.units, period2.units),
            sales: calcVariation(period1.sales, period2.sales)
        }
    });
}

/**
 * Herramienta: Top productos
 */
async function handleGetTopProducts(args: { criteria: string; limit?: string }, filters: FilterParams): Promise<string> {
    const { criteria, limit = '10' } = args;
    const whereClause = buildFilterConditions(filters);
    
    let orderBy = 'VentaTotal DESC';
    switch (criteria) {
        case 'units': orderBy = 'UnidadesVendidas DESC'; break;
        case 'margin': orderBy = 'MargenPct DESC'; break;
        case 'growth': orderBy = 'VentaTotal DESC'; break;
    }

    const query = `
        SELECT TOP ${parseInt(limit) || 10}
            T.BaseCol,
            MAX(T.DescripcionArticulo) as Producto,
            MAX(T.DescripcionMarca) as Marca,
            SUM(T.Cantidad) as UnidadesVendidas,
            CAST(SUM(T.Precio) as decimal(18,2)) as VentaTotal,
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
        WHERE ${whereClause} AND T.Cantidad > 0
        GROUP BY T.BaseCol
        HAVING SUM(T.Cantidad) > 0
        ORDER BY ${orderBy}
    `;

    const result = await executeSafeSQL(query);
    
    if (!result.success) {
        return JSON.stringify({ error: result.error });
    }

    return JSON.stringify({
        criteria,
        limit: parseInt(limit),
        products: result.data
    });
}

/**
 * Herramienta: Alertas de stock
 */
async function handleGetStockAlerts(args: { alert_type: string }): Promise<string> {
    const { alert_type } = args;
    
    let query: string;
    
    switch (alert_type) {
        case 'low_stock':
            query = `
                SELECT TOP 20
                    MS.IdArticulo,
                    A.Base as BaseCol,
                    MS.TotalStock,
                    MS.Pendientes as Pendiente
                FROM MovStockTotalResumen MS
                INNER JOIN Articulos A ON A.IdArticulo = MS.IdArticulo
                WHERE MS.TotalStock > 0 AND MS.TotalStock < 5
                ORDER BY MS.TotalStock ASC
            `;
            break;
        case 'overstock':
            query = `
                SELECT TOP 20
                    A.Base as BaseCol,
                    SUM(MS.TotalStock) as TotalStock
                FROM MovStockTotalResumen MS
                INNER JOIN Articulos A ON A.IdArticulo = MS.IdArticulo
                WHERE MS.TotalStock > 0
                GROUP BY A.Base
                HAVING SUM(MS.TotalStock) > 100
                ORDER BY SUM(MS.TotalStock) DESC
            `;
            break;
        default:
            query = `
                SELECT TOP 20
                    A.Base as BaseCol,
                    SUM(MS.TotalStock) as TotalStock,
                    SUM(ISNULL(MS.Pendientes, 0)) as Pendiente
                FROM MovStockTotalResumen MS
                INNER JOIN Articulos A ON A.IdArticulo = MS.IdArticulo
                WHERE MS.TotalStock > 0 OR ISNULL(MS.Pendientes, 0) > 0
                GROUP BY A.Base
                ORDER BY TotalStock ASC
            `;
    }

    const result = await executeSafeSQL(query);
    
    if (!result.success) {
        return JSON.stringify({ error: result.error });
    }

    return JSON.stringify({
        alert_type,
        count: result.rowCount,
        alerts: result.data
    });
}

/**
 * Crea una respuesta SSE (Server-Sent Events) desde un ReadableStream
 */
function createSSEResponse(textStream: ReadableStream<string>): Response {
    const encoder = new TextEncoder();
    const reader = textStream.getReader();

    const sseStream = new ReadableStream({
        async start(controller) {
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    
                    if (done) {
                        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                        controller.close();
                        break;
                    }

                    if (value) {
                        const sseData = `data: ${JSON.stringify({ content: value })}\n\n`;
                        controller.enqueue(encoder.encode(sseData));
                    }
                }
            } catch (error) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`));
                controller.close();
            }
        },
        cancel() {
            reader.cancel();
        }
    });

    return new Response(sseStream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}

/**
 * GET /api/chat/health
 * Verifica el estado del servicio
 */
export async function GET() {
    const ollamaHealthy = await checkOllamaHealth();
    
    return NextResponse.json({
        status: ollamaHealthy ? 'healthy' : 'unhealthy',
        ollama: ollamaHealthy,
        model: process.env.OLLAMA_MODEL || 'qwen2.5:14b',
        timestamp: new Date().toISOString()
    });
}
