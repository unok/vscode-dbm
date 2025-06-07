import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MySQLDriver } from "@/shared/database/drivers/MySQLDriver";
import type { DatabaseConfig } from "@/shared/types";

describe("MySQLDriver統合テスト", () => {
  let driver: MySQLDriver;
  let config: DatabaseConfig;

  beforeAll(async () => {
    // Docker ComposeでMySQLが起動していることを前提
    config = {
      id: "mysql-test",
      name: "MySQL Test",
      type: "mysql",
      host: "localhost",
      port: 3306,
      username: "dev_user",
      password: "dev_password",
      database: "test_db",
      ssl: false,
    };

    driver = new MySQLDriver(config);
  }, 30000);

  afterAll(async () => {
    if (driver) {
      await driver.disconnect();
    }
  });

  beforeEach(async () => {
    // 各テスト前にクリーンな状態にする
    if (driver.isConnected()) {
      await driver.query("DROP TABLE IF EXISTS test_table");
    }
  });

  describe("接続テスト", () => {
    it("MySQL接続が正常に確立される", async () => {
      expect(driver.isConnected()).toBe(false);

      await driver.connect();

      expect(driver.isConnected()).toBe(true);
      expect(driver.getConnectionInfo().type).toBe("mysql");
      expect(driver.getConnectionInfo().database).toBe("test_db");
    });

    it("接続切断が正常に動作する", async () => {
      await driver.connect();
      expect(driver.isConnected()).toBe(true);

      await driver.disconnect();

      expect(driver.isConnected()).toBe(false);
    });

    it("再接続が正常に動作する", async () => {
      await driver.connect();
      await driver.disconnect();

      expect(driver.isConnected()).toBe(false);

      await driver.connect();

      expect(driver.isConnected()).toBe(true);
    });
  });

  describe("基本クエリテスト", () => {
    beforeEach(async () => {
      await driver.connect();
    });

    it("SELECT 1 クエリが正常に実行される", async () => {
      const result = await driver.query("SELECT 1 as test_value");

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toEqual({ test_value: 1 });
      expect(result.rowCount).toBe(1);
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
    });

    it("テーブル作成クエリが正常に実行される", async () => {
      const createTableSql = `
        CREATE TABLE test_table (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(255) UNIQUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      const result = await driver.query(createTableSql);

      expect(result.error).toBeUndefined();
      expect(result.rowCount).toBe(0);
    });

    it("データ挿入クエリが正常に実行される", async () => {
      // まずテーブルを作成
      await driver.query(`
        CREATE TABLE test_table (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(255) UNIQUE
        )
      `);

      const insertResult = await driver.query(
        "INSERT INTO test_table (name, email) VALUES (?, ?)",
        ["テストユーザー", "test@example.com"],
      );

      expect(insertResult.error).toBeUndefined();
      expect(insertResult.rowCount).toBe(1);
    });

    it("データ取得クエリが正常に実行される", async () => {
      // テーブル作成とデータ挿入
      await driver.query(`
        CREATE TABLE test_table (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(255) UNIQUE
        )
      `);

      await driver.query("INSERT INTO test_table (name, email) VALUES (?, ?)", [
        "テストユーザー",
        "test@example.com",
      ]);

      const selectResult = await driver.query("SELECT * FROM test_table");

      expect(selectResult.rows).toHaveLength(1);
      expect(selectResult.rows[0]).toMatchObject({
        id: 1,
        name: "テストユーザー",
        email: "test@example.com",
      });
    });

    it("データ更新クエリが正常に実行される", async () => {
      // テーブル作成とデータ挿入
      await driver.query(`
        CREATE TABLE test_table (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(255) UNIQUE
        )
      `);

      await driver.query("INSERT INTO test_table (name, email) VALUES (?, ?)", [
        "テストユーザー",
        "test@example.com",
      ]);

      const updateResult = await driver.query(
        "UPDATE test_table SET name = ? WHERE id = ?",
        ["更新されたユーザー", 1],
      );

      expect(updateResult.error).toBeUndefined();
      expect(updateResult.rowCount).toBe(1);

      // 更新確認
      const selectResult = await driver.query(
        "SELECT name FROM test_table WHERE id = 1",
      );
      expect(selectResult.rows[0].name).toBe("更新されたユーザー");
    });

    it("データ削除クエリが正常に実行される", async () => {
      // テーブル作成とデータ挿入
      await driver.query(`
        CREATE TABLE test_table (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL
        )
      `);

      await driver.query("INSERT INTO test_table (name) VALUES (?)", [
        "テストユーザー",
      ]);

      const deleteResult = await driver.query(
        "DELETE FROM test_table WHERE id = ?",
        [1],
      );

      expect(deleteResult.error).toBeUndefined();
      expect(deleteResult.rowCount).toBe(1);

      // 削除確認
      const selectResult = await driver.query(
        "SELECT COUNT(*) as count FROM test_table",
      );
      expect(selectResult.rows[0].count).toBe(0);
    });
  });

  describe("エラーハンドリングテスト", () => {
    beforeEach(async () => {
      await driver.connect();
    });

    it("無効なSQLでエラーが適切に処理される", async () => {
      const result = await driver.query("INVALID SQL SYNTAX");

      expect(result.error).toBeDefined();
      expect(result.rows).toHaveLength(0);
      expect(result.rowCount).toBe(0);
    });

    it("存在しないテーブルへのクエリでエラーが適切に処理される", async () => {
      const result = await driver.query("SELECT * FROM nonexistent_table");

      expect(result.error).toBeDefined();
      expect(result.error).toContain("nonexistent_table");
    });

    it("制約違反でエラーが適切に処理される", async () => {
      await driver.query(`
        CREATE TABLE test_table (
          id INT AUTO_INCREMENT PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL
        )
      `);

      await driver.query("INSERT INTO test_table (email) VALUES (?)", [
        "test@example.com",
      ]);

      // 重複挿入
      const result = await driver.query(
        "INSERT INTO test_table (email) VALUES (?)",
        ["test@example.com"],
      );

      expect(result.error).toBeDefined();
      expect(result.error).toContain("Duplicate entry");
    });
  });

  describe("MySQLスキーマ取得テスト", () => {
    beforeEach(async () => {
      await driver.connect();
    });

    it("データベース一覧が取得できる", async () => {
      const databases = await driver.getDatabases();

      expect(databases).toBeInstanceOf(Array);
      expect(databases).toContain("test_db");
    });

    it("テーブル一覧が取得できる", async () => {
      const tables = await driver.getTables();

      expect(tables).toBeInstanceOf(Array);
      // usersテーブルが初期データに含まれている
      expect(tables.some((table) => table.name === "users")).toBe(true);
    });

    it("テーブルスキーマが取得できる", async () => {
      const schema = await driver.getTableSchema("users");

      expect(schema).toBeDefined();
      expect(schema.name).toBe("users");
      expect(schema.columns).toBeInstanceOf(Array);
      expect(schema.columns.length).toBeGreaterThan(0);

      // idカラムの確認
      const idColumn = schema.columns.find((col) => col.name === "id");
      expect(idColumn).toBeDefined();
      expect(idColumn?.isPrimaryKey).toBe(true);
    });

    it("カラム情報が正しく取得される", async () => {
      const schema = await driver.getTableSchema("users");
      const nameColumn = schema.columns.find((col) => col.name === "name");

      expect(nameColumn).toBeDefined();
      expect(nameColumn?.type).toContain("varchar");
      expect(nameColumn?.nullable).toBe(false);
    });
  });

  describe("パフォーマンステスト", () => {
    beforeEach(async () => {
      await driver.connect();
    });

    it("大量データ挿入が適切な時間で完了する", async () => {
      await driver.query(`
        CREATE TABLE test_table (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100),
          value INT
        )
      `);

      const startTime = Date.now();

      // 1000件のデータを挿入
      for (let i = 0; i < 1000; i++) {
        await driver.query(
          "INSERT INTO test_table (name, value) VALUES (?, ?)",
          [`name_${i}`, i],
        );
      }

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // 1000件で30秒以内
      expect(executionTime).toBeLessThan(30000);

      const countResult = await driver.query(
        "SELECT COUNT(*) as count FROM test_table",
      );
      expect(countResult.rows[0].count).toBe(1000);
    }, 60000);
  });
});
