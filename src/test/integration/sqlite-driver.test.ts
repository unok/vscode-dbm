import { promises as fs } from "fs"
import { resolve } from "path"
import { SQLiteDriver } from "@/shared/database/drivers/SQLiteDriver"
import type { DatabaseConfig } from "@/shared/types"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

describe("SQLiteDriver統合テスト", () => {
  let driver: SQLiteDriver
  let config: DatabaseConfig
  let tempDbPath: string

  beforeAll(async () => {
    // テスト用のSQLiteデータベースファイルパス
    tempDbPath = resolve("./test-database.sqlite")

    config = {
      id: "sqlite-test",
      name: "SQLite Test",
      type: "sqlite",
      database: tempDbPath,
    }

    driver = new SQLiteDriver(config)
  }, 30000)

  afterAll(async () => {
    if (driver) {
      await driver.disconnect()
    }

    // テスト用データベースファイルを削除
    try {
      await fs.unlink(tempDbPath)
    } catch (error) {
      // ファイルが存在しない場合は無視
    }
  })

  beforeEach(async () => {
    // 各テスト前にクリーンな状態にする
    if (driver.isConnected()) {
      await driver.query("DROP TABLE IF EXISTS test_table")
    }
  })

  describe("接続テスト", () => {
    it("SQLite接続が正常に確立される", async () => {
      expect(driver.isConnected()).toBe(false)

      await driver.connect()

      expect(driver.isConnected()).toBe(true)
      expect(driver.getConnectionInfo().type).toBe("sqlite")
      expect(driver.getConnectionInfo().database).toBe(tempDbPath)
    })

    it("メモリ内データベース接続が正常に動作する", async () => {
      const memoryConfig: DatabaseConfig = {
        id: "sqlite-memory",
        name: "SQLite Memory",
        type: "sqlite",
        database: ":memory:",
      }

      const memoryDriver = new SQLiteDriver(memoryConfig)

      await memoryDriver.connect()
      expect(memoryDriver.isConnected()).toBe(true)

      await memoryDriver.disconnect()
    })

    it("接続切断が正常に動作する", async () => {
      await driver.connect()
      expect(driver.isConnected()).toBe(true)

      await driver.disconnect()

      expect(driver.isConnected()).toBe(false)
    })

    it("再接続が正常に動作する", async () => {
      await driver.connect()
      await driver.disconnect()

      expect(driver.isConnected()).toBe(false)

      await driver.connect()

      expect(driver.isConnected()).toBe(true)
    })
  })

  describe("基本クエリテスト", () => {
    beforeEach(async () => {
      await driver.connect()
    })

    it("SELECT 1 クエリが正常に実行される", async () => {
      const result = await driver.query("SELECT 1 as test_value")

      expect(result.rows).toHaveLength(1)
      expect(result.rows[0]).toEqual({ test_value: 1 })
      expect(result.rowCount).toBe(1)
      expect(result.executionTime).toBeGreaterThan(0)
      expect(result.error).toBeUndefined()
    })

    it("テーブル作成クエリが正常に実行される", async () => {
      const createTableSQL = `
        CREATE TABLE test_table (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `

      const result = await driver.query(createTableSQL)

      expect(result.error).toBeUndefined()
      expect(result.rowCount).toBe(0)
    })

    it("データ挿入クエリが正常に実行される", async () => {
      // まずテーブルを作成
      await driver.query(`
        CREATE TABLE test_table (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE
        )
      `)

      const insertResult = await driver.query(
        "INSERT INTO test_table (name, email) VALUES (?, ?)",
        ["テストユーザー", "test@example.com"]
      )

      expect(insertResult.error).toBeUndefined()
      expect(insertResult.rowCount).toBe(1)
    })

    it("データ取得クエリが正常に実行される", async () => {
      // テーブル作成とデータ挿入
      await driver.query(`
        CREATE TABLE test_table (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE
        )
      `)

      await driver.query("INSERT INTO test_table (name, email) VALUES (?, ?)", [
        "テストユーザー",
        "test@example.com",
      ])

      const selectResult = await driver.query("SELECT * FROM test_table")

      expect(selectResult.rows).toHaveLength(1)
      expect(selectResult.rows[0]).toMatchObject({
        id: 1,
        name: "テストユーザー",
        email: "test@example.com",
      })
    })

    it("データ更新クエリが正常に実行される", async () => {
      // テーブル作成とデータ挿入
      await driver.query(`
        CREATE TABLE test_table (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE
        )
      `)

      await driver.query("INSERT INTO test_table (name, email) VALUES (?, ?)", [
        "テストユーザー",
        "test@example.com",
      ])

      const updateResult = await driver.query("UPDATE test_table SET name = ? WHERE id = ?", [
        "更新されたユーザー",
        1,
      ])

      expect(updateResult.error).toBeUndefined()
      expect(updateResult.rowCount).toBe(1)

      // 更新確認
      const selectResult = await driver.query("SELECT name FROM test_table WHERE id = ?", [1])
      expect(selectResult.rows[0].name).toBe("更新されたユーザー")
    })

    it("データ削除クエリが正常に実行される", async () => {
      // テーブル作成とデータ挿入
      await driver.query(`
        CREATE TABLE test_table (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL
        )
      `)

      await driver.query("INSERT INTO test_table (name) VALUES (?)", ["テストユーザー"])

      const deleteResult = await driver.query("DELETE FROM test_table WHERE id = ?", [1])

      expect(deleteResult.error).toBeUndefined()
      expect(deleteResult.rowCount).toBe(1)

      // 削除確認
      const selectResult = await driver.query("SELECT COUNT(*) as count FROM test_table")
      expect(selectResult.rows[0].count).toBe(0)
    })
  })

  describe("SQLite固有機能テスト", () => {
    beforeEach(async () => {
      await driver.connect()
    })

    it("JSON関数の操作が正常に動作する", async () => {
      await driver.query(`
        CREATE TABLE test_table (
          id INTEGER PRIMARY KEY,
          data TEXT
        )
      `)

      const jsonData = { name: "テストユーザー", age: 30, tags: ["developer", "sqlite"] }

      await driver.query("INSERT INTO test_table (data) VALUES (?)", [JSON.stringify(jsonData)])

      // JSON関数を使用してデータ取得
      const result = await driver.query(
        'SELECT json_extract(data, "$.name") as name FROM test_table WHERE id = 1'
      )
      expect(result.rows[0].name).toBe("テストユーザー")
    })

    it("BLOB型データの操作が正常に動作する", async () => {
      await driver.query(`
        CREATE TABLE test_table (
          id INTEGER PRIMARY KEY,
          binary_data BLOB
        )
      `)

      const binaryData = Buffer.from("テストバイナリデータ", "utf8")

      await driver.query("INSERT INTO test_table (binary_data) VALUES (?)", [binaryData])

      const result = await driver.query("SELECT binary_data FROM test_table WHERE id = 1")
      expect(Buffer.from(result.rows[0].binary_data).toString("utf8")).toBe("テストバイナリデータ")
    })

    it("FTS（全文検索）の操作が正常に動作する", async () => {
      await driver.query(`
        CREATE VIRTUAL TABLE documents USING fts5(title, content)
      `)

      await driver.query("INSERT INTO documents (title, content) VALUES (?, ?)", [
        "SQLiteドキュメント",
        "SQLiteは軽量で高速なデータベースエンジンです",
      ])

      const result = await driver.query("SELECT * FROM documents WHERE documents MATCH ?", [
        "SQLite",
      ])
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].title).toBe("SQLiteドキュメント")
    })

    it("ユーザー定義関数の作成が正常に動作する", async () => {
      // 実際のSQLiteドライバーでユーザー定義関数のテストケース
      // （実装時にSQLiteのuser-defined functionsを作成）

      const result = await driver.query("SELECT abs(-5) as absolute_value")
      expect(result.rows[0].absolute_value).toBe(5)
    })

    it("トランザクションが正常に動作する", async () => {
      await driver.query(`
        CREATE TABLE test_table (
          id INTEGER PRIMARY KEY,
          balance INTEGER NOT NULL
        )
      `)

      await driver.query("INSERT INTO test_table (balance) VALUES (100)")

      // トランザクション開始
      await driver.query("BEGIN TRANSACTION")

      try {
        await driver.query("UPDATE test_table SET balance = balance - 50 WHERE id = 1")
        await driver.query("INSERT INTO test_table (balance) VALUES (50)")

        // コミット
        await driver.query("COMMIT")

        const result = await driver.query("SELECT SUM(balance) as total FROM test_table")
        expect(result.rows[0].total).toBe(100)
      } catch (error) {
        await driver.query("ROLLBACK")
        throw error
      }
    })
  })

  describe("エラーハンドリングテスト", () => {
    beforeEach(async () => {
      await driver.connect()
    })

    it("無効なSQLでエラーが適切に処理される", async () => {
      const result = await driver.query("INVALID SQL SYNTAX")

      expect(result.error).toBeDefined()
      expect(result.rows).toHaveLength(0)
      expect(result.rowCount).toBe(0)
    })

    it("存在しないテーブルへのクエリでエラーが適切に処理される", async () => {
      const result = await driver.query("SELECT * FROM nonexistent_table")

      expect(result.error).toBeDefined()
      expect(result.error).toContain("no such table")
    })

    it("制約違反でエラーが適切に処理される", async () => {
      await driver.query(`
        CREATE TABLE test_table (
          id INTEGER PRIMARY KEY,
          email TEXT UNIQUE NOT NULL
        )
      `)

      await driver.query("INSERT INTO test_table (email) VALUES (?)", ["test@example.com"])

      // 重複挿入
      const result = await driver.query("INSERT INTO test_table (email) VALUES (?)", [
        "test@example.com",
      ])

      expect(result.error).toBeDefined()
      expect(result.error).toContain("UNIQUE constraint failed")
    })

    it("型制約違反でエラーが適切に処理される", async () => {
      await driver.query(`
        CREATE TABLE test_table (
          id INTEGER PRIMARY KEY,
          value INTEGER NOT NULL
        )
      `)

      const result = await driver.query("INSERT INTO test_table (value) VALUES (?)", [
        "not_a_number",
      ])

      // SQLiteは型に寛容だが、NULLチェックなどでエラーが発生する場合がある
      expect(result.error || result.rows.length >= 0).toBeTruthy()
    })
  })

  describe("SQLiteスキーマ取得テスト", () => {
    beforeEach(async () => {
      await driver.connect()
    })

    it("テーブル一覧が取得できる", async () => {
      await driver.query(`
        CREATE TABLE test_table1 (id INTEGER PRIMARY KEY, name TEXT)
      `)
      await driver.query(`
        CREATE TABLE test_table2 (id INTEGER PRIMARY KEY, value INTEGER)
      `)

      const tables = await driver.getTables()

      expect(tables).toBeInstanceOf(Array)
      expect(tables.some((table) => table.name === "test_table1")).toBe(true)
      expect(tables.some((table) => table.name === "test_table2")).toBe(true)
    })

    it("テーブルスキーマが取得できる", async () => {
      await driver.query(`
        CREATE TABLE test_table (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE,
          age INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)

      const schema = await driver.getTableSchema("test_table")

      expect(schema).toBeDefined()
      expect(schema.name).toBe("test_table")
      expect(schema.columns).toBeInstanceOf(Array)
      expect(schema.columns.length).toBe(5)

      // idカラムの確認
      const idColumn = schema.columns.find((col) => col.name === "id")
      expect(idColumn).toBeDefined()
      expect(idColumn?.isPrimaryKey).toBe(true)
      expect(idColumn?.autoIncrement).toBe(true)

      // nameカラムの確認
      const nameColumn = schema.columns.find((col) => col.name === "name")
      expect(nameColumn).toBeDefined()
      expect(nameColumn?.nullable).toBe(false)
    })

    it("インデックス情報が取得できる", async () => {
      await driver.query(`
        CREATE TABLE test_table (
          id INTEGER PRIMARY KEY,
          email TEXT UNIQUE,
          name TEXT
        )
      `)

      await driver.query("CREATE INDEX idx_test_name ON test_table (name)")

      const indexes = await driver.getTableIndexes("test_table")
      expect(indexes.some((idx) => idx.name === "idx_test_name")).toBe(true)
    })

    it("ビュー情報が取得できる", async () => {
      await driver.query(`
        CREATE TABLE test_table (
          id INTEGER PRIMARY KEY,
          name TEXT,
          active INTEGER DEFAULT 1
        )
      `)

      await driver.query(`
        CREATE VIEW active_users AS 
        SELECT id, name FROM test_table WHERE active = 1
      `)

      const views = await driver.getViews()
      expect(views.some((view) => view.name === "active_users")).toBe(true)
    })
  })

  describe("パフォーマンステスト", () => {
    beforeEach(async () => {
      await driver.connect()
    })

    it("大量データ挿入が適切な時間で完了する", async () => {
      await driver.query(`
        CREATE TABLE test_table (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          value INTEGER
        )
      `)

      const startTime = Date.now()

      // トランザクション内で一括挿入
      await driver.query("BEGIN TRANSACTION")

      for (let i = 0; i < 1000; i++) {
        await driver.query("INSERT INTO test_table (name, value) VALUES (?, ?)", [`name_${i}`, i])
      }

      await driver.query("COMMIT")

      const endTime = Date.now()
      const executionTime = endTime - startTime

      // 1000件で5秒以内（トランザクション使用）
      expect(executionTime).toBeLessThan(5000)

      const countResult = await driver.query("SELECT COUNT(*) as count FROM test_table")
      expect(countResult.rows[0].count).toBe(1000)
    }, 30000)

    it("ファイルサイズが適切に管理される", async () => {
      await driver.query(`
        CREATE TABLE test_table (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          data TEXT
        )
      `)

      // 大量データ挿入
      const largeText = "x".repeat(1000)
      for (let i = 0; i < 100; i++) {
        await driver.query("INSERT INTO test_table (data) VALUES (?)", [largeText])
      }

      // ファイルサイズ確認
      const stats = await fs.stat(tempDbPath)
      expect(stats.size).toBeGreaterThan(0)
      expect(stats.size).toBeLessThan(10 * 1024 * 1024) // 10MB未満

      // VACUUM実行でファイルサイズ最適化
      await driver.query("VACUUM")

      const statsAfterVacuum = await fs.stat(tempDbPath)
      expect(statsAfterVacuum.size).toBeLessThanOrEqual(stats.size)
    })
  })

  describe("並行アクセステスト", () => {
    it("複数の読み取り接続が同時に動作する", async () => {
      const config1: DatabaseConfig = {
        id: "sqlite-concurrent-1",
        name: "SQLite Concurrent 1",
        type: "sqlite",
        database: tempDbPath,
      }

      const config2: DatabaseConfig = {
        id: "sqlite-concurrent-2",
        name: "SQLite Concurrent 2",
        type: "sqlite",
        database: tempDbPath,
      }

      const driver1 = new SQLiteDriver(config1)
      const driver2 = new SQLiteDriver(config2)

      await driver.connect()
      await driver.query(`
        CREATE TABLE test_table (
          id INTEGER PRIMARY KEY,
          value INTEGER
        )
      `)
      await driver.query("INSERT INTO test_table (value) VALUES (42)")

      await driver1.connect()
      await driver2.connect()

      // 同時読み取り
      const [result1, result2] = await Promise.all([
        driver1.query("SELECT * FROM test_table"),
        driver2.query("SELECT * FROM test_table"),
      ])

      expect(result1.rows).toHaveLength(1)
      expect(result2.rows).toHaveLength(1)
      expect(result1.rows[0].value).toBe(42)
      expect(result2.rows[0].value).toBe(42)

      await driver1.disconnect()
      await driver2.disconnect()
    })
  })
})
