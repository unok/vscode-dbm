// SQL Editor Types

export interface SQLQuery {
  id?: string
  content: string
  createdAt?: Date
  executedAt?: Date
  executionTime?: number
  rowsAffected?: number
}

export interface QueryResult {
  columns: string[]
  rows: Record<string, any>[]
  rowCount: number
  executionTime: number
  query: string
  error?: string
  warnings?: string[]
}

export interface QueryExecutionOptions {
  maxRows?: number
  timeout?: number
  explain?: boolean
  dryRun?: boolean
  format?: "table" | "json" | "csv"
}

// Database Schema Types
export interface DatabaseSchema {
  tables: TableSchema[]
  views: ViewSchema[]
  functions: FunctionSchema[]
  procedures: ProcedureSchema[]
}

export interface TableSchema {
  name: string
  schema: string
  columns: ColumnSchema[]
  indexes?: IndexSchema[]
  constraints?: ConstraintSchema[]
  comment?: string
}

export interface ViewSchema {
  name: string
  schema: string
  definition: string
  columns?: ColumnSchema[]
  comment?: string
}

export interface ColumnSchema {
  name: string
  type: string
  nullable: boolean
  isPrimaryKey: boolean
  isAutoIncrement?: boolean
  defaultValue?: any
  maxLength?: number
  precision?: number
  scale?: number
  comment?: string
}

export interface IndexSchema {
  name: string
  columns: string[]
  isUnique: boolean
  isPrimary?: boolean
  type?: string
}

export interface ConstraintSchema {
  name: string
  type: "PRIMARY KEY" | "FOREIGN KEY" | "UNIQUE" | "CHECK"
  columns: string[]
  referencedTable?: string
  referencedColumns?: string[]
  definition?: string
}

export interface FunctionSchema {
  name: string
  schema: string
  parameters: ParameterSchema[]
  returnType: string
  language: string
  definition: string
}

export interface ProcedureSchema {
  name: string
  schema: string
  parameters: ParameterSchema[]
  language: string
  definition: string
}

export interface ParameterSchema {
  name: string
  type: string
  mode: "IN" | "OUT" | "INOUT"
  defaultValue?: any
}

// Autocompletion Types
export interface CompletionItem {
  label: string
  kind: CompletionItemKind
  detail?: string
  documentation?: string
  insertText?: string
  insertTextRules?: CompletionInsertTextRule
  range?: CompletionRange
  sortText?: string
  filterText?: string
  additionalTextEdits?: TextEdit[]
}

export enum CompletionItemKind {
  Text = "text",
  Method = "method",
  Function = "function",
  Constructor = "constructor",
  Field = "field",
  Variable = "variable",
  Class = "class",
  Interface = "interface",
  Module = "module",
  Property = "property",
  Unit = "unit",
  Value = "value",
  Enum = "enum",
  Keyword = "keyword",
  Snippet = "snippet",
  Color = "color",
  File = "file",
  Reference = "reference",
  Folder = "folder",
  EnumMember = "enumMember",
  Constant = "constant",
  Struct = "struct",
  Event = "event",
  Operator = "operator",
  TypeParameter = "typeParameter",
  Table = "table",
  Column = "column",
  Database = "database",
  Schema = "schema",
}

export enum CompletionInsertTextRule {
  None = "none",
  KeepWhitespace = "keepWhitespace",
  InsertAsSnippet = "insertAsSnippet",
}

export interface CompletionRange {
  startLineNumber: number
  startColumn: number
  endLineNumber: number
  endColumn: number
}

export interface TextEdit {
  range: CompletionRange
  text: string
}

export interface Position {
  line: number
  column: number
}

// Validation Types
export interface ValidationError {
  type: "syntax" | "schema" | "security" | "performance"
  message: string
  line?: number
  column?: number
  length?: number
  severity: "error" | "warning" | "info"
  code?: string
  quickFix?: QuickFix
}

export interface QuickFix {
  title: string
  edits: TextEdit[]
}

// Query History and Bookmarks
export interface QueryHistoryItem {
  id: string
  query: string
  executedAt: Date
  executionTime?: number
  rowsAffected?: number
  success: boolean
  error?: string
}

export interface QueryBookmark {
  id: string
  name: string
  query: string
  description?: string
  tags: string[]
  createdAt: Date
  updatedAt?: Date
}

// Execution Plan Types
export interface ExecutionPlan {
  query: string
  plan: ExecutionPlanNode[]
  totalCost: number
  estimatedRows: number
  actualRows?: number
  executionTime?: number
}

export interface ExecutionPlanNode {
  nodeType: string
  relation?: string
  alias?: string
  indexName?: string
  joinType?: string
  cost: {
    startup: number
    total: number
  }
  rows: number
  width: number
  actualRows?: number
  actualTime?: {
    startup: number
    total: number
  }
  children?: ExecutionPlanNode[]
  condition?: string
  output?: string[]
}

// SQL Formatting Types
export interface SQLFormatOptions {
  keywordCase: "upper" | "lower" | "capitalize"
  identifierCase: "upper" | "lower" | "preserve"
  indentSize: number
  indentType: "spaces" | "tabs"
  lineLength: number
  commaPosition: "before" | "after"
  insertSpaces: boolean
  preserveComments: boolean
  alignColumnDefinitions: boolean
  alignJoinConditions: boolean
}

// SQL Language Server Types
export interface SQLLanguageServerCapabilities {
  completionProvider: boolean
  hoverProvider: boolean
  signatureHelpProvider: boolean
  definitionProvider: boolean
  referencesProvider: boolean
  documentFormattingProvider: boolean
  documentRangeFormattingProvider: boolean
  documentSymbolProvider: boolean
  workspaceSymbolProvider: boolean
  renameProvider: boolean
  foldingRangeProvider: boolean
  selectionRangeProvider: boolean
  semanticTokensProvider: boolean
}

export interface HoverInfo {
  contents: string[]
  range?: CompletionRange
}

export interface SignatureHelp {
  signatures: SignatureInformation[]
  activeSignature: number
  activeParameter: number
}

export interface SignatureInformation {
  label: string
  documentation?: string
  parameters: ParameterInformation[]
}

export interface ParameterInformation {
  label: string
  documentation?: string
}

export interface Definition {
  uri: string
  range: CompletionRange
}

export interface DocumentSymbol {
  name: string
  detail?: string
  kind: CompletionItemKind
  range: CompletionRange
  selectionRange: CompletionRange
  children?: DocumentSymbol[]
}

// Export and Import Types
export interface ExportOptions {
  format: "csv" | "json" | "xlsx" | "sql" | "xml"
  includeHeaders: boolean
  delimiter?: string
  quote?: string
  escape?: string
  encoding?: string
  compression?: boolean
  fileName?: string
}

export interface ImportOptions {
  format: "csv" | "json" | "xlsx" | "sql"
  hasHeaders: boolean
  delimiter?: string
  quote?: string
  escape?: string
  encoding?: string
  tableName?: string
  schema?: string
  truncateFirst?: boolean
  onConflict?: "ignore" | "replace" | "update"
}

// Connection Types
export interface DatabaseConnection {
  id: string
  name: string
  type: "mysql" | "postgresql" | "sqlite" | "mssql" | "oracle"
  host?: string
  port?: number
  database: string
  username?: string
  password?: string
  ssl?: boolean
  connectionString?: string
  options?: Record<string, any>
}

// Query Execution Context
export interface QueryExecutionContext {
  connection: DatabaseConnection
  database?: string
  schema?: string
  transaction?: boolean
  autoCommit?: boolean
  isolation?: "READ_UNCOMMITTED" | "READ_COMMITTED" | "REPEATABLE_READ" | "SERIALIZABLE"
}

// SQL Dialect Types
export interface SQLDialect {
  name: string
  keywords: string[]
  functions: string[]
  datatypes: string[]
  operators: string[]
  quotingStyle: {
    identifier: string
    string: string
  }
  features: {
    cte: boolean
    windowFunctions: boolean
    jsonSupport: boolean
    arraySupport: boolean
    uuidSupport: boolean
  }
}

// Performance Monitoring
export interface QueryPerformanceMetrics {
  queryId: string
  executionTime: number
  planningTime?: number
  rows: number
  bufferHits?: number
  bufferReads?: number
  tempFileWrites?: number
  memoryUsage?: number
  cpuTime?: number
  ioTime?: number
}

// SQL Editor State
export interface SQLEditorState {
  content: string
  selection: {
    startLine: number
    startColumn: number
    endLine: number
    endColumn: number
  }
  scrollPosition: {
    top: number
    left: number
  }
  undoStack: string[]
  redoStack: string[]
  isDirty: boolean
  isExecuting: boolean
  lastResult?: QueryResult
  activeConnection?: DatabaseConnection
}

// SQL Editor Configuration
export interface SQLEditorConfig {
  theme: "vs" | "vs-dark" | "hc-black"
  fontSize: number
  fontFamily: string
  tabSize: number
  insertSpaces: boolean
  wordWrap: "on" | "off" | "wordWrapColumn" | "bounded"
  wordWrapColumn: number
  lineNumbers: "on" | "off" | "relative" | "interval"
  minimap: boolean
  folding: boolean
  autoClosingBrackets: "always" | "languageDefined" | "beforeWhitespace" | "never"
  autoClosingQuotes: "always" | "languageDefined" | "beforeWhitespace" | "never"
  formatOnSave: boolean
  formatOnType: boolean
  autoSave: "off" | "afterDelay" | "onFocusChange" | "onWindowChange"
  autoSaveDelay: number
  quickSuggestions: boolean
  quickSuggestionsDelay: number
  parameterHints: boolean
  wordBasedSuggestions: boolean
  showUnused: boolean
  showDeprecated: boolean
}

// SQL Snippets
export interface SQLSnippet {
  name: string
  prefix: string
  body: string[]
  description: string
  scope?: string
}

// Debugger Types
export interface SQLDebugger {
  isDebugging: boolean
  breakpoints: SQLBreakpoint[]
  currentLine?: number
  variables: Record<string, any>
  callStack: SQLStackFrame[]
}

export interface SQLBreakpoint {
  line: number
  condition?: string
  hitCondition?: string
  logMessage?: string
  enabled: boolean
}

export interface SQLStackFrame {
  name: string
  line: number
  column: number
  source: string
}

// Code Lens Types
export interface SQLCodeLens {
  range: CompletionRange
  command: SQLCommand
  isResolved: boolean
}

export interface SQLCommand {
  title: string
  command: string
  arguments?: any[]
}

// Semantic Tokens
export interface SemanticTokensLegend {
  tokenTypes: string[]
  tokenModifiers: string[]
}

export interface SemanticTokens {
  resultId?: string
  data: number[]
}

// Error Recovery
export interface ErrorRecoveryState {
  errors: ValidationError[]
  suggestions: CompletionItem[]
  canRecover: boolean
  recoveryActions: QuickFix[]
}

// SQL Test Types
export interface SQLTestCase {
  name: string
  setup?: string[]
  query: string
  expectedResult?: {
    columns: string[]
    rows: Record<string, any>[]
    rowCount?: number
  }
  expectedError?: {
    code?: string
    message?: string
  }
  cleanup?: string[]
}

export interface SQLTestSuite {
  name: string
  description?: string
  setup?: string[]
  tests: SQLTestCase[]
  cleanup?: string[]
}
