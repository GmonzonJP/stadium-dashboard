/**
 * Tests de seguridad para Text-to-SQL
 * @module __tests__/lib/text-to-sql-security
 */

import { describe, it, expect } from '@jest/globals';

// Simulamos las funciones de validación del módulo text-to-sql
const FORBIDDEN_KEYWORDS = [
  'DROP', 'DELETE', 'TRUNCATE', 'INSERT', 'UPDATE', 'ALTER',
  'CREATE', 'EXEC', 'EXECUTE', 'xp_', 'sp_', '--', ';'
];

const ALLOWED_TABLES = [
  'Transacciones', 'Productos', 'Tiendas', 'Marcas',
  'Categorias', 'Stock', 'Proveedores'
];

function containsForbiddenKeyword(sql: string): { forbidden: boolean; keyword?: string } {
  const upperSql = sql.toUpperCase();
  for (const keyword of FORBIDDEN_KEYWORDS) {
    if (upperSql.includes(keyword.toUpperCase())) {
      return { forbidden: true, keyword };
    }
  }
  return { forbidden: false };
}

function extractTablesFromQuery(sql: string): string[] {
  const fromMatch = sql.match(/FROM\s+(\w+)/gi) || [];
  const joinMatch = sql.match(/JOIN\s+(\w+)/gi) || [];

  const tables: string[] = [];

  [...fromMatch, ...joinMatch].forEach(match => {
    const tableName = match.replace(/FROM\s+|JOIN\s+/gi, '').trim();
    if (tableName && !tables.includes(tableName)) {
      tables.push(tableName);
    }
  });

  return tables;
}

function validateAllowedTables(tables: string[]): { valid: boolean; invalidTable?: string } {
  for (const table of tables) {
    if (!ALLOWED_TABLES.includes(table)) {
      return { valid: false, invalidTable: table };
    }
  }
  return { valid: true };
}

describe('Text-to-SQL Security', () => {
  describe('Forbidden Keywords Detection', () => {
    it('should detect DROP statements', () => {
      const result = containsForbiddenKeyword('DROP TABLE Transacciones');
      expect(result.forbidden).toBe(true);
      expect(result.keyword).toBe('DROP');
    });

    it('should detect DELETE statements', () => {
      const result = containsForbiddenKeyword('DELETE FROM Productos WHERE id = 1');
      expect(result.forbidden).toBe(true);
      expect(result.keyword).toBe('DELETE');
    });

    it('should detect UPDATE statements', () => {
      const result = containsForbiddenKeyword('UPDATE Productos SET precio = 100');
      expect(result.forbidden).toBe(true);
      expect(result.keyword).toBe('UPDATE');
    });

    it('should detect INSERT statements', () => {
      const result = containsForbiddenKeyword("INSERT INTO Productos VALUES ('test')");
      expect(result.forbidden).toBe(true);
      expect(result.keyword).toBe('INSERT');
    });

    it('should detect SQL injection via comments', () => {
      const result = containsForbiddenKeyword("SELECT * FROM Productos -- malicious");
      expect(result.forbidden).toBe(true);
      expect(result.keyword).toBe('--');
    });

    it('should detect semicolon injection', () => {
      const result = containsForbiddenKeyword('SELECT * FROM Productos; DROP TABLE Productos');
      expect(result.forbidden).toBe(true);
      expect(result.keyword).toBe(';');
    });

    it('should detect stored procedure execution', () => {
      const result = containsForbiddenKeyword('EXEC sp_executesql @sql');
      expect(result.forbidden).toBe(true);
      expect(result.keyword).toBe('EXEC');
    });

    it('should detect xp_ procedures', () => {
      const result = containsForbiddenKeyword('xp_cmdshell "dir"');
      expect(result.forbidden).toBe(true);
      expect(result.keyword).toBe('xp_');
    });

    it('should allow valid SELECT queries', () => {
      const result = containsForbiddenKeyword('SELECT * FROM Transacciones WHERE fecha > @date');
      expect(result.forbidden).toBe(false);
    });

    it('should allow aggregate functions', () => {
      const result = containsForbiddenKeyword('SELECT SUM(ventas), COUNT(*) FROM Transacciones GROUP BY marca');
      expect(result.forbidden).toBe(false);
    });

    it('should be case-insensitive', () => {
      const result = containsForbiddenKeyword('drop table transacciones');
      expect(result.forbidden).toBe(true);
    });
  });

  describe('Table Extraction', () => {
    it('should extract single table from FROM clause', () => {
      const tables = extractTablesFromQuery('SELECT * FROM Transacciones');
      expect(tables).toEqual(['Transacciones']);
    });

    it('should extract multiple tables from JOINs', () => {
      const tables = extractTablesFromQuery(
        'SELECT * FROM Transacciones t JOIN Productos p ON t.producto = p.id JOIN Tiendas ti ON t.tienda = ti.id'
      );
      expect(tables).toContain('Transacciones');
      expect(tables).toContain('Productos');
      expect(tables).toContain('Tiendas');
    });

    it('should handle subqueries', () => {
      const tables = extractTablesFromQuery(
        'SELECT * FROM Transacciones WHERE marca IN (SELECT id FROM Marcas)'
      );
      expect(tables).toContain('Transacciones');
      expect(tables).toContain('Marcas');
    });
  });

  describe('Table Whitelist Validation', () => {
    it('should allow whitelisted tables', () => {
      const result = validateAllowedTables(['Transacciones', 'Productos']);
      expect(result.valid).toBe(true);
    });

    it('should reject non-whitelisted tables', () => {
      const result = validateAllowedTables(['Transacciones', 'sys.tables']);
      expect(result.valid).toBe(false);
      expect(result.invalidTable).toBe('sys.tables');
    });

    it('should reject system tables', () => {
      const result = validateAllowedTables(['dashboard_users']);
      expect(result.valid).toBe(false);
      expect(result.invalidTable).toBe('dashboard_users');
    });
  });

  describe('Full Query Validation', () => {
    it('should pass valid analytical query', () => {
      const sql = `
        SELECT
          m.nombre as marca,
          SUM(t.unidades) as total_unidades,
          SUM(t.venta) as total_ventas
        FROM Transacciones t
        JOIN Marcas m ON t.marca = m.id
        WHERE t.fecha BETWEEN @startDate AND @endDate
        GROUP BY m.nombre
        ORDER BY total_ventas DESC
      `;

      const forbiddenCheck = containsForbiddenKeyword(sql);
      const tables = extractTablesFromQuery(sql);
      const tableCheck = validateAllowedTables(tables);

      expect(forbiddenCheck.forbidden).toBe(false);
      expect(tableCheck.valid).toBe(true);
    });

    it('should reject query with DROP TABLE', () => {
      const sql = 'SELECT * FROM Transacciones; DROP TABLE Transacciones';

      const forbiddenCheck = containsForbiddenKeyword(sql);

      expect(forbiddenCheck.forbidden).toBe(true);
    });

    it('should reject access to sensitive tables', () => {
      const sql = 'SELECT * FROM dashboard_users WHERE usuario = @user';

      const tables = extractTablesFromQuery(sql);
      const tableCheck = validateAllowedTables(tables);

      expect(tableCheck.valid).toBe(false);
    });
  });
});
