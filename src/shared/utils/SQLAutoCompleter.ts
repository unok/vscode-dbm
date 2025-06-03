import {
  ColumnSchema,
  CompletionInsertTextRule,
  type CompletionItem,
  CompletionItemKind,
  type DatabaseSchema,
  type Position,
  TableSchema,
} from "../types/sql"

interface CompletionCache {
  [key: string]: CompletionItem[]
}

interface QueryContext {
  inSelect: boolean
  inFrom: boolean
  inWhere: boolean
  inJoin: boolean
  inOrderBy: boolean
  inGroupBy: boolean
  inHaving: boolean
  tables: string[]
  aliases: Map<string, string>
  currentTable?: string
}

export class SQLAutoCompleter {
  private schema: DatabaseSchema
  private cache: CompletionCache = {}
  private sqlKeywords: string[] = []
  private sqlFunctions: string[] = []
  private sqlDataTypes: string[] = []
  private snippets: CompletionItem[] = []

  constructor(schema: DatabaseSchema) {
    this.schema = schema
    this.initializeKeywords()
    this.initializeFunctions()
    this.initializeDataTypes()
    this.initializeSnippets()
  }

  /**
   * Get completions for current position
   */
  getCompletions(query: string, position: Position): CompletionItem[] {
    const cacheKey = `${query}-${position.line}-${position.column}`

    if (this.cache[cacheKey]) {
      return this.cache[cacheKey]
    }

    const completions = this.generateCompletions(query, position)

    // Cache results (limit cache size for memory management)
    if (Object.keys(this.cache).length > 100) {
      this.cache = {}
    }
    this.cache[cacheKey] = completions

    return completions
  }

  /**
   * Generate completions based on context
   */
  generateCompletions(query: string, position: Position): CompletionItem[] {
    const completions: CompletionItem[] = []
    const context = this.analyzeQueryContext(query, position)
    const currentWord = this.getCurrentWord(query, position)
    const precedingText = this.getPrecedingText(query, position)

    // Get context-specific completions
    if (context.inSelect) {
      completions.push(...this.getSelectCompletions(context, currentWord))
    } else if (context.inFrom) {
      completions.push(...this.getFromCompletions(context, currentWord))
    } else if (context.inJoin) {
      completions.push(...this.getJoinCompletions(context, currentWord))
    } else if (context.inWhere || context.inHaving) {
      completions.push(...this.getWhereCompletions(context, currentWord))
    } else if (precedingText.trim() === "" || this.isStartOfStatement(precedingText)) {
      completions.push(...this.getStatementStartCompletions())
    } else {
      completions.push(...this.getGeneralCompletions(context, currentWord))
    }

    // Add keywords, functions, and snippets based on context
    completions.push(...this.getKeywordCompletions(currentWord, context))
    completions.push(...this.getFunctionCompletions(currentWord, context))

    if (currentWord.length === 0) {
      completions.push(...this.getSnippetCompletions(context))
    }

    // Filter and sort completions
    return this.filterAndSortCompletions(completions, currentWord)
  }

  /**
   * Get completions for SELECT clause
   */
  private getSelectCompletions(context: QueryContext, _currentWord: string): CompletionItem[] {
    const completions: CompletionItem[] = []

    // Add columns from available tables
    for (const tableName of context.tables) {
      const table = this.schema.tables.find((t) => t.name === tableName)
      if (table) {
        for (const column of table.columns) {
          completions.push({
            label: column.name,
            kind: CompletionItemKind.Column,
            detail: `${column.type} - ${table.name}`,
            documentation: column.comment,
            sortText: `column_${column.name}`,
          })
        }
      }
    }

    // Add qualified column names if there are multiple tables
    if (context.tables.length > 1) {
      for (const tableName of context.tables) {
        const table = this.schema.tables.find((t) => t.name === tableName)
        if (table) {
          for (const column of table.columns) {
            completions.push({
              label: `${tableName}.${column.name}`,
              kind: CompletionItemKind.Column,
              detail: `${column.type} - ${table.name}`,
              documentation: column.comment,
              sortText: `qualified_${tableName}_${column.name}`,
            })
          }
        }
      }
    }

    // Add aggregate functions
    const aggregateFunctions = ["COUNT", "SUM", "AVG", "MIN", "MAX", "GROUP_CONCAT"]
    for (const func of aggregateFunctions) {
      completions.push({
        label: `${func}()`,
        kind: CompletionItemKind.Function,
        detail: "Aggregate function",
        insertText: `${func}($1)`,
        insertTextRules: CompletionInsertTextRule.InsertAsSnippet,
        sortText: `function_${func}`,
      })
    }

    return completions
  }

  /**
   * Get completions for FROM clause
   */
  private getFromCompletions(_context: QueryContext, _currentWord: string): CompletionItem[] {
    const completions: CompletionItem[] = []

    // Add all tables
    for (const table of this.schema.tables) {
      completions.push({
        label: table.name,
        kind: CompletionItemKind.Table,
        detail: `Table - ${table.schema}`,
        documentation: table.comment,
        sortText: `table_${table.name}`,
      })
    }

    // Add all views
    for (const view of this.schema.views) {
      completions.push({
        label: view.name,
        kind: CompletionItemKind.Table,
        detail: `View - ${view.schema}`,
        documentation: view.comment,
        sortText: `view_${view.name}`,
      })
    }

    return completions
  }

  /**
   * Get completions for JOIN clause
   */
  private getJoinCompletions(context: QueryContext, _currentWord: string): CompletionItem[] {
    const completions: CompletionItem[] = []

    // Add tables that are not already in the query
    for (const table of this.schema.tables) {
      if (!context.tables.includes(table.name)) {
        completions.push({
          label: table.name,
          kind: CompletionItemKind.Table,
          detail: `Table - ${table.schema}`,
          documentation: table.comment,
          sortText: `table_${table.name}`,
        })
      }
    }

    // Add JOIN keywords
    const joinTypes = ["INNER JOIN", "LEFT JOIN", "RIGHT JOIN", "FULL OUTER JOIN", "CROSS JOIN"]
    for (const joinType of joinTypes) {
      completions.push({
        label: joinType,
        kind: CompletionItemKind.Keyword,
        detail: "JOIN type",
        sortText: `join_${joinType}`,
      })
    }

    return completions
  }

  /**
   * Get completions for WHERE/HAVING clause
   */
  private getWhereCompletions(context: QueryContext, _currentWord: string): CompletionItem[] {
    const completions: CompletionItem[] = []

    // Add columns from available tables
    for (const tableName of context.tables) {
      const table = this.schema.tables.find((t) => t.name === tableName)
      if (table) {
        for (const column of table.columns) {
          completions.push({
            label: column.name,
            kind: CompletionItemKind.Column,
            detail: `${column.type} - ${table.name}`,
            documentation: column.comment,
            sortText: `column_${column.name}`,
          })
        }
      }
    }

    // Add comparison operators
    const operators = [
      "=",
      "!=",
      "<>",
      "<",
      ">",
      "<=",
      ">=",
      "LIKE",
      "NOT LIKE",
      "IN",
      "NOT IN",
      "BETWEEN",
      "IS NULL",
      "IS NOT NULL",
    ]
    for (const operator of operators) {
      completions.push({
        label: operator,
        kind: CompletionItemKind.Operator,
        detail: "Comparison operator",
        sortText: `operator_${operator}`,
      })
    }

    // Add logical operators
    const logicalOperators = ["AND", "OR", "NOT"]
    for (const operator of logicalOperators) {
      completions.push({
        label: operator,
        kind: CompletionItemKind.Keyword,
        detail: "Logical operator",
        sortText: `logical_${operator}`,
      })
    }

    return completions
  }

  /**
   * Get completions for statement start
   */
  private getStatementStartCompletions(): CompletionItem[] {
    const completions: CompletionItem[] = []

    const statements = [
      { label: "SELECT", detail: "Select data from tables" },
      { label: "INSERT", detail: "Insert new data" },
      { label: "UPDATE", detail: "Update existing data" },
      { label: "DELETE", detail: "Delete data" },
      { label: "CREATE", detail: "Create database objects" },
      { label: "ALTER", detail: "Modify database objects" },
      { label: "DROP", detail: "Remove database objects" },
      { label: "WITH", detail: "Common Table Expression" },
    ]

    for (const statement of statements) {
      completions.push({
        label: statement.label,
        kind: CompletionItemKind.Keyword,
        detail: statement.detail,
        sortText: `statement_${statement.label}`,
      })
    }

    return completions
  }

  /**
   * Get general completions
   */
  private getGeneralCompletions(_context: QueryContext, _currentWord: string): CompletionItem[] {
    const completions: CompletionItem[] = []

    // Add clause keywords based on context
    const clauseKeywords = ["WHERE", "GROUP BY", "HAVING", "ORDER BY", "LIMIT", "OFFSET"]
    for (const keyword of clauseKeywords) {
      completions.push({
        label: keyword,
        kind: CompletionItemKind.Keyword,
        detail: "SQL clause",
        sortText: `clause_${keyword}`,
      })
    }

    return completions
  }

  /**
   * Get keyword completions
   */
  private getKeywordCompletions(currentWord: string, _context: QueryContext): CompletionItem[] {
    const completions: CompletionItem[] = []

    for (const keyword of this.sqlKeywords) {
      if (keyword.toLowerCase().startsWith(currentWord.toLowerCase())) {
        completions.push({
          label: keyword,
          kind: CompletionItemKind.Keyword,
          detail: "SQL keyword",
          sortText: `keyword_${keyword}`,
        })
      }
    }

    return completions
  }

  /**
   * Get function completions
   */
  private getFunctionCompletions(currentWord: string, _context: QueryContext): CompletionItem[] {
    const completions: CompletionItem[] = []

    for (const func of this.sqlFunctions) {
      if (func.toLowerCase().startsWith(currentWord.toLowerCase())) {
        completions.push({
          label: `${func}()`,
          kind: CompletionItemKind.Function,
          detail: "SQL function",
          insertText: `${func}($1)`,
          insertTextRules: CompletionInsertTextRule.InsertAsSnippet,
          sortText: `function_${func}`,
        })
      }
    }

    return completions
  }

  /**
   * Get snippet completions
   */
  private getSnippetCompletions(_context: QueryContext): CompletionItem[] {
    return this.snippets.filter((_snippet) => {
      // Return snippets based on context
      return true // Simplified for now
    })
  }

  /**
   * Analyze query context
   */
  private analyzeQueryContext(query: string, position: Position): QueryContext {
    const context: QueryContext = {
      inSelect: false,
      inFrom: false,
      inWhere: false,
      inJoin: false,
      inOrderBy: false,
      inGroupBy: false,
      inHaving: false,
      tables: [],
      aliases: new Map(),
    }

    const beforeCursor = query.substring(0, this.getOffsetFromPosition(query, position))
    const upperQuery = beforeCursor.toUpperCase()

    // Find current clause
    const clauses = ["SELECT", "FROM", "WHERE", "JOIN", "GROUP BY", "ORDER BY", "HAVING"]
    let currentClause = ""
    let lastClauseIndex = -1

    for (const clause of clauses) {
      const index = upperQuery.lastIndexOf(clause)
      if (index > lastClauseIndex) {
        lastClauseIndex = index
        currentClause = clause
      }
    }

    // Set context flags
    context.inSelect = currentClause === "SELECT"
    context.inFrom = currentClause === "FROM"
    context.inWhere = currentClause === "WHERE"
    context.inJoin = currentClause.includes("JOIN")
    context.inOrderBy = currentClause === "ORDER BY"
    context.inGroupBy = currentClause === "GROUP BY"
    context.inHaving = currentClause === "HAVING"

    // Extract table names
    const fromMatches = beforeCursor.match(/FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi)
    if (fromMatches) {
      for (const match of fromMatches) {
        const tableName = match.replace(/FROM\s+/i, "").trim()
        context.tables.push(tableName)
      }
    }

    const joinMatches = beforeCursor.match(/JOIN\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi)
    if (joinMatches) {
      for (const match of joinMatches) {
        const tableName = match.replace(/.*JOIN\s+/i, "").trim()
        context.tables.push(tableName)
      }
    }

    return context
  }

  /**
   * Get current word at position
   */
  private getCurrentWord(query: string, position: Position): string {
    const offset = this.getOffsetFromPosition(query, position)
    let start = offset
    let end = offset

    // Find word boundaries
    while (start > 0 && /[a-zA-Z0-9_]/.test(query[start - 1])) {
      start--
    }
    while (end < query.length && /[a-zA-Z0-9_]/.test(query[end])) {
      end++
    }

    return query.substring(start, end)
  }

  /**
   * Get text preceding the cursor
   */
  private getPrecedingText(query: string, position: Position): string {
    const offset = this.getOffsetFromPosition(query, position)
    return query.substring(0, offset)
  }

  /**
   * Convert position to offset
   */
  private getOffsetFromPosition(query: string, position: Position): number {
    const lines = query.split("\n")
    let offset = 0

    for (let i = 0; i < position.line - 1; i++) {
      offset += lines[i].length + 1 // +1 for newline
    }

    offset += position.column - 1
    return Math.min(offset, query.length)
  }

  /**
   * Check if position is at start of statement
   */
  private isStartOfStatement(precedingText: string): boolean {
    const trimmed = precedingText.trim()
    return trimmed === "" || trimmed.endsWith(";")
  }

  /**
   * Filter and sort completions
   */
  private filterAndSortCompletions(
    completions: CompletionItem[],
    currentWord: string
  ): CompletionItem[] {
    if (!currentWord) {
      return completions.slice(0, 50) // Limit results
    }

    const filtered = completions.filter((item) =>
      item.label.toLowerCase().includes(currentWord.toLowerCase())
    )

    // Sort by relevance
    filtered.sort((a, b) => {
      const aStartsWith = a.label.toLowerCase().startsWith(currentWord.toLowerCase())
      const bStartsWith = b.label.toLowerCase().startsWith(currentWord.toLowerCase())

      if (aStartsWith && !bStartsWith) return -1
      if (!aStartsWith && bStartsWith) return 1

      // Use sortText if available
      const aSortText = a.sortText || a.label
      const bSortText = b.sortText || b.label
      return aSortText.localeCompare(bSortText)
    })

    return filtered.slice(0, 50) // Limit results
  }

  /**
   * Initialize SQL keywords
   */
  private initializeKeywords(): void {
    this.sqlKeywords = [
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
      "ASC",
      "DESC",
      "PRIMARY",
      "KEY",
      "FOREIGN",
      "UNIQUE",
      "DEFAULT",
      "CHECK",
      "CONSTRAINT",
      "AUTO_INCREMENT",
      "NOT NULL",
    ]
  }

  /**
   * Initialize SQL functions
   */
  private initializeFunctions(): void {
    this.sqlFunctions = [
      // Aggregate functions
      "COUNT",
      "SUM",
      "AVG",
      "MIN",
      "MAX",
      "GROUP_CONCAT",
      "STRING_AGG",

      // String functions
      "CONCAT",
      "SUBSTRING",
      "LEFT",
      "RIGHT",
      "LENGTH",
      "UPPER",
      "LOWER",
      "TRIM",
      "LTRIM",
      "RTRIM",
      "REPLACE",
      "REVERSE",
      "CHAR_LENGTH",

      // Date functions
      "NOW",
      "CURDATE",
      "CURTIME",
      "DATE",
      "TIME",
      "DATETIME",
      "TIMESTAMP",
      "YEAR",
      "MONTH",
      "DAY",
      "HOUR",
      "MINUTE",
      "SECOND",
      "DATE_ADD",
      "DATE_SUB",
      "DATEDIFF",
      "DATE_FORMAT",

      // Math functions
      "ABS",
      "CEIL",
      "FLOOR",
      "ROUND",
      "SQRT",
      "POWER",
      "MOD",
      "RAND",
      "SIGN",
      "SIN",
      "COS",
      "TAN",
      "PI",

      // Conditional functions
      "IF",
      "IFNULL",
      "NULLIF",
      "COALESCE",
      "GREATEST",
      "LEAST",

      // Type conversion functions
      "CAST",
      "CONVERT",
      "FORMAT",
    ]
  }

  /**
   * Initialize SQL data types
   */
  private initializeDataTypes(): void {
    this.sqlDataTypes = [
      "INTEGER",
      "INT",
      "BIGINT",
      "SMALLINT",
      "TINYINT",
      "DECIMAL",
      "NUMERIC",
      "FLOAT",
      "DOUBLE",
      "REAL",
      "VARCHAR",
      "CHAR",
      "TEXT",
      "LONGTEXT",
      "MEDIUMTEXT",
      "DATE",
      "TIME",
      "DATETIME",
      "TIMESTAMP",
      "YEAR",
      "BOOLEAN",
      "BOOL",
      "BIT",
      "BLOB",
      "LONGBLOB",
      "MEDIUMBLOB",
      "TINYBLOB",
      "JSON",
      "UUID",
      "ENUM",
      "SET",
    ]
  }

  /**
   * Initialize common SQL snippets
   */
  private initializeSnippets(): void {
    this.snippets = [
      {
        label: "SELECT Statement",
        kind: CompletionItemKind.Snippet,
        detail: "Basic SELECT statement",
        insertText: "SELECT ${1:columns}\nFROM ${2:table}\nWHERE ${3:condition}",
        insertTextRules: CompletionInsertTextRule.InsertAsSnippet,
        sortText: "snippet_select",
      },
      {
        label: "INSERT Statement",
        kind: CompletionItemKind.Snippet,
        detail: "Basic INSERT statement",
        insertText: "INSERT INTO ${1:table} (${2:columns})\nVALUES (${3:values})",
        insertTextRules: CompletionInsertTextRule.InsertAsSnippet,
        sortText: "snippet_insert",
      },
      {
        label: "UPDATE Statement",
        kind: CompletionItemKind.Snippet,
        detail: "Basic UPDATE statement",
        insertText: "UPDATE ${1:table}\nSET ${2:column} = ${3:value}\nWHERE ${4:condition}",
        insertTextRules: CompletionInsertTextRule.InsertAsSnippet,
        sortText: "snippet_update",
      },
      {
        label: "DELETE Statement",
        kind: CompletionItemKind.Snippet,
        detail: "Basic DELETE statement",
        insertText: "DELETE FROM ${1:table}\nWHERE ${2:condition}",
        insertTextRules: CompletionInsertTextRule.InsertAsSnippet,
        sortText: "snippet_delete",
      },
      {
        label: "JOIN Query",
        kind: CompletionItemKind.Snippet,
        detail: "SELECT with JOIN",
        insertText:
          "SELECT ${1:t1.column}, ${2:t2.column}\nFROM ${3:table1} t1\nJOIN ${4:table2} t2 ON t1.${5:id} = t2.${6:foreign_id}",
        insertTextRules: CompletionInsertTextRule.InsertAsSnippet,
        sortText: "snippet_join",
      },
      {
        label: "CTE (Common Table Expression)",
        kind: CompletionItemKind.Snippet,
        detail: "WITH clause for CTE",
        insertText: "WITH ${1:cte_name} AS (\n  ${2:SELECT query}\n)\nSELECT *\nFROM ${1:cte_name}",
        insertTextRules: CompletionInsertTextRule.InsertAsSnippet,
        sortText: "snippet_cte",
      },
    ]
  }

  /**
   * Update schema
   */
  updateSchema(newSchema: DatabaseSchema): void {
    this.schema = newSchema
    this.cache = {} // Clear cache when schema changes
  }

  /**
   * Clear completion cache
   */
  clearCache(): void {
    this.cache = {}
  }
}
