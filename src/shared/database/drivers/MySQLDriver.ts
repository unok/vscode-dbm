import mysql from "mysql2/promise"
import { DatabaseConnection } from "../DatabaseConnection"
import { DatabaseConfig, QueryResult, TableSchema, ColumnSchema, IndexSchema } from "../../types"

export class MySQLDriver extends DatabaseConnection {
  private connection?: mysql.Connection

  constructor(config: DatabaseConfig) {
    super(config)
  }

  async connect(timeout = 10000): Promise<void> {
    try {
      await this.executeWithTimeout(async () => {
        this.connection = await mysql.createConnection({
          host: this.config.host,
          port: this.config.port,
          user: this.config.username,
          password: this.config.password,
          database: this.config.database,
          ssl: this.config.ssl,
        })

        this.setConnected(true)
      }, timeout)
    } catch (error) {
      this.setConnected(false)
      throw new Error(`MySQL connection failed: ${error}`)
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.end()
      this.connection = undefined
    }
    this.setConnected(false)
  }

  async query(sql: string, params?: any[]): Promise<QueryResult> {
    if (!this.connection) {
      return {
        rows: [],
        rowCount: 0,
        executionTime: 0,
        error: "Not connected to database",
      }
    }

    const startTime = Date.now()

    try {
      const [rows, fields] = await this.connection.execute(sql, params)
      const executionTime = Date.now() - startTime

      // INSERT/UPDATE/DELETE の場合
      if (Array.isArray(rows) && typeof (rows as any).affectedRows === "number") {
        return {
          rows: [],
          rowCount: (rows as any).affectedRows,
          executionTime,
        }
      }

      // SELECT の場合
      return {
        rows: Array.isArray(rows) ? (rows as any[]) : [],
        rowCount: Array.isArray(rows) ? rows.length : 0,
        executionTime,
      }
    } catch (error) {
      return {
        rows: [],
        rowCount: 0,
        executionTime: Date.now() - startTime,
        error: (error as Error).message,
      }
    }
  }

  async getDatabases(): Promise<string[]> {
    const result = await this.query("SHOW DATABASES")
    return result.rows.map((row: any) => row.Database)
  }

  async getTables(): Promise<{ name: string; type: string }[]> {
    const result = await this.query("SHOW TABLES")
    const tableKey = `Tables_in_${this.config.database}`

    return result.rows.map((row: any) => ({
      name: row[tableKey],
      type: "table",
    }))
  }

  async getTableSchema(tableName: string): Promise<TableSchema> {
    const columnsResult = await this.query(
      "SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ? AND TABLE_SCHEMA = ?",
      [tableName, this.config.database]
    )

    const columns: ColumnSchema[] = columnsResult.rows.map((row: any) => ({
      name: row.COLUMN_NAME,
      type: row.COLUMN_TYPE,
      nullable: row.IS_NULLABLE === "YES",
      defaultValue: row.COLUMN_DEFAULT,
      isPrimaryKey: row.COLUMN_KEY === "PRI",
      isForeignKey: row.COLUMN_KEY === "MUL",
      isUnique: row.COLUMN_KEY === "UNI",
      autoIncrement: row.EXTRA === "auto_increment",
    }))

    // インデックス情報取得
    const indexResult = await this.query("SHOW INDEX FROM ??", [tableName])
    const indexes: IndexSchema[] = []

    const indexMap = new Map<string, IndexSchema>()
    indexResult.rows.forEach((row: any) => {
      if (!indexMap.has(row.Key_name)) {
        indexMap.set(row.Key_name, {
          name: row.Key_name,
          columns: [],
          unique: row.Non_unique === 0,
          type: "BTREE",
        })
      }
      indexMap.get(row.Key_name)!.columns.push(row.Column_name)
    })

    indexes.push(...indexMap.values())

    return {
      name: tableName,
      columns,
      primaryKeys: columns.filter((col) => col.isPrimaryKey).map((col) => col.name),
      foreignKeys: [], // TODO: 外部キー情報の実装
      indexes,
    }
  }
}
