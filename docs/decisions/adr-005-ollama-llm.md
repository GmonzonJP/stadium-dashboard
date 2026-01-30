# ADR-005: LLM Local con Ollama

## Estado
Aceptado

## Contexto
Stadium Dashboard necesita capacidades de IA para:
- StadiumGPT: Chatbot de análisis de datos
- Text-to-SQL: Conversión de preguntas a queries SQL
- Generación de insights y explicaciones

Restricciones:
- Datos sensibles del negocio (no pueden salir a la nube)
- Sin costos recurrentes de API (OpenAI, Anthropic)
- Baja latencia para análisis interactivo
- Servidor disponible con recursos significativos

## Decisión
Implementar Ollama como servidor de LLM local con modelo Qwen 2.5 72B.

### Configuración:
```typescript
const OLLAMA_CONFIG = {
  baseUrl: 'http://127.0.0.1:11434',
  model: 'qwen2.5:72b',
  options: {
    num_predict: 512,      // Max tokens de respuesta
    temperature: 0.7,
    top_p: 0.9
  }
};
```

### Endpoints utilizados:
- `POST /api/generate`: Generación de texto
- `POST /api/chat`: Chat conversacional

## Alternativas Consideradas

### 1. OpenAI API (GPT-4)
- **Pro**: Mejor calidad de respuestas
- **Pro**: Sin gestión de infraestructura
- **Contra**: Datos salen a la nube (compliance)
- **Contra**: Costo por token (~$0.03-0.06/1K tokens)
- **Contra**: Dependencia de servicio externo

### 2. Anthropic Claude
- **Pro**: Excelente para análisis
- **Contra**: Mismos problemas que OpenAI

### 3. Azure OpenAI (región local)
- **Pro**: Compliance potencialmente mejor
- **Contra**: Sigue siendo cloud
- **Contra**: Complejidad de configuración

### 4. LLM más pequeño (Llama 7B, etc.)
- **Pro**: Menos recursos
- **Contra**: Calidad insuficiente para SQL generation

### 5. Fine-tuning de modelo propio
- **Pro**: Modelo especializado
- **Contra**: Requiere datos de entrenamiento
- **Contra**: Complejidad significativa

## Consecuencias

### Positivas
- Datos nunca salen del servidor local
- Sin costos por uso (solo electricidad)
- Latencia baja (red local)
- Control total sobre el modelo
- Funciona sin internet

### Negativas
- Requiere GPU o CPU potente (48 cores actuales)
- Modelo de 72B necesita ~45GB RAM para inferencia
- Calidad menor que GPT-4/Claude
- Mantenimiento de infraestructura propia
- Actualizaciones manuales del modelo

## Especificaciones del Servidor

```
Servidor: aisrv (10.120.0.24)
CPU: Intel Xeon Gold 6426Y (48 cores, 2 sockets)
RAM: 192 GB
Modelo: Qwen 2.5 72B (quantized)
Modo: CPU-only (sin GPU)
```

## Implementación

### Archivo principal: `src/lib/llm-service.ts`

```typescript
export async function generateResponse(
  prompt: string,
  context?: string
): Promise<string> {
  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: buildPrompt(prompt, context),
      stream: false,
      options: { num_predict: 512 }
    })
  });

  const data = await response.json();
  return data.response;
}
```

### Streaming para chat:

```typescript
export async function* streamChat(
  messages: Message[]
): AsyncGenerator<string> {
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages,
      stream: true
    })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line) {
        const data = JSON.parse(line);
        if (data.message?.content) {
          yield data.message.content;
        }
      }
    }
  }
}
```

## System Prompts

### StadiumGPT
```
Eres StadiumGPT, un asistente especializado en análisis de datos
de retail deportivo para Stadium (Uruguay).

Tienes acceso a datos de:
- Ventas y transacciones
- Stock e inventario
- Productos y marcas
- Tiendas

Responde siempre en español. Si no tienes datos suficientes,
indica qué información adicional necesitas.

Moneda: Pesos uruguayos ($)
```

### Text-to-SQL
```
Genera consultas SQL SELECT para SQL Server basadas en preguntas
del usuario.

REGLAS:
1. Solo SELECT, nunca INSERT/UPDATE/DELETE
2. Usa TOP 500 por defecto
3. Solo las tablas del esquema proporcionado
4. Devuelve el SQL en formato limpio sin explicaciones

ESQUEMA:
[esquema de tablas...]
```

## Configuración de Ollama

```bash
# Instalación
curl -fsSL https://ollama.ai/install.sh | sh

# Descargar modelo
ollama pull qwen2.5:72b

# Servicio systemd
sudo systemctl enable ollama
sudo systemctl start ollama

# Verificar
curl http://localhost:11434/api/tags
```

## Timeouts y Resiliencia

```typescript
// Timeout largo para modelos grandes
const GENERATION_TIMEOUT = 300000; // 5 minutos

// Retry con backoff
async function generateWithRetry(prompt: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await generateResponse(prompt);
    } catch (error) {
      if (i === retries - 1) throw error;
      await sleep(1000 * (i + 1)); // 1s, 2s, 3s
    }
  }
}
```

## Métricas de Performance

Observado en producción:
- Tiempo promedio de respuesta: 15-45 segundos
- Tokens por segundo: ~5-10 (CPU-only)
- Uso de RAM: ~45-60 GB durante inferencia
- Uso de CPU: 80-100% durante generación

## Mejoras Futuras

1. **GPU**: Agregar GPU para 10x más velocidad
2. **Modelo más pequeño**: Qwen 2.5 14B para consultas simples
3. **Caché de respuestas**: Para preguntas frecuentes
4. **Fine-tuning**: Modelo especializado en el dominio
