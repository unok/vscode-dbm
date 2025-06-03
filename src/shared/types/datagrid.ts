import type {
  ColumnDef,
  ColumnFiltersState,
  PaginationState,
  SortingState,
} from "@tanstack/react-table"

// Core data types
export interface TableData {
  tableName: string
  columns: ColumnDefinition[]
  rows: Record<string, CellValue>[]
  totalRows: number
  offset: number
  limit: number
  hasNextPage?: boolean
  hasPreviousPage?: boolean
}

export interface ColumnDefinition {
  id: string
  name: string
  type: string
  nullable: boolean
  isPrimaryKey: boolean
  isAutoIncrement: boolean
  maxLength?: number
  defaultValue?: CellValue
  foreignKeyTarget?: {
    table: string
    column: string
  }
  comment?: string
}

export type CellValue = string | number | boolean | Date | null | undefined

// Enhanced column definition for TanStack Table
export interface DataGridColumn {
  id?: string
  accessorKey?: string
  header?: string | ((props: any) => any)
  cell?: (props: any) => any
  meta?: {
    columnDef: ColumnDefinition
    cellType: CellType
    editable: boolean
    sortable: boolean
    filterable: boolean
    width?: number
    minWidth?: number
    maxWidth?: number
    isPrimaryKey: boolean
    nullable: boolean
  }
}

export type CellType =
  | "text"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "time"
  | "email"
  | "url"
  | "uuid"
  | "json"
  | "enum"

// Cell editing types
export interface EditableCell {
  rowIndex: number
  columnId: string
  originalValue: CellValue
  editedValue: CellValue
  isDirty: boolean
  isValid: boolean
  validationError?: string
}

export interface CellEditInfo {
  isEditing: boolean
  editedValue: CellValue
  originalValue: CellValue
}

// Row operations
export interface RowOperation {
  type: "insert" | "update" | "delete"
  rowIndex: number
  data: Record<string, CellValue>
  originalData?: Record<string, CellValue>
}

export interface AddedRow {
  tempId: string
  data: Record<string, CellValue>
  index: number
}

export interface DeletedRow {
  originalIndex: number
  data: Record<string, CellValue>
  primaryKeyValue: CellValue
}

// Filtering and sorting
export interface DataGridFilter {
  id: string
  value: unknown
  operator?: FilterOperator
}

export type FilterOperator =
  | "equals"
  | "notEquals"
  | "contains"
  | "notContains"
  | "startsWith"
  | "endsWith"
  | "greaterThan"
  | "lessThan"
  | "greaterThanOrEqual"
  | "lessThanOrEqual"
  | "isEmpty"
  | "isNotEmpty"
  | "isNull"
  | "isNotNull"

export interface DataGridSort {
  id: string
  desc: boolean
}

// Pagination
export interface PaginationOptions {
  offset: number
  limit: number
}

export interface PaginationInfo {
  currentPage: number
  pageSize: number
  totalPages: number
  totalRows: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

// Selection
export interface SelectionState {
  selectedRows: Set<number>
  selectedCells: Set<string> // Format: "rowIndex:columnId"
  selectionMode: "row" | "cell" | "column"
}

// Data grid state
export interface DataGridState {
  data: TableData
  editableCells: Map<string, EditableCell>
  addedRows: AddedRow[]
  deletedRows: DeletedRow[]
  sorting: SortingState
  columnFilters: ColumnFiltersState
  globalFilter: string
  pagination: PaginationState
  selection: SelectionState
  isLoading: boolean
  error?: string
}

// Configuration
export interface DataGridConfig {
  enableSorting: boolean
  enableFiltering: boolean
  enablePagination: boolean
  enableSelection: boolean
  enableEditing: boolean
  enableVirtualization: boolean
  pageSize: number
  maxPageSize: number
  allowAddRows: boolean
  allowDeleteRows: boolean
  allowBulkOperations: boolean
  autoSave: boolean
  autoSaveDelay: number
}

// Events
export interface CellEditEvent {
  rowIndex: number
  columnId: string
  oldValue: CellValue
  newValue: CellValue
  column: ColumnDefinition
}

export interface RowAddEvent {
  row: Record<string, CellValue>
  index: number
}

export interface RowDeleteEvent {
  rowIndex: number
  row: Record<string, CellValue>
}

export interface DataCommitEvent {
  operations: RowOperation[]
  sqlStatements: string[]
}

// Validation
export interface ValidationRule {
  type: "required" | "minLength" | "maxLength" | "pattern" | "custom"
  value?: any
  message: string
  validator?: (value: CellValue, row: Record<string, CellValue>) => boolean
}

export interface ColumnValidation {
  columnId: string
  rules: ValidationRule[]
}

// UUID generation
export interface UUIDOptions {
  version: 1 | 4 | 6 | 7
  prefix?: string
  suffix?: string
}

// Cell renderer props
export interface CellRendererProps {
  value: CellValue
  row: Record<string, CellValue>
  column: DataGridColumn
  isEditing: boolean
  onChange?: (value: CellValue) => void
  onCommit?: () => void
  onCancel?: () => void
}

// Advanced features
export interface DataGridFeatures {
  virtualScrolling: boolean
  infiniteScrolling: boolean
  columnResizing: boolean
  columnReordering: boolean
  columnPinning: boolean
  rowGrouping: boolean
  aggregation: boolean
  export: boolean
  print: boolean
}

// Export options
export interface ExportOptions {
  format: "csv" | "json" | "xlsx" | "sql"
  includeHeaders: boolean
  selectedRowsOnly: boolean
  fileName?: string
  compression?: boolean
}

// Import options
export interface ImportOptions {
  format: "csv" | "json" | "xlsx"
  hasHeaders: boolean
  delimiter?: string
  encoding?: string
  onProgress?: (progress: number) => void
  onError?: (error: string) => void
}

// Performance monitoring
export interface PerformanceMetrics {
  renderTime: number
  dataLoadTime: number
  scrollPerformance: number
  memoryUsage: number
  operationsPerSecond: number
}

// Context menu
export interface ContextMenuAction {
  id: string
  label: string
  icon?: React.ReactNode
  shortcut?: string
  disabled?: boolean
  separator?: boolean
  children?: ContextMenuAction[]
  handler: (context: ContextMenuContext) => void
}

export interface ContextMenuContext {
  type: "cell" | "row" | "column" | "header"
  rowIndex?: number
  columnId?: string
  value?: CellValue
  selectedRows?: number[]
  selectedCells?: string[]
}

// Keyboard shortcuts
export interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  metaKey?: boolean
  action: string
  handler: (event: KeyboardEvent) => void
}

// Theme and styling
export interface DataGridTheme {
  colors: {
    background: string
    foreground: string
    border: string
    hover: string
    selected: string
    edited: string
    error: string
    header: string
  }
  fonts: {
    family: string
    size: string
    weight: string
  }
  spacing: {
    cellPadding: string
    rowHeight: string
    headerHeight: string
  }
}

// Advanced DataGrid types (missing exports)
export interface BulkEditOperation {
  type: 'update' | 'delete'
  columnId?: string
  value?: CellValue
  valueFunction?: (row: Record<string, CellValue>, index?: number) => CellValue
  rowIndices: number[]
  condition?: (row: Record<string, CellValue>) => boolean
}

export interface BulkOperationPreview {
  willAffect: number
  changes: Array<{
    rowIndex: number
    columnId: string
    currentValue: CellValue
    newValue: CellValue
  }>
}

export interface BulkOperationResult {
  success: boolean
  affectedRows: number
  validationErrors?: string[]
  error?: string
}

export interface CellEditResult {
  success: boolean
  error?: string
  validationErrors?: string[]
  cellState?: CellState
}

export interface CellState {
  isEditing: boolean
  isDirty: boolean
  isValid: boolean
  originalValue: CellValue
  editedValue?: CellValue
  validationResult?: ValidationResult
  changeType?: 'none' | 'modified' | 'added'
  visualIndicator?: string
  customIndicator?: string
  customMessage?: string
}

export interface RowState {
  isNew: boolean
  isDeleted: boolean
  hasChanges: boolean
  visualIndicator?: string
}

export interface ChangeRecord {
  modifiedCells: Array<{
    rowIndex: number
    columnId: string
    originalValue: CellValue
    newValue: CellValue
    timestamp: Date
  }>
  addedRows: Array<{
    rowIndex: number
    tempId: string
    data: Record<string, CellValue>
    timestamp: Date
  }>
  deletedRows: Array<{
    originalIndex: number
    data: Record<string, CellValue>
    timestamp: Date
  }>
  affectedRows: Set<number>
  totalChanges: number
  lastModified: Date | null
}

export interface ChangeStatistics {
  totalChanges: number
  modifiedCells: number
  addedRows: number
  deletedRows: number
  affectedRows: number
}

export interface CopyPasteData {
  type: 'single-cell' | 'range' | 'rows'
  data: CellValue[][]
  metadata: {
    columns: string[]
    rows: number
  }
}

export interface PasteOptions {
  conflictResolution?: 'overwrite' | 'skip' | 'merge'
  validateData?: boolean
  preserveFormatting?: boolean
  autoExpandRows?: boolean
  skipValidationErrors?: boolean
}

export interface PasteResult {
  success: boolean
  affectedCells: number
  validationErrors?: string[]
  error?: string
}

export interface CursorAIDefaultOptions {
  context?: string
  existingData?: Record<string, CellValue>[]
  columns?: ColumnDefinition[]
  rowIndex?: number
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings?: string[]
  suggestions?: string[]
}

export interface VirtualScrollConfig {
  enabled: boolean
  itemHeight: number | ((index: number) => number)
  containerHeight: number
  bufferSize: number
  overscan: number
}

// Additional missing types
export interface CellChange {
  rowIndex: number
  columnId: string
  oldValue: CellValue
  newValue: CellValue
  timestamp: Date
}

export interface RowAddition {
  rowIndex: number
  tempId: string
  data: Record<string, CellValue>
  timestamp: Date
  primaryKeyValue?: CellValue
}

export interface RowDeletion {
  originalIndex: number
  data: Record<string, CellValue>
  timestamp: Date
  primaryKeyValue?: CellValue
}

export interface CursorAIPattern {
  pattern: string
  confidence: number
  examples: string[]
}

export interface CursorAISuggestion {
  column: string
  value: CellValue
  confidence: number
  reasoning?: string
}

export interface CursorAITransformation {
  sourceColumn: string
  targetColumn: string
  function: (value: CellValue) => CellValue
  preview: CellValue[]
}

export interface CursorAIValidation {
  issues: string[]
  confidence: number
  suggestions?: string[]
}

export interface EditableCell {
  rowIndex: number
  columnId: string
  originalValue: CellValue
  editedValue: CellValue
  isEditing: boolean
  isDirty: boolean
}

export interface ValidationContext {
  row: Record<string, CellValue>
  rowIndex: number
  columnId: string
  value: CellValue
}
