// Database schema types for metadata management

export interface ConnectionInfo {
  id: string;
  name: string;
  type: "mysql" | "postgresql" | "sqlite";
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database: string;
  ssl?: boolean | object;
  isConnected?: boolean;
  lastConnected?: Date;
}

export interface DatabaseSchema {
  name?: string;
  tables: TableMetadata[];
  views: ViewMetadata[];
  functions?: FunctionMetadata[];
  triggers?: TriggerMetadata[];
}

export interface TableMetadata {
  name: string;
  schema?: string;
  type: "table" | "view";
  columns: ColumnMetadata[];
  indexes?: IndexMetadata[];
  constraints?: ConstraintMetadata[];
  rowCount?: number;
  size?: number;
  comment?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ColumnMetadata {
  name: string;
  type: string;
  fullType?: string; // Complete type definition (e.g., "VARCHAR(255) NOT NULL DEFAULT ''")
  nullable: boolean;
  defaultValue?: string | null;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isUnique: boolean;
  isAutoIncrement: boolean;
  maxLength?: number;
  characterMaximumLength?: number | null; // SQL standard field name
  precision?: number;
  numericPrecision?: number | null; // SQL standard field name
  scale?: number;
  numericScale?: number | null; // SQL standard field name
  comment?: string;
  constraintName?: string; // Name of the constraint (for PK, FK, UNIQUE)
  foreignKeyTarget?: {
    table: string;
    column: string;
    schema?: string;
  };
}

export interface ViewMetadata {
  name: string;
  schema?: string;
  definition: string;
  columns: ColumnMetadata[];
  comment?: string;
  createdAt?: Date;
}

export interface IndexMetadata {
  name: string;
  table: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
  type: "btree" | "hash" | "gist" | "gin" | "fulltext" | "spatial";
  size?: number;
}

export interface ConstraintMetadata {
  name: string;
  type: "primary_key" | "foreign_key" | "unique" | "check" | "not_null";
  columns: string[];
  referencedTable?: string;
  referencedColumns?: string[];
  definition?: string;
}

export interface FunctionMetadata {
  name: string;
  schema?: string;
  returnType: string;
  parameters: ParameterMetadata[];
  language: string;
  definition: string;
  comment?: string;
}

export interface ParameterMetadata {
  name: string;
  type: string;
  mode: "in" | "out" | "inout";
  defaultValue?: string;
}

export interface TriggerMetadata {
  name: string;
  table: string;
  event: "insert" | "update" | "delete";
  timing: "before" | "after" | "instead_of";
  definition: string;
}

// Tree node types for schema explorer
export interface SchemaTreeNode {
  id: string;
  label: string;
  type: SchemaNodeType;
  icon: string;
  children?: SchemaTreeNode[];
  metadata?: TableMetadata | ViewMetadata | ColumnMetadata;
  isExpanded?: boolean;
  isLoading?: boolean;
  parentId?: string;
}

export type SchemaNodeType =
  | "database"
  | "schema"
  | "tables"
  | "table"
  | "views"
  | "view"
  | "columns"
  | "column"
  | "indexes"
  | "index"
  | "constraints"
  | "constraint"
  | "functions"
  | "function"
  | "triggers"
  | "trigger";

// Search and filter types
export interface SchemaSearchOptions {
  query: string;
  types: SchemaNodeType[];
  caseSensitive: boolean;
  useRegex: boolean;
}

export interface SchemaSearchResult {
  node: SchemaTreeNode;
  matches: SearchMatch[];
}

export interface SearchMatch {
  field: string;
  value: string;
  start: number;
  end: number;
}

// Connection specific schema info
export interface ConnectionSchema {
  connectionId: string;
  databaseName: string;
  schema: DatabaseSchema;
  lastUpdated: Date;
  isStale: boolean;
}

// Metadata cache interface
export interface MetadataCache {
  get(connectionId: string): ConnectionSchema | undefined;
  set(connectionId: string, schema: ConnectionSchema): void;
  invalidate(connectionId: string): void;
  clear(): void;
  size(): number;
}

// Query builder for metadata extraction
export interface MetadataQuery {
  getTables(schema?: string): string;
  getViews(schema?: string): string;
  getColumns(table: string, schema?: string): string;
  getIndexes(table: string, schema?: string): string;
  getConstraints(table: string, schema?: string): string;
  getFunctions(schema?: string): string;
  getTriggers(table?: string, schema?: string): string;
  getRowCount(table: string, schema?: string): string;
}

// Database-specific metadata query builders
export interface MySQLMetadataQuery extends MetadataQuery {
  getTableSize(table: string, schema?: string): string;
  getAutoIncrementInfo(table: string, schema?: string): string;
}

export interface PostgreSQLMetadataQuery extends MetadataQuery {
  getSequences(schema?: string): string;
  getEnums(schema?: string): string;
  getTablespaces(): string;
}

export interface SQLiteMetadataQuery extends MetadataQuery {
  getPragmaInfo(table: string): string;
  getForeignKeys(table: string): string;
}
