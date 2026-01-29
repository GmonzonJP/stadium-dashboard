/**
 * LLM Service - Cliente para Ollama API
 * Comunicación directa con Ollama usando fetch nativo
 * Sin dependencias de Vercel o servicios cloud
 */
import { Agent } from 'undici';

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
}

export interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}

export interface OllamaResponse {
    model: string;
    created_at: string;
    message: ChatMessage;
    done: boolean;
    total_duration?: number;
    load_duration?: number;
    prompt_eval_count?: number;
    eval_count?: number;
}

export interface StreamChunk {
    model: string;
    created_at: string;
    message: {
        role: string;
        content: string;
    };
    done: boolean;
}

export interface Tool {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: {
            type: 'object';
            properties: Record<string, {
                type: string;
                description: string;
                enum?: string[];
            }>;
            required: string[];
        };
    };
}

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:14b';
const OLLAMA_HEADERS_TIMEOUT_MS = Number(process.env.OLLAMA_HEADERS_TIMEOUT_MS || 300000);
const OLLAMA_MAX_TOKENS = Number(process.env.OLLAMA_MAX_TOKENS || 512);

const ollamaDispatcher = new Agent({
    headersTimeout: OLLAMA_HEADERS_TIMEOUT_MS,
    bodyTimeout: OLLAMA_HEADERS_TIMEOUT_MS
});
const ollamaFetchOptions = { dispatcher: ollamaDispatcher } as RequestInit;

/**
 * Verifica si Ollama está disponible
 */
export async function checkOllamaHealth(): Promise<boolean> {
    try {
        const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
            method: 'GET',
            ...ollamaFetchOptions
        });
        return response.ok;
    } catch (error) {
        console.error('Ollama health check failed:', error);
        return false;
    }
}

/**
 * Lista los modelos disponibles en Ollama
 */
export async function listModels(): Promise<string[]> {
    try {
        const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
            ...ollamaFetchOptions
        });
        if (!response.ok) return [];
        const data = await response.json();
        return data.models?.map((m: { name: string }) => m.name) || [];
    } catch (error) {
        console.error('Error listing models:', error);
        return [];
    }
}

/**
 * Envía un mensaje al LLM y obtiene respuesta completa (sin streaming)
 */
export async function chat(
    messages: ChatMessage[],
    tools?: Tool[],
    options?: {
        temperature?: number;
        max_tokens?: number;
    }
): Promise<OllamaResponse> {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...ollamaFetchOptions,
        body: JSON.stringify({
            model: OLLAMA_MODEL,
            messages,
            tools,
            stream: false,
            options: {
                temperature: options?.temperature ?? 0.7,
                num_predict: options?.max_tokens ?? OLLAMA_MAX_TOKENS,
            },
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${error}`);
    }

    return response.json();
}

/**
 * Envía un mensaje al LLM con streaming (Server-Sent Events)
 * Retorna un ReadableStream para procesar chunks
 */
export async function chatStream(
    messages: ChatMessage[],
    tools?: Tool[],
    options?: {
        temperature?: number;
        max_tokens?: number;
    }
): Promise<ReadableStream<Uint8Array>> {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...ollamaFetchOptions,
        body: JSON.stringify({
            model: OLLAMA_MODEL,
            messages,
            tools,
            stream: true,
            options: {
                temperature: options?.temperature ?? 0.7,
                num_predict: options?.max_tokens ?? OLLAMA_MAX_TOKENS,
            },
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${error}`);
    }

    if (!response.body) {
        throw new Error('No response body from Ollama');
    }

    return response.body;
}

/**
 * Procesa el stream de Ollama y extrae el contenido
 * Genera un nuevo stream con solo el texto de respuesta
 */
export function createTextStream(ollamaStream: ReadableStream<Uint8Array>): ReadableStream<string> {
    const reader = ollamaStream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    return new ReadableStream<string>({
        async pull(controller) {
            try {
                const { done, value } = await reader.read();
                
                if (done) {
                    controller.close();
                    return;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.trim()) {
                        try {
                            const chunk: StreamChunk = JSON.parse(line);
                            if (chunk.message?.content) {
                                controller.enqueue(chunk.message.content);
                            }
                            if (chunk.done) {
                                controller.close();
                                return;
                            }
                        } catch (e) {
                            // Línea no es JSON válido, ignorar
                        }
                    }
                }
            } catch (error) {
                controller.error(error);
            }
        },
        cancel() {
            reader.cancel();
        }
    });
}

/**
 * Definición de herramientas disponibles para el LLM
 */
export const STADIUM_TOOLS: Tool[] = [
    {
        type: 'function',
        function: {
            name: 'execute_sql_query',
            description: 'Ejecuta una consulta SQL SELECT en la base de datos del warehouse para obtener datos de ventas, productos, stock, etc. Solo se permiten consultas SELECT.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'La consulta SQL SELECT a ejecutar. Debe ser una consulta válida de SQL Server.'
                    },
                    explanation: {
                        type: 'string',
                        description: 'Explicación breve de qué datos obtiene esta consulta.'
                    }
                },
                required: ['query', 'explanation']
            }
        }
    }
];

/**
 * Sistema prompt para StadiumGPT - CON ESQUEMA REAL DE LA BASE DE DATOS
 * Actualizado con nombres de columnas correctos
 */
export const SYSTEM_PROMPT = `Eres StadiumGPT, asistente experto en análisis de datos de Stadium (cadena de retail deportivo en Uruguay).

## REGLAS CRÍTICAS:
1. NUNCA muestres código SQL al usuario
2. NUNCA inventes datos - usa SOLO la información proporcionada en el contexto
3. Responde siempre en español de forma profesional y ejecutiva
4. Usa **negritas** para destacar cifras importantes
5. Los montos están en **UYU (pesos uruguayos)** - formatear como $60.3M, $15.3K, etc.
6. Si no tienes datos de algo, di claramente "No tengo esa información en el contexto actual"

## ESQUEMA REAL DE LA BASE DE DATOS:

### TABLA: Transacciones (Ventas - tabla principal)
| Columna | Descripción |
|---------|-------------|
| Fecha | Fecha de la transacción |
| IdDeposito | ID de la tienda/sucursal |
| IdArticulo | Código completo del artículo |
| Cantidad | Unidades vendidas (+) o devueltas (-) |
| PRECIO | Importe total de la venta en UYU |
| Costo | Costo del producto |
| CostoFinal | Costo con IVA |
| MargenPorc | Porcentaje de margen |
| MargenMonto | Margen en pesos |
| IdMarca | ID de la marca |
| DescripcionMarca | Nombre de la marca |
| IdClase | ID de la categoría |
| DescripcionClase | Categoría (Calzado, Indumentaria, etc.) |
| IdGenero | ID del género |
| DescripcionGenero | Género (Hombre, Mujer, Niño, Unisex) |
| idProveedor | ID del proveedor |
| NombreProveedor | Nombre del proveedor |
| BaseCol | Código base del modelo (13 caracteres) |
| DescripcionArticulo | Descripción completa del producto |
| CodBase | Código base |
| CodColor | Código de color |
| CodTalle | Código de talla |
| PrecioLista | Precio de lista original |
| descuento | Descuento aplicado |

### TABLA: UltimaCompra (Costos)
| Columna | Descripción |
|---------|-------------|
| BaseArticulo | Código del artículo |
| UltimoCosto | Último costo de compra (sin IVA) |

### TABLA: MovStockTotalResumen (Stock)
| Columna | Descripción |
|---------|-------------|
| IdArticulo | Código del artículo |
| TotalStock | Stock disponible actual |

### TABLA: Tiendas
| Columna | Descripción |
|---------|-------------|
| IdTienda | ID de la tienda |
| Descripcion | Nombre de la tienda |

## MARCAS PRINCIPALES DE STADIUM (REALES):
Miss Carol, Adidas, Puma, Umbro, New Balance, Converse, Freeway, Tiffosi, Mini Miss Carol, Havaianas, Vans, Reebok, Fila, Topper

## RELACIONES:
- Transacciones.BaseCol = Articulos.Base (código base del producto)
- Para UltimaCompra: JOIN Articulos A ON A.IdArticulo = UltimaCompra.BaseArticulo, luego usar A.Base
- Para MovStockTotalResumen: JOIN Articulos A ON A.IdArticulo = MovStockTotalResumen.IdArticulo, luego usar A.Base
- Transacciones.IdDeposito = Tiendas.IdTienda
- IMPORTANTE: NO usar SUBSTRING para obtener código base, usar JOIN con Articulos

## FÓRMULAS:
- Costo con IVA = Costo × 1.22 (o usar CostoFinal directamente)
- Margen (%) = MargenPorc (ya calculado) o ((PRECIO - CostoFinal) / PRECIO × 100)
- Ticket Promedio = Total Ventas / Total Unidades

## DATOS DEL CONTEXTO ACTUAL:
{CONTEXT}

## INSTRUCCIONES:
1. Responde SOLO con los datos del contexto proporcionado arriba
2. Las cifras están en UYU (pesos uruguayos)
3. NO inventes marcas, productos ni números
4. Si no tienes la información, dilo claramente
5. Presenta la información de forma ejecutiva y profesional`;
