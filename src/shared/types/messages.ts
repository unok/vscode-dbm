// Message types for VSCode extension and WebView communication

export interface BaseMessage {
  type: string
  data?: unknown
}

// Extension to WebView messages
export interface ConnectionStatusMessage extends BaseMessage {
  type: "connectionStatus"
  data: {
    connected: boolean
    databases: DatabaseInfo[]
    activeConnection?: ConnectionInfo
  }
}

export interface ConnectionResultMessage extends BaseMessage {
  type: "connectionResult"
  data: {
    success: boolean
    message: string
    connection?: ConnectionInfo
    error?: string
  }
}

export interface QueryResultMessage extends BaseMessage {
  type: "queryResult"
  data: {
    success: boolean
    results: QueryResult[]
    error?: string
    executionTime?: number
  }
}

export interface ThemeChangedMessage extends BaseMessage {
  type: "themeChanged"
  data: {
    kind: "light" | "dark"
  }
}

export interface ChangeViewMessage extends BaseMessage {
  type: "changeView"
  data: {
    viewType: "dashboard" | "explorer" | "datagrid" | "sql"
  }
}

// WebView to Extension messages
export interface GetConnectionStatusMessage extends BaseMessage {
  type: "getConnectionStatus"
}

export interface OpenConnectionMessage extends BaseMessage {
  type: "openConnection"
  data: {
    type: "mysql" | "postgresql" | "sqlite"
    host: string
    port: number
    database: string
    username: string
    password: string
    ssl?: boolean
  }
}

export interface ExecuteQueryMessage extends BaseMessage {
  type: "executeQuery"
  data: {
    query: string
    connection?: string
  }
}

export interface GetThemeMessage extends BaseMessage {
  type: "getTheme"
}

export interface ShowInfoMessage extends BaseMessage {
  type: "showInfo"
  data: {
    message: string
  }
}

export interface ShowErrorMessage extends BaseMessage {
  type: "showError"
  data: {
    message: string
  }
}

export interface GetTableDataMessage extends BaseMessage {
  type: "getTableData"
  data: {
    tableName: string
    schema?: string
    limit?: number
    offset?: number
  }
}

export interface GetSchemaMessage extends BaseMessage {
  type: "getSchema"
  data: {
    refresh?: boolean
  }
}

export interface SaveConnectionMessage extends BaseMessage {
  type: "saveConnection"
  data: {
    id: string
    name: string
    type: "mysql" | "postgresql" | "sqlite"
    host: string
    port: number
    database: string
    username: string
    password?: string
    ssl?: boolean
  }
}

export interface TestConnectionMessage extends BaseMessage {
  type: "testConnection"
  data: {
    name: string
    type: "mysql" | "postgresql" | "sqlite"
    host: string
    port: number
    database: string
    username: string
    password?: string
    ssl?: boolean
  }
}

export interface GetDefaultConnectionConfigMessage extends BaseMessage {
  type: "getDefaultConnectionConfig"
}

export interface GetSavedConnectionsMessage extends BaseMessage {
  type: "getSavedConnections"
}

export interface GetActiveConnectionsMessage extends BaseMessage {
  type: "getActiveConnections"
}

export interface DisconnectConnectionMessage extends BaseMessage {
  type: "disconnectConnection"
  data: {
    connectionId: string
  }
}

export interface TableDataMessage extends BaseMessage {
  type: "tableData"
  data: {
    success: boolean
    tableName?: string
    data?: QueryResult
    error?: string
  }
}

export interface SchemaDataMessage extends BaseMessage {
  type: "schemaData"
  data: {
    success: boolean
    schema?: DatabaseInfo
    error?: string
  }
}

export interface ActiveConnectionsMessage extends BaseMessage {
  type: "activeConnections"
  data: {
    connections: Array<{
      id: string
      name: string
      type: string
      config: {
        host: string
        port: number
        database: string
        username: string
      }
      isConnected: boolean
      connectedAt: Date
    }>
  }
}

export interface SavedConnectionsMessage extends BaseMessage {
  type: "savedConnections"
  data: {
    connections: Array<{
      id: string
      name: string
      type: "mysql" | "postgresql" | "sqlite"
      host: string
      port: number
      database: string
      username: string
      ssl?: boolean
    }>
  }
}

// Data types
export interface DatabaseInfo {
  name: string
  type: "mysql" | "postgresql" | "sqlite"
  tables: TableInfo[]
  views: ViewInfo[]
}

export interface TableInfo {
  name: string
  schema?: string
  columns: ColumnInfo[]
  rowCount: number
}

export interface ViewInfo {
  name: string
  schema?: string
  definition: string
}

export interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  defaultValue?: string
  isPrimaryKey: boolean
  isForeignKey: boolean
  foreignKeyTarget?: {
    table: string
    column: string
  }
}

export interface ConnectionInfo {
  id: string
  name: string
  type: "mysql" | "postgresql" | "sqlite"
  host: string
  port: number
  database: string
  username: string
  isConnected: boolean
  lastConnected?: Date
}

export interface QueryResult {
  columns: string[]
  rows: unknown[][]
  affectedRows?: number
  insertId?: number
}

// Union types for message handling
export type ExtensionMessage =
  | ConnectionStatusMessage
  | ConnectionResultMessage
  | QueryResultMessage
  | ThemeChangedMessage
  | ChangeViewMessage
  | TableDataMessage
  | SchemaDataMessage
  | ActiveConnectionsMessage
  | SavedConnectionsMessage

export type WebViewMessage =
  | GetConnectionStatusMessage
  | OpenConnectionMessage
  | ExecuteQueryMessage
  | GetThemeMessage
  | ShowInfoMessage
  | ShowErrorMessage
  | DisconnectConnectionMessage
  | GetTableDataMessage
  | GetSchemaMessage
  | SaveConnectionMessage
  | TestConnectionMessage
  | GetDefaultConnectionConfigMessage
  | GetSavedConnectionsMessage
  | GetActiveConnectionsMessage
