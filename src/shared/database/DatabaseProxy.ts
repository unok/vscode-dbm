/**
 * DatabaseProxy - データベース接続とクエリ実行を管理
 * 実際のデータベースドライバーを使用して接続
 */

import type { Connection as MySQLConnection } from "mysql2/promise"
import type { Client as PostgreSQLClient } from "pg"
import type { SQLiteWebDriver } from "./drivers/SQLiteWebDriver"

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
  private connection: MySQLConnection | PostgreSQLClient | SQLiteWebDriver | null = null
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

      // 接続が作成されたので、一時的にisConnectedをtrueに設定してテストクエリを実行
      this.isConnected = true
      const result = await this.query("SELECT 1 as test")

      if (!result.success) {
        this.isConnected = false
        throw new Error(`Connection test failed: ${result.error || "Unknown error"}`)
      }

      return this.isConnected
    } catch (error) {
      console.error("Database connection failed:", error)
      this.isConnected = false
      // エラーを上位に投げて詳細な情報を保持
      throw error
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
      if (this.config.type === "sqlite") {
        // SQLiteWebDriverの専用メソッドを使用
        const driver = this.connection as import("./drivers/SQLiteWebDriver").SQLiteWebDriver
        return await driver.getTables()
      }

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
            await (this.connection as SQLiteWebDriver).disconnect()
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

    const connectionConfig = {
      host: this.config.host,
      port: this.config.port,
      user: this.config.username,
      password: this.config.password,
      database: this.config.database,
    }

    const client = new Client(connectionConfig)

    try {
      await client.connect()
      return client
    } catch (error) {
      console.error("PostgreSQL client.connect() failed:", error)
      throw error
    }
  }

  private async connectSQLite(): Promise<import("./drivers/SQLiteWebDriver").SQLiteWebDriver> {
    const { SQLiteWebDriver } = await import("./drivers/SQLiteWebDriver")
    const driver = new SQLiteWebDriver({
      id: `sqlite_${Date.now()}`,
      name: "SQLite Memory Database",
      type: "sqlite",
      host: "",
      port: 0,
      database: this.config.database,
      username: "",
      password: "",
    })
    await driver.connect()
    await driver.initializeTestDatabase()
    return driver
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
    _startTime: number
  ): Promise<QueryResult> {
    const driver = this.connection as SQLiteWebDriver
    const result = await driver.query(sql, params)

    return {
      success: !result.error,
      rows: result.rows,
      rowCount: result.rowCount,
      executionTime: result.executionTime,
      error: result.error,
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
