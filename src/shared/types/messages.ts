// Message types for VSCode extension and WebView communication

export interface BaseMessage {
  type: string
  data?: any
}

// Extension to WebView messages
export interface ConnectionStatusMessage extends BaseMessage {
  type: 'connectionStatus'
  data: {
    connected: boolean
    databases: DatabaseInfo[]
    activeConnection?: ConnectionInfo
  }
}

export interface ConnectionResultMessage extends BaseMessage {
  type: 'connectionResult'
  data: {
    success: boolean
    message: string
    connection?: ConnectionInfo
    error?: string
  }
}

export interface QueryResultMessage extends BaseMessage {
  type: 'queryResult'
  data: {
    success: boolean
    results: QueryResult[]
    error?: string
    executionTime?: number
  }
}

export interface ThemeChangedMessage extends BaseMessage {
  type: 'themeChanged'
  data: {
    kind: 'light' | 'dark'
  }
}

export interface ChangeViewMessage extends BaseMessage {
  type: 'changeView'
  data: {
    viewType: 'dashboard' | 'explorer' | 'datagrid' | 'sql'
  }
}

// WebView to Extension messages
export interface GetConnectionStatusMessage extends BaseMessage {
  type: 'getConnectionStatus'
}

export interface OpenConnectionMessage extends BaseMessage {
  type: 'openConnection'
  data: {
    type: 'mysql' | 'postgresql' | 'sqlite'
    host: string
    port: number
    database: string
    username: string
    password: string
    ssl?: boolean
  }
}

export interface ExecuteQueryMessage extends BaseMessage {
  type: 'executeQuery'
  data: {
    query: string
    connection?: string
  }
}

export interface GetThemeMessage extends BaseMessage {
  type: 'getTheme'
}

export interface ShowInfoMessage extends BaseMessage {
  type: 'showInfo'
  data: {
    message: string
  }
}

export interface ShowErrorMessage extends BaseMessage {
  type: 'showError'
  data: {
    message: string
  }
}

// Data types
export interface DatabaseInfo {
  name: string
  type: 'mysql' | 'postgresql' | 'sqlite'
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
  type: 'mysql' | 'postgresql' | 'sqlite'
  host: string
  port: number
  database: string
  username: string
  isConnected: boolean
  lastConnected?: Date
}

export interface QueryResult {
  columns: string[]
  rows: any[][]
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

export type WebViewMessage =
  | GetConnectionStatusMessage
  | OpenConnectionMessage
  | ExecuteQueryMessage
  | GetThemeMessage
  | ShowInfoMessage
  | ShowErrorMessage