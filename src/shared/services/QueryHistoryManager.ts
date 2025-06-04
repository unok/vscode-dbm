import type {
  AdvancedSQLConfig,
  HistorySearchOptions,
  QueryExecutionResult,
  QueryHistoryEntry,
} from "../types/advanced-sql"
import type { QueryExecutionContext } from "../types/sql"

export class QueryHistoryManager {
  private history: QueryHistoryEntry[] = []
  private config: AdvancedSQLConfig["history"]
  private nextId = 1

  constructor(
    config: AdvancedSQLConfig["history"] = {
      enabled: true,
      maxEntries: 1000,
      retentionDays: 30,
      trackExecutionTime: true,
      autoFavorite: {
        enabled: true,
        minExecutionTime: 1000,
        minUsageCount: 5,
      },
    }
  ) {
    this.config = config
    this.loadHistory()
  }

  async addEntry(
    sql: string,
    context: QueryExecutionContext,
    result: QueryExecutionResult = {}
  ): Promise<QueryHistoryEntry> {
    if (!this.config.enabled) {
      throw new Error("Query history is disabled")
    }

    const entry: QueryHistoryEntry = {
      id: `history_${this.nextId++}_${Date.now()}`,
      sql: sql.trim(),
      executedAt: new Date(),
      executionTime: result.executionTime,
      rowCount: result.rowCount,
      success: result.success ?? true,
      error: result.error,
      database: context.connection.database || "unknown",
      connection: context.connection.id,
      user: context.user || "unknown",
      isFavorite: false,
    }

    // Check for auto-favorite
    if (this.config.autoFavorite.enabled) {
      entry.isFavorite = this.shouldAutoFavorite(entry)
    }

    this.history.unshift(entry) // Add to beginning

    // Enforce limits
    this.enforceRetentionPolicy()
    this.saveHistory()

    return entry
  }

  async getHistory(limit?: number, offset = 0): Promise<QueryHistoryEntry[]> {
    const start = offset
    const end = limit ? start + limit : undefined
    return this.history.slice(start, end)
  }

  async searchHistory(options: HistorySearchOptions): Promise<QueryHistoryEntry[]> {
    let results = [...this.history]

    // Filter by search text
    if (options.searchText) {
      const searchLower = options.searchText.toLowerCase()
      results = results.filter((entry) => entry.sql.toLowerCase().includes(searchLower))
    }

    // Filter by date range
    if (options.startDate) {
      const startDate = options.startDate
      results = results.filter((entry) => entry.executedAt >= startDate)
    }

    if (options.endDate) {
      const endDate = options.endDate
      results = results.filter((entry) => entry.executedAt <= endDate)
    }

    // Filter by execution time
    if (options.minExecutionTime !== undefined) {
      const minTime = options.minExecutionTime
      results = results.filter((entry) => (entry.executionTime || 0) >= minTime)
    }

    if (options.maxExecutionTime !== undefined) {
      const maxTime = options.maxExecutionTime
      results = results.filter((entry) => (entry.executionTime || 0) <= maxTime)
    }

    // Filter by success
    if (options.successOnly) {
      results = results.filter((entry) => entry.success)
    }

    // Filter by database
    if (options.database) {
      results = results.filter((entry) => entry.database === options.database)
    }

    // Apply pagination
    const start = options.offset || 0
    const end = options.limit ? start + options.limit : undefined

    return results.slice(start, end)
  }

  async getFavorites(): Promise<QueryHistoryEntry[]> {
    return this.history.filter((entry) => entry.isFavorite)
  }

  async toggleFavorite(entryId: string): Promise<QueryHistoryEntry | null> {
    const entry = this.history.find((e) => e.id === entryId)
    if (!entry) {
      return null
    }

    entry.isFavorite = !entry.isFavorite
    this.saveHistory()

    return entry
  }

  async getEntry(entryId: string): Promise<QueryHistoryEntry | null> {
    return this.history.find((entry) => entry.id === entryId) || null
  }

  async deleteEntry(entryId: string): Promise<boolean> {
    const index = this.history.findIndex((entry) => entry.id === entryId)
    if (index === -1) {
      return false
    }

    this.history.splice(index, 1)
    this.saveHistory()
    return true
  }

  async clearHistory(): Promise<void> {
    this.history = []
    this.saveHistory()
  }

  async clearOldEntries(beforeDate: Date): Promise<number> {
    const originalLength = this.history.length
    this.history = this.history.filter((entry) => entry.executedAt >= beforeDate)
    const removedCount = originalLength - this.history.length

    if (removedCount > 0) {
      this.saveHistory()
    }

    return removedCount
  }

  async getStatistics(): Promise<HistoryStatistics> {
    const now = new Date()
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const total = this.history.length
    const successful = this.history.filter((e) => e.success).length
    const failed = total - successful
    const favorites = this.history.filter((e) => e.isFavorite).length

    const lastDay = this.history.filter((e) => e.executedAt >= dayAgo).length
    const lastWeek = this.history.filter((e) => e.executedAt >= weekAgo).length
    const lastMonth = this.history.filter((e) => e.executedAt >= monthAgo).length

    const executionTimes = this.history
      .filter((e) => e.executionTime !== undefined)
      .map((e) => e.executionTime as number)

    const avgExecutionTime =
      executionTimes.length > 0
        ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length
        : 0

    const maxExecutionTime = executionTimes.length > 0 ? Math.max(...executionTimes) : 0

    // Most common databases
    const databaseCounts = this.history.reduce(
      (acc, entry) => {
        acc[entry.database] = (acc[entry.database] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    const topDatabases = Object.entries(databaseCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))

    // Most frequent queries
    const queryCounts = this.history.reduce(
      (acc, entry) => {
        const normalizedSQL = this.normalizeSQL(entry.sql)
        acc[normalizedSQL] = (acc[normalizedSQL] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    const topQueries = Object.entries(queryCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([sql, count]) => ({ sql, count }))

    return {
      total,
      successful,
      failed,
      favorites,
      lastDay,
      lastWeek,
      lastMonth,
      avgExecutionTime,
      maxExecutionTime,
      topDatabases,
      topQueries,
      oldestEntry:
        this.history.length > 0 ? this.history[this.history.length - 1].executedAt : null,
      newestEntry: this.history.length > 0 ? this.history[0].executedAt : null,
    }
  }

  async exportHistory(format: "json" | "csv" | "sql" = "json"): Promise<string> {
    switch (format) {
      case "json":
        return JSON.stringify(this.history, null, 2)

      case "csv":
        return this.exportToCSV()

      case "sql":
        return this.exportToSQL()

      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }

  async importHistory(data: string, format: "json" = "json"): Promise<number> {
    let entries: QueryHistoryEntry[]

    switch (format) {
      case "json":
        entries = JSON.parse(data)
        break

      default:
        throw new Error(`Unsupported import format: ${format}`)
    }

    // Validate entries
    const validEntries = entries.filter((entry) => this.isValidHistoryEntry(entry))

    // Merge with existing history, avoiding duplicates
    const existingIds = new Set(this.history.map((e) => e.id))
    const newEntries = validEntries.filter((entry) => !existingIds.has(entry.id))

    this.history = [...newEntries, ...this.history]
    this.enforceRetentionPolicy()
    this.saveHistory()

    return newEntries.length
  }

  private shouldAutoFavorite(entry: QueryHistoryEntry): boolean {
    const config = this.config.autoFavorite

    // Check execution time threshold
    if (entry.executionTime && entry.executionTime >= config.minExecutionTime) {
      return true
    }

    // Check usage count threshold
    const usageCount = this.history.filter(
      (e) => this.normalizeSQL(e.sql) === this.normalizeSQL(entry.sql)
    ).length

    return usageCount >= config.minUsageCount
  }

  private normalizeSQL(sql: string): string {
    return sql
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/\d+/g, "?") // Replace numbers with placeholders
      .replace(/'[^']*'/g, "?") // Replace string literals with placeholders
      .trim()
  }

  private enforceRetentionPolicy(): void {
    // Limit by count
    if (this.history.length > this.config.maxEntries) {
      this.history = this.history.slice(0, this.config.maxEntries)
    }

    // Limit by age
    const cutoffDate = new Date(Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000)
    this.history = this.history.filter(
      (entry) => entry.executedAt >= cutoffDate || entry.isFavorite
    )
  }

  private exportToCSV(): string {
    const headers = [
      "ID",
      "SQL",
      "Executed At",
      "Execution Time",
      "Row Count",
      "Success",
      "Error",
      "Database",
      "Connection",
      "User",
      "Is Favorite",
    ]

    const rows = this.history.map((entry) => [
      entry.id,
      `"${entry.sql.replace(/"/g, '""')}"`, // Escape quotes in SQL
      entry.executedAt.toISOString(),
      entry.executionTime?.toString() || "",
      entry.rowCount?.toString() || "",
      entry.success.toString(),
      entry.error ? `"${entry.error.replace(/"/g, '""')}"` : "",
      entry.database,
      entry.connection,
      entry.user,
      entry.isFavorite.toString(),
    ])

    return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n")
  }

  private exportToSQL(): string {
    const statements = this.history.map((entry) => {
      const values = [
        `'${entry.id}'`,
        `'${entry.sql.replace(/'/g, "''")}'`, // Escape single quotes
        `'${entry.executedAt.toISOString()}'`,
        entry.executionTime?.toString() || "NULL",
        entry.rowCount?.toString() || "NULL",
        entry.success ? "TRUE" : "FALSE",
        entry.error ? `'${entry.error.replace(/'/g, "''")}'` : "NULL",
        `'${entry.database}'`,
        `'${entry.connection}'`,
        `'${entry.user}'`,
        entry.isFavorite ? "TRUE" : "FALSE",
      ]

      return `INSERT INTO query_history (id, sql, executed_at, execution_time, row_count, success, error, database, connection, user, is_favorite) VALUES (${values.join(", ")});`
    })

    return statements.join("\n")
  }

  private isValidHistoryEntry(entry: unknown): entry is QueryHistoryEntry {
    return (
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as any).id === "string" &&
      typeof (entry as any).sql === "string" &&
      (entry as any).executedAt instanceof Date &&
      typeof (entry as any).success === "boolean" &&
      typeof (entry as any).database === "string" &&
      typeof (entry as any).connection === "string" &&
      typeof (entry as any).user === "string" &&
      typeof (entry as any).isFavorite === "boolean"
    )
  }

  private loadHistory(): void {
    try {
      // In a real implementation, this would load from persistent storage
      // For now, we'll start with an empty history
      this.history = []
    } catch (error) {
      console.warn("Failed to load query history:", error)
      this.history = []
    }
  }

  private saveHistory(): void {
    // In a real implementation, this would save to persistent storage
    // For now, we'll just keep it in memory
  }
}

interface HistoryStatistics {
  total: number
  successful: number
  failed: number
  favorites: number
  lastDay: number
  lastWeek: number
  lastMonth: number
  avgExecutionTime: number
  maxExecutionTime: number
  topDatabases: Array<{ name: string; count: number }>
  topQueries: Array<{ sql: string; count: number }>
  oldestEntry: Date | null
  newestEntry: Date | null
}

export type { QueryHistoryEntry, HistorySearchOptions, QueryExecutionResult }
