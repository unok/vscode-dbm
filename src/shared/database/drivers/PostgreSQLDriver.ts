import { Client } from "pg"
import { DatabaseConnection } from "../DatabaseConnection"
import { DatabaseConfig, QueryResult, TableSchema, ColumnSchema, IndexSchema } from "../../types"

export class PostgreSQLDriver extends DatabaseConnection {
  private client?: Client

  constructor(config: DatabaseConfig) {
    super(config)
  }

  async connect(timeout = 10000): Promise<void> {
    try {
      await this.executeWithTimeout(async () => {
        this.client = new Client({
          host: this.config.host,
          port: this.config.port,
          user: this.config.username,
          password: this.config.password,
          database: this.config.database,
          ssl: this.config.ssl,
        })

        await this.client.connect()
        this.setConnected(true)
      }, timeout)
    } catch (error) {
      this.setConnected(false)
      throw new Error(`PostgreSQL connection failed: ${error}`)
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.end()
      this.client = undefined
    }
    this.setConnected(false)
  }

  async query(sql: string, params?: any[]): Promise<QueryResult> {
    if (!this.client) {
      return {
        rows: [],
        rowCount: 0,
        executionTime: 0,
        error: "Not connected to database",
      }
    }

    const startTime = Date.now()

    try {
      const result = await this.client.query(sql, params)
      const executionTime = Date.now() - startTime

      return {
        rows: result.rows,
        rowCount: result.rowCount || result.rows.length,
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
    const result = await this.query("SELECT datname FROM pg_database WHERE datistemplate = false")
    return result.rows.map((row: any) => row.datname)
  }

  async getSchemas(): Promise<string[]> {
    const result = await this.query(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')"
    )
    return result.rows.map((row: any) => row.schema_name)
  }

  async getTables(): Promise<{ name: string; type: string }[]> {
    const result = await this.query(`
      SELECT tablename as name, 'table' as type 
      FROM pg_tables 
      WHERE schemaname = 'public'
    `)

    return result.rows
  }

  async getViews(): Promise<{ name: string; type: string }[]> {
    const result = await this.query(`
      SELECT viewname as name, 'view' as type 
      FROM pg_views 
      WHERE schemaname = 'public'
    `)

    return result.rows
  }

  async getTableSchema(tableName: string): Promise<TableSchema> {
    const columnsResult = await this.query(
      `
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length,
        numeric_precision,
        numeric_scale
      FROM information_schema.columns 
      WHERE table_name = $1 AND table_schema = 'public'
      ORDER BY ordinal_position
    `,
      [tableName]
    )

    // 主キー情報取得
    const pkResult = await this.query(
      `
      SELECT a.attname
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = $1::regclass AND i.indisprimary
    `,
      [tableName]
    )

    const primaryKeys = pkResult.rows.map((row: any) => row.attname)

    const columns: ColumnSchema[] = columnsResult.rows.map((row: any) => ({
      name: row.column_name,
      type: this.formatPostgreSQLType(row),
      nullable: row.is_nullable === "YES",
      defaultValue: row.column_default,
      isPrimaryKey: primaryKeys.includes(row.column_name),
      isForeignKey: false, // TODO: 外部キー判定の実装
      isUnique: false, // TODO: ユニーク制約判定の実装
      autoIncrement: row.column_default?.includes("nextval") || false,
    }))

    return {
      name: tableName,
      columns,
      primaryKeys,
      foreignKeys: [], // TODO: 外部キー情報の実装
      indexes: await this.getTableIndexes(tableName),
    }
  }

  async getTableIndexes(tableName: string): Promise<IndexSchema[]> {
    const result = await this.query(
      `
      SELECT 
        i.relname as index_name,
        array_agg(a.attname ORDER BY c.ordinality) as column_names,
        ix.indisunique as is_unique
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN unnest(ix.indkey) WITH ORDINALITY AS c(attnum, ordinality) ON true
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = c.attnum
      WHERE t.relname = $1 AND t.relkind = 'r'
      GROUP BY i.relname, ix.indisunique
    `,
      [tableName]
    )

    return result.rows.map((row: any) => ({
      name: row.index_name,
      columns: row.column_names,
      unique: row.is_unique,
      type: "BTREE",
    }))
  }

  private formatPostgreSQLType(column: any): string {
    let type = column.data_type

    if (column.character_maximum_length) {
      type += `(${column.character_maximum_length})`
    } else if (column.numeric_precision && column.numeric_scale) {
      type += `(${column.numeric_precision},${column.numeric_scale})`
    } else if (column.numeric_precision) {
      type += `(${column.numeric_precision})`
    }

    return type
  }
}
