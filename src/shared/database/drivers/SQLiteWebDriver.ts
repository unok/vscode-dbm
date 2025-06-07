import initSqlJs, {
  type Database,
  type SqlJsStatic,
  type SqlValue,
} from "sql.js";
import type {
  ColumnSchema,
  IndexSchema,
  QueryResult,
  TableSchema,
} from "../../types";
import { DatabaseConnection } from "../DatabaseConnection";

/**
 * WebAssembly版SQLiteドライバー（VSCode拡張機能対応）
 * sql.jsを使用してブラウザ/Node.js環境で動作
 */
export class SQLiteWebDriver extends DatabaseConnection {
  private db?: Database;
  private sqlJs?: SqlJsStatic;

  async connect(timeout = 10000): Promise<void> {
    try {
      await this.executeWithTimeout(async () => {
        // sql.jsを初期化
        this.sqlJs = await initSqlJs({
          // WebAssemblyファイルのパスを指定（必要に応じて）
          // locateFile: (file: string) => `path/to/${file}`
        });

        // メモリ内データベースを作成
        this.db = new this.sqlJs.Database();
        this.setConnected(true);
      }, timeout);
    } catch (error) {
      this.setConnected(false);
      throw new Error(`SQLite WebAssembly connection failed: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = undefined;
    }
    this.setConnected(false);
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    if (!this.db || !this.sqlJs) {
      return {
        rows: [],
        rowCount: 0,
        executionTime: 0,
        error: "Not connected to database",
      };
    }

    const startTime = Date.now();

    try {
      // パラメータを適切な型に変換
      const sqlParams: SqlValue[] = (params || []).map((param) => {
        if (param === null || param === undefined) return null;
        if (typeof param === "string" || typeof param === "number") {
          return param;
        }
        return String(param);
      });

      // クエリを実行
      const stmt = this.db.prepare(sql);
      if (sqlParams.length > 0) {
        stmt.bind(sqlParams);
      }

      const rows: Record<string, unknown>[] = [];

      // 結果を取得
      while (stmt.step()) {
        const row = stmt.getAsObject();
        rows.push(row);
      }

      stmt.free();

      return {
        rows,
        rowCount: rows.length,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        rows: [],
        rowCount: 0,
        executionTime: Date.now() - startTime,
        error: (error as Error).message,
      };
    }
  }

  async getTables(): Promise<{ name: string; type: string }[]> {
    const result = await this.query(`
      SELECT name, type 
      FROM sqlite_master 
      WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);

    return result.rows as { name: string; type: string }[];
  }

  async getViews(): Promise<{ name: string; type: string }[]> {
    const result = await this.query(`
      SELECT name, type 
      FROM sqlite_master 
      WHERE type = 'view'
      ORDER BY name
    `);

    return result.rows as { name: string; type: string }[];
  }

  async getTableSchema(tableName: string): Promise<TableSchema> {
    // テーブル情報取得
    const pragmaResult = await this.query(`PRAGMA table_info(${tableName})`);

    const columns: ColumnSchema[] = pragmaResult.rows.map(
      (row: Record<string, unknown>) => ({
        name: String(row.name),
        type: String(row.type),
        nullable: row.notnull === 0,
        defaultValue:
          row.dflt_value === null ? undefined : String(row.dflt_value),
        isPrimaryKey: row.pk === 1,
        isForeignKey: false, // TODO: 外部キー判定の実装
        isUnique: false, // TODO: ユニーク制約判定の実装
        autoIncrement:
          row.pk === 1 && String(row.type).toLowerCase().includes("integer"),
      }),
    );

    // 主キー一覧
    const primaryKeys = columns
      .filter((col) => col.isPrimaryKey)
      .map((col) => col.name);

    return {
      name: tableName,
      columns,
      primaryKeys,
      foreignKeys: [], // TODO: 外部キー情報の実装
      indexes: await this.getTableIndexes(tableName),
    };
  }

  async getTableIndexes(tableName: string): Promise<IndexSchema[]> {
    const indexListResult = await this.query(`PRAGMA index_list(${tableName})`);

    const indexes: IndexSchema[] = [];

    for (const indexInfo of indexListResult.rows) {
      const indexDetailResult = await this.query(
        `PRAGMA index_info(${indexInfo.name})`,
      );

      const columns = indexDetailResult.rows.map(
        (row: Record<string, unknown>) => row.name as string,
      );

      indexes.push({
        name: String(indexInfo.name),
        columns,
        unique: indexInfo.unique === 1,
        type: "BTREE",
      });
    }

    return indexes;
  }

  /**
   * テスト用データベースを初期化
   */
  async initializeTestDatabase(): Promise<void> {
    if (!this.db) {
      throw new Error("Database not connected");
    }

    // サンプルテーブルとデータを作成
    await this.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.query(`
      INSERT OR IGNORE INTO users (name, email) VALUES 
      ('Alice', 'alice@example.com'),
      ('Bob', 'bob@example.com'),
      ('Charlie', 'charlie@example.com')
    `);

    // 追加のテストテーブル
    await this.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL,
        category TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.query(`
      INSERT OR IGNORE INTO products (name, price, category) VALUES 
      ('Laptop', 999.99, 'Electronics'),
      ('Book', 19.99, 'Education'),
      ('Coffee', 4.50, 'Food')
    `);
  }
}
