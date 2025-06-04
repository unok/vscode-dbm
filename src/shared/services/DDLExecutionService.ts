import type { DatabaseConnection as DatabaseDriver } from "../database/DatabaseConnection"
import { MySQLDriver } from "../database/drivers/MySQLDriver"
import { PostgreSQLDriver } from "../database/drivers/PostgreSQLDriver"
import { SQLiteDriver } from "../database/drivers/SQLiteDriver"
import type { DatabaseConnection as DatabaseConnectionConfig } from "../types/sql"
import type { DDLResult, TableDefinition } from "../types/table-management"
import { TableManagementService } from "./TableManagementService"

export class DDLExecutionService {
  private tableService: TableManagementService
  private connectionCache: Map<string, DatabaseDriver> = new Map()

  constructor() {
    this.tableService = new TableManagementService()
  }

  /**
   * Create a database driver instance from connection config
   */
  private createDriver(config: DatabaseConnectionConfig): DatabaseDriver {
    // Only support implemented database types
    if (!["mysql", "postgresql", "sqlite"].includes(config.type)) {
      throw new Error(`Unsupported database type: ${config.type}`)
    }

    const dbConfig = {
      id: config.id,
      name: config.name,
      type: config.type as "mysql" | "postgresql" | "sqlite",
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      database: config.database || "",
      ssl: config.ssl,
    }

    switch (dbConfig.type) {
      case "mysql":
        return new MySQLDriver(dbConfig)
      case "postgresql":
        return new PostgreSQLDriver(dbConfig)
      case "sqlite":
        return new SQLiteDriver(dbConfig)
      default:
        throw new Error(`Unsupported database type: ${dbConfig.type}`)
    }
  }

  /**
   * Get or create a database connection
   */
  private async getConnection(config: DatabaseConnectionConfig): Promise<DatabaseDriver> {
    const cacheKey = config.id

    if (this.connectionCache.has(cacheKey)) {
      const connection = this.connectionCache.get(cacheKey)!
      if (connection.isConnected()) {
        return connection
      }
    }

    const driver = this.createDriver(config)
    await driver.connect()
    this.connectionCache.set(cacheKey, driver)

    return driver
  }

  /**
   * Execute DDL statement
   */
  async executeDDL(sql: string, connection: DatabaseConnectionConfig): Promise<DDLResult> {
    const startTime = performance.now()

    try {
      const driver = await this.getConnection(connection)
      const result = await driver.query(sql)

      const executionTime = performance.now() - startTime

      if (result.error) {
        return {
          success: false,
          sql,
          error: result.error,
          executionTime,
        }
      }

      return {
        success: true,
        sql,
        executionTime,
        affectedRows: result.rowCount,
      }
    } catch (error) {
      return {
        success: false,
        sql,
        error: error instanceof Error ? error.message : "Unknown error",
        executionTime: performance.now() - startTime,
      }
    }
  }

  /**
   * Create table from definition
   */
  async createTable(
    tableDefinition: TableDefinition,
    connection: DatabaseConnectionConfig
  ): Promise<DDLResult> {
    try {
      // Validate table definition
      this.validateTableDefinition(tableDefinition)

      // Generate CREATE TABLE SQL
      const sql = await this.tableService.generateCreateTableSQL(tableDefinition, connection)

      // Execute the DDL
      return await this.executeDDL(sql, connection)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Add column to existing table
   */
  async addColumn(
    tableName: string,
    columnDefinition: any,
    connection: DatabaseConnectionConfig
  ): Promise<DDLResult> {
    try {
      const sql = await this.tableService.generateAddColumnSQL(
        tableName,
        columnDefinition,
        connection
      )
      return await this.executeDDL(sql, connection)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Modify existing column
   */
  async modifyColumn(
    tableName: string,
    oldColumn: any,
    newColumn: any,
    connection: DatabaseConnectionConfig
  ): Promise<DDLResult> {
    try {
      const sql = await this.tableService.generateModifyColumnSQL(
        tableName,
        oldColumn,
        newColumn,
        connection
      )
      return await this.executeDDL(sql, connection)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Drop column from table
   */
  async dropColumn(
    tableName: string,
    columnName: string,
    connection: DatabaseConnectionConfig
  ): Promise<DDLResult> {
    try {
      const sql = await this.tableService.generateDropColumnSQL(tableName, columnName, connection)
      return await this.executeDDL(sql, connection)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Rename table
   */
  async renameTable(
    oldName: string,
    newName: string,
    connection: DatabaseConnectionConfig
  ): Promise<DDLResult> {
    try {
      const sql = await this.tableService.generateRenameTableSQL(oldName, newName, connection)
      return await this.executeDDL(sql, connection)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Add constraint to table
   */
  async addConstraint(
    tableName: string,
    constraint: any,
    connection: DatabaseConnectionConfig
  ): Promise<DDLResult> {
    try {
      const sql = await this.tableService.generateAddConstraintSQL(
        tableName,
        constraint,
        connection
      )
      return await this.executeDDL(sql, connection)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Drop constraint from table
   */
  async dropConstraint(
    tableName: string,
    constraintName: string,
    connection: DatabaseConnectionConfig
  ): Promise<DDLResult> {
    try {
      const sql = await this.tableService.generateDropConstraintSQL(
        tableName,
        constraintName,
        connection
      )
      return await this.executeDDL(sql, connection)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Create index
   */
  async createIndex(
    indexDefinition: any,
    connection: DatabaseConnectionConfig
  ): Promise<DDLResult> {
    try {
      const sql = await this.tableService.generateCreateIndexSQL(indexDefinition, connection)
      return await this.executeDDL(sql, connection)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Drop index
   */
  async dropIndex(indexName: string, connection: DatabaseConnectionConfig): Promise<DDLResult> {
    try {
      const sql = await this.tableService.generateDropIndexSQL(indexName, connection)
      return await this.executeDDL(sql, connection)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Drop table
   */
  async dropTable(
    tableName: string,
    connection: DatabaseConnectionConfig,
    ifExists = false
  ): Promise<DDLResult> {
    try {
      const sql = await this.tableService.generateDropTableSQL(tableName, connection, ifExists)
      return await this.executeDDL(sql, connection)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Execute multiple DDL statements as a transaction
   */
  async executeTransaction(
    sqlStatements: string[],
    connection: DatabaseConnectionConfig
  ): Promise<DDLResult[]> {
    const results: DDLResult[] = []

    try {
      const driver = await this.getConnection(connection)

      // Start transaction
      await driver.query("BEGIN")

      try {
        for (const sql of sqlStatements) {
          const result = await this.executeDDL(sql, connection)
          results.push(result)

          if (!result.success) {
            throw new Error(`DDL failed: ${result.error}`)
          }
        }

        // Commit transaction
        await driver.query("COMMIT")

        return results
      } catch (error) {
        // Rollback transaction
        await driver.query("ROLLBACK")
        throw error
      }
    } catch (error) {
      // Add error result for any remaining statements
      const errorResult: DDLResult = {
        success: false,
        error: error instanceof Error ? error.message : "Transaction failed",
      }

      while (results.length < sqlStatements.length) {
        results.push(errorResult)
      }

      return results
    }
  }

  /**
   * Test database connection
   */
  async testConnection(
    connection: DatabaseConnectionConfig
  ): Promise<{ success: boolean; message: string }> {
    try {
      const driver = this.createDriver(connection)
      await driver.connect()
      await driver.disconnect()

      return {
        success: true,
        message: "Connection successful",
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Connection failed",
      }
    }
  }

  /**
   * Get database metadata
   */
  async getDatabaseMetadata(connection: DatabaseConnectionConfig) {
    try {
      const driver = await this.getConnection(connection)

      if ("getTables" in driver) {
        return await (driver as any).getTables()
      }

      throw new Error("Database metadata not supported for this driver")
    } catch (error) {
      throw new Error(
        `Failed to get database metadata: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    }
  }

  /**
   * Validate table definition
   */
  private validateTableDefinition(tableDefinition: TableDefinition): void {
    if (!tableDefinition.name || tableDefinition.name.trim().length === 0) {
      throw new Error("Table name is required")
    }

    if (!tableDefinition.columns || tableDefinition.columns.length === 0) {
      throw new Error("Table must have at least one column")
    }

    // Validate table name
    this.tableService.validateTableName(tableDefinition.name)

    // Validate columns
    for (const column of tableDefinition.columns) {
      this.tableService.validateColumnName(column.name)
    }

    // Validate constraints
    if (tableDefinition.constraints) {
      for (const constraint of tableDefinition.constraints) {
        this.tableService.validateConstraint(constraint)
      }
    }
  }

  /**
   * Close all cached connections
   */
  async closeConnections(): Promise<void> {
    const promises = Array.from(this.connectionCache.values()).map(async (connection) => {
      try {
        await connection.disconnect()
      } catch (error) {
        console.error("Error disconnecting:", error)
      }
    })

    await Promise.all(promises)
    this.connectionCache.clear()
  }

  /**
   * Get connection status
   */
  getConnectionStatus(connectionId: string): { connected: boolean; lastConnected?: Date } {
    const connection = this.connectionCache.get(connectionId)
    if (!connection) {
      return { connected: false }
    }

    return connection.getConnectionStatus()
  }
}
