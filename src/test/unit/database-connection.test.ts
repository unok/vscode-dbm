import { describe, it, expect, beforeEach, vi } from "vitest"
import { DatabaseConnection } from "@/shared/database/DatabaseConnection"
import { DatabaseConfig } from "@/shared/types"

// モック設定
vi.mock("mysql2/promise", () => ({
  createConnection: vi.fn(),
  createPool: vi.fn(),
}))

vi.mock("pg", () => ({
  Client: vi.fn(),
  Pool: vi.fn(),
}))

vi.mock("better-sqlite3", () => ({
  default: vi.fn(),
}))

describe("DatabaseConnection", () => {
  let mockConfig: DatabaseConfig

  beforeEach(() => {
    mockConfig = {
      id: "test-connection-1",
      name: "Test Database",
      type: "mysql",
      host: "localhost",
      port: 3306,
      username: "test_user",
      password: "test_password",
      database: "test_db",
      ssl: false,
    }
  })

  describe("接続成功テスト", () => {
    it("MySQL接続が成功する", async () => {
      const connection = new DatabaseConnection(mockConfig)

      await expect(connection.connect()).resolves.not.toThrow()
      expect(connection.isConnected()).toBe(true)
      expect(connection.getConnectionId()).toBe("test-connection-1")
    })

    it("PostgreSQL接続が成功する", async () => {
      const postgresConfig: DatabaseConfig = {
        ...mockConfig,
        type: "postgresql",
        port: 5432,
      }

      const connection = new DatabaseConnection(postgresConfig)

      await expect(connection.connect()).resolves.not.toThrow()
      expect(connection.isConnected()).toBe(true)
    })

    it("SQLite接続が成功する", async () => {
      const sqliteConfig: DatabaseConfig = {
        id: "test-sqlite",
        name: "Test SQLite",
        type: "sqlite",
        database: ":memory:",
      }

      const connection = new DatabaseConnection(sqliteConfig)

      await expect(connection.connect()).resolves.not.toThrow()
      expect(connection.isConnected()).toBe(true)
    })
  })

  describe("接続失敗テスト", () => {
    it("無効なホストで接続が失敗する", async () => {
      const invalidConfig: DatabaseConfig = {
        ...mockConfig,
        host: "invalid-host-12345",
      }

      const connection = new DatabaseConnection(invalidConfig)

      await expect(connection.connect()).rejects.toThrow()
      expect(connection.isConnected()).toBe(false)
    })

    it("無効な認証情報で接続が失敗する", async () => {
      const invalidConfig: DatabaseConfig = {
        ...mockConfig,
        username: "invalid_user",
        password: "invalid_password",
      }

      const connection = new DatabaseConnection(invalidConfig)

      await expect(connection.connect()).rejects.toThrow()
      expect(connection.isConnected()).toBe(false)
    })

    it("存在しないデータベースで接続が失敗する", async () => {
      const invalidConfig: DatabaseConfig = {
        ...mockConfig,
        database: "nonexistent_database_12345",
      }

      const connection = new DatabaseConnection(invalidConfig)

      await expect(connection.connect()).rejects.toThrow()
      expect(connection.isConnected()).toBe(false)
    })
  })

  describe("接続プール管理テスト", () => {
    it("接続プールが正しく作成される", () => {
      const connection = new DatabaseConnection(mockConfig)

      expect(connection.getPoolSize()).toBe(0)

      connection.createPool({ min: 2, max: 10 })

      expect(connection.getPoolSize()).toBe(2)
      expect(connection.getMaxPoolSize()).toBe(10)
    })

    it("接続プールからの接続取得が正常に動作する", async () => {
      const connection = new DatabaseConnection(mockConfig)
      connection.createPool({ min: 1, max: 5 })

      const poolConnection = await connection.getPoolConnection()

      expect(poolConnection).toBeDefined()
      expect(connection.getActiveConnectionsCount()).toBe(1)
    })

    it("接続プールの上限を超えた場合の処理が正しい", async () => {
      const connection = new DatabaseConnection(mockConfig)
      connection.createPool({ min: 1, max: 2 })

      const conn1 = await connection.getPoolConnection()
      const conn2 = await connection.getPoolConnection()

      expect(connection.getActiveConnectionsCount()).toBe(2)

      // 3つ目の接続要求は待機またはエラーとなる
      await expect(connection.getPoolConnection()).rejects.toThrow("Pool exhausted")
    })

    it("接続プールのクリーンアップが正常に動作する", async () => {
      const connection = new DatabaseConnection(mockConfig)
      connection.createPool({ min: 2, max: 10 })

      await connection.destroyPool()

      expect(connection.getPoolSize()).toBe(0)
      expect(connection.getActiveConnectionsCount()).toBe(0)
    })
  })

  describe("クエリ実行テスト", () => {
    it("SELECT クエリが正常に実行される", async () => {
      const connection = new DatabaseConnection(mockConfig)
      await connection.connect()

      const result = await connection.query("SELECT 1 as test")

      expect(result.rows).toHaveLength(1)
      expect(result.rows[0]).toEqual({ test: 1 })
      expect(result.rowCount).toBe(1)
      expect(result.executionTime).toBeGreaterThan(0)
    })

    it("無効なクエリでエラーが返される", async () => {
      const connection = new DatabaseConnection(mockConfig)
      await connection.connect()

      const result = await connection.query("INVALID SQL QUERY")

      expect(result.error).toBeDefined()
      expect(result.rows).toHaveLength(0)
    })

    it("パラメータ付きクエリが正常に実行される", async () => {
      const connection = new DatabaseConnection(mockConfig)
      await connection.connect()

      const result = await connection.query("SELECT ? as value", [42])

      expect(result.rows).toHaveLength(1)
      expect(result.rows[0]).toEqual({ value: 42 })
    })
  })

  describe("接続状態管理テスト", () => {
    it("接続状態の取得が正しく動作する", async () => {
      const connection = new DatabaseConnection(mockConfig)

      expect(connection.getConnectionStatus().connected).toBe(false)

      await connection.connect()

      const status = connection.getConnectionStatus()
      expect(status.connected).toBe(true)
      expect(status.lastConnected).toBeInstanceOf(Date)
    })

    it("接続切断が正常に動作する", async () => {
      const connection = new DatabaseConnection(mockConfig)
      await connection.connect()

      expect(connection.isConnected()).toBe(true)

      await connection.disconnect()

      expect(connection.isConnected()).toBe(false)
    })

    it("接続タイムアウトが正しく処理される", async () => {
      const timeoutConfig: DatabaseConfig = {
        ...mockConfig,
        host: "slow-host",
      }

      const connection = new DatabaseConnection(timeoutConfig)

      // 5秒でタイムアウト設定
      await expect(connection.connect(5000)).rejects.toThrow("Connection timeout")
    }, 10000)
  })
})
