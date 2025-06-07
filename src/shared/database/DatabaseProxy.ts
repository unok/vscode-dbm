/**
 * DatabaseProxy - データベース接続とクエリ実行を管理
 * 実際のデータベースドライバーを使用して接続
 */

import type { Database as SQLiteDatabase } from "better-sqlite3"
import type { Connection as MySQLConnection } from "mysql2/promise"
import type { Client as PostgreSQLClient } from "pg"

export interface DatabaseProxyConfig {
  type: "mysql" | "postgresql" | "sqlite"
  host: string
  port: number
  database: string
  username: string
  password: string
}

export interface QueryResult {
  success: boolean
  rows?: Record<string, unknown>[]
  rowCount?: number
  executionTime?: number
  error?: string
}

export class DatabaseProxy {
  private config: DatabaseProxyConfig
  private connection: MySQLConnection | PostgreSQLClient | SQLiteDatabase | null = null
  private isConnected = false

  constructor(config: DatabaseProxyConfig) {
    this.config = config
  }

  async connect(): Promise<boolean> {
    try {
      await this.disconnect() // 既存の接続を閉じる

      switch (this.config.type) {
        case "mysql":
          this.connection = await this.connectMySQL()
          break
        case "postgresql":
          this.connection = await this.connectPostgreSQL()
          break
        case "sqlite":
          this.connection = await this.connectSQLite()
          break
        default:
          throw new Error(`Unsupported database type: ${this.config.type}`)
      }

      // 接続テスト
      const result = await this.query("SELECT 1 as test")
      this.isConnected = result.success
      return this.isConnected
    } catch (error) {
      console.error("Database connection failed:", error)
      this.isConnected = false
      return false
    }
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    const startTime = Date.now()

    if (!this.isConnected || !this.connection) {
      return {
        success: false,
        error: "Database not connected",
        executionTime: Date.now() - startTime,
      }
    }

    try {
      switch (this.config.type) {
        case "mysql":
          return await this.executeMySQL(sql, params || [], startTime)
        case "postgresql":
          return await this.executePostgreSQL(sql, params || [], startTime)
        case "sqlite":
          return await this.executeSQLite(sql, params || [], startTime)
        default:
          throw new Error(`Unsupported database type: ${this.config.type}`)
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        executionTime: Date.now() - startTime,
      }
    }
  }

  async getTables(): Promise<{ name: string; type: string }[]> {
    if (!this.isConnected || !this.connection) {
      return []
    }

    try {
      let tablesQuery = ""
      switch (this.config.type) {
        case "mysql":
          tablesQuery = "SHOW TABLES"
          break
        case "postgresql":
          tablesQuery = `
            SELECT table_name as name, 'table' as type 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            UNION ALL
            SELECT table_name as name, 'view' as type 
            FROM information_schema.views 
            WHERE table_schema = 'public'
          `
          break
        case "sqlite":
          tablesQuery = `
            SELECT name, type 
            FROM sqlite_master 
            WHERE type IN ('table', 'view') 
            AND name NOT LIKE 'sqlite_%'
          `
          break
      }

      const result = await this.query(tablesQuery)
      if (result.success && result.rows) {
        return result.rows.map((row) => ({
          name: String(row.name || row[Object.keys(row)[0]]),
          type: String(row.type || "table"),
        }))
      }
      return []
    } catch (error) {
      console.error("Error getting tables:", error)
      return []
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      try {
        switch (this.config.type) {
          case "mysql":
            await (this.connection as MySQLConnection).end()
            break
          case "postgresql":
            await (this.connection as PostgreSQLClient).end()
            break
          case "sqlite":
            ;(this.connection as SQLiteDatabase).close()
            break
        }
      } catch (error) {
        console.error("Error disconnecting from database:", error)
      } finally {
        this.connection = null
        this.isConnected = false
      }
    }
  }

  getConnectionInfo(): DatabaseProxyConfig {
    return { ...this.config }
  }

  // 実際のデータベース接続メソッド
  private async connectMySQL(): Promise<MySQLConnection> {
    const mysql = await import("mysql2/promise")
    return await mysql.createConnection({
      host: this.config.host,
      port: this.config.port,
      user: this.config.username,
      password: this.config.password,
      database: this.config.database,
    })
  }

  private async connectPostgreSQL(): Promise<PostgreSQLClient> {
    const { Client } = await import("pg")
    const client = new Client({
      host: this.config.host,
      port: this.config.port,
      user: this.config.username,
      password: this.config.password,
      database: this.config.database,
    })
    await client.connect()
    return client
  }

  private async connectSQLite(): Promise<SQLiteDatabase> {
    const Database = (await import("better-sqlite3")).default
    return new Database(this.config.database)
  }

  // 実際のクエリ実行メソッド
  private async executeMySQL(
    sql: string,
    params: unknown[],
    startTime: number
  ): Promise<QueryResult> {
    const connection = this.connection as MySQLConnection
    const [rows] = await connection.execute(sql, params)

    return {
      success: true,
      rows: Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [],
      rowCount: Array.isArray(rows) ? rows.length : 0,
      executionTime: Date.now() - startTime,
    }
  }

  private async executePostgreSQL(
    sql: string,
    params: unknown[],
    startTime: number
  ): Promise<QueryResult> {
    const client = this.connection as PostgreSQLClient
    const result = await client.query(sql, params)

    return {
      success: true,
      rows: result.rows,
      rowCount: result.rowCount || 0,
      executionTime: Date.now() - startTime,
    }
  }

  private async executeSQLite(
    sql: string,
    params: unknown[],
    startTime: number
  ): Promise<QueryResult> {
    const db = this.connection as SQLiteDatabase

    if (sql.toLowerCase().trim().startsWith("select")) {
      const stmt = db.prepare(sql)
      const rows = stmt.all(params) as Record<string, unknown>[]

      return {
        success: true,
        rows: rows,
        rowCount: rows.length,
        executionTime: Date.now() - startTime,
      }
    }
    const stmt = db.prepare(sql)
    const result = stmt.run(params)

    return {
      success: true,
      rows: [],
      rowCount: result.changes,
      executionTime: Date.now() - startTime,
    }
  }
}

/**
 * データベース接続ファクトリー関数
 */
export const DatabaseProxyFactory = {
  create(config: DatabaseProxyConfig): DatabaseProxy {
    return new DatabaseProxy(config)
  },

  createMySQL(
    host: string,
    port: number,
    database: string,
    username: string,
    password: string
  ): DatabaseProxy {
    return new DatabaseProxy({
      type: "mysql",
      host,
      port,
      database,
      username,
      password,
    })
  },

  createPostgreSQL(
    host: string,
    port: number,
    database: string,
    username: string,
    password: string
  ): DatabaseProxy {
    return new DatabaseProxy({
      type: "postgresql",
      host,
      port,
      database,
      username,
      password,
    })
  },

  createSQLite(database: string): DatabaseProxy {
    return new DatabaseProxy({
      type: "sqlite",
      host: "",
      port: 0,
      database,
      username: "",
      password: "",
    })
  },
}
