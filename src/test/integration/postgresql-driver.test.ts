import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest"
import { PostgreSQLDriver } from "@/shared/database/drivers/PostgreSQLDriver"
import { DatabaseConfig } from "@/shared/types"

describe("PostgreSQLDriver統合テスト", () => {
  let driver: PostgreSQLDriver
  let config: DatabaseConfig

  beforeAll(async () => {
    // Docker ComposeでPostgreSQLが起動していることを前提
    config = {
      id: "postgres-test",
      name: "PostgreSQL Test",
      type: "postgresql",
      host: "localhost",
      port: 5432,
      username: "dev_user",
      password: "dev_password",
      database: "test_db",
      ssl: false,
    }

    driver = new PostgreSQLDriver(config)
  }, 30000)

  afterAll(async () => {
    if (driver) {
      await driver.disconnect()
    }
  })

  beforeEach(async () => {
    // 各テスト前にクリーンな状態にする
    if (driver.isConnected()) {
      await driver.query("DROP TABLE IF EXISTS test_table CASCADE")
    }
  })

  describe("接続テスト", () => {
    it("PostgreSQL接続が正常に確立される", async () => {
      expect(driver.isConnected()).toBe(false)

      await driver.connect()

      expect(driver.isConnected()).toBe(true)
      expect(driver.getConnectionInfo().type).toBe("postgresql")
      expect(driver.getConnectionInfo().database).toBe("test_db")
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
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(255) UNIQUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `

      const result = await driver.query(createTableSQL)

      expect(result.error).toBeUndefined()
      expect(result.rowCount).toBe(0)
    })

    it("UUID生成クエリが正常に実行される", async () => {
      const result = await driver.query("SELECT uuid_generate_v4() as uuid_value")

      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].uuid_value).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      )
    })

    it("データ挿入クエリが正常に実行される", async () => {
      // まずテーブルを作成
      await driver.query(`
        CREATE TABLE test_table (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(255) UNIQUE
        )
      `)

      const insertResult = await driver.query(
        "INSERT INTO test_table (name, email) VALUES ($1, $2) RETURNING id",
        ["テストユーザー", "test@example.com"]
      )

      expect(insertResult.error).toBeUndefined()
      expect(insertResult.rowCount).toBe(1)
      expect(insertResult.rows[0].id).toBe(1)
    })

    it("データ取得クエリが正常に実行される", async () => {
      // テーブル作成とデータ挿入
      await driver.query(`
        CREATE TABLE test_table (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(255) UNIQUE
        )
      `)

      await driver.query("INSERT INTO test_table (name, email) VALUES ($1, $2)", [
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
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(255) UNIQUE
        )
      `)

      await driver.query("INSERT INTO test_table (name, email) VALUES ($1, $2)", [
        "テストユーザー",
        "test@example.com",
      ])

      const updateResult = await driver.query("UPDATE test_table SET name = $1 WHERE id = $2", [
        "更新されたユーザー",
        1,
      ])

      expect(updateResult.error).toBeUndefined()
      expect(updateResult.rowCount).toBe(1)

      // 更新確認
      const selectResult = await driver.query("SELECT name FROM test_table WHERE id = $1", [1])
      expect(selectResult.rows[0].name).toBe("更新されたユーザー")
    })

    it("データ削除クエリが正常に実行される", async () => {
      // テーブル作成とデータ挿入
      await driver.query(`
        CREATE TABLE test_table (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL
        )
      `)

      await driver.query("INSERT INTO test_table (name) VALUES ($1)", ["テストユーザー"])

      const deleteResult = await driver.query("DELETE FROM test_table WHERE id = $1", [1])

      expect(deleteResult.error).toBeUndefined()
      expect(deleteResult.rowCount).toBe(1)

      // 削除確認
      const selectResult = await driver.query("SELECT COUNT(*) as count FROM test_table")
      expect(parseInt(selectResult.rows[0].count)).toBe(0)
    })
  })

  describe("PostgreSQL固有機能テスト", () => {
    beforeEach(async () => {
      await driver.connect()
    })

    it("JSON型データの操作が正常に動作する", async () => {
      await driver.query(`
        CREATE TABLE test_table (
          id SERIAL PRIMARY KEY,
          data JSON NOT NULL
        )
      `)

      const jsonData = { name: "テストユーザー", age: 30, tags: ["developer", "postgresql"] }

      await driver.query("INSERT INTO test_table (data) VALUES ($1)", [JSON.stringify(jsonData)])

      const result = await driver.query("SELECT data FROM test_table WHERE id = 1")
      expect(JSON.parse(result.rows[0].data)).toEqual(jsonData)
    })

    it("ARRAY型データの操作が正常に動作する", async () => {
      await driver.query(`
        CREATE TABLE test_table (
          id SERIAL PRIMARY KEY,
          tags TEXT[] NOT NULL
        )
      `)

      const tags = ["tag1", "tag2", "tag3"]

      await driver.query("INSERT INTO test_table (tags) VALUES ($1)", [tags])

      const result = await driver.query("SELECT tags FROM test_table WHERE id = 1")
      expect(result.rows[0].tags).toEqual(tags)
    })

    it("UUIDカラムの操作が正常に動作する", async () => {
      await driver.query(`
        CREATE TABLE test_table (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name VARCHAR(100) NOT NULL
        )
      `)

      await driver.query("INSERT INTO test_table (name) VALUES ($1)", ["テストユーザー"])

      const result = await driver.query("SELECT id, name FROM test_table")
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      )
      expect(result.rows[0].name).toBe("テストユーザー")
    })

    it("ENUMタイプの操作が正常に動作する", async () => {
      await driver.query(`CREATE TYPE status_enum AS ENUM ('active', 'inactive', 'pending')`)

      await driver.query(`
        CREATE TABLE test_table (
          id SERIAL PRIMARY KEY,
          status status_enum NOT NULL DEFAULT 'pending'
        )
      `)

      await driver.query("INSERT INTO test_table (status) VALUES ($1)", ["active"])

      const result = await driver.query("SELECT status FROM test_table WHERE id = 1")
      expect(result.rows[0].status).toBe("active")
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
      expect(result.error).toContain("nonexistent_table")
    })

    it("制約違反でエラーが適切に処理される", async () => {
      await driver.query(`
        CREATE TABLE test_table (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL
        )
      `)

      await driver.query("INSERT INTO test_table (email) VALUES ($1)", ["test@example.com"])

      // 重複挿入
      const result = await driver.query("INSERT INTO test_table (email) VALUES ($1)", [
        "test@example.com",
      ])

      expect(result.error).toBeDefined()
      expect(result.error).toContain("duplicate key value")
    })
  })

  describe("PostgreSQLスキーマ取得テスト", () => {
    beforeEach(async () => {
      await driver.connect()
    })

    it("データベース一覧が取得できる", async () => {
      const databases = await driver.getDatabases()

      expect(databases).toBeInstanceOf(Array)
      expect(databases).toContain("test_db")
    })

    it("スキーマ一覧が取得できる", async () => {
      const schemas = await driver.getSchemas()

      expect(schemas).toBeInstanceOf(Array)
      expect(schemas).toContain("public")
    })

    it("テーブル一覧が取得できる", async () => {
      const tables = await driver.getTables()

      expect(tables).toBeInstanceOf(Array)
      // usersテーブルが初期データに含まれている
      expect(tables.some((table) => table.name === "users")).toBe(true)
    })

    it("テーブルスキーマが取得できる", async () => {
      const schema = await driver.getTableSchema("users")

      expect(schema).toBeDefined()
      expect(schema.name).toBe("users")
      expect(schema.columns).toBeInstanceOf(Array)
      expect(schema.columns.length).toBeGreaterThan(0)

      // idカラムの確認
      const idColumn = schema.columns.find((col) => col.name === "id")
      expect(idColumn).toBeDefined()
      expect(idColumn?.isPrimaryKey).toBe(true)
    })

    it("ビュー情報が取得できる", async () => {
      // テストビューを作成
      await driver.query(`
        CREATE VIEW test_view AS 
        SELECT id, name FROM users WHERE is_active = true
      `)

      const views = await driver.getViews()
      expect(views.some((view) => view.name === "test_view")).toBe(true)
    })

    it("インデックス情報が取得できる", async () => {
      await driver.query(`
        CREATE TABLE test_table (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE,
          name VARCHAR(100)
        )
      `)

      await driver.query("CREATE INDEX idx_test_name ON test_table (name)")

      const indexes = await driver.getTableIndexes("test_table")
      expect(indexes.some((idx) => idx.name === "idx_test_name")).toBe(true)
    })
  })

  describe("パフォーマンステスト", () => {
    beforeEach(async () => {
      await driver.connect()
    })

    it("大量データ挿入が適切な時間で完了する", async () => {
      await driver.query(`
        CREATE TABLE test_table (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100),
          value INTEGER
        )
      `)

      const startTime = Date.now()

      // バッチ挿入で効率化
      const values = Array.from({ length: 1000 }, (_, i) => `('name_${i}', ${i})`).join(",")
      await driver.query(`INSERT INTO test_table (name, value) VALUES ${values}`)

      const endTime = Date.now()
      const executionTime = endTime - startTime

      // 1000件で10秒以内（バッチ挿入）
      expect(executionTime).toBeLessThan(10000)

      const countResult = await driver.query("SELECT COUNT(*) as count FROM test_table")
      expect(parseInt(countResult.rows[0].count)).toBe(1000)
    }, 30000)

    it("複雑なJOINクエリが適切な時間で完了する", async () => {
      // 複数テーブル作成
      await driver.query(`
        CREATE TABLE categories (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL
        )
      `)

      await driver.query(`
        CREATE TABLE products (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          category_id INTEGER REFERENCES categories(id),
          price DECIMAL(10,2)
        )
      `)

      // データ挿入
      await driver.query("INSERT INTO categories (name) VALUES ($1), ($2), ($3)", [
        "Electronics",
        "Books",
        "Clothing",
      ])

      await driver.query(`
        INSERT INTO products (name, category_id, price) VALUES 
        ('Laptop', 1, 999.99),
        ('Book', 2, 19.99),
        ('Shirt', 3, 29.99)
      `)

      const startTime = Date.now()

      const result = await driver.query(`
        SELECT p.name as product_name, c.name as category_name, p.price
        FROM products p
        JOIN categories c ON p.category_id = c.id
        ORDER BY p.price DESC
      `)

      const endTime = Date.now()
      const executionTime = endTime - startTime

      expect(executionTime).toBeLessThan(1000) // 1秒以内
      expect(result.rows).toHaveLength(3)
      expect(result.rows[0].product_name).toBe("Laptop")
    })
  })
})
