# ADR-003: Seguridad de Text-to-SQL

## Estado
Aceptado

## Contexto
Stadium Dashboard incluye una funcionalidad de "consulta en lenguaje natural" donde el usuario puede hacer preguntas como "¿Cuánto vendió Nike?" y el sistema genera y ejecuta SQL automáticamente.

Esto presenta riesgos de seguridad significativos:
- SQL Injection (el LLM podría generar SQL malicioso)
- Acceso a datos no autorizados
- Modificación/eliminación de datos
- Ejecución de procedimientos peligrosos

## Decisión
Implementar seguridad en capas (Defense in Depth):

### Capa 1: Whitelist de Tablas
```typescript
const ALLOWED_TABLES = new Set([
  'transacciones',
  'ultimacompra',
  'articuloprecio',
  'movstocktotalresumen',
  'tiendas',
  'articulos',
  'colores'
]);
```

### Capa 2: Palabras Clave Prohibidas
```typescript
const FORBIDDEN_KEYWORDS = [
  'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE',
  'TRUNCATE', 'EXEC', 'EXECUTE', 'sp_', 'xp_', 'GRANT',
  'REVOKE', 'DENY', 'BACKUP', 'RESTORE', 'SHUTDOWN',
  'DBCC', 'OPENQUERY', 'OPENROWSET', 'BULK'
];
```

### Capa 3: Validaciones Estructurales
- Query DEBE comenzar con SELECT
- NO múltiples statements (;)
- Comentarios SQL removidos

### Capa 4: Límites de Resultados
```typescript
const DEFAULT_ROW_LIMIT = 500;
const MAX_ROW_LIMIT = 1000;
```

### Capa 5: Timeout
```typescript
const QUERY_TIMEOUT = 15000; // 15 segundos
```

### Capa 6: Auditoría
```typescript
// Todas las queries se loguean
await logQuery({
  userId: user.id,
  question: userQuestion,
  generatedSQL: sql,
  success: true,
  timestamp: new Date()
});
```

## Alternativas Consideradas

### 1. Solo Whitelist de Tablas
- **Contra**: No previene UPDATE/DELETE en tablas permitidas

### 2. Usuario de BD de solo lectura
- **Pro**: Protección a nivel de BD
- **Contra**: Requiere configuración DBA
- **Contra**: No previene queries costosas
- **Decisión**: Implementar como mejora futura

### 3. Sandbox/VM para ejecución
- **Pro**: Aislamiento completo
- **Contra**: Complejidad excesiva
- **Contra**: Latencia adicional

### 4. No ofrecer Text-to-SQL
- **Pro**: Sin riesgo
- **Contra**: Pierde funcionalidad valiosa

## Consecuencias

### Positivas
- Múltiples capas de protección
- Ataques deben superar todas las capas
- Queries limitadas en tiempo y resultados
- Auditoría completa para investigación

### Negativas
- Puede rechazar queries legítimas (falsos positivos)
- Overhead de validación en cada query
- Mantenimiento de listas de palabras prohibidas

## Validación Implementada

```typescript
function validateSQL(sql: string): ValidationResult {
  // 1. Debe comenzar con SELECT
  if (!sql.trim().toUpperCase().startsWith('SELECT')) {
    return { valid: false, error: 'Solo SELECT permitido' };
  }

  // 2. Sin palabras prohibidas
  const upper = sql.toUpperCase();
  for (const keyword of FORBIDDEN_KEYWORDS) {
    if (upper.includes(keyword)) {
      return { valid: false, error: `Palabra prohibida: ${keyword}` };
    }
  }

  // 3. Sin múltiples statements
  if (sql.includes(';') && sql.indexOf(';') < sql.length - 1) {
    return { valid: false, error: 'Múltiples statements no permitidos' };
  }

  // 4. Verificar tablas usadas
  const tablesUsed = extractTables(sql);
  for (const table of tablesUsed) {
    if (!ALLOWED_TABLES.has(table.toLowerCase())) {
      return { valid: false, error: `Tabla no permitida: ${table}` };
    }
  }

  return { valid: true };
}
```

## Prompt de Sistema para LLM

El prompt incluye instrucciones explícitas:
```
REGLAS ESTRICTAS:
1. Solo genera SELECT, nunca INSERT/UPDATE/DELETE
2. Solo usa las tablas listadas en el esquema
3. Incluye TOP 500 en todas las queries
4. No uses subconsultas que podrían ser costosas
5. No inventes nombres de columnas
```

## Logs y Auditoría

Cada query se registra en:
- `logs/text-to-sql-YYYY-MM-DD.log`

Formato:
```json
{
  "timestamp": "2026-01-28T10:30:00Z",
  "userId": 1,
  "question": "¿Cuánto vendió Nike?",
  "sql": "SELECT SUM(venta) FROM Transacciones WHERE marca='Nike'",
  "valid": true,
  "executionTime": 234,
  "rowCount": 1
}
```

## Mejoras Futuras

1. **Usuario de BD readonly**: Crear usuario SQL con solo SELECT en tablas específicas
2. **Rate Limiting más estricto**: Por usuario, no solo por IP
3. **Query Cost Estimation**: Rechazar queries potencialmente costosas
4. **Revisión humana**: Para queries de usuarios nuevos
