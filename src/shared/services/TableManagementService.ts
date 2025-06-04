import type { DatabaseConnection } from "../types/sql"
import {
  DATA_TYPE_MAPPINGS,
  SQL_RESERVED_KEYWORDS,
} from "../types/table-management"
import type {
  ColumnDefinition,
  ConstraintDefinition,
  DATABASE_FEATURES,
  DDLResult,
  IndexDefinition,
  TableDefinition,
  TableValidationError,
  TableValidationResult,
} from "../types/table-management"

export class TableManagementService {

  // テーブル作成SQL生成
  async generateCreateTableSQL(
    tableDefinition: TableDefinition,
    connection: DatabaseConnection
  ): Promise<string> {
    const { name, schema, columns, constraints = [] } = tableDefinition
    const dbType = connection.type

    let sql = `CREATE TABLE `

    if (schema && schema !== "public") {
      sql += `${this.escapeIdentifier(schema)}.`
    }
    sql += `${this.escapeIdentifier(name)} (\n`

    // カラム定義
    const columnDefinitions = columns.map((column) => this.generateColumnDefinition(column, dbType))

    // PRIMARY KEY制約
    const primaryKeyColumns = columns
      .filter((col) => col.isPrimaryKey)
      .map((col) => this.escapeIdentifier(col.name))

    if (primaryKeyColumns.length > 0) {
      columnDefinitions.push(`  PRIMARY KEY (${primaryKeyColumns.join(", ")})`)
    }

    // その他の制約
    constraints.forEach((constraint) => {
      if (constraint.type !== "PRIMARY_KEY") {
        columnDefinitions.push(`  ${this.generateConstraintDefinition(constraint)}`)
      }
    })

    sql += columnDefinitions.join(",\n") + "\n"
    sql += ")"

    // データベース固有のオプション
    sql += this.generateTableOptions(dbType)

    return sql
  }

  // カラム追加SQL生成
  async generateAddColumnSQL(
    tableName: string,
    columnDefinition: ColumnDefinition,
    connection: DatabaseConnection
  ): Promise<string> {
    const columnDef = this.generateColumnDefinition(columnDefinition, connection.type)
    return `ALTER TABLE ${this.escapeIdentifier(tableName)} ADD COLUMN ${columnDef}`
  }

  // カラム変更SQL生成
  async generateModifyColumnSQL(
    tableName: string,
    oldColumn: ColumnDefinition,
    newColumn: ColumnDefinition,
    connection: DatabaseConnection
  ): Promise<string> {
    const columnDef = this.generateColumnDefinition(newColumn, connection.type)

    switch (connection.type) {
      case "mysql":
        return `ALTER TABLE ${this.escapeIdentifier(tableName)} MODIFY COLUMN ${columnDef}`
      case "postgresql":
        // PostgreSQLは複数のALTER文が必要な場合がある
        const statements = []

        if (oldColumn.dataType !== newColumn.dataType) {
          statements.push(
            `ALTER TABLE ${this.escapeIdentifier(tableName)} ` +
              `ALTER COLUMN ${this.escapeIdentifier(newColumn.name)} ` +
              `TYPE ${newColumn.dataType}`
          )
        }

        if (oldColumn.nullable !== newColumn.nullable) {
          const nullConstraint = newColumn.nullable ? "DROP NOT NULL" : "SET NOT NULL"
          statements.push(
            `ALTER TABLE ${this.escapeIdentifier(tableName)} ` +
              `ALTER COLUMN ${this.escapeIdentifier(newColumn.name)} ${nullConstraint}`
          )
        }

        if (oldColumn.defaultValue !== newColumn.defaultValue) {
          const defaultClause = newColumn.defaultValue
            ? `SET DEFAULT ${this.formatDefaultValue(newColumn.defaultValue)}`
            : "DROP DEFAULT"
          statements.push(
            `ALTER TABLE ${this.escapeIdentifier(tableName)} ` +
              `ALTER COLUMN ${this.escapeIdentifier(newColumn.name)} ${defaultClause}`
          )
        }

        return statements.join(";\n")

      case "sqlite":
        // SQLiteは制限があるため、テーブル再作成が必要な場合がある
        throw new Error("SQLite does not support column modification. Table recreation required.")

      default:
        return `ALTER TABLE ${this.escapeIdentifier(tableName)} MODIFY COLUMN ${columnDef}`
    }
  }

  // カラム削除SQL生成
  async generateDropColumnSQL(
    tableName: string,
    columnName: string,
    connection: DatabaseConnection
  ): Promise<string> {
    if (connection.type === "sqlite") {
      throw new Error("SQLite does not support DROP COLUMN. Table recreation required.")
    }

    return `ALTER TABLE ${this.escapeIdentifier(tableName)} DROP COLUMN ${this.escapeIdentifier(columnName)}`
  }

  // テーブル名変更SQL生成
  async generateRenameTableSQL(
    oldName: string,
    newName: string,
    connection: DatabaseConnection
  ): Promise<string> {
    switch (connection.type) {
      case "mysql":
        return `RENAME TABLE ${this.escapeIdentifier(oldName)} TO ${this.escapeIdentifier(newName)}`
      case "postgresql":
      case "sqlite":
        return `ALTER TABLE ${this.escapeIdentifier(oldName)} RENAME TO ${this.escapeIdentifier(newName)}`
      default:
        return `ALTER TABLE ${this.escapeIdentifier(oldName)} RENAME TO ${this.escapeIdentifier(newName)}`
    }
  }

  // 制約追加SQL生成
  async generateAddConstraintSQL(
    tableName: string,
    constraint: ConstraintDefinition,
    connection: DatabaseConnection
  ): Promise<string> {
    const constraintDef = this.generateConstraintDefinition(constraint)
    return `ALTER TABLE ${this.escapeIdentifier(tableName)} ADD CONSTRAINT ${constraintDef}`
  }

  // 制約削除SQL生成
  async generateDropConstraintSQL(
    tableName: string,
    constraintName: string,
    connection: DatabaseConnection
  ): Promise<string> {
    switch (connection.type) {
      case "mysql":
        return `ALTER TABLE ${this.escapeIdentifier(tableName)} DROP CONSTRAINT ${this.escapeIdentifier(constraintName)}`
      case "sqlite":
        throw new Error("SQLite does not support DROP CONSTRAINT. Table recreation required.")
      default:
        return `ALTER TABLE ${this.escapeIdentifier(tableName)} DROP CONSTRAINT ${this.escapeIdentifier(constraintName)}`
    }
  }

  // インデックス作成SQL生成
  async generateCreateIndexSQL(
    indexDefinition: IndexDefinition,
    connection: DatabaseConnection
  ): Promise<string> {
    const { name, tableName, columns, unique, where } = indexDefinition

    let sql = "CREATE "
    if (unique) sql += "UNIQUE "
    sql += `INDEX ${this.escapeIdentifier(name)} ON ${this.escapeIdentifier(tableName)} `
    sql += `(${columns.map((col) => this.escapeIdentifier(col)).join(", ")})`

    if (where && connection.type === "postgresql") {
      sql += ` WHERE ${where}`
    }

    return sql
  }

  // インデックス削除SQL生成
  async generateDropIndexSQL(indexName: string, connection: DatabaseConnection): Promise<string> {
    switch (connection.type) {
      case "mysql":
        // MySQLではテーブル名が必要な場合がある
        return `DROP INDEX ${this.escapeIdentifier(indexName)}`
      case "sqlite":
        return `DROP INDEX IF EXISTS ${this.escapeIdentifier(indexName)}`
      default:
        return `DROP INDEX ${this.escapeIdentifier(indexName)}`
    }
  }

  // テーブル削除SQL生成
  async generateDropTableSQL(
    tableName: string,
    connection: DatabaseConnection,
    ifExists = false
  ): Promise<string> {
    let sql = "DROP TABLE "
    if (ifExists) sql += "IF EXISTS "
    sql += this.escapeIdentifier(tableName)
    return sql
  }

  // DDL実行
  async executeSQL(sql: string, connection: DatabaseConnection): Promise<DDLResult> {
    try {
      // 実際のDB接続とSQL実行はここで行う
      // モックのため成功を返す
      const startTime = performance.now()

      // 実際の実装では、ここでデータベースドライバーを使用してSQLを実行
      // const result = await databaseDriver.execute(sql, connection);

      const executionTime = performance.now() - startTime

      return {
        success: true,
        sql,
        executionTime,
        affectedRows: 0,
      }
    } catch (error) {
      return {
        success: false,
        sql,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  // テーブル作成実行
  async createTable(
    tableDefinition: TableDefinition,
    connection: DatabaseConnection
  ): Promise<DDLResult> {
    try {
      const sql = await this.generateCreateTableSQL(tableDefinition, connection)
      return await this.executeSQL(sql, connection)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  // カラム追加実行
  async addColumn(
    tableName: string,
    columnDefinition: ColumnDefinition,
    connection: DatabaseConnection
  ): Promise<DDLResult> {
    try {
      const sql = await this.generateAddColumnSQL(tableName, columnDefinition, connection)
      return await this.executeSQL(sql, connection)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  // バリデーション
  validateTableName(tableName: string): void {
    if (!tableName || tableName.trim().length === 0) {
      throw new Error("Table name cannot be empty")
    }

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      throw new Error(
        "Invalid table name: must start with letter or underscore, contain only alphanumeric characters and underscores"
      )
    }

    if (SQL_RESERVED_KEYWORDS.includes(tableName.toUpperCase())) {
      throw new Error(`Reserved keyword cannot be used as table name: ${tableName}`)
    }
  }

  validateColumnName(columnName: string): void {
    if (!columnName || columnName.trim().length === 0) {
      throw new Error("Column name cannot be empty")
    }

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(columnName)) {
      throw new Error(
        "Invalid column name: must start with letter or underscore, contain only alphanumeric characters and underscores"
      )
    }

    if (SQL_RESERVED_KEYWORDS.includes(columnName.toUpperCase())) {
      throw new Error(`Reserved keyword cannot be used as column name: ${columnName}`)
    }
  }

  validateDataType(dataType: string, connection: DatabaseConnection): void {
    const mappings = DATA_TYPE_MAPPINGS[connection.type]
    const baseType = dataType.split("(")[0].toUpperCase()

    if (!mappings || !Object.values(mappings).includes(baseType)) {
      const validTypes = mappings ? Object.values(mappings).join(", ") : "N/A"
      throw new Error(
        `Unsupported data type '${dataType}' for ${connection.type}. Valid types: ${validTypes}`
      )
    }
  }

  validateConstraint(constraint: ConstraintDefinition): void {
    if (!constraint.name || constraint.name.trim().length === 0) {
      throw new Error("Constraint name cannot be empty")
    }

    switch (constraint.type) {
      case "FOREIGN_KEY":
        if (!constraint.referencedTable) {
          throw new Error("Referenced table is required for foreign key constraint")
        }
        if (!constraint.referencedColumns || constraint.referencedColumns.length === 0) {
          throw new Error("Referenced columns are required for foreign key constraint")
        }
        if (!constraint.columns || constraint.columns.length === 0) {
          throw new Error("Columns are required for foreign key constraint")
        }
        if (constraint.columns.length !== constraint.referencedColumns.length) {
          throw new Error("Number of columns must match number of referenced columns")
        }
        break

      case "CHECK":
        if (!constraint.checkExpression) {
          throw new Error("Check expression is required for check constraint")
        }
        break

      case "PRIMARY_KEY":
      case "UNIQUE":
        if (!constraint.columns || constraint.columns.length === 0) {
          throw new Error(`Columns are required for ${constraint.type.toLowerCase()} constraint`)
        }
        break
    }
  }

  // プライベートヘルパーメソッド
  private generateColumnDefinition(column: ColumnDefinition, dbType: string): string {
    let def = `  ${this.escapeIdentifier(column.name)} ${column.dataType}`

    if (!column.nullable) {
      def += " NOT NULL"
    }

    if (column.autoIncrement) {
      switch (dbType) {
        case "mysql":
          def += " AUTO_INCREMENT"
          break
        case "postgresql":
          // PostgreSQLではSERIALまたはIDENTITYを使用
          break
        case "sqlite":
          // SQLiteでは自動的に処理される
          break
      }
    }

    if (column.defaultValue !== undefined && column.defaultValue !== null) {
      def += ` DEFAULT ${this.formatDefaultValue(column.defaultValue)}`
    }

    if (column.comment) {
      def += ` COMMENT '${column.comment.replace(/'/g, "''")}'`
    }

    return def
  }

  private generateConstraintDefinition(constraint: ConstraintDefinition): string {
    const name = this.escapeIdentifier(constraint.name)

    switch (constraint.type) {
      case "PRIMARY_KEY":
        return `${name} PRIMARY KEY (${constraint.columns?.map((col) => this.escapeIdentifier(col)).join(", ") || ""})`

      case "FOREIGN_KEY":
        let fkDef = `${name} FOREIGN KEY (${constraint.columns?.map((col) => this.escapeIdentifier(col)).join(", ") || ""}) `
        fkDef += `REFERENCES ${this.escapeIdentifier(constraint.referencedTable || "")}(${constraint.referencedColumns?.map((col) => this.escapeIdentifier(col)).join(", ") || ""})`

        if (constraint.onDelete) {
          fkDef += ` ON DELETE ${constraint.onDelete.replace("_", " ")}`
        }
        if (constraint.onUpdate) {
          fkDef += ` ON UPDATE ${constraint.onUpdate.replace("_", " ")}`
        }

        return fkDef

      case "UNIQUE":
        return `${name} UNIQUE (${constraint.columns?.map((col) => this.escapeIdentifier(col)).join(", ") || ""})`

      case "CHECK":
        return `${name} CHECK (${constraint.checkExpression})`

      default:
        throw new Error(`Unsupported constraint type: ${constraint.type}`)
    }
  }

  private generateTableOptions(dbType: string): string {
    switch (dbType) {
      case "mysql":
        return " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
      case "postgresql":
        return ""
      case "sqlite":
        return ""
      default:
        return ""
    }
  }

  private escapeIdentifier(identifier: string): string {
    // シンプルなエスケープ実装
    // 実際の実装では、データベース固有のエスケープルールを適用
    return `\`${identifier.replace(/`/g, "``")}\``
  }

  private formatDefaultValue(value: string | number | boolean | null): string {
    if (value === null) {
      return "NULL"
    }

    if (typeof value === "string") {
      // 関数呼び出しの場合はクォートしない
      if (
        value.toUpperCase().includes("()") ||
        ["NOW()", "CURRENT_TIMESTAMP", "CURRENT_DATE", "CURRENT_TIME"].includes(value.toUpperCase())
      ) {
        return value
      }
      return `'${value.replace(/'/g, "''")}'`
    }

    if (typeof value === "boolean") {
      return value ? "TRUE" : "FALSE"
    }

    return String(value)
  }
}
