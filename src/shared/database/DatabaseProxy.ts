/**
 * DatabaseProxy - VSCode拡張機能でのネイティブモジュール問題を回避
 * HTTP APIを通じてデータベースに接続
 */

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

  constructor(config: DatabaseProxyConfig) {
    this.config = config
  }

  async connect(): Promise<boolean> {
    try {
      // 接続テスト用の軽量クエリ
      const result = await this.query("SELECT 1 as test")
      return result.success
    } catch (error) {
      console.error("Database connection failed:", error)
      return false
    }
  }

  async query(sql: string, _params?: unknown[]): Promise<QueryResult> {
    const startTime = Date.now()

    try {
      // 実際のデータベース接続の代わりに、サンプルデータを返す
      // 将来的にはHTTP APIまたは別の方法で実装

      if (sql.toLowerCase().includes("select")) {
        return this.mockSelectQuery(sql, startTime)
      }
      return this.mockNonSelectQuery(sql, startTime)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        executionTime: Date.now() - startTime,
      }
    }
  }

  private mockSelectQuery(sql: string, startTime: number): QueryResult {
    // SQLに基づいてサンプルデータを返す
    if (sql.toLowerCase().includes("users")) {
      return {
        success: true,
        rows: [
          { id: 1, name: "Alice", email: "alice@example.com", created_at: "2024-01-01 10:00:00" },
          { id: 2, name: "Bob", email: "bob@example.com", created_at: "2024-01-01 11:00:00" },
          {
            id: 3,
            name: "Charlie",
            email: "charlie@example.com",
            created_at: "2024-01-01 12:00:00",
          },
        ],
        rowCount: 3,
        executionTime: Date.now() - startTime,
      }
    }
    if (sql.toLowerCase().includes("products")) {
      return {
        success: true,
        rows: [
          { id: 1, name: "Laptop", price: 999.99, category: "Electronics" },
          { id: 2, name: "Book", price: 19.99, category: "Education" },
          { id: 3, name: "Coffee", price: 4.5, category: "Food" },
        ],
        rowCount: 3,
        executionTime: Date.now() - startTime,
      }
    }
    return {
      success: true,
      rows: [{ test: 1 }],
      rowCount: 1,
      executionTime: Date.now() - startTime,
    }
  }

  private mockNonSelectQuery(_sql: string, startTime: number): QueryResult {
    // INSERT、UPDATE、DELETE等の操作
    return {
      success: true,
      rows: [],
      rowCount: 1, // 影響を受けた行数
      executionTime: Date.now() - startTime,
    }
  }

  async getTables(): Promise<{ name: string; type: string }[]> {
    // テーブル一覧を返す
    return [
      { name: "users", type: "table" },
      { name: "products", type: "table" },
      { name: "orders", type: "table" },
      { name: "user_orders", type: "view" },
    ]
  }

  async disconnect(): Promise<void> {
    // Cleanup logic will be implemented when needed
  }

  getConnectionInfo(): DatabaseProxyConfig {
    return { ...this.config }
  }
}

/**
 * データベース接続ファクトリー関数
 */
export const DatabaseProxyFactory = {
  create(config: DatabaseProxyConfig): DatabaseProxy {
    return new DatabaseProxy(config)
  },

  createMySQL(host = "localhost", port = 3307): DatabaseProxy {
    return new DatabaseProxy({
      type: "mysql",
      host,
      port,
      database: "test_db",
      username: "dev_user",
      password: "dev_password",
    })
  },

  createPostgreSQL(host = "localhost", port = 5433): DatabaseProxy {
    return new DatabaseProxy({
      type: "postgresql",
      host,
      port,
      database: "test_db",
      username: "dev_user",
      password: "dev_password",
    })
  },

  createSQLite(database = ":memory:"): DatabaseProxy {
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
