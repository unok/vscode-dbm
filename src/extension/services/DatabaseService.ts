import * as vscode from "vscode"
import {
  type DatabaseProxy,
  type DatabaseProxyConfig,
  DatabaseProxyFactory,
} from "../../shared/database/DatabaseProxy"
import type {
  BaseMessage,
  ConnectionInfo,
  ConnectionStatusMessage,
  DatabaseInfo,
  ExecuteQueryMessage,
  OpenConnectionMessage,
} from "../../shared/types/messages"

/**
 * データベース接続とクエリ実行を管理する中央サービス
 * サイドバーとパネルの両方から利用可能
 */
export class DatabaseService {
  private static instance: DatabaseService | undefined
  private databaseProxy?: DatabaseProxy
  private isConnected = false
  private connectionType?: string
  private listeners: Map<string, (message: BaseMessage) => void> = new Map()

  private constructor() {}

  /**
   * シングルトンインスタンスを取得
   */
  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService()
    }
    return DatabaseService.instance
  }

  /**
   * メッセージリスナーを登録
   */
  addMessageListener(id: string, callback: (message: BaseMessage) => void) {
    this.listeners.set(id, callback)
  }

  /**
   * メッセージリスナーを削除
   */
  removeMessageListener(id: string) {
    this.listeners.delete(id)
  }

  /**
   * 全てのリスナーにメッセージを送信
   */
  private broadcastMessage(message: BaseMessage) {
    for (const callback of this.listeners.values()) {
      callback(message)
    }
  }

  /**
   * 接続状態を取得
   */
  getConnectionStatus(): ConnectionStatusMessage["data"] {
    const databases: DatabaseInfo[] =
      this.isConnected && this.connectionType
        ? [
            {
              name: this.connectionType.split(" ")[0].toLowerCase(),
              type: this.connectionType.includes("MySQL")
                ? "mysql"
                : this.connectionType.includes("PostgreSQL")
                  ? "postgresql"
                  : "sqlite",
              tables: [],
              views: [],
            },
          ]
        : []

    return {
      connected: this.isConnected,
      databases,
      activeConnection:
        this.isConnected && this.connectionType
          ? {
              id: `conn_${Date.now()}`,
              name: this.connectionType,
              type: this.connectionType.includes("MySQL")
                ? "mysql"
                : this.connectionType.includes("PostgreSQL")
                  ? "postgresql"
                  : "sqlite",
              host: "localhost",
              port: 0,
              database: "",
              username: "",
              isConnected: true,
            }
          : undefined,
    }
  }

  /**
   * データベースに接続
   */
  async connect(
    data: Partial<OpenConnectionMessage["data"]>
  ): Promise<{ success: boolean; message: string }> {
    try {
      // 接続中の場合は切断
      if (this.databaseProxy) {
        await this.databaseProxy.disconnect()
      }

      // 設定を環境変数、VSCode設定、ユーザー入力の順で取得
      const vscodeConfig = vscode.workspace.getConfiguration("vscode-dbm")

      const dbType =
        data.type === "postgresql" ? "postgresql" : data.type === "sqlite" ? "sqlite" : "mysql"

      const defaultConfigs = {
        mysql: {
          host:
            data.host || process.env.MYSQL_HOST || vscodeConfig.get("mysql.host") || "localhost",
          port:
            data.port ||
            (process.env.MYSQL_PORT ? Number.parseInt(process.env.MYSQL_PORT, 10) : null) ||
            vscodeConfig.get("mysql.port") ||
            3307,
          database:
            data.database ||
            process.env.MYSQL_DATABASE ||
            vscodeConfig.get("mysql.database") ||
            "test_db",
          username:
            data.username ||
            process.env.MYSQL_USER ||
            vscodeConfig.get("mysql.username") ||
            "test_user",
          password:
            data.password ||
            process.env.MYSQL_PASSWORD ||
            vscodeConfig.get("mysql.password") ||
            "test_password",
        },
        postgresql: {
          host:
            data.host ||
            process.env.POSTGRES_HOST ||
            vscodeConfig.get("postgresql.host") ||
            "localhost",
          port:
            data.port ||
            (process.env.POSTGRES_PORT ? Number.parseInt(process.env.POSTGRES_PORT, 10) : null) ||
            vscodeConfig.get("postgresql.port") ||
            5433,
          database:
            data.database ||
            process.env.POSTGRES_DB ||
            vscodeConfig.get("postgresql.database") ||
            "test_db",
          username:
            data.username ||
            process.env.POSTGRES_USER ||
            vscodeConfig.get("postgresql.username") ||
            "test_user",
          password:
            data.password ||
            process.env.POSTGRES_PASSWORD ||
            vscodeConfig.get("postgresql.password") ||
            "test_password",
        },
        sqlite: {
          database:
            data.database ||
            process.env.SQLITE_DATABASE ||
            vscodeConfig.get("sqlite.database") ||
            ":memory:",
        },
      }

      // データベースタイプに応じて接続
      let config: DatabaseProxyConfig
      switch (dbType) {
        case "mysql": {
          const mysqlConfig = defaultConfigs.mysql
          config = {
            type: "mysql",
            host: mysqlConfig.host,
            port: mysqlConfig.port,
            database: mysqlConfig.database,
            username: mysqlConfig.username,
            password: mysqlConfig.password,
          }
          this.connectionType = `MySQL (${mysqlConfig.host}:${mysqlConfig.port})`
          break
        }
        case "postgresql": {
          const pgConfig = defaultConfigs.postgresql
          config = {
            type: "postgresql",
            host: pgConfig.host,
            port: pgConfig.port,
            database: pgConfig.database,
            username: pgConfig.username,
            password: pgConfig.password,
          }
          this.connectionType = `PostgreSQL (${pgConfig.host}:${pgConfig.port})`
          break
        }
        case "sqlite": {
          const sqliteConfig = defaultConfigs.sqlite
          config = {
            type: "sqlite",
            host: "",
            port: 0,
            database: sqliteConfig.database,
            username: "",
            password: "",
          }
          this.connectionType = `SQLite (${sqliteConfig.database})`
          break
        }
        default:
          throw new Error(`Unsupported database type: ${dbType}`)
      }

      this.databaseProxy = DatabaseProxyFactory.create(config)
      const connected = await this.databaseProxy.connect()
      this.isConnected = connected

      if (connected) {
        vscode.window.showInformationMessage(`${this.connectionType} 接続成功`)
        this.broadcastMessage({
          type: "connectionStatus",
          data: this.getConnectionStatus(),
        })
        return { success: true, message: `${this.connectionType} に接続しました` }
      }

      // フォールバック: SQLiteに自動切り替え
      if (dbType !== "sqlite") {
        console.warn(`${dbType} connection failed, falling back to SQLite`)
        return await this.connect({
          type: "sqlite",
          database: ":memory:",
          host: "",
          port: 0,
          username: "",
          password: "",
        })
      }

      throw new Error("データベース接続に失敗しました")
    } catch (error) {
      console.error("Database connection failed:", error)

      // フォールバック: SQLiteに自動切り替え
      if (data.type !== "sqlite") {
        console.warn(`${data.type} connection failed with error: ${error}, falling back to SQLite`)
        try {
          return await this.connect({
            type: "sqlite",
            database: ":memory:",
            host: "",
            port: 0,
            username: "",
            password: "",
          })
        } catch (fallbackError) {
          console.error("SQLite fallback also failed:", fallbackError)
        }
      }

      this.isConnected = false
      const errorMessage = error instanceof Error ? error.message : "不明なエラー"
      vscode.window.showErrorMessage(`接続エラー: ${errorMessage}`)
      return { success: false, message: errorMessage }
    }
  }

  /**
   * データベースから切断
   */
  async disconnect(): Promise<void> {
    if (this.databaseProxy) {
      await this.databaseProxy.disconnect()
      this.databaseProxy = undefined
    }
    this.isConnected = false
    this.connectionType = undefined

    this.broadcastMessage({
      type: "connectionStatus",
      data: this.getConnectionStatus(),
    })
  }

  /**
   * クエリを実行
   */
  async executeQuery(data: ExecuteQueryMessage["data"]): Promise<void> {
    if (!this.databaseProxy || !this.isConnected) {
      vscode.window.showWarningMessage("データベースに接続されていません")

      this.broadcastMessage({
        type: "queryResult",
        data: {
          success: false,
          results: [],
          message: "データベースに接続されていません",
        },
      })
      return
    }

    try {
      const query = data.query || "SELECT * FROM users LIMIT 10"
      const result = await this.databaseProxy.query(query)

      if (result.success) {
        vscode.window.showInformationMessage(
          `クエリ実行成功: ${result.rowCount}行取得 (${result.executionTime}ms) - ${this.connectionType}`
        )

        this.broadcastMessage({
          type: "queryResult",
          data: {
            success: true,
            results: result.rows || [],
            rowCount: result.rowCount || 0,
            executionTime: result.executionTime || 0,
            message: `${result.rowCount}行を取得しました (${this.connectionType})`,
          },
        })
      } else {
        throw new Error(result.error || "クエリ実行に失敗しました")
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "不明なエラー"
      vscode.window.showErrorMessage(`クエリエラー: ${errorMessage}`)

      this.broadcastMessage({
        type: "queryResult",
        data: {
          success: false,
          results: [],
          message: errorMessage,
        },
      })
    }
  }

  /**
   * テーブル一覧を取得
   */
  async getTables(): Promise<{ name: string; type: string }[]> {
    if (!this.databaseProxy || !this.isConnected) {
      return []
    }
    return await this.databaseProxy.getTables()
  }

  /**
   * クリーンアップ
   */
  async cleanup(): Promise<void> {
    await this.disconnect()
    this.listeners.clear()
  }
}
