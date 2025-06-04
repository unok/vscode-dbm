import { beforeEach, describe, expect, test } from "vitest"
import { DDLExecutionService } from "@/shared/services/DDLExecutionService"
import type { DatabaseConnection } from "@/shared/types/sql"
import type { ConstraintDefinition, TableDefinition } from "@/shared/types/table-management"

describe("DDL Execution Service - Constraint Management Integration", () => {
  let ddlService: DDLExecutionService
  let mockConnection: DatabaseConnection

  beforeEach(() => {
    ddlService = new DDLExecutionService()
    mockConnection = {
      id: "test-connection",
      name: "Test Database",
      type: "postgresql",
      database: "test_db",
    }
  })

  describe("Constraint Addition", () => {
    beforeEach(async () => {
      // Create base table for constraint operations
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
            name: "email",
            dataType: "VARCHAR(255)",
            nullable: false,
          },
          {
            name: "age",
            dataType: "INTEGER",
            nullable: true,
          },
          {
            name: "department_id",
            dataType: "INTEGER",
            nullable: true,
          },
        ],
      }

      await ddlService.createTable(tableDefinition, mockConnection)
    })

    test("should add UNIQUE constraint successfully", async () => {
      const constraint: ConstraintDefinition = {
        name: "uk_users_email",
        type: "UNIQUE",
        columns: ["email"],
      }

      const availableColumns = ["id", "email", "age", "department_id"]
      const result = await ddlService.addConstraint("users", constraint, mockConnection, availableColumns)

      expect(result.success).toBe(true)
      expect(result.sql).toContain("ALTER TABLE")
      expect(result.sql).toContain("ADD CONSTRAINT")
      expect(result.sql).toContain("UNIQUE")
    })

    test("should add FOREIGN KEY constraint successfully", async () => {
      const constraint: ConstraintDefinition = {
        name: "fk_users_department",
        type: "FOREIGN_KEY",
        columns: ["department_id"],
        referencedTable: "departments",
        referencedColumns: ["id"],
        onDelete: "CASCADE",
        onUpdate: "RESTRICT",
      }

      const availableColumns = ["id", "email", "age", "department_id"]
      const result = await ddlService.addConstraint("users", constraint, mockConnection, availableColumns)

      expect(result.success).toBe(true)
      expect(result.sql).toContain("FOREIGN KEY")
      expect(result.sql).toContain("REFERENCES")
      expect(result.sql).toContain("CASCADE")
    })

    test("should add CHECK constraint successfully", async () => {
      const constraint: ConstraintDefinition = {
        name: "ck_users_age",
        type: "CHECK",
        checkExpression: "age >= 0 AND age <= 150",
      }

      const availableColumns = ["id", "email", "age", "department_id"]
      const result = await ddlService.addConstraint("users", constraint, mockConnection, availableColumns)

      expect(result.success).toBe(true)
      expect(result.sql).toContain("CHECK")
      expect(result.sql).toContain("age >= 0 AND age <= 150")
    })

    test("should reject invalid constraint", async () => {
      const constraint: ConstraintDefinition = {
        name: "",
        type: "UNIQUE",
        columns: ["email"],
      }

      const availableColumns = ["id", "email", "age", "department_id"]
      const result = await ddlService.addConstraint("users", constraint, mockConnection, availableColumns)

      expect(result.success).toBe(false)
      expect(result.error).toContain("validation failed")
    })

    test("should reject constraint with non-existent columns", async () => {
      const constraint: ConstraintDefinition = {
        name: "uk_users_invalid",
        type: "UNIQUE",
        columns: ["non_existent_column"],
      }

      const availableColumns = ["id", "email", "age", "department_id"]
      const result = await ddlService.addConstraint("users", constraint, mockConnection, availableColumns)

      expect(result.success).toBe(false)
      expect(result.error).toContain("does not exist")
    })

    test("should handle SQLite constraint limitations", async () => {
      const constraint: ConstraintDefinition = {
        name: "uk_users_email",
        type: "UNIQUE",
        columns: ["email"],
      }

      const sqliteConnection = { ...mockConnection, type: "sqlite" as const }
      const availableColumns = ["id", "email", "age", "department_id"]
      const result = await ddlService.addConstraint("users", constraint, sqliteConnection, availableColumns)

      expect(result.success).toBe(false)
      expect(result.error).toContain("SQLite does not support")
    })
  })

  describe("Constraint Removal", () => {
    test("should drop constraint successfully", async () => {
      const result = await ddlService.dropConstraint("users", "uk_users_email", mockConnection)

      expect(result.success).toBe(true)
      expect(result.sql).toContain("DROP CONSTRAINT")
      expect(result.sql).toContain("uk_users_email")
    })

    test("should handle SQLite constraint drop limitations", async () => {
      const sqliteConnection = { ...mockConnection, type: "sqlite" as const }
      const result = await ddlService.dropConstraint("users", "uk_users_email", sqliteConnection)

      expect(result.success).toBe(false)
      expect(result.error).toContain("SQLite does not support")
    })
  })

  describe("Constraint Validation", () => {
    test("should validate valid constraint", () => {
      const constraint: ConstraintDefinition = {
        name: "uk_users_email",
        type: "UNIQUE",
        columns: ["email"],
      }

      const availableColumns = ["id", "email", "age"]
      const result = ddlService.validateConstraint(constraint, availableColumns, mockConnection)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    test("should validate invalid constraint", () => {
      const constraint: ConstraintDefinition = {
        name: "",
        type: "UNIQUE",
        columns: ["email"],
      }

      const availableColumns = ["id", "email", "age"]
      const result = ddlService.validateConstraint(constraint, availableColumns, mockConnection)

      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe("Constraint Dependencies Analysis", () => {
    test("should analyze constraint dependencies", () => {
      const constraints: ConstraintDefinition[] = [
        {
          name: "pk_users_id",
          type: "PRIMARY_KEY",
          columns: ["id"],
        },
        {
          name: "fk_users_department",
          type: "FOREIGN_KEY",
          columns: ["department_id"],
          referencedTable: "departments",
          referencedColumns: ["id"],
        },
        {
          name: "uk_users_email",
          type: "UNIQUE",
          columns: ["email"],
        },
      ]

      const result = ddlService.analyzeConstraintDependencies(constraints)

      expect(result.canApply).toBe(true)
      expect(result.circularDependencies).toHaveLength(0)
      expect(Object.keys(result.dependencies)).toContain("fk_users_department")
    })

    test("should detect problematic constraints", () => {
      const constraints: ConstraintDefinition[] = [
        {
          name: "pk_users_id",
          type: "PRIMARY_KEY",
          columns: ["id"],
        },
        {
          name: "pk_users_uuid",
          type: "PRIMARY_KEY",
          columns: ["uuid"],
        },
      ]

      const result = ddlService.analyzeConstraintDependencies(constraints)

      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings.some(w => w.includes("Multiple primary key"))).toBe(true)
    })
  })

  describe("Constraint Creation Order", () => {
    test("should order constraints properly", () => {
      const constraints: ConstraintDefinition[] = [
        {
          name: "fk_users_department",
          type: "FOREIGN_KEY",
          columns: ["department_id"],
          referencedTable: "departments",
          referencedColumns: ["id"],
        },
        {
          name: "pk_users_id",
          type: "PRIMARY_KEY",
          columns: ["id"],
        },
        {
          name: "uk_users_email",
          type: "UNIQUE",
          columns: ["email"],
        },
      ]

      const ordered = ddlService.getConstraintCreationOrder(constraints)

      expect(ordered).toHaveLength(3)
      // Foreign keys should be last
      expect(ordered[ordered.length - 1].type).toBe("FOREIGN_KEY")
    })
  })

  describe("Batch Constraint Operations", () => {
    test("should execute batch constraint operations successfully", async () => {
      const operations = [
        {
          type: "add" as const,
          tableName: "users",
          constraint: {
            name: "uk_users_email",
            type: "UNIQUE",
            columns: ["email"],
          },
          availableColumns: ["id", "email", "age", "department_id"],
        },
        {
          type: "add" as const,
          tableName: "users",
          constraint: {
            name: "ck_users_age",
            type: "CHECK",
            checkExpression: "age >= 0",
          },
          availableColumns: ["id", "email", "age", "department_id"],
        },
      ]

      const results = await ddlService.batchConstraintOperations(operations, mockConnection)

      expect(results).toHaveLength(2)
      results.forEach(result => {
        expect(result.success).toBe(true)
      })
    })

    test("should rollback batch operations on error", async () => {
      const operations = [
        {
          type: "add" as const,
          tableName: "users",
          constraint: {
            name: "uk_users_email",
            type: "UNIQUE",
            columns: ["email"],
          },
          availableColumns: ["id", "email", "age", "department_id"],
        },
        {
          type: "add" as const,
          tableName: "users",
          constraint: {
            name: "", // Invalid constraint
            type: "UNIQUE",
            columns: ["email"],
          },
          availableColumns: ["id", "email", "age", "department_id"],
        },
      ]

      const results = await ddlService.batchConstraintOperations(operations, mockConnection)

      expect(results).toHaveLength(2)
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(false)
    })

    test("should handle drop operations in batch", async () => {
      const operations = [
        {
          type: "drop" as const,
          tableName: "users",
          constraintName: "uk_users_email",
        },
        {
          type: "drop" as const,
          tableName: "users",
          constraintName: "ck_users_age",
        },
      ]

      const results = await ddlService.batchConstraintOperations(operations, mockConnection)

      expect(results).toHaveLength(2)
      results.forEach(result => {
        expect(result.success).toBe(true)
      })
    })

    test("should handle invalid batch operations", async () => {
      const operations = [
        {
          type: "add" as const,
          tableName: "users",
          // Missing constraint
          availableColumns: ["id", "email", "age", "department_id"],
        },
        {
          type: "drop" as const,
          tableName: "users",
          // Missing constraintName
        },
      ]

      const results = await ddlService.batchConstraintOperations(operations as any, mockConnection)

      expect(results).toHaveLength(2)
      results.forEach(result => {
        expect(result.success).toBe(false)
        expect(result.error).toContain("Invalid constraint operation")
      })
    })
  })

  describe("Integration with Table Creation", () => {
    test("should create table with constraints", async () => {
      const tableDefinition: TableDefinition = {
        name: "orders",
        schema: "public",
        columns: [
          {
            name: "id",
            dataType: "INTEGER",
            nullable: false,
            isPrimaryKey: true,
          },
          {
            name: "customer_id",
            dataType: "INTEGER",
            nullable: false,
          },
          {
            name: "order_date",
            dataType: "DATE",
            nullable: false,
          },
          {
            name: "total_amount",
            dataType: "DECIMAL(10,2)",
            nullable: false,
          },
        ],
        constraints: [
          {
            name: "fk_orders_customer",
            type: "FOREIGN_KEY",
            columns: ["customer_id"],
            referencedTable: "customers",
            referencedColumns: ["id"],
            onDelete: "CASCADE",
          },
          {
            name: "ck_orders_amount",
            type: "CHECK",
            checkExpression: "total_amount >= 0",
          },
        ],
      }

      const result = await ddlService.createTable(tableDefinition, mockConnection)

      expect(result.success).toBe(true)
      expect(result.sql).toContain("CREATE TABLE")
      expect(result.sql).toContain("FOREIGN KEY")
      expect(result.sql).toContain("CHECK")
    })

    test("should validate table constraints during creation", async () => {
      const tableDefinition: TableDefinition = {
        name: "invalid_table",
        schema: "public",
        columns: [
          {
            name: "id",
            dataType: "INTEGER",
            nullable: false,
            isPrimaryKey: true,
          },
        ],
        constraints: [
          {
            name: "", // Invalid constraint name
            type: "UNIQUE",
            columns: ["id"],
          },
        ],
      }

      const result = await ddlService.createTable(tableDefinition, mockConnection)

      expect(result.success).toBe(false)
      expect(result.error).toContain("validation")
    })
  })

  afterEach(async () => {
    // Clean up connections
    await ddlService.closeConnections()
  })
})