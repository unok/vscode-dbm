// 共有型定義

export interface DatabaseConfig {
  id: string;
  name: string;
  type: "mysql" | "postgresql" | "sqlite";
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database: string;
  ssl?: boolean | object;
}

export interface TableSchema {
  name: string;
  columns: ColumnSchema[];
  primaryKeys: string[];
  foreignKeys: ForeignKeySchema[];
  indexes: IndexSchema[];
}

export interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isUnique: boolean;
  autoIncrement: boolean;
}

export interface ForeignKeySchema {
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
  onUpdate: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
  onDelete: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
}

export interface IndexSchema {
  name: string;
  columns: string[];
  unique: boolean;
  type: "BTREE" | "HASH" | "FULLTEXT" | "SPATIAL";
}

export interface QueryResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTime: number;
  error?: string;
}

export interface ConnectionStatus {
  connected: boolean;
  lastConnected?: Date;
  error?: string;
}

export interface DatabaseDriver {
  connect(timeout?: number): Promise<void>;
  disconnect(): Promise<void>;
  query(sql: string, params?: unknown[]): Promise<QueryResult>;
  isConnected(): boolean;
  getConnectionInfo(): DatabaseConfig;
  getConnectionStatus(): ConnectionStatus;
  getDatabases?(): Promise<string[]>;
  getSchemas?(): Promise<string[]>;
  getTables(): Promise<{ name: string; type: string }[]>;
  getViews?(): Promise<{ name: string; type: string }[]>;
  getTableSchema(tableName: string): Promise<TableSchema>;
  getTableIndexes?(tableName: string): Promise<IndexSchema[]>;
}
