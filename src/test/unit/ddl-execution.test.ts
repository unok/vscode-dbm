import { beforeEach, describe, expect, test, vi } from "vitest"
import { DDLExecutionService } from "@/shared/services/DDLExecutionService"
import type { DatabaseConnection } from "@/shared/types/sql"
import type { TableDefinition } from "@/shared/types/table-management"

describe("DDLExecutionService", () => {
  let ddlService: DDLExecutionService
  let mockConnection: DatabaseConnection

  beforeEach(() => {
    ddlService = new DDLExecutionService()
    mockConnection = {
      id: "test-connection",
      name: "Test Database",
      type: "sqlite",
      database: ":memory:",
    }
  })

  describe("Table Creation", () => {
    test("should create a simple table", async () => {
      const tableDefinition: TableDefinition = {
        name: "users",
        schema: "public",
        columns: [
          {
            name: "id",
            dataType: "INTEGER",
            nullable: false,
            isPrimaryKey: true,
          },
          {
            name: "name",
            dataType: "TEXT",
            nullable: false,
          },
          {
            name: "email",
            dataType: "TEXT",
            nullable: true,
          },
        ],
      }

      const result = await ddlService.createTable(tableDefinition, mockConnection)

      expect(result.success).toBe(true)
      expect(result.sql).toContain("CREATE TABLE")
      expect(result.sql).toContain("users")
      expect(result.sql).toContain("id INTEGER NOT NULL")
      expect(result.sql).toContain("name TEXT NOT NULL")
      expect(result.sql).toContain("email TEXT")
      expect(result.executionTime).toBeGreaterThan(0)
    })

    test("should create table with constraints", async () => {
      const tableDefinition: TableDefinition = {
        name: "posts",
        schema: "public",
        columns: [
          {
            name: "id",
            dataType: "INTEGER",
            nullable: false,
            isPrimaryKey: true,
          },
          {
            name: "title",
            dataType: "TEXT",
            nullable: false,
          },
          {
            name: "content",
            dataType: "TEXT",
            nullable: true,
          },
        ],
        constraints: [
          {
            name: "uk_posts_title",
            type: "UNIQUE",
            columns: ["title"],
          },
        ],
      }

      const result = await ddlService.createTable(tableDefinition, mockConnection)

      expect(result.success).toBe(true)
      expect(result.sql).toContain("UNIQUE")
    })

    test("should handle table creation errors", async () => {
      const invalidTableDefinition: TableDefinition = {
        name: "", // Invalid empty name
        schema: "public",
        columns: [],
      }

      const result = await ddlService.createTable(invalidTableDefinition, mockConnection)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Table name is required")
    })
  })

  describe("Column Operations", () => {
    beforeEach(async () => {
      // Create base table for column operations
      const tableDefinition: TableDefinition = {
        name: "test_table",
        schema: "public",
        columns: [
          {
            name: "id",
            dataType: "INTEGER",
            nullable: false,
            isPrimaryKey: true,
          },
          {
            name: "name",
            dataType: "TEXT",
            nullable: false,
          },
        ],
      }

      await ddlService.createTable(tableDefinition, mockConnection)
    })

    test("should add column to existing table", async () => {
      const columnDefinition = {
        name: "email",
        dataType: "TEXT",
        nullable: true,
      }

      const result = await ddlService.addColumn("test_table", columnDefinition, mockConnection)

      expect(result.success).toBe(true)
      expect(result.sql).toContain("ALTER TABLE")
      expect(result.sql).toContain("ADD COLUMN")
      expect(result.sql).toContain("email")
    })

    test("should handle SQLite column modification limitations", async () => {
      const oldColumn = {
        name: "name",
        dataType: "TEXT",
        nullable: false,
      }

      const newColumn = {
        name: "name",
        dataType: "VARCHAR(100)",
        nullable: false,
      }

      const result = await ddlService.modifyColumn("test_table", oldColumn, newColumn, mockConnection)

      expect(result.success).toBe(false)
      expect(result.error).toContain("SQLite does not support column modification")
    })
  })

  describe("Index Operations", () => {
    beforeEach(async () => {
      // Create base table for index operations
      const tableDefinition: TableDefinition = {
        name: "indexed_table",
        schema: "public",
        columns: [
          {
            name: "id",
            dataType: "INTEGER",
            nullable: false,
            isPrimaryKey: true,
          },
          {
            name: "name",
            dataType: "TEXT",
            nullable: false,
          },
          {
            name: "email",
            dataType: "TEXT",
            nullable: true,
          },
        ],
      }

      await ddlService.createTable(tableDefinition, mockConnection)
    })

    test("should create index", async () => {
      const indexDefinition = {
        name: "idx_indexed_table_name",
        tableName: "indexed_table",
        columns: ["name"],
        unique: false,
      }

      const result = await ddlService.createIndex(indexDefinition, mockConnection)

      expect(result.success).toBe(true)
      expect(result.sql).toContain("CREATE INDEX")
      expect(result.sql).toContain("idx_indexed_table_name")
      expect(result.sql).toContain("ON indexed_table")
    })

    test("should create unique index", async () => {
      const indexDefinition = {
        name: "uk_indexed_table_email",
        tableName: "indexed_table",
        columns: ["email"],
        unique: true,
      }

      const result = await ddlService.createIndex(indexDefinition, mockConnection)

      expect(result.success).toBe(true)
      expect(result.sql).toContain("CREATE UNIQUE INDEX")
    })

    test("should drop index", async () => {
      // First create an index
      const indexDefinition = {
        name: "idx_to_drop",
        tableName: "indexed_table",
        columns: ["name"],
        unique: false,
      }

      await ddlService.createIndex(indexDefinition, mockConnection)

      // Then drop it
      const result = await ddlService.dropIndex("idx_to_drop", mockConnection)

      expect(result.success).toBe(true)
      expect(result.sql).toContain("DROP INDEX")
    })
  })

  describe("Transaction Support", () => {
    test("should execute multiple DDL statements in transaction", async () => {
      const statements = [
        "CREATE TABLE tx_test1 (id INTEGER PRIMARY KEY, name TEXT)",
        "CREATE TABLE tx_test2 (id INTEGER PRIMARY KEY, value TEXT)",
        "CREATE INDEX idx_tx_test1_name ON tx_test1(name)",
      ]

      const results = await ddlService.executeTransaction(statements, mockConnection)

      expect(results).toHaveLength(3)
      results.forEach((result) => {
        expect(result.success).toBe(true)
      })
    })

    test("should rollback transaction on error", async () => {
      const statements = [
        "CREATE TABLE tx_test_rollback (id INTEGER PRIMARY KEY, name TEXT)",
        "CREATE TABLE tx_test_rollback (id INTEGER PRIMARY KEY, value TEXT)", // Duplicate table name
      ]

      const results = await ddlService.executeTransaction(statements, mockConnection)

      expect(results).toHaveLength(2)
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(false)
    })
  })

  describe("Connection Management", () => {
    test("should test database connection", async () => {
      const result = await ddlService.testConnection(mockConnection)

      expect(result.success).toBe(true)
      expect(result.message).toBe("Connection successful")
    })

    test("should handle connection errors", async () => {
      const invalidConnection: DatabaseConnection = {
        id: "invalid",
        name: "Invalid Connection",
        type: "mysql",
        host: "nonexistent-host",
        port: 3306,
        database: "test",
        username: "user",
        password: "pass",
      }

      const result = await ddlService.testConnection(invalidConnection)

      expect(result.success).toBe(false)
      expect(result.message).toContain("failed")
    })

    test("should cache connections", async () => {
      // First connection
      const result1 = await ddlService.testConnection(mockConnection)
      expect(result1.success).toBe(true)

      // Check connection status
      const status = ddlService.getConnectionStatus(mockConnection.id)
      expect(status.connected).toBe(true)
    })
  })

  describe("Table Management", () => {
    test("should drop table", async () => {
      // First create a table
      const tableDefinition: TableDefinition = {
        name: "table_to_drop",
        schema: "public",
        columns: [
          {
            name: "id",
            dataType: "INTEGER",
            nullable: false,
            isPrimaryKey: true,
          },
        ],
      }

      await ddlService.createTable(tableDefinition, mockConnection)

      // Then drop it
      const result = await ddlService.dropTable("table_to_drop", mockConnection, true)

      expect(result.success).toBe(true)
      expect(result.sql).toContain("DROP TABLE")
      expect(result.sql).toContain("IF EXISTS")
    })

    test("should rename table", async () => {
      // First create a table
      const tableDefinition: TableDefinition = {
        name: "old_table_name",
        schema: "public",
        columns: [
          {
            name: "id",
            dataType: "INTEGER",
            nullable: false,
            isPrimaryKey: true,
          },
        ],
      }

      await ddlService.createTable(tableDefinition, mockConnection)

      // Then rename it
      const result = await ddlService.renameTable("old_table_name", "new_table_name", mockConnection)

      expect(result.success).toBe(true)
      expect(result.sql).toContain("ALTER TABLE")
      expect(result.sql).toContain("RENAME TO")
    })
  })

  describe("Validation", () => {
    test("should validate table definition with missing columns", async () => {
      const invalidTableDefinition: TableDefinition = {
        name: "valid_name",
        schema: "public",
        columns: [], // Empty columns array
      }

      const result = await ddlService.createTable(invalidTableDefinition, mockConnection)

      expect(result.success).toBe(false)
      expect(result.error).toContain("must have at least one column")
    })

    test("should validate table name with reserved keywords", async () => {
      const invalidTableDefinition: TableDefinition = {
        name: "SELECT", // Reserved keyword
        schema: "public",
        columns: [
          {
            name: "id",
            dataType: "INTEGER",
            nullable: false,
            isPrimaryKey: true,
          },
        ],
      }

      const result = await ddlService.createTable(invalidTableDefinition, mockConnection)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Reserved keyword")
    })
  })

  afterEach(async () => {
    // Clean up connections
    await ddlService.closeConnections()
  })
})