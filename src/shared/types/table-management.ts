// Table Management Types

export interface TableDefinition {
  name: string;
  schema: string;
  comment?: string;
  columns: ColumnDefinition[];
  constraints?: ConstraintDefinition[];
  indexes?: IndexDefinition[];
}

export interface ColumnDefinition {
  name: string;
  dataType: string;
  nullable: boolean;
  defaultValue?: string | number | boolean | null;
  comment?: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  autoIncrement?: boolean;
  maxLength?: number;
  precision?: number;
  scale?: number;
}

export interface ConstraintDefinition {
  name: string;
  type: "PRIMARY_KEY" | "FOREIGN_KEY" | "UNIQUE" | "CHECK" | "NOT_NULL";
  columns?: string[];
  referencedTable?: string;
  referencedColumns?: string[];
  onDelete?: "CASCADE" | "SET_NULL" | "RESTRICT" | "NO_ACTION" | "SET_DEFAULT";
  onUpdate?: "CASCADE" | "SET_NULL" | "RESTRICT" | "NO_ACTION" | "SET_DEFAULT";
  checkExpression?: string;
  deferrable?: boolean;
  initiallyDeferred?: boolean;
}

export interface IndexDefinition {
  name: string;
  tableName: string;
  columns: string[];
  unique: boolean;
  type?: "BTREE" | "HASH" | "GIN" | "GIST" | "SPGIST" | "BRIN";
  where?: string; // Partial index condition
  include?: string[]; // Covering index columns (PostgreSQL)
  comment?: string;
}

export interface DDLResult {
  success: boolean;
  sql?: string;
  error?: string;
  executionTime?: number;
  affectedRows?: number;
}

export interface TableValidationError {
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface TableValidationResult {
  valid: boolean;
  errors: TableValidationError[];
  warnings: TableValidationError[];
}

// Constraint Management Types
export interface ConstraintValidationError {
  type: "validation" | "database" | "security";
  field: string;
  message: string;
  severity: "error" | "warning" | "info";
}

export interface ConstraintValidationResult {
  isValid: boolean;
  errors: ConstraintValidationError[];
  warnings: ConstraintValidationError[];
}

export interface ConstraintManagementResult {
  dependencies: Record<string, string[]>;
  circularDependencies: string[];
  warnings: string[];
  canApply: boolean;
}

// Index Management Types
export interface IndexValidationError {
  type: "validation" | "database" | "security" | "performance" | "optimization";
  field: string;
  message: string;
  severity: "error" | "warning" | "info";
}

export interface IndexValidationResult {
  isValid: boolean;
  errors: IndexValidationError[];
  warnings: IndexValidationError[];
}

export interface IndexOptimizationSuggestion {
  type: "optimization" | "warning" | "performance";
  priority: "high" | "medium" | "low";
  message: string;
}

export interface IndexPerformanceAnalysis {
  estimatedSelectivity: number; // 0.0 to 1.0
  estimatedSize: number; // in MB
  maintenanceCost: "low" | "medium" | "high";
  suggestions: IndexOptimizationSuggestion[];
}

export interface IndexManagementResult {
  analysis: {
    totalIndexes: number;
    uniqueIndexes: number;
    partialIndexes: number;
    coveringIndexes: number;
    estimatedTotalSize: number;
    maintenanceComplexity: "low" | "medium" | "high";
  };
  recommendations: IndexOptimizationSuggestion[];
  canOptimize: boolean;
}

// Data type mappings for different databases
export interface DataTypeMapping {
  mysql: Record<string, string>;
  postgresql: Record<string, string>;
  sqlite: Record<string, string>;
  mssql: Record<string, string>;
  oracle: Record<string, string>;
}

export const DATA_TYPE_MAPPINGS: DataTypeMapping = {
  mysql: {
    INTEGER: "INT",
    BIGINTEGER: "BIGINT",
    DECIMAL: "DECIMAL",
    FLOAT: "FLOAT",
    DOUBLE: "DOUBLE",
    STRING: "VARCHAR",
    TEXT: "TEXT",
    LONGTEXT: "LONGTEXT",
    BOOLEAN: "BOOLEAN",
    DATE: "DATE",
    TIME: "TIME",
    DATETIME: "DATETIME",
    TIMESTAMP: "TIMESTAMP",
    BINARY: "BINARY",
    VARBINARY: "VARBINARY",
    BLOB: "BLOB",
    JSON: "JSON",
  },
  postgresql: {
    INTEGER: "INTEGER",
    BIGINTEGER: "BIGINT",
    DECIMAL: "DECIMAL",
    FLOAT: "REAL",
    DOUBLE: "DOUBLE PRECISION",
    STRING: "VARCHAR",
    TEXT: "TEXT",
    BOOLEAN: "BOOLEAN",
    DATE: "DATE",
    TIME: "TIME",
    DATETIME: "TIMESTAMP",
    TIMESTAMP: "TIMESTAMP",
    BINARY: "BYTEA",
    UUID: "UUID",
    JSON: "JSON",
    JSONB: "JSONB",
    ARRAY: "ARRAY",
    SERIAL: "SERIAL",
    BIGSERIAL: "BIGSERIAL",
  },
  sqlite: {
    INTEGER: "INTEGER",
    DECIMAL: "REAL",
    FLOAT: "REAL",
    DOUBLE: "REAL",
    STRING: "TEXT",
    TEXT: "TEXT",
    BOOLEAN: "INTEGER",
    DATE: "TEXT",
    TIME: "TEXT",
    DATETIME: "TEXT",
    TIMESTAMP: "TEXT",
    BINARY: "BLOB",
    BLOB: "BLOB",
  },
  mssql: {
    INTEGER: "INT",
    BIGINTEGER: "BIGINT",
    DECIMAL: "DECIMAL",
    FLOAT: "FLOAT",
    DOUBLE: "FLOAT",
    STRING: "NVARCHAR",
    TEXT: "NTEXT",
    BOOLEAN: "BIT",
    DATE: "DATE",
    TIME: "TIME",
    DATETIME: "DATETIME2",
    TIMESTAMP: "DATETIME2",
    BINARY: "BINARY",
    VARBINARY: "VARBINARY",
    UNIQUEIDENTIFIER: "UNIQUEIDENTIFIER",
  },
  oracle: {
    INTEGER: "NUMBER",
    BIGINTEGER: "NUMBER",
    DECIMAL: "NUMBER",
    FLOAT: "BINARY_FLOAT",
    DOUBLE: "BINARY_DOUBLE",
    STRING: "VARCHAR2",
    TEXT: "CLOB",
    BOOLEAN: "NUMBER(1)",
    DATE: "DATE",
    TIME: "TIMESTAMP",
    DATETIME: "TIMESTAMP",
    TIMESTAMP: "TIMESTAMP",
    BINARY: "RAW",
    BLOB: "BLOB",
  },
};

// SQL keywords that should be avoided as table/column names
export const SQL_RESERVED_KEYWORDS = [
  "SELECT",
  "INSERT",
  "UPDATE",
  "DELETE",
  "CREATE",
  "DROP",
  "ALTER",
  "TABLE",
  "INDEX",
  "VIEW",
  "DATABASE",
  "SCHEMA",
  "FROM",
  "WHERE",
  "JOIN",
  "INNER",
  "LEFT",
  "RIGHT",
  "FULL",
  "OUTER",
  "UNION",
  "GROUP",
  "ORDER",
  "BY",
  "HAVING",
  "LIMIT",
  "OFFSET",
  "AS",
  "AND",
  "OR",
  "NOT",
  "IN",
  "EXISTS",
  "BETWEEN",
  "LIKE",
  "IS",
  "NULL",
  "TRUE",
  "FALSE",
  "CASE",
  "WHEN",
  "THEN",
  "ELSE",
  "END",
  "IF",
  "WHILE",
  "FOR",
  "LOOP",
  "FUNCTION",
  "PROCEDURE",
  "TRIGGER",
  "PRIMARY",
  "FOREIGN",
  "KEY",
  "REFERENCES",
  "CONSTRAINT",
  "UNIQUE",
  "CHECK",
  "DEFAULT",
  "AUTO_INCREMENT",
  "SERIAL",
  "BOOLEAN",
  "INTEGER",
  "DECIMAL",
  "FLOAT",
  "DOUBLE",
  "VARCHAR",
  "TEXT",
  "DATE",
  "TIME",
  "TIMESTAMP",
  "BLOB",
];

// Table creation options
export interface TableCreationOptions {
  ifNotExists?: boolean;
  temporary?: boolean;
  engine?: string; // MySQL
  charset?: string; // MySQL
  collation?: string; // MySQL
  tablespace?: string; // PostgreSQL/Oracle
  unlogged?: boolean; // PostgreSQL
  withOids?: boolean; // PostgreSQL (deprecated)
}

// Column modification operations
export type ColumnOperation = "ADD" | "MODIFY" | "CHANGE" | "DROP" | "RENAME";

export interface ColumnModification {
  operation: ColumnOperation;
  column: ColumnDefinition;
  newName?: string; // For RENAME operation
  position?: "FIRST" | { after: string }; // MySQL specific
}

// Table comparison and diff
export interface TableDiff {
  tableName: string;
  columnChanges: ColumnModification[];
  constraintChanges: {
    added: ConstraintDefinition[];
    removed: string[];
    modified: ConstraintDefinition[];
  };
  indexChanges: {
    added: IndexDefinition[];
    removed: string[];
    modified: IndexDefinition[];
  };
}

// Export/Import formats
export type DDLFormat = "sql" | "json" | "yaml" | "xml";

export interface DDLExportOptions {
  format: DDLFormat;
  includeData?: boolean;
  includeDropStatements?: boolean;
  includeCreateStatements?: boolean;
  includeIndexes?: boolean;
  includeConstraints?: boolean;
  pretty?: boolean;
}

// Table statistics
export interface TableStatistics {
  rowCount: number;
  dataSize: number; // in bytes
  indexSize: number; // in bytes
  lastModified?: Date;
  lastAnalyzed?: Date;
  autoIncrementValue?: number;
}

// Database-specific features
export interface DatabaseFeatures {
  supportsPartialIndexes: boolean;
  supportsExpressionIndexes: boolean;
  supportsCoveringIndexes: boolean;
  supportsCheckConstraints: boolean;
  supportsDeferrableConstraints: boolean;
  supportsTableComments: boolean;
  supportsColumnComments: boolean;
  supportsAutoIncrement: boolean;
  supportsSequences: boolean;
  maxTableNameLength: number;
  maxColumnNameLength: number;
  maxIndexNameLength: number;
  maxConstraintNameLength: number;
}

export const DATABASE_FEATURES: Record<string, DatabaseFeatures> = {
  mysql: {
    supportsPartialIndexes: false,
    supportsExpressionIndexes: true,
    supportsCoveringIndexes: false,
    supportsCheckConstraints: true,
    supportsDeferrableConstraints: false,
    supportsTableComments: true,
    supportsColumnComments: true,
    supportsAutoIncrement: true,
    supportsSequences: false,
    maxTableNameLength: 64,
    maxColumnNameLength: 64,
    maxIndexNameLength: 64,
    maxConstraintNameLength: 64,
  },
  postgresql: {
    supportsPartialIndexes: true,
    supportsExpressionIndexes: true,
    supportsCoveringIndexes: true,
    supportsCheckConstraints: true,
    supportsDeferrableConstraints: true,
    supportsTableComments: true,
    supportsColumnComments: true,
    supportsAutoIncrement: false,
    supportsSequences: true,
    maxTableNameLength: 63,
    maxColumnNameLength: 63,
    maxIndexNameLength: 63,
    maxConstraintNameLength: 63,
  },
  sqlite: {
    supportsPartialIndexes: true,
    supportsExpressionIndexes: true,
    supportsCoveringIndexes: false,
    supportsCheckConstraints: true,
    supportsDeferrableConstraints: true,
    supportsTableComments: false,
    supportsColumnComments: false,
    supportsAutoIncrement: true,
    supportsSequences: false,
    maxTableNameLength: 1000,
    maxColumnNameLength: 1000,
    maxIndexNameLength: 1000,
    maxConstraintNameLength: 1000,
  },
  mssql: {
    supportsPartialIndexes: true,
    supportsExpressionIndexes: true,
    supportsCoveringIndexes: true,
    supportsCheckConstraints: true,
    supportsDeferrableConstraints: false,
    supportsTableComments: false,
    supportsColumnComments: false,
    supportsAutoIncrement: true,
    supportsSequences: true,
    maxTableNameLength: 128,
    maxColumnNameLength: 128,
    maxIndexNameLength: 128,
    maxConstraintNameLength: 128,
  },
  oracle: {
    supportsPartialIndexes: false,
    supportsExpressionIndexes: true,
    supportsCoveringIndexes: false,
    supportsCheckConstraints: true,
    supportsDeferrableConstraints: true,
    supportsTableComments: true,
    supportsColumnComments: true,
    supportsAutoIncrement: false,
    supportsSequences: true,
    maxTableNameLength: 30,
    maxColumnNameLength: 30,
    maxIndexNameLength: 30,
    maxConstraintNameLength: 30,
  },
};
