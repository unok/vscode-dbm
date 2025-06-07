import mysql from "mysql2/promise";
import type {
  ColumnSchema,
  IndexSchema,
  QueryResult,
  TableSchema,
} from "../../types";
import { DatabaseConnection } from "../DatabaseConnection";

export class MySQLDriver extends DatabaseConnection {
  private connection?: mysql.Connection;

  async connect(timeout = 10000): Promise<void> {
    try {
      await this.executeWithTimeout(async () => {
        this.connection = await mysql.createConnection({
          host: this.config.host,
          port: this.config.port,
          user: this.config.username,
          password: this.config.password,
          database: this.config.database,
          ssl:
            this.config.ssl === true
              ? {}
              : (this.config.ssl as object) || undefined,
        });

        this.setConnected(true);
      }, timeout);
    } catch (error) {
      this.setConnected(false);
      throw new Error(`MySQL connection failed: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
      this.connection = undefined;
    }
    this.setConnected(false);
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    if (!this.connection) {
      return {
        rows: [],
        rowCount: 0,
        executionTime: 0,
        error: "Not connected to database",
      };
    }

    const startTime = Date.now();

    try {
      const [rows] = await this.connection.execute(sql, params);
      const executionTime = Date.now() - startTime;

      // INSERT/UPDATE/DELETE の場合
      if (
        Array.isArray(rows) &&
        typeof (rows as unknown as { affectedRows: number }).affectedRows ===
          "number"
      ) {
        return {
          rows: [],
          rowCount: (rows as unknown as { affectedRows: number }).affectedRows,
          executionTime,
        };
      }

      // SELECT の場合
      return {
        rows: Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [],
        rowCount: Array.isArray(rows) ? rows.length : 0,
        executionTime,
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

  async getDatabases(): Promise<string[]> {
    const result = await this.query("SHOW DATABASES");
    return result.rows.map(
      (row: Record<string, unknown>) => row.Database as string,
    );
  }

  async getTables(): Promise<{ name: string; type: string }[]> {
    const result = await this.query("SHOW TABLES");
    const tableKey = `Tables_in_${this.config.database}`;

    return result.rows.map((row: Record<string, unknown>) => ({
      name: row[tableKey] as string,
      type: "table",
    }));
  }

  async getTableSchema(tableName: string): Promise<TableSchema> {
    const columnsResult = await this.query(
      "SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ? AND TABLE_SCHEMA = ?",
      [tableName, this.config.database],
    );

    const columns: ColumnSchema[] = columnsResult.rows.map(
      (row: Record<string, unknown>) => ({
        name: String(row.COLUMN_NAME),
        type: String(row.COLUMN_TYPE),
        nullable: row.IS_NULLABLE === "YES",
        defaultValue:
          row.COLUMN_DEFAULT === null ? undefined : String(row.COLUMN_DEFAULT),
        isPrimaryKey: row.COLUMN_KEY === "PRI",
        isForeignKey: row.COLUMN_KEY === "MUL",
        isUnique: row.COLUMN_KEY === "UNI",
        autoIncrement: row.EXTRA === "auto_increment",
      }),
    );

    // インデックス情報取得
    const indexResult = await this.query("SHOW INDEX FROM ??", [tableName]);
    const indexes: IndexSchema[] = [];

    const indexMap = new Map<string, IndexSchema>();
    for (const row of indexResult.rows as Record<string, unknown>[]) {
      if (!indexMap.has(row.Key_name as string)) {
        indexMap.set(row.Key_name as string, {
          name: row.Key_name as string,
          columns: [],
          unique: row.Non_unique === 0,
          type: "BTREE",
        });
      }
      indexMap
        .get(row.Key_name as string)
        ?.columns.push(row.Column_name as string);
    }

    indexes.push(...indexMap.values());

    return {
      name: tableName,
      columns,
      primaryKeys: columns
        .filter((col) => col.isPrimaryKey)
        .map((col) => col.name),
      foreignKeys: [], // TODO: 外部キー情報の実装
      indexes,
    };
  }
}
