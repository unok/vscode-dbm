import type { ColumnDef, SortingState, ColumnFiltersState, PaginationState } from '@tanstack/react-table'

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
export interface DataGridColumn extends ColumnDef<Record<string, CellValue>, CellValue> {
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
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'time'
  | 'email'
  | 'url'
  | 'uuid'
  | 'json'
  | 'enum'

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
  type: 'insert' | 'update' | 'delete'
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
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'isNull'
  | 'isNotNull'

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
  selectionMode: 'row' | 'cell' | 'column'
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
  type: 'required' | 'minLength' | 'maxLength' | 'pattern' | 'custom'
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
  format: 'csv' | 'json' | 'xlsx' | 'sql'
  includeHeaders: boolean
  selectedRowsOnly: boolean
  fileName?: string
  compression?: boolean
}

// Import options
export interface ImportOptions {
  format: 'csv' | 'json' | 'xlsx'
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
  type: 'cell' | 'row' | 'column' | 'header'
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