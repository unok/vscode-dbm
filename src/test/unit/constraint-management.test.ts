import { beforeEach, describe, expect, test } from "vitest";
import { ConstraintManagementService } from "@/shared/services/ConstraintManagementService";
import type { DatabaseConnection } from "@/shared/types/sql";
import type { ConstraintDefinition } from "@/shared/types/table-management";

describe("ConstraintManagementService", () => {
  let constraintService: ConstraintManagementService;
  let mockConnection: DatabaseConnection;

  beforeEach(() => {
    constraintService = new ConstraintManagementService();
    mockConnection = {
      id: "test-connection",
      name: "Test Database",
      type: "postgresql",
      database: "test_db",
    };
  });

  describe("Constraint Validation", () => {
    const availableColumns = ["id", "name", "email", "age", "created_at"];

    test("should validate PRIMARY KEY constraint", () => {
      const constraint: ConstraintDefinition = {
        name: "pk_users_id",
        type: "PRIMARY_KEY",
        columns: ["id"],
      };

      const result = constraintService.validateConstraint(
        constraint,
        availableColumns,
        mockConnection,
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("should validate FOREIGN KEY constraint", () => {
      const constraint: ConstraintDefinition = {
        name: "fk_users_department",
        type: "FOREIGN_KEY",
        columns: ["department_id"],
        referencedTable: "departments",
        referencedColumns: ["id"],
        onDelete: "CASCADE",
        onUpdate: "RESTRICT",
      };

      const result = constraintService.validateConstraint(
        constraint,
        [...availableColumns, "department_id"],
        mockConnection,
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("should validate UNIQUE constraint", () => {
      const constraint: ConstraintDefinition = {
        name: "uk_users_email",
        type: "UNIQUE",
        columns: ["email"],
      };

      const result = constraintService.validateConstraint(
        constraint,
        availableColumns,
        mockConnection,
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("should validate CHECK constraint", () => {
      const constraint: ConstraintDefinition = {
        name: "ck_users_age",
        type: "CHECK",
        checkExpression: "age >= 0 AND age <= 150",
      };

      const result = constraintService.validateConstraint(
        constraint,
        availableColumns,
        mockConnection,
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("should reject constraint without name", () => {
      const constraint: ConstraintDefinition = {
        name: "",
        type: "PRIMARY_KEY",
        columns: ["id"],
      };

      const result = constraintService.validateConstraint(
        constraint,
        availableColumns,
        mockConnection,
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe("name");
      expect(result.errors[0].message).toContain("required");
    });

    test("should reject constraint with invalid name", () => {
      const constraint: ConstraintDefinition = {
        name: "123-invalid-name",
        type: "PRIMARY_KEY",
        columns: ["id"],
      };

      const result = constraintService.validateConstraint(
        constraint,
        availableColumns,
        mockConnection,
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === "name")).toBe(true);
    });

    test("should reject PRIMARY KEY without columns", () => {
      const constraint: ConstraintDefinition = {
        name: "pk_test",
        type: "PRIMARY_KEY",
        columns: [],
      };

      const result = constraintService.validateConstraint(
        constraint,
        availableColumns,
        mockConnection,
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === "columns")).toBe(true);
    });

    test("should reject PRIMARY KEY with non-existent columns", () => {
      const constraint: ConstraintDefinition = {
        name: "pk_test",
        type: "PRIMARY_KEY",
        columns: ["non_existent_column"],
      };

      const result = constraintService.validateConstraint(
        constraint,
        availableColumns,
        mockConnection,
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === "columns")).toBe(true);
    });

    test("should reject FOREIGN KEY without referenced table", () => {
      const constraint: ConstraintDefinition = {
        name: "fk_test",
        type: "FOREIGN_KEY",
        columns: ["id"],
        referencedTable: "",
        referencedColumns: ["id"],
      };

      const result = constraintService.validateConstraint(
        constraint,
        availableColumns,
        mockConnection,
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === "referencedTable")).toBe(
        true,
      );
    });

    test("should reject FOREIGN KEY with mismatched column count", () => {
      const constraint: ConstraintDefinition = {
        name: "fk_test",
        type: "FOREIGN_KEY",
        columns: ["id", "name"],
        referencedTable: "other_table",
        referencedColumns: ["id"], // Only one column
      };

      const result = constraintService.validateConstraint(
        constraint,
        availableColumns,
        mockConnection,
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === "columns")).toBe(true);
    });

    test("should reject FOREIGN KEY with invalid actions", () => {
      const constraint: ConstraintDefinition = {
        name: "fk_test",
        type: "FOREIGN_KEY",
        columns: ["id"],
        referencedTable: "other_table",
        referencedColumns: ["id"],
        onDelete: "INVALID_ACTION" as "CASCADE",
        onUpdate: "ANOTHER_INVALID" as "CASCADE",
      };

      const result = constraintService.validateConstraint(
        constraint,
        availableColumns,
        mockConnection,
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === "onDelete")).toBe(true);
      expect(result.errors.some((e) => e.field === "onUpdate")).toBe(true);
    });

    test("should reject CHECK constraint without expression", () => {
      const constraint: ConstraintDefinition = {
        name: "ck_test",
        type: "CHECK",
        checkExpression: "",
      };

      const result = constraintService.validateConstraint(
        constraint,
        availableColumns,
        mockConnection,
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === "checkExpression")).toBe(
        true,
      );
    });

    test("should reject CHECK constraint with dangerous SQL", () => {
      const constraint: ConstraintDefinition = {
        name: "ck_test",
        type: "CHECK",
        checkExpression: "age > 0 OR DROP TABLE users",
      };

      const result = constraintService.validateConstraint(
        constraint,
        availableColumns,
        mockConnection,
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.type === "security")).toBe(true);
    });

    test("should reject CHECK constraint with unbalanced parentheses", () => {
      const constraint: ConstraintDefinition = {
        name: "ck_test",
        type: "CHECK",
        checkExpression: "age > 0 AND (name IS NOT NULL",
      };

      const result = constraintService.validateConstraint(
        constraint,
        availableColumns,
        mockConnection,
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.message.includes("parentheses"))).toBe(
        true,
      );
    });
  });

  describe("SQL Generation", () => {
    test("should generate PRIMARY KEY constraint SQL", () => {
      const constraint: ConstraintDefinition = {
        name: "pk_users_id",
        type: "PRIMARY_KEY",
        columns: ["id"],
      };

      const sql = constraintService.generateConstraintDefinition(constraint);

      expect(sql).toBe("`pk_users_id` PRIMARY KEY (`id`)");
    });

    test("should generate FOREIGN KEY constraint SQL", () => {
      const constraint: ConstraintDefinition = {
        name: "fk_users_department",
        type: "FOREIGN_KEY",
        columns: ["department_id"],
        referencedTable: "departments",
        referencedColumns: ["id"],
        onDelete: "CASCADE",
        onUpdate: "SET_NULL",
      };

      const sql = constraintService.generateConstraintDefinition(constraint);

      expect(sql).toBe(
        "`fk_users_department` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE CASCADE ON UPDATE SET NULL",
      );
    });

    test("should generate UNIQUE constraint SQL", () => {
      const constraint: ConstraintDefinition = {
        name: "uk_users_email",
        type: "UNIQUE",
        columns: ["email"],
      };

      const sql = constraintService.generateConstraintDefinition(constraint);

      expect(sql).toBe("`uk_users_email` UNIQUE (`email`)");
    });

    test("should generate CHECK constraint SQL", () => {
      const constraint: ConstraintDefinition = {
        name: "ck_users_age",
        type: "CHECK",
        checkExpression: "age >= 0 AND age <= 150",
      };

      const sql = constraintService.generateConstraintDefinition(constraint);

      expect(sql).toBe("`ck_users_age` CHECK (age >= 0 AND age <= 150)");
    });

    test("should generate composite PRIMARY KEY constraint SQL", () => {
      const constraint: ConstraintDefinition = {
        name: "pk_user_roles",
        type: "PRIMARY_KEY",
        columns: ["user_id", "role_id"],
      };

      const sql = constraintService.generateConstraintDefinition(constraint);

      expect(sql).toBe("`pk_user_roles` PRIMARY KEY (`user_id`, `role_id`)");
    });
  });

  describe("ADD CONSTRAINT SQL Generation", () => {
    test("should generate ADD CONSTRAINT SQL for MySQL", () => {
      const constraint: ConstraintDefinition = {
        name: "uk_users_email",
        type: "UNIQUE",
        columns: ["email"],
      };

      const mysqlConnection = { ...mockConnection, type: "mysql" as const };
      const sql = constraintService.generateAddConstraintSQL(
        "users",
        constraint,
        mysqlConnection,
      );

      expect(sql).toBe(
        "ALTER TABLE `users` ADD CONSTRAINT `uk_users_email` UNIQUE (`email`)",
      );
    });

    test("should generate ADD CONSTRAINT SQL for PostgreSQL", () => {
      const constraint: ConstraintDefinition = {
        name: "uk_users_email",
        type: "UNIQUE",
        columns: ["email"],
      };

      const sql = constraintService.generateAddConstraintSQL(
        "users",
        constraint,
        mockConnection,
      );

      expect(sql).toBe(
        "ALTER TABLE `users` ADD CONSTRAINT `uk_users_email` UNIQUE (`email`)",
      );
    });

    test("should throw error for SQLite ADD CONSTRAINT", () => {
      const constraint: ConstraintDefinition = {
        name: "uk_users_email",
        type: "UNIQUE",
        columns: ["email"],
      };

      const sqliteConnection = { ...mockConnection, type: "sqlite" as const };

      expect(() => {
        constraintService.generateAddConstraintSQL(
          "users",
          constraint,
          sqliteConnection,
        );
      }).toThrow("SQLite does not support adding constraints");
    });
  });

  describe("DROP CONSTRAINT SQL Generation", () => {
    test("should generate DROP CONSTRAINT SQL for MySQL", () => {
      const mysqlConnection = { ...mockConnection, type: "mysql" as const };
      const sql = constraintService.generateDropConstraintSQL(
        "users",
        "uk_users_email",
        mysqlConnection,
      );

      expect(sql).toBe("ALTER TABLE `users` DROP CONSTRAINT `uk_users_email`");
    });

    test("should generate DROP CONSTRAINT SQL for PostgreSQL", () => {
      const sql = constraintService.generateDropConstraintSQL(
        "users",
        "uk_users_email",
        mockConnection,
      );

      expect(sql).toBe("ALTER TABLE `users` DROP CONSTRAINT `uk_users_email`");
    });

    test("should throw error for SQLite DROP CONSTRAINT", () => {
      const sqliteConnection = { ...mockConnection, type: "sqlite" as const };

      expect(() => {
        constraintService.generateDropConstraintSQL(
          "users",
          "uk_users_email",
          sqliteConnection,
        );
      }).toThrow("SQLite does not support dropping constraints");
    });
  });

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
      ];

      const result =
        constraintService.analyzeConstraintDependencies(constraints);

      expect(result.canApply).toBe(true);
      expect(result.circularDependencies).toHaveLength(0);
      expect(result.dependencies.fk_users_department).toContain("departments");
    });

    test("should detect multiple primary key warning", () => {
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
      ];

      const result =
        constraintService.analyzeConstraintDependencies(constraints);

      expect(
        result.warnings.some((w) => w.includes("Multiple primary key")),
      ).toBe(true);
    });

    test("should detect duplicate unique constraints", () => {
      const constraints: ConstraintDefinition[] = [
        {
          name: "uk_users_email_1",
          type: "UNIQUE",
          columns: ["email"],
        },
        {
          name: "uk_users_email_2",
          type: "UNIQUE",
          columns: ["email"],
        },
      ];

      const result =
        constraintService.analyzeConstraintDependencies(constraints);

      expect(
        result.warnings.some((w) => w.includes("Duplicate unique constraint")),
      ).toBe(true);
    });
  });

  describe("Constraint Creation Order", () => {
    test("should order constraints with foreign keys last", () => {
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
      ];

      const ordered = constraintService.getConstraintCreationOrder(constraints);

      expect(ordered).toHaveLength(3);
      expect(ordered[0].type).not.toBe("FOREIGN_KEY");
      expect(ordered[1].type).not.toBe("FOREIGN_KEY");
      expect(ordered[2].type).toBe("FOREIGN_KEY");
    });

    test("should preserve order for non-foreign key constraints", () => {
      const constraints: ConstraintDefinition[] = [
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
        {
          name: "ck_users_age",
          type: "CHECK",
          checkExpression: "age >= 0",
        },
      ];

      const ordered = constraintService.getConstraintCreationOrder(constraints);

      expect(ordered).toEqual(constraints);
    });
  });

  describe("Database-specific Validation", () => {
    test("should validate SQLite CHECK constraint with ROWID warning", () => {
      const constraint: ConstraintDefinition = {
        name: "ck_test",
        type: "CHECK",
        checkExpression: "ROWID > 0",
      };

      const sqliteConnection = { ...mockConnection, type: "sqlite" as const };
      const result = constraintService.validateConstraint(
        constraint,
        [],
        sqliteConnection,
      );

      expect(result.isValid).toBe(true);
      expect(result.warnings.some((w) => w.message.includes("ROWID"))).toBe(
        true,
      );
    });

    test("should handle unknown constraint type", () => {
      const constraint = {
        name: "unknown_constraint",
        type: "UNKNOWN_TYPE",
        columns: ["id"],
      } as ConstraintDefinition;

      const result = constraintService.validateConstraint(
        constraint,
        ["id"],
        mockConnection,
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === "type")).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    test("should handle constraint with very long name", () => {
      const longName = "a".repeat(100);
      const constraint: ConstraintDefinition = {
        name: longName,
        type: "PRIMARY_KEY",
        columns: ["id"],
      };

      const result = constraintService.validateConstraint(
        constraint,
        ["id"],
        mockConnection,
      );

      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((e) => e.message.includes("63 characters")),
      ).toBe(true);
    });

    test("should handle empty available columns array", () => {
      const constraint: ConstraintDefinition = {
        name: "pk_test",
        type: "PRIMARY_KEY",
        columns: ["id"],
      };

      const result = constraintService.validateConstraint(
        constraint,
        [],
        mockConnection,
      );

      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((e) => e.message.includes("does not exist")),
      ).toBe(true);
    });

    test("should handle constraint without columns property", () => {
      const constraint = {
        name: "test_constraint",
        type: "PRIMARY_KEY",
      } as ConstraintDefinition;

      const result = constraintService.validateConstraint(
        constraint,
        ["id"],
        mockConnection,
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === "columns")).toBe(true);
    });
  });
});
