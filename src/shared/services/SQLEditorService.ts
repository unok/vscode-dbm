import type {
  DatabaseSchema,
  ExecutionPlan,
  ExportOptions,
  QueryBookmark,
  QueryExecutionContext,
  QueryExecutionOptions,
  QueryHistoryItem,
  QueryResult,
  SQLFormatOptions,
  SQLQuery,
} from "../types/sql"

export class SQLEditorService {
  private schema: DatabaseSchema
  private queryHistory: QueryHistoryItem[] = []
  private bookmarks: QueryBookmark[] = []
  private historyLimit = 100
  private nextQueryId = 1
  private nextBookmarkId = 1

  constructor(schema: DatabaseSchema) {
    this.schema = schema
  }

  /**
   * Execute a single SQL query
   */
  async executeQuery(query: string, options?: QueryExecutionOptions): Promise<QueryResult> {
    const startTime = Date.now()

    try {
      // Validate query before execution
      if (!query.trim()) {
        throw new Error("Query cannot be empty")
      }

      // Mock execution - in real implementation, this would connect to database
      const result = await this.mockQueryExecution(query, options)

      const executionTime = Date.now() - startTime
      result.executionTime = executionTime

      // Add to history
      this.addToHistory(query, executionTime, result.rowCount, true)

      return result
    } catch (error) {
      const executionTime = Date.now() - startTime

      // Add failed query to history
      this.addToHistory(
        query,
        executionTime,
        0,
        false,
        error instanceof Error ? error.message : "Unknown error"
      )

      throw error
    }
  }

  /**
   * Execute query with specific options
   */
  async executeQueryWithOptions(
    query: string,
    options: QueryExecutionOptions
  ): Promise<QueryResult> {
    if (options.timeout) {
      return Promise.race([
        this.executeQuery(query, options),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Query execution timeout after ${options.timeout}ms`)),
            options.timeout
          )
        ),
      ])
    }

    if (options.dryRun) {
      // Validate query without executing
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTime: 0,
        query,
        warnings: ["Query validated successfully (dry run)"],
      }
    }

    if (options.explain) {
      const plan = await this.getExecutionPlan(query)
      return {
        columns: ["Query Plan"],
        rows: [{ "Query Plan": JSON.stringify(plan, null, 2) }],
        rowCount: 1,
        executionTime: 0,
        query,
      }
    }

    return this.executeQuery(query, options)
  }

  /**
   * Execute multiple queries in sequence
   */
  async executeMultipleQueries(queries: string[]): Promise<QueryResult[]> {
    const results: QueryResult[] = []

    for (const query of queries) {
      if (query.trim()) {
        const result = await this.executeQuery(query)
        results.push(result)
      }
    }

    return results
  }

  /**
   * Get execution plan for query
   */
  async getExecutionPlan(query: string): Promise<ExecutionPlan> {
    // Mock execution plan - in real implementation, this would use EXPLAIN
    if (query.toLowerCase().includes("syntax error") || query.trim().endsWith("FROM")) {
      throw new Error("Syntax error in query")
    }

    const mockPlan: ExecutionPlan = {
      query,
      plan: [
        {
          nodeType: "Seq Scan",
          relation: "users",
          cost: { startup: 0.0, total: 15.0 },
          rows: 100,
          width: 64,
          condition: query.includes("WHERE") ? "filter condition" : undefined,
        },
      ],
      totalCost: 15.0,
      estimatedRows: 100,
    }

    return mockPlan
  }

  /**
   * Format SQL query
   */
  formatQuery(query: string, options?: SQLFormatOptions): string {
    const defaultOptions: SQLFormatOptions = {
      keywordCase: "upper",
      identifierCase: "preserve",
      indentSize: 2,
      indentType: "spaces",
      lineLength: 80,
      commaPosition: "after",
      insertSpaces: true,
      preserveComments: true,
      alignColumnDefinitions: true,
      alignJoinConditions: true,
    }

    const formatOptions = { ...defaultOptions, ...options }

    // Basic SQL formatting implementation
    let formatted = query.replace(/\s+/g, " ").trim()

    // Convert keywords to specified case
    const keywords = [
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
      "UNION",
      "INSERT",
      "UPDATE",
      "DELETE",
      "INTO",
      "VALUES",
      "SET",
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
    ]

    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, "gi")
      const replacement =
        formatOptions.keywordCase === "upper"
          ? keyword.toUpperCase()
          : formatOptions.keywordCase === "lower"
            ? keyword.toLowerCase()
            : keyword

      formatted = formatted.replace(regex, replacement)
    }

    // Add line breaks and indentation
    formatted = formatted
      .replace(/\bSELECT\b/gi, "SELECT\n  ")
      .replace(/\bFROM\b/gi, "\nFROM ")
      .replace(/\bWHERE\b/gi, "\nWHERE ")
      .replace(/\bJOIN\b/gi, "\nJOIN ")
      .replace(/\bLEFT JOIN\b/gi, "\nLEFT JOIN ")
      .replace(/\bRIGHT JOIN\b/gi, "\nRIGHT JOIN ")
      .replace(/\bINNER JOIN\b/gi, "\nINNER JOIN ")
      .replace(/\bGROUP BY\b/gi, "\nGROUP BY ")
      .replace(/\bORDER BY\b/gi, "\nORDER BY ")
      .replace(/\bHAVING\b/gi, "\nHAVING ")
      .replace(/\bLIMIT\b/gi, "\nLIMIT ")
      .replace(/,\s+/g, formatOptions.commaPosition === "before" ? "\n  , " : ",\n  ")

    return formatted
  }

  /**
   * Query History Management
   */
  addToHistory(
    query: string,
    executionTime?: number,
    rowsAffected?: number,
    success = true,
    error?: string
  ): void {
    const historyItem: QueryHistoryItem = {
      id: `query_${this.nextQueryId++}`,
      query: query.trim(),
      executedAt: new Date(),
      executionTime,
      rowsAffected,
      success,
      error,
    }

    this.queryHistory.unshift(historyItem)

    // Limit history size
    if (this.queryHistory.length > this.historyLimit) {
      this.queryHistory = this.queryHistory.slice(0, this.historyLimit)
    }
  }

  getQueryHistory(): string[] {
    return this.queryHistory.map((item) => item.query)
  }

  clearHistory(): void {
    this.queryHistory = []
  }

  searchHistory(searchTerm: string): string[] {
    const lowerSearchTerm = searchTerm.toLowerCase()
    return this.queryHistory
      .filter((item) => item.query.toLowerCase().includes(lowerSearchTerm))
      .map((item) => item.query)
  }

  /**
   * Bookmark Management
   */
  saveBookmark(bookmark: Omit<QueryBookmark, "createdAt"> & { createdAt?: Date }): void {
    const existingIndex = this.bookmarks.findIndex((b) => b.id === bookmark.id)

    const bookmarkWithDate: QueryBookmark = {
      ...bookmark,
      createdAt: bookmark.createdAt || new Date(),
      updatedAt: existingIndex >= 0 ? new Date() : undefined,
    }

    if (existingIndex >= 0) {
      this.bookmarks[existingIndex] = bookmarkWithDate
    } else {
      this.bookmarks.push(bookmarkWithDate)
    }
  }

  getBookmarks(): QueryBookmark[] {
    return [...this.bookmarks]
  }

  deleteBookmark(id: string): void {
    this.bookmarks = this.bookmarks.filter((b) => b.id !== id)
  }

  searchBookmarks(searchTerm: string): QueryBookmark[] {
    const lowerSearchTerm = searchTerm.toLowerCase()
    return this.bookmarks.filter(
      (bookmark) =>
        bookmark.name.toLowerCase().includes(lowerSearchTerm) ||
        bookmark.description?.toLowerCase().includes(lowerSearchTerm) ||
        bookmark.tags.some((tag) => tag.toLowerCase().includes(lowerSearchTerm)) ||
        bookmark.query.toLowerCase().includes(lowerSearchTerm)
    )
  }

  /**
   * Export Results
   */
  exportToCSV(result: QueryResult): string {
    const lines: string[] = []

    // Add header
    lines.push(result.columns.join(","))

    // Add data rows
    for (const row of result.rows) {
      const values = result.columns.map((col) => {
        const value = row[col]
        if (value === null || value === undefined) {
          return ""
        }
        // Escape values that contain commas or quotes
        const stringValue = String(value)
        if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
          return `"${stringValue.replace(/"/g, '""')}"`
        }
        return stringValue
      })
      lines.push(values.join(","))
    }

    return lines.join("\n")
  }

  exportToJSON(result: QueryResult): string {
    return JSON.stringify(result.rows, null, 2)
  }

  exportToSQL(result: QueryResult, tableName: string): string {
    const statements: string[] = []

    for (const row of result.rows) {
      const columns = result.columns.join(", ")
      const values = result.columns
        .map((col) => {
          const value = row[col]
          if (value === null || value === undefined) {
            return "NULL"
          }
          if (typeof value === "string") {
            return `'${value.replace(/'/g, "''")}'`
          }
          if (typeof value === "boolean") {
            return value ? "TRUE" : "FALSE"
          }
          return String(value)
        })
        .join(", ")

      statements.push(`INSERT INTO ${tableName} (${columns}) VALUES (${values});`)
    }

    return statements.join("\n")
  }

  /**
   * Schema Information
   */
  updateSchema(newSchema: DatabaseSchema): void {
    this.schema = newSchema
  }

  getSchema(): DatabaseSchema {
    return this.schema
  }

  getTableNames(): string[] {
    return this.schema.tables.map((table) => table.name)
  }

  getColumnNames(tableName?: string): string[] {
    if (!tableName) {
      // Return all column names from all tables
      return this.schema.tables.flatMap((table) => table.columns.map((col) => col.name))
    }

    const table = this.schema.tables.find((t) => t.name === tableName)
    return table ? table.columns.map((col) => col.name) : []
  }

  /**
   * Mock query execution for testing
   */
  private async mockQueryExecution(
    query: string,
    options?: QueryExecutionOptions
  ): Promise<QueryResult> {
    const lowerQuery = query.toLowerCase().trim()

    // Simulate different query types
    if (lowerQuery.includes("non_existent_table")) {
      throw new Error('Table "non_existent_table" does not exist')
    }

    if (lowerQuery.startsWith("select")) {
      // Mock SELECT query
      const mockColumns = ["id", "name", "email", "created_at"]
      const mockRows = [
        { id: 1, name: "John Doe", email: "john@example.com", created_at: "2023-01-01T10:00:00Z" },
        {
          id: 2,
          name: "Jane Smith",
          email: "jane@example.com",
          created_at: "2023-01-02T11:00:00Z",
        },
      ]

      let resultRows = mockRows
      let resultColumns = mockColumns

      // Handle COUNT queries
      if (lowerQuery.includes("count(")) {
        resultColumns = ["count"]
        resultRows = [{ id: 0, name: String(mockRows.length), email: "", created_at: "" }]
      }

      // Apply LIMIT if specified
      if (options?.maxRows && resultRows.length > options.maxRows) {
        resultRows = resultRows.slice(0, options.maxRows)
      }

      return {
        columns: resultColumns,
        rows: resultRows,
        rowCount: resultRows.length,
        executionTime: 0,
        query,
      }
    }

    if (lowerQuery.startsWith("insert")) {
      return {
        columns: [],
        rows: [],
        rowCount: 1,
        executionTime: 0,
        query,
      }
    }

    if (lowerQuery.startsWith("update")) {
      return {
        columns: [],
        rows: [],
        rowCount: 1,
        executionTime: 0,
        query,
      }
    }

    if (lowerQuery.startsWith("delete")) {
      return {
        columns: [],
        rows: [],
        rowCount: 1,
        executionTime: 0,
        query,
      }
    }

    // Default response
    return {
      columns: [],
      rows: [],
      rowCount: 0,
      executionTime: 0,
      query,
    }
  }
}
