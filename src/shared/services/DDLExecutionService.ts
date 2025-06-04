import type { DatabaseConnection as DatabaseDriver } from "../database/DatabaseConnection"
import { MySQLDriver } from "../database/drivers/MySQLDriver"
import { PostgreSQLDriver } from "../database/drivers/PostgreSQLDriver"
import { SQLiteDriver } from "../database/drivers/SQLiteDriver"
import type { DatabaseConnection as DatabaseConnectionConfig } from "../types/sql"
import type { DDLResult, TableDefinition } from "../types/table-management"
import { ConstraintManagementService } from "./ConstraintManagementService"
import { IndexManagementService } from "./IndexManagementService"
import { TableManagementService } from "./TableManagementService"

export class DDLExecutionService {
  private tableService: TableManagementService
  private constraintService: ConstraintManagementService
  private indexService: IndexManagementService
  private connectionCache: Map<string, DatabaseDriver> = new Map()

  constructor() {
    this.tableService = new TableManagementService()
    this.constraintService = new ConstraintManagementService()
    this.indexService = new IndexManagementService()
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
    connection: DatabaseConnectionConfig,
    availableColumns: string[] = []
  ): Promise<DDLResult> {
    try {
      // Validate constraint first
      const validation = this.constraintService.validateConstraint(
        constraint,
        availableColumns,
        connection
      )

      if (!validation.isValid) {
        const errorMessages = validation.errors.map((e) => e.message).join("; ")
        return {
          success: false,
          error: `Constraint validation failed: ${errorMessages}`,
        }
      }

      const sql = this.constraintService.generateAddConstraintSQL(tableName, constraint, connection)
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
      const sql = this.constraintService.generateDropConstraintSQL(
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
    connection: DatabaseConnectionConfig,
    availableColumns: string[] = [],
    existingIndexes: any[] = []
  ): Promise<DDLResult> {
    try {
      // Validate index first
      const validation = this.indexService.validateIndex(
        indexDefinition,
        availableColumns,
        connection,
        existingIndexes
      )

      if (!validation.isValid) {
        const errorMessages = validation.errors.map((e) => e.message).join("; ")
        return {
          success: false,
          error: `Index validation failed: ${errorMessages}`,
        }
      }

      const sql = this.indexService.generateCreateIndexSQL(indexDefinition, connection)
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
  async dropIndex(
    indexName: string,
    connection: DatabaseConnectionConfig,
    ifExists = false
  ): Promise<DDLResult> {
    try {
      const sql = this.indexService.generateDropIndexSQL(indexName, connection, ifExists)
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

  /**
   * Validate constraint definition
   */
  validateConstraint(
    constraint: any,
    availableColumns: string[],
    connection: DatabaseConnectionConfig
  ) {
    return this.constraintService.validateConstraint(constraint, availableColumns, connection)
  }

  /**
   * Analyze constraint dependencies
   */
  analyzeConstraintDependencies(constraints: any[]) {
    return this.constraintService.analyzeConstraintDependencies(constraints)
  }

  /**
   * Get constraint creation order
   */
  getConstraintCreationOrder(constraints: any[]) {
    return this.constraintService.getConstraintCreationOrder(constraints)
  }

  /**
   * Get existing constraints for a table
   */
  async getTableConstraints(tableName: string, connection: DatabaseConnectionConfig) {
    return await this.constraintService.getTableConstraints(tableName, connection)
  }

  /**
   * Batch constraint operations
   */
  async batchConstraintOperations(
    operations: Array<{
      type: "add" | "drop"
      tableName: string
      constraint?: any
      constraintName?: string
      availableColumns?: string[]
    }>,
    connection: DatabaseConnectionConfig
  ): Promise<DDLResult[]> {
    const results: DDLResult[] = []

    try {
      const driver = await this.getConnection(connection)

      // Start transaction
      await driver.query("BEGIN")

      try {
        for (const operation of operations) {
          let result: DDLResult

          if (operation.type === "add" && operation.constraint) {
            result = await this.addConstraint(
              operation.tableName,
              operation.constraint,
              connection,
              operation.availableColumns
            )
          } else if (operation.type === "drop" && operation.constraintName) {
            result = await this.dropConstraint(
              operation.tableName,
              operation.constraintName,
              connection
            )
          } else {
            result = {
              success: false,
              error: "Invalid constraint operation",
            }
          }

          results.push(result)

          if (!result.success) {
            throw new Error(`Constraint operation failed: ${result.error}`)
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
      // Add error result for any remaining operations
      const errorResult: DDLResult = {
        success: false,
        error: error instanceof Error ? error.message : "Transaction failed",
      }

      while (results.length < operations.length) {
        results.push(errorResult)
      }

      return results
    }
  }

  /**
   * Validate index definition
   */
  validateIndex(
    index: any,
    availableColumns: string[],
    connection: DatabaseConnectionConfig,
    existingIndexes: any[] = []
  ) {
    return this.indexService.validateIndex(index, availableColumns, connection, existingIndexes)
  }

  /**
   * Analyze index performance
   */
  analyzeIndexPerformance(index: any, availableColumns: string[] = []) {
    return this.indexService.analyzeIndexPerformance(index, availableColumns)
  }

  /**
   * Get optimization suggestions for indexes
   */
  getIndexOptimizationSuggestions(indexes: any[], tableColumns: string[]) {
    return this.indexService.getOptimizationSuggestions(indexes, tableColumns)
  }

  /**
   * Analyze index maintenance requirements
   */
  analyzeIndexMaintenance(indexes: any[]) {
    return this.indexService.analyzeIndexMaintenance(indexes)
  }

  /**
   * Batch index operations
   */
  async batchIndexOperations(
    operations: Array<{
      type: "create" | "drop"
      indexDefinition?: any
      indexName?: string
      availableColumns?: string[]
      existingIndexes?: any[]
      ifExists?: boolean
    }>,
    connection: DatabaseConnectionConfig
  ): Promise<DDLResult[]> {
    const results: DDLResult[] = []

    try {
      const driver = await this.getConnection(connection)

      // Start transaction
      await driver.query("BEGIN")

      try {
        for (const operation of operations) {
          let result: DDLResult

          if (operation.type === "create" && operation.indexDefinition) {
            result = await this.createIndex(
              operation.indexDefinition,
              connection,
              operation.availableColumns,
              operation.existingIndexes
            )
          } else if (operation.type === "drop" && operation.indexName) {
            result = await this.dropIndex(operation.indexName, connection, operation.ifExists)
          } else {
            result = {
              success: false,
              error: "Invalid index operation",
            }
          }

          results.push(result)

          if (!result.success) {
            throw new Error(`Index operation failed: ${result.error}`)
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
      // Add error result for any remaining operations
      const errorResult: DDLResult = {
        success: false,
        error: error instanceof Error ? error.message : "Transaction failed",
      }

      while (results.length < operations.length) {
        results.push(errorResult)
      }

      return results
    }
  }

  /**
   * Rebuild index (drop and recreate)
   */
  async rebuildIndex(
    indexDefinition: any,
    connection: DatabaseConnectionConfig,
    availableColumns: string[] = [],
    existingIndexes: any[] = []
  ): Promise<DDLResult[]> {
    const operations = [
      {
        type: "drop" as const,
        indexName: indexDefinition.name,
        ifExists: true,
      },
      {
        type: "create" as const,
        indexDefinition,
        availableColumns,
        existingIndexes,
      },
    ]

    return await this.batchIndexOperations(operations, connection)
  }

  /**
   * Analyze and optimize table indexes
   */
  async optimizeTableIndexes(
    tableName: string,
    currentIndexes: any[],
    tableColumns: string[],
    _connection: DatabaseConnectionConfig
  ): Promise<{
    analysis: any
    recommendations: any[]
    suggestedOperations: Array<{
      type: "create" | "drop" | "modify"
      description: string
      indexDefinition?: any
      indexName?: string
    }>
  }> {
    const analysis = this.analyzeIndexMaintenance(currentIndexes)
    const recommendations = this.getIndexOptimizationSuggestions(currentIndexes, tableColumns)

    const suggestedOperations: Array<{
      type: "create" | "drop" | "modify"
      description: string
      indexDefinition?: any
      indexName?: string
    }> = []

    // Generate suggested operations based on recommendations
    for (const recommendation of recommendations) {
      if (recommendation.message.includes("foreign key column")) {
        const match = recommendation.message.match(/"([^"]+)"/)
        if (match) {
          const columnName = match[1]
          suggestedOperations.push({
            type: "create",
            description: `Add index on foreign key column ${columnName}`,
            indexDefinition: {
              name: `idx_${tableName}_${columnName}`,
              tableName,
              columns: [columnName],
              unique: false,
              type: "BTREE",
            },
          })
        }
      } else if (recommendation.message.includes("redundant")) {
        const match = recommendation.message.match(/Index "([^"]+)"/)
        if (match) {
          const indexName = match[1]
          suggestedOperations.push({
            type: "drop",
            description: `Remove redundant index ${indexName}`,
            indexName,
          })
        }
      }
    }

    return {
      analysis,
      recommendations,
      suggestedOperations,
    }
  }
}
