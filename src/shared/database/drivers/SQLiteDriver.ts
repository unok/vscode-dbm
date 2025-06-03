import Database from "better-sqlite3"
import type {
  ColumnSchema,
  DatabaseConfig,
  IndexSchema,
  QueryResult,
  TableSchema,
} from "../../types"
import { DatabaseConnection } from "../DatabaseConnection"

export class SQLiteDriver extends DatabaseConnection {
  private db?: Database.Database

  constructor(config: DatabaseConfig) {
    super(config)
  }

  async connect(timeout = 10000): Promise<void> {
    try {
      await this.executeWithTimeout(async () => {
        this.db = new Database(this.config.database)
        this.setConnected(true)
      }, timeout)
    } catch (error) {
      this.setConnected(false)
      throw new Error(`SQLite connection failed: ${error}`)
    }
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close()
      this.db = undefined
    }
    this.setConnected(false)
  }

  async query(sql: string, params?: any[]): Promise<QueryResult> {
    if (!this.db) {
      return {
        rows: [],
        rowCount: 0,
        executionTime: 0,
        error: "Not connected to database",
      }
    }

    const startTime = Date.now()

    try {
      // SELECT クエリかどうかを判定
      const isSelect = sql.trim().toLowerCase().startsWith("select")

      if (isSelect) {
        const stmt = this.db.prepare(sql)
        const rows = stmt.all(params || [])

        return {
          rows: rows as any[],
          rowCount: rows.length,
          executionTime: Date.now() - startTime,
        }
      } else {
        // INSERT, UPDATE, DELETE など
        const stmt = this.db.prepare(sql)
        const result = stmt.run(params || [])

        return {
          rows: [],
          rowCount: result.changes,
          executionTime: Date.now() - startTime,
        }
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

  async getTables(): Promise<{ name: string; type: string }[]> {
    const result = await this.query(`
      SELECT name, type 
      FROM sqlite_master 
      WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `)

    return result.rows as { name: string; type: string }[]
  }

  async getViews(): Promise<{ name: string; type: string }[]> {
    const result = await this.query(`
      SELECT name, type 
      FROM sqlite_master 
      WHERE type = 'view'
      ORDER BY name
    `)

    return result.rows as { name: string; type: string }[]
  }

  async getTableSchema(tableName: string): Promise<TableSchema> {
    // テーブル情報取得
    const pragmaResult = await this.query(`PRAGMA table_info(${tableName})`)

    const columns: ColumnSchema[] = pragmaResult.rows.map((row: any) => ({
      name: row.name,
      type: row.type,
      nullable: row.notnull === 0,
      defaultValue: row.dflt_value,
      isPrimaryKey: row.pk === 1,
      isForeignKey: false, // TODO: 外部キー判定の実装
      isUnique: false, // TODO: ユニーク制約判定の実装
      autoIncrement: row.pk === 1 && row.type.toLowerCase().includes("integer"),
    }))

    // 主キー一覧
    const primaryKeys = columns.filter((col) => col.isPrimaryKey).map((col) => col.name)

    return {
      name: tableName,
      columns,
      primaryKeys,
      foreignKeys: [], // TODO: 外部キー情報の実装
      indexes: await this.getTableIndexes(tableName),
    }
  }

  async getTableIndexes(tableName: string): Promise<IndexSchema[]> {
    const indexListResult = await this.query(`PRAGMA index_list(${tableName})`)

    const indexes: IndexSchema[] = []

    for (const indexInfo of indexListResult.rows) {
      const indexDetailResult = await this.query(`PRAGMA index_info(${indexInfo.name})`)

      const columns = indexDetailResult.rows.map((row: any) => row.name)

      indexes.push({
        name: indexInfo.name,
        columns,
        unique: indexInfo.unique === 1,
        type: "BTREE",
      })
    }

    return indexes
  }
}
