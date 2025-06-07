import type { DatabaseConnection } from "../types/sql";
import type {
  IndexDefinition,
  IndexManagementResult,
  IndexOptimizationSuggestion,
  IndexPerformanceAnalysis,
  IndexValidationError,
  IndexValidationResult,
} from "../types/table-management";
import { DATABASE_FEATURES } from "../types/table-management";

export class IndexManagementService {
  /**
   * Validate index definition
   */
  validateIndex(
    index: IndexDefinition,
    availableColumns: string[],
    connection: DatabaseConnection,
    existingIndexes: IndexDefinition[] = [],
  ): IndexValidationResult {
    const errors: IndexValidationError[] = [];
    const warnings: IndexValidationError[] = [];

    // Basic name validation
    if (!index.name || index.name.trim().length === 0) {
      errors.push({
        type: "validation",
        field: "name",
        message: "Index name is required",
        severity: "error",
      });
    }

    if (index.name && index.name.length > 63) {
      errors.push({
        type: "validation",
        field: "name",
        message: "Index name must be 63 characters or less",
        severity: "error",
      });
    }

    // SQL naming convention validation
    if (index.name && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(index.name)) {
      errors.push({
        type: "validation",
        field: "name",
        message:
          "Index name must start with letter or underscore, contain only alphanumeric characters and underscores",
        severity: "error",
      });
    }

    // Columns validation
    if (!index.columns || index.columns.length === 0) {
      errors.push({
        type: "validation",
        field: "columns",
        message: "Index must specify at least one column",
        severity: "error",
      });
    } else {
      // Check if all specified columns exist
      for (const column of index.columns) {
        if (!availableColumns.includes(column)) {
          errors.push({
            type: "validation",
            field: "columns",
            message: `Column "${column}" does not exist in the table`,
            severity: "error",
          });
        }
      }

      // Check for duplicate columns in the same index
      const duplicateColumns = index.columns.filter(
        (col, i) => index.columns.indexOf(col) !== i,
      );
      if (duplicateColumns.length > 0) {
        errors.push({
          type: "validation",
          field: "columns",
          message: `Duplicate columns in index: ${duplicateColumns.join(", ")}`,
          severity: "error",
        });
      }
    }

    // Include columns validation (PostgreSQL covering indexes)
    if (index.include && index.include.length > 0) {
      const features = DATABASE_FEATURES[connection.type];
      if (features?.supportsCoveringIndexes) {
        for (const column of index.include) {
          if (!availableColumns.includes(column)) {
            errors.push({
              type: "validation",
              field: "include",
              message: `Include column "${column}" does not exist in the table`,
              severity: "error",
            });
          }
          if (index.columns?.includes(column)) {
            errors.push({
              type: "validation",
              field: "include",
              message: `Column "${column}" cannot be both in index columns and include columns`,
              severity: "error",
            });
          }
        }
      } else {
        errors.push({
          type: "database",
          field: "include",
          message: `${connection.type} does not support covering indexes`,
          severity: "error",
        });
      }
    }

    // WHERE clause validation (partial indexes)
    if (index.where && index.where.trim().length > 0) {
      const features = DATABASE_FEATURES[connection.type];
      if (features?.supportsPartialIndexes) {
        this.validateWhereClause(index.where, errors);
      } else {
        errors.push({
          type: "database",
          field: "where",
          message: `${connection.type} does not support partial indexes`,
          severity: "error",
        });
      }
    }

    // Index type validation
    if (index.type) {
      this.validateIndexType(index.type, connection, errors);
    }

    // Check for duplicate indexes
    this.checkDuplicateIndexes(index, existingIndexes, warnings);

    // Performance warnings
    this.validateIndexPerformance(index, warnings);

    return {
      isValid: errors.filter((e) => e.severity === "error").length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Generate CREATE INDEX SQL
   */
  generateCreateIndexSQL(
    index: IndexDefinition,
    connection: DatabaseConnection,
  ): string {
    let sql = "CREATE ";

    if (index.unique) {
      sql += "UNIQUE ";
    }

    sql += "INDEX ";

    // Add IF NOT EXISTS for supported databases
    if (connection.type === "postgresql" || connection.type === "sqlite") {
      sql += "IF NOT EXISTS ";
    }

    sql += `${this.escapeIdentifier(index.name)} ON ${this.escapeIdentifier(index.tableName)}`;

    // Index method/type (PostgreSQL)
    if (
      connection.type === "postgresql" &&
      index.type &&
      index.type !== "BTREE"
    ) {
      sql += ` USING ${index.type}`;
    }

    // Index columns
    sql += ` (${index.columns.map((col) => this.escapeIdentifier(col)).join(", ")})`;

    // Include columns (PostgreSQL covering indexes)
    if (
      index.include &&
      index.include.length > 0 &&
      connection.type === "postgresql"
    ) {
      sql += ` INCLUDE (${index.include.map((col) => this.escapeIdentifier(col)).join(", ")})`;
    }

    // WHERE clause (partial indexes)
    if (index.where && index.where.trim().length > 0) {
      sql += ` WHERE ${index.where}`;
    }

    return sql;
  }

  /**
   * Generate DROP INDEX SQL
   */
  generateDropIndexSQL(
    indexName: string,
    connection: DatabaseConnection,
    ifExists = false,
  ): string {
    let sql = "DROP INDEX ";

    if (ifExists) {
      if (connection.type === "postgresql" || connection.type === "sqlite") {
        sql += "IF EXISTS ";
      }
    }

    sql += this.escapeIdentifier(indexName);

    return sql;
  }

  /**
   * Analyze index performance and provide optimization suggestions
   */
  analyzeIndexPerformance(
    index: IndexDefinition,
    availableColumns: string[] = [],
  ): IndexPerformanceAnalysis {
    const suggestions: IndexOptimizationSuggestion[] = [];
    let estimatedSelectivity = 0.1; // Default assumption

    // Analyze column selectivity
    if (index.columns && index.columns.length > 0) {
      // Check if all index columns are available
      const missingColumns = index.columns.filter(
        (col) => !availableColumns.includes(col),
      );
      if (missingColumns.length > 0) {
        suggestions.push({
          type: "warning",
          priority: "high",
          message: `Columns [${missingColumns.join(", ")}] not found in available columns. Index references non-existent columns`,
        });
      }

      // Single column index
      if (index.columns.length === 1) {
        const column = index.columns[0];
        if (
          column.toLowerCase().includes("id") ||
          column.toLowerCase().includes("uuid")
        ) {
          estimatedSelectivity = 0.001; // Very selective
          suggestions.push({
            type: "optimization",
            priority: "high",
            message: `Column "${column}" appears to be highly selective - excellent for indexing`,
          });
        } else if (
          column.toLowerCase().includes("status") ||
          column.toLowerCase().includes("type")
        ) {
          estimatedSelectivity = 0.3; // Low selectivity
          suggestions.push({
            type: "warning",
            priority: "medium",
            message: `Column "${column}" may have low selectivity - consider composite index`,
          });
        }
      } else {
        // Composite index
        estimatedSelectivity = 0.01; // Generally more selective

        // Check column order
        const firstColumn = index.columns[0];
        if (
          firstColumn.toLowerCase().includes("status") ||
          firstColumn.toLowerCase().includes("type")
        ) {
          suggestions.push({
            type: "optimization",
            priority: "high",
            message:
              "Consider placing more selective columns first in composite index",
          });
        }

        if (index.columns.length > 5) {
          suggestions.push({
            type: "warning",
            priority: "medium",
            message: "Very wide composite index may have high maintenance cost",
          });
        }
      }
    }

    // Partial index analysis
    if (index.where && index.where.trim().length > 0) {
      estimatedSelectivity *= 0.1; // Partial indexes are generally more selective
      suggestions.push({
        type: "optimization",
        priority: "high",
        message:
          "Partial index can significantly reduce index size and maintenance cost",
      });
    }

    // Covering index analysis
    if (index.include && index.include.length > 0) {
      suggestions.push({
        type: "optimization",
        priority: "medium",
        message:
          "Covering index can eliminate table lookups for covered columns",
      });

      if (index.include.length > 10) {
        suggestions.push({
          type: "warning",
          priority: "low",
          message: "Very wide covering index may have diminishing returns",
        });
      }
    }

    // Unique index analysis
    if (index.unique) {
      estimatedSelectivity = Math.min(estimatedSelectivity, 0.001);
      suggestions.push({
        type: "optimization",
        priority: "high",
        message:
          "Unique index provides both constraint enforcement and excellent selectivity",
      });
    }

    return {
      estimatedSelectivity,
      estimatedSize: this.estimateIndexSize(index),
      maintenanceCost: this.estimateMaintenanceCost(index),
      suggestions,
    };
  }

  /**
   * Get optimization suggestions for a set of indexes
   */
  getOptimizationSuggestions(
    indexes: IndexDefinition[],
    tableColumns: string[],
  ): IndexOptimizationSuggestion[] {
    const suggestions: IndexOptimizationSuggestion[] = [];

    // Check for redundant indexes
    for (let i = 0; i < indexes.length; i++) {
      for (let j = i + 1; j < indexes.length; j++) {
        const index1 = indexes[i];
        const index2 = indexes[j];

        if (this.isRedundantIndex(index1, index2)) {
          suggestions.push({
            type: "warning",
            priority: "medium",
            message: `Index "${index2.name}" may be redundant with "${index1.name}"`,
          });
        }
      }
    }

    // Check for missing indexes on foreign key columns
    const foreignKeyColumns = tableColumns.filter(
      (col) =>
        col.toLowerCase().includes("_id") || col.toLowerCase().endsWith("id"),
    );

    for (const fkCol of foreignKeyColumns) {
      const hasIndex = indexes.some(
        (idx) =>
          idx.columns.includes(fkCol) ||
          (idx.columns.length > 0 && idx.columns[0] === fkCol),
      );

      if (!hasIndex) {
        suggestions.push({
          type: "optimization",
          priority: "high",
          message: `Consider adding index on foreign key column "${fkCol}"`,
        });
      }
    }

    // Check for too many indexes
    if (indexes.length > 10) {
      suggestions.push({
        type: "warning",
        priority: "low",
        message:
          "Table has many indexes - consider consolidating or removing unused ones",
      });
    }

    return suggestions;
  }

  /**
   * Analyze index usage and maintenance requirements
   */
  analyzeIndexMaintenance(indexes: IndexDefinition[]): IndexManagementResult {
    const analysis = {
      totalIndexes: indexes.length,
      uniqueIndexes: indexes.filter((idx) => idx.unique).length,
      partialIndexes: indexes.filter((idx) => idx.where).length,
      coveringIndexes: indexes.filter(
        (idx) => idx.include && idx.include.length > 0,
      ).length,
      estimatedTotalSize: 0,
      maintenanceComplexity: "low" as "low" | "medium" | "high",
    };

    // Calculate total estimated size
    analysis.estimatedTotalSize = indexes.reduce((total, idx) => {
      return total + this.estimateIndexSize(idx);
    }, 0);

    // Determine maintenance complexity
    if (indexes.length > 15 || analysis.estimatedTotalSize > 1000) {
      analysis.maintenanceComplexity = "high";
    } else if (indexes.length > 8 || analysis.estimatedTotalSize > 500) {
      analysis.maintenanceComplexity = "medium";
    }

    const recommendations = this.getOptimizationSuggestions(indexes, []);

    return {
      analysis,
      recommendations,
      canOptimize: recommendations.length > 0,
    };
  }

  // Private helper methods
  private validateWhereClause(
    whereClause: string,
    errors: IndexValidationError[],
  ): void {
    const clause = whereClause.trim();

    // Check for balanced parentheses
    let parenCount = 0;
    for (const char of clause) {
      if (char === "(") parenCount++;
      if (char === ")") parenCount--;
      if (parenCount < 0) {
        errors.push({
          type: "validation",
          field: "where",
          message: "Unbalanced parentheses in WHERE clause",
          severity: "error",
        });
        return;
      }
    }

    if (parenCount !== 0) {
      errors.push({
        type: "validation",
        field: "where",
        message: "Unbalanced parentheses in WHERE clause",
        severity: "error",
      });
    }

    // Check for dangerous SQL patterns
    const dangerousPatterns = [
      /\b(DROP|DELETE|INSERT|UPDATE|CREATE|ALTER)\b/i,
      /\b(EXEC|EXECUTE)\b/i,
      /--/,
      /\/\*/,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(clause)) {
        errors.push({
          type: "security",
          field: "where",
          message: "WHERE clause contains potentially dangerous SQL",
          severity: "error",
        });
      }
    }
  }

  private validateIndexType(
    indexType: string,
    connection: DatabaseConnection,
    errors: IndexValidationError[],
  ): void {
    const supportedTypes = this.getSupportedIndexTypes(connection.type);

    if (!supportedTypes.includes(indexType)) {
      errors.push({
        type: "database",
        field: "type",
        message: `Index type "${indexType}" is not supported by ${connection.type}`,
        severity: "error",
      });
    }
  }

  private getSupportedIndexTypes(databaseType: string): string[] {
    switch (databaseType) {
      case "postgresql":
        return ["BTREE", "HASH", "GIN", "GIST", "SPGIST", "BRIN"];
      case "mysql":
        return ["BTREE", "HASH"];
      case "sqlite":
        return ["BTREE"];
      default:
        return ["BTREE"];
    }
  }

  private checkDuplicateIndexes(
    newIndex: IndexDefinition,
    existingIndexes: IndexDefinition[],
    warnings: IndexValidationError[],
  ): void {
    for (const existingIndex of existingIndexes) {
      if (existingIndex.name === newIndex.name) {
        warnings.push({
          type: "validation",
          field: "name",
          message: `Index name "${newIndex.name}" already exists`,
          severity: "warning",
        });
      }

      // Check for identical column sets
      const newColumns = [...(newIndex.columns || [])].sort();
      const existingColumns = [...(existingIndex.columns || [])].sort();

      if (JSON.stringify(newColumns) === JSON.stringify(existingColumns)) {
        warnings.push({
          type: "optimization",
          field: "columns",
          message: `Index on columns [${newColumns.join(", ")}] already exists as "${existingIndex.name}"`,
          severity: "warning",
        });
      }
    }
  }

  private validateIndexPerformance(
    index: IndexDefinition,
    warnings: IndexValidationError[],
  ): void {
    // Check for potential performance issues
    if (index.columns && index.columns.length > 6) {
      warnings.push({
        type: "performance",
        field: "columns",
        message:
          "Very wide composite index may have poor performance and high maintenance cost",
        severity: "warning",
      });
    }

    // Check for low-selectivity leading column
    if (index.columns && index.columns.length > 0) {
      const firstColumn = index.columns[0].toLowerCase();
      if (
        firstColumn.includes("status") ||
        firstColumn.includes("type") ||
        firstColumn.includes("flag")
      ) {
        warnings.push({
          type: "performance",
          field: "columns",
          message:
            "Leading column appears to have low selectivity - consider reordering",
          severity: "warning",
        });
      }
    }
  }

  private isRedundantIndex(
    index1: IndexDefinition,
    index2: IndexDefinition,
  ): boolean {
    if (!index1.columns || !index2.columns) return false;

    // Check if one index is a prefix of another
    const cols1 = index1.columns;
    const cols2 = index2.columns;

    if (cols1.length <= cols2.length) {
      return cols1.every((col, i) => cols2[i] === col);
    }
    return cols2.every((col, i) => cols1[i] === col);
  }

  private estimateIndexSize(index: IndexDefinition): number {
    // Simplified estimation in MB
    const baseSize = 1; // 1MB base
    const columnCount =
      (index.columns?.length || 0) + (index.include?.length || 0);
    const sizeMultiplier = index.unique ? 0.8 : 1.0; // Unique indexes typically smaller
    const partialMultiplier = index.where ? 0.3 : 1.0; // Partial indexes much smaller

    return baseSize * columnCount * sizeMultiplier * partialMultiplier;
  }

  private estimateMaintenanceCost(
    index: IndexDefinition,
  ): "low" | "medium" | "high" {
    const columnCount =
      (index.columns?.length || 0) + (index.include?.length || 0);

    if (columnCount > 8 || (index.columns && index.columns.length > 5)) {
      return "high";
    }
    if (columnCount > 4) {
      return "medium";
    }
    return "low";
  }

  private escapeIdentifier(identifier: string): string {
    // Database-agnostic identifier escaping
    return `\`${identifier.replace(/`/g, "``")}\``;
  }
}
