import type { DatabaseConnection } from "../types/sql"
import type {
  ConstraintDefinition,
  ConstraintManagementResult,
  ConstraintValidationError,
  ConstraintValidationResult,
  DDLResult,
} from "../types/table-management"

export class ConstraintManagementService {
  /**
   * Validate constraint definition
   */
  validateConstraint(
    constraint: ConstraintDefinition,
    availableColumns: string[],
    connection: DatabaseConnection
  ): ConstraintValidationResult {
    const errors: ConstraintValidationError[] = []

    // Basic name validation
    if (!constraint.name || constraint.name.trim().length === 0) {
      errors.push({
        type: "validation",
        field: "name",
        message: "Constraint name is required",
        severity: "error",
      })
    }

    if (constraint.name && constraint.name.length > 63) {
      errors.push({
        type: "validation",
        field: "name",
        message: "Constraint name must be 63 characters or less",
        severity: "error",
      })
    }

    // SQL naming convention validation
    if (constraint.name && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(constraint.name)) {
      errors.push({
        type: "validation",
        field: "name",
        message:
          "Constraint name must start with letter or underscore, contain only alphanumeric characters and underscores",
        severity: "error",
      })
    }

    // Type-specific validation
    switch (constraint.type) {
      case "PRIMARY_KEY":
        this.validatePrimaryKeyConstraint(constraint, availableColumns, errors)
        break
      case "FOREIGN_KEY":
        this.validateForeignKeyConstraint(constraint, availableColumns, errors)
        break
      case "UNIQUE":
        this.validateUniqueConstraint(constraint, availableColumns, errors)
        break
      case "CHECK":
        this.validateCheckConstraint(constraint, connection, errors)
        break
      default:
        errors.push({
          type: "validation",
          field: "type",
          message: `Unsupported constraint type: ${constraint.type}`,
          severity: "error",
        })
    }

    return {
      isValid: errors.filter((e) => e.severity === "error").length === 0,
      errors,
      warnings: errors.filter((e) => e.severity === "warning"),
    }
  }

  /**
   * Generate ADD CONSTRAINT SQL
   */
  generateAddConstraintSQL(
    tableName: string,
    constraint: ConstraintDefinition,
    connection: DatabaseConnection
  ): string {
    const constraintDef = this.generateConstraintDefinition(constraint)

    // Some databases require different syntax
    switch (connection.type) {
      case "mysql":
        return `ALTER TABLE ${this.escapeIdentifier(tableName)} ADD CONSTRAINT ${constraintDef}`
      case "postgresql":
        return `ALTER TABLE ${this.escapeIdentifier(tableName)} ADD CONSTRAINT ${constraintDef}`
      case "sqlite":
        // SQLite has limited ALTER TABLE support for constraints
        throw new Error(
          "SQLite does not support adding constraints to existing tables. Table recreation required."
        )
      default:
        return `ALTER TABLE ${this.escapeIdentifier(tableName)} ADD CONSTRAINT ${constraintDef}`
    }
  }

  /**
   * Generate DROP CONSTRAINT SQL
   */
  generateDropConstraintSQL(
    tableName: string,
    constraintName: string,
    connection: DatabaseConnection
  ): string {
    switch (connection.type) {
      case "mysql":
        return `ALTER TABLE ${this.escapeIdentifier(tableName)} DROP CONSTRAINT ${this.escapeIdentifier(constraintName)}`
      case "postgresql":
        return `ALTER TABLE ${this.escapeIdentifier(tableName)} DROP CONSTRAINT ${this.escapeIdentifier(constraintName)}`
      case "sqlite":
        throw new Error("SQLite does not support dropping constraints. Table recreation required.")
      default:
        return `ALTER TABLE ${this.escapeIdentifier(tableName)} DROP CONSTRAINT ${this.escapeIdentifier(constraintName)}`
    }
  }

  /**
   * Generate constraint definition for CREATE TABLE or ALTER TABLE
   */
  generateConstraintDefinition(constraint: ConstraintDefinition): string {
    const name = this.escapeIdentifier(constraint.name)

    switch (constraint.type) {
      case "PRIMARY_KEY":
        return `${name} PRIMARY KEY (${this.formatColumnList(constraint.columns || [])})`

      case "FOREIGN_KEY": {
        let fkDef = `${name} FOREIGN KEY (${this.formatColumnList(constraint.columns || [])}) `
        fkDef += `REFERENCES ${this.escapeIdentifier(constraint.referencedTable || "")}(${this.formatColumnList(constraint.referencedColumns || [])})`

        if (constraint.onDelete && constraint.onDelete !== "RESTRICT") {
          fkDef += ` ON DELETE ${constraint.onDelete.replace("_", " ")}`
        }
        if (constraint.onUpdate && constraint.onUpdate !== "RESTRICT") {
          fkDef += ` ON UPDATE ${constraint.onUpdate.replace("_", " ")}`
        }

        return fkDef
      }

      case "UNIQUE":
        return `${name} UNIQUE (${this.formatColumnList(constraint.columns || [])})`

      case "CHECK":
        return `${name} CHECK (${constraint.checkExpression || ""})`

      default:
        throw new Error(`Unsupported constraint type: ${constraint.type}`)
    }
  }

  /**
   * Get existing constraints for a table
   */
  async getTableConstraints(
    _tableName: string,
    _connection: DatabaseConnection
  ): Promise<ConstraintDefinition[]> {
    // This would require database-specific queries to retrieve constraints
    // For now, return empty array as this would be implemented with actual database drivers
    return []
  }

  /**
   * Analyze constraint dependencies
   */
  analyzeConstraintDependencies(constraints: ConstraintDefinition[]): ConstraintManagementResult {
    const dependencyMap = new Map<string, string[]>()
    const circularDependencies: string[] = []
    const warnings: string[] = []

    // Analyze foreign key dependencies
    const foreignKeys = constraints.filter((c) => c.type === "FOREIGN_KEY")

    for (const fk of foreignKeys) {
      if (fk.referencedTable) {
        const deps = dependencyMap.get(fk.name) || []
        deps.push(fk.referencedTable)
        dependencyMap.set(fk.name, deps)
      }
    }

    // Check for potential issues
    const primaryKeys = constraints.filter((c) => c.type === "PRIMARY_KEY")
    if (primaryKeys.length > 1) {
      warnings.push(
        "Multiple primary key constraints defined. Only one primary key per table is allowed."
      )
    }

    const uniqueConstraints = constraints.filter((c) => c.type === "UNIQUE")
    const uniqueColumnSets = new Set<string>()

    for (const unique of uniqueConstraints) {
      const columnSet = (unique.columns || []).sort().join(",")
      if (uniqueColumnSets.has(columnSet)) {
        warnings.push(`Duplicate unique constraint on columns: ${columnSet}`)
      }
      uniqueColumnSets.add(columnSet)
    }

    return {
      dependencies: Object.fromEntries(dependencyMap),
      circularDependencies,
      warnings,
      canApply: circularDependencies.length === 0,
    }
  }

  /**
   * Generate constraint creation order considering dependencies
   */
  getConstraintCreationOrder(constraints: ConstraintDefinition[]): ConstraintDefinition[] {
    const ordered: ConstraintDefinition[] = []
    const remaining = [...constraints]

    // First, add all non-foreign key constraints
    const nonForeignKeys = remaining.filter((c) => c.type !== "FOREIGN_KEY")
    ordered.push(...nonForeignKeys)

    // Remove non-foreign keys from remaining
    const foreignKeys = remaining.filter((c) => c.type === "FOREIGN_KEY")

    // Add foreign keys (they typically need to be added after table creation)
    ordered.push(...foreignKeys)

    return ordered
  }

  // Private validation methods
  private validatePrimaryKeyConstraint(
    constraint: ConstraintDefinition,
    availableColumns: string[],
    errors: ConstraintValidationError[]
  ): void {
    if (!constraint.columns || constraint.columns.length === 0) {
      errors.push({
        type: "validation",
        field: "columns",
        message: "Primary key constraint must specify at least one column",
        severity: "error",
      })
      return
    }

    // Check if all specified columns exist
    for (const column of constraint.columns) {
      if (!availableColumns.includes(column)) {
        errors.push({
          type: "validation",
          field: "columns",
          message: `Column "${column}" does not exist in the table`,
          severity: "error",
        })
      }
    }
  }

  private validateForeignKeyConstraint(
    constraint: ConstraintDefinition,
    availableColumns: string[],
    errors: ConstraintValidationError[]
  ): void {
    if (!constraint.columns || constraint.columns.length === 0) {
      errors.push({
        type: "validation",
        field: "columns",
        message: "Foreign key constraint must specify at least one local column",
        severity: "error",
      })
    }

    if (!constraint.referencedTable || constraint.referencedTable.trim().length === 0) {
      errors.push({
        type: "validation",
        field: "referencedTable",
        message: "Foreign key constraint must specify a referenced table",
        severity: "error",
      })
    }

    if (!constraint.referencedColumns || constraint.referencedColumns.length === 0) {
      errors.push({
        type: "validation",
        field: "referencedColumns",
        message: "Foreign key constraint must specify at least one referenced column",
        severity: "error",
      })
    }

    if (constraint.columns && constraint.referencedColumns) {
      if (constraint.columns.length !== constraint.referencedColumns.length) {
        errors.push({
          type: "validation",
          field: "columns",
          message: "Number of local columns must match number of referenced columns",
          severity: "error",
        })
      }
    }

    // Check if all specified local columns exist
    if (constraint.columns) {
      for (const column of constraint.columns) {
        if (!availableColumns.includes(column)) {
          errors.push({
            type: "validation",
            field: "columns",
            message: `Local column "${column}" does not exist in the table`,
            severity: "error",
          })
        }
      }
    }

    // Validate reference actions
    const validActions = ["CASCADE", "SET_NULL", "RESTRICT", "NO_ACTION", "SET_DEFAULT"]

    if (constraint.onDelete && !validActions.includes(constraint.onDelete)) {
      errors.push({
        type: "validation",
        field: "onDelete",
        message: `Invalid ON DELETE action: ${constraint.onDelete}`,
        severity: "error",
      })
    }

    if (constraint.onUpdate && !validActions.includes(constraint.onUpdate)) {
      errors.push({
        type: "validation",
        field: "onUpdate",
        message: `Invalid ON UPDATE action: ${constraint.onUpdate}`,
        severity: "error",
      })
    }
  }

  private validateUniqueConstraint(
    constraint: ConstraintDefinition,
    availableColumns: string[],
    errors: ConstraintValidationError[]
  ): void {
    if (!constraint.columns || constraint.columns.length === 0) {
      errors.push({
        type: "validation",
        field: "columns",
        message: "Unique constraint must specify at least one column",
        severity: "error",
      })
      return
    }

    // Check if all specified columns exist
    for (const column of constraint.columns) {
      if (!availableColumns.includes(column)) {
        errors.push({
          type: "validation",
          field: "columns",
          message: `Column "${column}" does not exist in the table`,
          severity: "error",
        })
      }
    }
  }

  private validateCheckConstraint(
    constraint: ConstraintDefinition,
    connection: DatabaseConnection,
    errors: ConstraintValidationError[]
  ): void {
    if (!constraint.checkExpression || constraint.checkExpression.trim().length === 0) {
      errors.push({
        type: "validation",
        field: "checkExpression",
        message: "Check constraint must specify an expression",
        severity: "error",
      })
      return
    }

    // Basic syntax validation
    const expression = constraint.checkExpression.trim()

    // Check for balanced parentheses
    let parenCount = 0
    for (const char of expression) {
      if (char === "(") parenCount++
      if (char === ")") parenCount--
      if (parenCount < 0) {
        errors.push({
          type: "validation",
          field: "checkExpression",
          message: "Unbalanced parentheses in check expression",
          severity: "error",
        })
        return
      }
    }

    if (parenCount !== 0) {
      errors.push({
        type: "validation",
        field: "checkExpression",
        message: "Unbalanced parentheses in check expression",
        severity: "error",
      })
    }

    // Check for dangerous SQL patterns
    const dangerousPatterns = [
      /\b(DROP|DELETE|INSERT|UPDATE|CREATE|ALTER)\b/i,
      /\b(EXEC|EXECUTE)\b/i,
      /--/,
      /\/\*/,
    ]

    for (const pattern of dangerousPatterns) {
      if (pattern.test(expression)) {
        errors.push({
          type: "security",
          field: "checkExpression",
          message: "Check expression contains potentially dangerous SQL",
          severity: "error",
        })
      }
    }

    // Database-specific validation
    if (connection.type === "sqlite") {
      // SQLite has some limitations on CHECK constraints
      if (expression.includes("ROWID")) {
        errors.push({
          type: "database",
          field: "checkExpression",
          message: "SQLite CHECK constraints cannot reference ROWID",
          severity: "warning",
        })
      }
    }
  }

  // Helper methods
  private escapeIdentifier(identifier: string): string {
    // Database-agnostic identifier escaping
    return `\`${identifier.replace(/`/g, "``")}\``
  }

  private formatColumnList(columns: string[]): string {
    return columns.map((col) => this.escapeIdentifier(col)).join(", ")
  }
}
