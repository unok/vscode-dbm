import type { DatabaseSchema, ValidationError } from "../types/sql";

export class SQLQueryValidator {
  private schema: DatabaseSchema;
  private sqlKeywords: Set<string>;
  private dangerousKeywords: Set<string>;
  private aggregateFunctions: Set<string>;

  constructor(schema: DatabaseSchema) {
    this.schema = schema;

    this.sqlKeywords = new Set([
      "SELECT",
      "FROM",
      "WHERE",
      "JOIN",
      "LEFT",
      "RIGHT",
      "INNER",
      "OUTER",
      "ON",
      "GROUP BY",
      "ORDER BY",
      "HAVING",
      "LIMIT",
      "OFFSET",
      "UNION",
      "INSERT",
      "INTO",
      "VALUES",
      "UPDATE",
      "SET",
      "DELETE",
      "CREATE",
      "ALTER",
      "DROP",
      "TRUNCATE",
      "INDEX",
      "VIEW",
      "TABLE",
      "DATABASE",
      "AND",
      "OR",
      "NOT",
      "IN",
      "EXISTS",
      "BETWEEN",
      "LIKE",
      "IS",
      "NULL",
      "AS",
      "DISTINCT",
      "ALL",
      "ANY",
      "SOME",
      "CASE",
      "WHEN",
      "THEN",
      "ELSE",
      "END",
      "IF",
      "WHILE",
      "FOR",
      "DECLARE",
      "BEGIN",
      "COMMIT",
      "ROLLBACK",
      "TRANSACTION",
      "START",
      "SAVEPOINT",
      "GRANT",
      "REVOKE",
    ]);

    this.dangerousKeywords = new Set([
      "DROP",
      "TRUNCATE",
      "DELETE",
      "ALTER",
      "CREATE",
      "GRANT",
      "REVOKE",
      "EXEC",
      "EXECUTE",
      "SHUTDOWN",
      "SCRIPT",
    ]);

    this.aggregateFunctions = new Set([
      "COUNT",
      "SUM",
      "AVG",
      "MIN",
      "MAX",
      "GROUP_CONCAT",
      "STRING_AGG",
    ]);
  }

  /**
   * Validate complete query
   */
  validateQuery(query: string): ValidationError[] {
    const errors: ValidationError[] = [];

    errors.push(...this.validateSyntax(query));
    errors.push(...this.validateSchema(query));
    errors.push(...this.validateSecurity(query));
    errors.push(...this.validatePerformance(query));

    return errors;
  }

  /**
   * Validate SQL syntax
   */
  validateSyntax(query: string): ValidationError[] {
    const errors: ValidationError[] = [];
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      return errors;
    }

    const statements = this.splitStatements(trimmedQuery);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (!statement) continue;

      const statementErrors = this.validateStatementSyntax(statement, i + 1);
      errors.push(...statementErrors);
    }

    return errors;
  }

  /**
   * Validate schema references
   */
  validateSchema(query: string): ValidationError[] {
    const errors: ValidationError[] = [];
    const _upperQuery = query.toUpperCase();

    // Find table references
    const tableMatches = query.match(/FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi);
    if (tableMatches) {
      for (const match of tableMatches) {
        const tableName = match.replace(/FROM\s+/i, "").trim();
        if (!this.tableExists(tableName)) {
          errors.push({
            type: "schema",
            message: `Table "${tableName}" does not exist`,
            severity: "error",
            code: "TABLE_NOT_FOUND",
          });
        }
      }
    }

    // Find JOIN table references
    const joinMatches = query.match(/JOIN\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi);
    if (joinMatches) {
      for (const match of joinMatches) {
        const tableName = match.replace(/.*JOIN\s+/i, "").trim();
        if (!this.tableExists(tableName)) {
          errors.push({
            type: "schema",
            message: `Table "${tableName}" does not exist in JOIN clause`,
            severity: "error",
            code: "TABLE_NOT_FOUND",
          });
        }
      }
    }

    // Validate column references (basic validation)
    const selectMatches = query.match(/SELECT\s+(.*?)\s+FROM/i);
    if (selectMatches?.[1]) {
      const columns = selectMatches[1].split(",").map((col) => col.trim());
      for (const column of columns) {
        if (column === "*") continue;

        const cleanColumn = column
          .replace(/\s+AS\s+[a-zA-Z_][a-zA-Z0-9_]*/i, "")
          .trim();
        if (cleanColumn.includes("(")) continue; // Skip functions

        const [tableAlias, columnName] = cleanColumn.includes(".")
          ? cleanColumn.split(".").map((s) => s.trim())
          : [null, cleanColumn];

        if (columnName && !this.columnExists(columnName, tableAlias)) {
          errors.push({
            type: "schema",
            message: `Column "${cleanColumn}" does not exist`,
            severity: "error",
            code: "COLUMN_NOT_FOUND",
          });
        }
      }
    }

    return errors;
  }

  /**
   * Validate security concerns
   */
  validateSecurity(query: string): ValidationError[] {
    const errors: ValidationError[] = [];
    const upperQuery = query.toUpperCase();

    // Check for dangerous operations
    for (const keyword of this.dangerousKeywords) {
      if (upperQuery.includes(keyword)) {
        const severity =
          keyword === "DROP" || keyword === "TRUNCATE" ? "error" : "warning";
        errors.push({
          type: "security",
          message: `Potentially dangerous operation: ${keyword}`,
          severity,
          code: "DANGEROUS_OPERATION",
        });
      }
    }

    // Check for potential SQL injection patterns
    const injectionPatterns = [
      /;\s*DROP\s+/i,
      /;\s*DELETE\s+/i,
      /;\s*TRUNCATE\s+/i,
      /'\s*OR\s+'[^']*'\s*=\s*'[^']*'/i,
      /'\s*OR\s+1\s*=\s*1/i,
      /UNION\s+SELECT/i,
      /'\s*;\s*--/i,
      /'\s*;\s*\/\*/i,
    ];

    for (const pattern of injectionPatterns) {
      if (pattern.test(query)) {
        errors.push({
          type: "security",
          message: "Potential SQL injection detected",
          severity: "error",
          code: "SQL_INJECTION",
        });
        break;
      }
    }

    // Check for unparameterized string concatenation
    if (query.includes("' + ") || query.includes("' || ")) {
      errors.push({
        type: "security",
        message: "Use parameterized queries instead of string concatenation",
        severity: "warning",
        code: "STRING_CONCATENATION",
      });
    }

    return errors;
  }

  /**
   * Validate performance concerns
   */
  validatePerformance(query: string): ValidationError[] {
    const errors: ValidationError[] = [];
    const upperQuery = query.toUpperCase();

    // Check for SELECT * usage
    if (upperQuery.includes("SELECT *")) {
      errors.push({
        type: "performance",
        message: "Avoid SELECT * - specify only needed columns",
        severity: "warning",
        code: "SELECT_STAR",
      });
    }

    // Check for missing WHERE clause in UPDATE/DELETE
    if (
      (upperQuery.includes("UPDATE ") && !upperQuery.includes("WHERE")) ||
      (upperQuery.includes("DELETE ") && !upperQuery.includes("WHERE"))
    ) {
      errors.push({
        type: "performance",
        message: "UPDATE/DELETE without WHERE clause affects all rows",
        severity: "warning",
        code: "MISSING_WHERE",
      });
    }

    // Check for missing LIMIT in potentially large result sets
    if (
      upperQuery.includes("SELECT") &&
      upperQuery.includes("ORDER BY") &&
      !upperQuery.includes("LIMIT")
    ) {
      errors.push({
        type: "performance",
        message: "Consider adding LIMIT to avoid large result sets",
        severity: "info",
        code: "MISSING_LIMIT",
      });
    }

    // Check for functions in WHERE clause
    const functionsInWhere = query.match(/WHERE\s+.*?([A-Z_]+\([^)]*\))/i);
    if (functionsInWhere) {
      errors.push({
        type: "performance",
        message: "Functions in WHERE clause may prevent index usage",
        severity: "info",
        code: "FUNCTION_IN_WHERE",
      });
    }

    // Check for LIKE with leading wildcard
    if (query.match(/LIKE\s+'%[^%]/i)) {
      errors.push({
        type: "performance",
        message: "LIKE with leading wildcard prevents index usage",
        severity: "info",
        code: "LEADING_WILDCARD",
      });
    }

    return errors;
  }

  /**
   * Split query into individual statements
   */
  private splitStatements(query: string): string[] {
    const statements: string[] = [];
    let current = "";
    let inString = false;
    let stringChar = "";
    let inComment = false;

    for (let i = 0; i < query.length; i++) {
      const char = query[i];
      const nextChar = query[i + 1];

      if (inComment) {
        if (char === "*" && nextChar === "/") {
          inComment = false;
          i++; // Skip the '/'
        }
        continue;
      }

      if (char === "/" && nextChar === "*") {
        inComment = true;
        i++; // Skip the '*'
        continue;
      }

      if (char === "-" && nextChar === "-") {
        // Line comment - skip to end of line
        while (i < query.length && query[i] !== "\n") {
          i++;
        }
        continue;
      }

      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar) {
        if (nextChar === stringChar) {
          // Escaped quote
          current += char + nextChar;
          i++;
          continue;
        }
        inString = false;
        stringChar = "";
      }

      if (!inString && char === ";") {
        if (current.trim()) {
          statements.push(current.trim());
        }
        current = "";
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      statements.push(current.trim());
    }

    return statements;
  }

  /**
   * Validate individual statement syntax
   */
  private validateStatementSyntax(
    statement: string,
    lineNumber: number,
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    const upperStatement = statement.toUpperCase().trim();

    if (!upperStatement) {
      return errors;
    }

    // Basic syntax checks
    if (upperStatement.startsWith("SELECT")) {
      if (
        !upperStatement.includes("FROM") &&
        !upperStatement.match(/SELECT\s+[\d'"]/)
      ) {
        errors.push({
          type: "syntax",
          message: "SELECT statement missing FROM clause",
          line: lineNumber,
          severity: "error",
          code: "MISSING_FROM",
        });
      }
    }

    if (upperStatement.startsWith("INSERT")) {
      if (!upperStatement.includes("INTO")) {
        errors.push({
          type: "syntax",
          message: "INSERT statement missing INTO clause",
          line: lineNumber,
          severity: "error",
          code: "MISSING_INTO",
        });
      }
      if (
        !upperStatement.includes("VALUES") &&
        !upperStatement.includes("SELECT")
      ) {
        errors.push({
          type: "syntax",
          message: "INSERT statement missing VALUES or SELECT clause",
          line: lineNumber,
          severity: "error",
          code: "MISSING_VALUES",
        });
      }
    }

    if (upperStatement.startsWith("UPDATE")) {
      if (!upperStatement.includes("SET")) {
        errors.push({
          type: "syntax",
          message: "UPDATE statement missing SET clause",
          line: lineNumber,
          severity: "error",
          code: "MISSING_SET",
        });
      }
    }

    if (upperStatement.startsWith("DELETE")) {
      if (!upperStatement.includes("FROM")) {
        errors.push({
          type: "syntax",
          message: "DELETE statement missing FROM clause",
          line: lineNumber,
          severity: "error",
          code: "MISSING_FROM",
        });
      }
    }

    // Check for unmatched parentheses
    const openParens = (statement.match(/\(/g) || []).length;
    const closeParens = (statement.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      errors.push({
        type: "syntax",
        message: "Unmatched parentheses",
        line: lineNumber,
        severity: "error",
        code: "UNMATCHED_PARENS",
      });
    }

    // Check for unmatched quotes
    const singleQuotes = (statement.match(/'/g) || []).length;
    const doubleQuotes = (statement.match(/"/g) || []).length;
    if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0) {
      errors.push({
        type: "syntax",
        message: "Unmatched quotes",
        line: lineNumber,
        severity: "error",
        code: "UNMATCHED_QUOTES",
      });
    }

    return errors;
  }

  /**
   * Check if table exists in schema
   */
  private tableExists(tableName: string): boolean {
    return this.schema.tables.some(
      (table) => table.name.toLowerCase() === tableName.toLowerCase(),
    );
  }

  /**
   * Check if column exists
   */
  private columnExists(
    columnName: string,
    tableAlias?: string | null,
  ): boolean {
    if (!tableAlias) {
      // Check all tables for the column
      return this.schema.tables.some((table) =>
        table.columns.some(
          (col) => col.name.toLowerCase() === columnName.toLowerCase(),
        ),
      );
    }

    // Find table by alias (simplified - in real implementation would track aliases)
    const table = this.schema.tables.find(
      (t) => t.name.toLowerCase() === tableAlias.toLowerCase(),
    );

    if (!table) {
      return false;
    }

    return table.columns.some(
      (col) => col.name.toLowerCase() === columnName.toLowerCase(),
    );
  }

  /**
   * Update schema
   */
  updateSchema(newSchema: DatabaseSchema): void {
    this.schema = newSchema;
  }

  /**
   * Get schema information
   */
  getSchema(): DatabaseSchema {
    return this.schema;
  }
}
