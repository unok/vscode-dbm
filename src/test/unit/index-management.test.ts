import { beforeEach, describe, expect, it, vi } from "vitest"
import { IndexManagementService } from "../../shared/services/IndexManagementService"
import type {
  DatabaseConnection,
  IndexDefinition,
  IndexPerformanceAnalysis,
  IndexValidationResult,
} from "../../shared/types/table-management"

describe("IndexManagementService", () => {
  let indexService: IndexManagementService
  let mockConnection: DatabaseConnection

  beforeEach(() => {
    indexService = new IndexManagementService()
    mockConnection = {
      query: vi.fn(),
      close: vi.fn(),
      isConnected: true,
      driver: "mysql",
    } as any
  })

  describe("Index Validation", () => {
    it("should validate a simple index", () => {
      const index: IndexDefinition = {
        name: "idx_user_email",
        tableName: "users",
        columns: ["email"],
        type: "btree",
        unique: false,
      }

      const result: IndexValidationResult = indexService.validateIndex(
        index,
        ["id", "email", "name"],
        mockConnection
      )

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it("should reject index with invalid name", () => {
      const index: IndexDefinition = {
        name: "",
        tableName: "users",
        columns: ["email"],
        type: "btree",
        unique: false,
      }

      const result = indexService.validateIndex(index, ["email"], mockConnection)

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].type).toBe("validation")
    })

    it("should reject index with non-existent columns", () => {
      const index: IndexDefinition = {
        name: "idx_invalid",
        tableName: "users",
        columns: ["nonexistent_column"],
        type: "btree",
        unique: false,
      }

      const result = indexService.validateIndex(index, ["id", "email"], mockConnection)

      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.type === "column")).toBe(true)
    })

    it("should warn about duplicate indexes", () => {
      const existingIndex: IndexDefinition = {
        name: "idx_existing",
        tableName: "users",
        columns: ["email"],
        type: "btree",
        unique: false,
      }

      const newIndex: IndexDefinition = {
        name: "idx_duplicate",
        tableName: "users",
        columns: ["email"],
        type: "btree",
        unique: false,
      }

      const result = indexService.validateIndex(newIndex, ["email"], mockConnection, [
        existingIndex,
      ])

      expect(result.warnings.some((w) => w.type === "redundancy")).toBe(true)
    })

    it("should warn about wide composite indexes", () => {
      const index: IndexDefinition = {
        name: "idx_wide",
        tableName: "users",
        columns: ["col1", "col2", "col3", "col4", "col5", "col6", "col7"],
        type: "btree",
        unique: false,
      }

      const availableColumns = ["col1", "col2", "col3", "col4", "col5", "col6", "col7"]
      const result = indexService.validateIndex(index, availableColumns, mockConnection)

      expect(result.warnings.some((w) => w.type === "performance")).toBe(true)
    })
  })

  describe("Index Performance Analysis", () => {
    it("should analyze single column index performance", () => {
      const index: IndexDefinition = {
        name: "idx_user_id",
        tableName: "users",
        columns: ["id"],
        type: "btree",
        unique: true,
      }

      const analysis: IndexPerformanceAnalysis = indexService.analyzeIndexPerformance(index)

      expect(analysis).toBeDefined()
      expect(analysis.estimatedSelectivity).toBeLessThan(0.1)
      expect(analysis.suggestions).toBeDefined()
    })

    it("should analyze composite index performance", () => {
      const index: IndexDefinition = {
        name: "idx_composite",
        tableName: "users",
        columns: ["status", "created_at"],
        type: "btree",
        unique: false,
      }

      const analysis = indexService.analyzeIndexPerformance(index)

      expect(analysis.suggestions.length).toBeGreaterThan(0)
      expect(analysis.suggestions.some((s) => s.type === "optimization")).toBe(true)
    })

    it("should detect low selectivity leading columns", () => {
      const index: IndexDefinition = {
        name: "idx_low_selectivity",
        tableName: "users",
        columns: ["status", "id"],
        type: "btree",
        unique: false,
      }

      const analysis = indexService.analyzeIndexPerformance(index)

      expect(analysis.suggestions.some((s) => s.message.includes("selective columns first"))).toBe(
        true
      )
    })

    it("should suggest optimizations for very wide indexes", () => {
      const index: IndexDefinition = {
        name: "idx_very_wide",
        tableName: "users",
        columns: ["a", "b", "c", "d", "e", "f", "g"],
        type: "btree",
        unique: false,
      }

      const analysis = indexService.analyzeIndexPerformance(index)

      expect(analysis.suggestions.some((s) => s.message.includes("Consider reducing"))).toBe(true)
    })
  })

  describe("DDL Generation", () => {
    it("should generate CREATE INDEX statement for MySQL", () => {
      const index: IndexDefinition = {
        name: "idx_user_email",
        tableName: "users",
        columns: ["email"],
        type: "btree",
        unique: false,
      }

      const sql = indexService.generateCreateIndexSQL(index, "mysql")

      expect(sql).toContain("CREATE INDEX")
      expect(sql).toContain("idx_user_email")
      expect(sql).toContain("users")
      expect(sql).toContain("email")
    })

    it("should generate CREATE UNIQUE INDEX statement", () => {
      const index: IndexDefinition = {
        name: "idx_unique_email",
        tableName: "users",
        columns: ["email"],
        type: "btree",
        unique: true,
      }

      const sql = indexService.generateCreateIndexSQL(index, "mysql")

      expect(sql).toContain("CREATE UNIQUE INDEX")
    })

    it("should generate composite index statement", () => {
      const index: IndexDefinition = {
        name: "idx_composite",
        tableName: "users",
        columns: ["first_name", "last_name"],
        type: "btree",
        unique: false,
      }

      const sql = indexService.generateCreateIndexSQL(index, "postgresql")

      expect(sql).toContain("first_name")
      expect(sql).toContain("last_name")
    })

    it("should generate DROP INDEX statement", () => {
      const sql = indexService.generateDropIndexSQL("idx_to_drop", "users", "mysql")

      expect(sql).toContain("DROP INDEX")
      expect(sql).toContain("idx_to_drop")
    })
  })

  describe("Database-specific Features", () => {
    it("should handle MySQL specific syntax", () => {
      const index: IndexDefinition = {
        name: "idx_mysql",
        tableName: "users",
        columns: ["name"],
        type: "btree",
        unique: false,
      }

      const sql = indexService.generateCreateIndexSQL(index, "mysql")

      expect(sql).toMatch(/CREATE INDEX `\w+`/)
    })

    it("should handle PostgreSQL specific syntax", () => {
      const index: IndexDefinition = {
        name: "idx_postgres",
        tableName: "users",
        columns: ["name"],
        type: "btree",
        unique: false,
      }

      const sql = indexService.generateCreateIndexSQL(index, "postgresql")

      expect(sql).toMatch(/CREATE INDEX "\w+"/)
    })

    it("should handle SQLite specific syntax", () => {
      const index: IndexDefinition = {
        name: "idx_sqlite",
        tableName: "users",
        columns: ["name"],
        type: "btree",
        unique: false,
      }

      const sql = indexService.generateCreateIndexSQL(index, "sqlite")

      expect(sql).toContain("CREATE INDEX")
    })
  })

  describe("Index Optimization Suggestions", () => {
    it("should suggest covering indexes for query patterns", () => {
      const index: IndexDefinition = {
        name: "idx_query_pattern",
        tableName: "orders",
        columns: ["customer_id"],
        type: "btree",
        unique: false,
      }

      const analysis = indexService.analyzeIndexPerformance(index, [
        "customer_id",
        "order_date",
        "status",
      ])

      expect(analysis.suggestions.length).toBeGreaterThan(0)
    })

    it("should detect redundant indexes", () => {
      const index1: IndexDefinition = {
        name: "idx_short",
        tableName: "users",
        columns: ["email"],
        type: "btree",
        unique: false,
      }

      const index2: IndexDefinition = {
        name: "idx_long",
        tableName: "users",
        columns: ["email", "name"],
        type: "btree",
        unique: false,
      }

      const result = indexService.validateIndex(index1, ["email", "name"], mockConnection, [index2])

      expect(result.warnings.some((w) => w.type === "redundancy")).toBe(true)
    })
  })
})
