import {
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import type React from "react"
import { startTransition, useCallback, useEffect, useMemo, useState } from "react"
import { DataGridService } from "../../shared/services/DataGridService"
import type {
  CellValue,
  ColumnDefinition,
  DataGridColumn,
  DataGridConfig,
  EditableCell,
  TableData,
} from "../../shared/types/datagrid"
import { UUIDGenerator } from "../../shared/utils/UUIDGenerator"
import { useVSCodeAPI } from "../api/vscode"

interface DataGridProps {
  tableName?: string
  initialData?: TableData
  config?: Partial<DataGridConfig>
  onDataChange?: (data: TableData) => void
  onError?: (error: string) => void
}

const defaultConfig: DataGridConfig = {
  enableSorting: true,
  enableFiltering: true,
  enablePagination: true,
  enableSelection: true,
  enableEditing: true,
  enableVirtualization: false,
  pageSize: 50,
  maxPageSize: 500,
  allowAddRows: true,
  allowDeleteRows: true,
  allowBulkOperations: true,
  autoSave: false,
  autoSaveDelay: 1000,
}

const DataGrid: React.FC<DataGridProps> = ({
  tableName,
  initialData,
  config = {},
  onDataChange,
  onError,
}) => {
  // State management
  const [tableData, setTableData] = useState<TableData | null>(initialData || null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; columnId: string } | null>(
    null
  )
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState("")
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: config.pageSize || defaultConfig.pageSize,
  })

  // Services
  const dataGridService = useMemo(() => new DataGridService(), [])
  const _uuidGenerator = useMemo(() => new UUIDGenerator(), [])
  const vscodeApi = useVSCodeAPI()
  const finalConfig = useMemo(() => ({ ...defaultConfig, ...config }), [config])

  // Load data effect
  useEffect(() => {
    if (tableName && !initialData) {
      loadTableData()
    }
  }, [tableName, initialData])

  // Load table data
  const loadTableData = useCallback(async () => {
    if (!tableName) return

    setIsLoading(true)
    setError(null)

    try {
      const data = await dataGridService.loadTableData(tableName, {
        offset: pagination.pageIndex * pagination.pageSize,
        limit: pagination.pageSize,
      })

      startTransition(() => {
        setTableData(data)
        onDataChange?.(data)
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load table data"
      setError(errorMessage)
      onError?.(errorMessage)
      vscodeApi.showError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [
    tableName,
    pagination.pageIndex,
    pagination.pageSize,
    dataGridService,
    onDataChange,
    onError,
    vscodeApi,
  ])

  // Process columns for TanStack Table
  const columns = useMemo<ColumnDef<Record<string, CellValue>>[]>(() => {
    if (!tableData) return []

    return dataGridService
      .processColumnDefinitions(tableData.columns)
      .map((col): ColumnDef<Record<string, CellValue>> => {
        const columnId = col.id || `col_${Math.random().toString(36).substr(2, 9)}`
        return {
          id: columnId,
          accessorKey: columnId,
          cell: ({ getValue, row }) => (
            <DataGridCell
              value={getValue() as CellValue}
              row={row.original}
              column={{
                id: columnId,
                name: col.meta?.columnDef.name || columnId,
                type: col.meta?.columnDef.type || "text",
                nullable: col.meta?.columnDef.nullable || false,
                isPrimaryKey: col.meta?.columnDef.isPrimaryKey || false,
                isAutoIncrement: col.meta?.columnDef.isAutoIncrement || false,
              }}
              rowIndex={row.index}
              isEditing={editingCell?.rowIndex === row.index && editingCell?.columnId === columnId}
              onEdit={handleCellEdit}
              onCommit={handleCellCommit}
              onCancel={handleCellCancel}
            />
          ),
          header: () => (
            <DataGridHeader
              column={{
                id: columnId,
                name: col.meta?.columnDef.name || columnId,
                type: col.meta?.columnDef.type || "text",
                nullable: col.meta?.columnDef.nullable || false,
                isPrimaryKey: col.meta?.columnDef.isPrimaryKey || false,
                isAutoIncrement: col.meta?.columnDef.isAutoIncrement || false,
              }}
              sorting={sorting}
              onSort={finalConfig.enableSorting ? handleSort : undefined}
              onFilter={finalConfig.enableFiltering ? handleFilter : undefined}
            />
          ),
          meta: col.meta,
        }
      })
  }, [tableData, editingCell, sorting, finalConfig, dataGridService])

  // TanStack Table instance
  const table = useReactTable({
    data: tableData?.rows || [],
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: finalConfig.enableSorting ? getSortedRowModel() : undefined,
    getFilteredRowModel: finalConfig.enableFiltering ? getFilteredRowModel() : undefined,
    getPaginationRowModel: finalConfig.enablePagination ? getPaginationRowModel() : undefined,
    pageCount: tableData ? Math.ceil(tableData.totalRows / pagination.pageSize) : 0,
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
  })

  // Event handlers
  const handleCellEdit = useCallback(
    (rowIndex: number, columnId: string) => {
      if (!finalConfig.enableEditing) return
      setEditingCell({ rowIndex, columnId })
    },
    [finalConfig.enableEditing]
  )

  const handleCellCommit = useCallback(
    (rowIndex: number, columnId: string, newValue: CellValue) => {
      try {
        dataGridService.updateCellValue(rowIndex, columnId, newValue)
        setEditingCell(null)

        // Trigger re-render
        setTableData((prev) => (prev ? { ...prev } : null))

        if (finalConfig.autoSave) {
          setTimeout(() => {
            handleSaveChanges()
          }, finalConfig.autoSaveDelay)
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to update cell"
        vscodeApi.showError(errorMessage)
      }
    },
    [dataGridService, finalConfig.autoSave, finalConfig.autoSaveDelay, vscodeApi]
  )

  const handleCellCancel = useCallback(() => {
    setEditingCell(null)
  }, [])

  const handleSort = useCallback((columnId: string) => {
    setSorting((prev) => {
      const existing = prev.find((s) => s.id === columnId)
      if (!existing) {
        return [{ id: columnId, desc: false }]
      }
      if (!existing.desc) {
        return [{ id: columnId, desc: true }]
      }
      return prev.filter((s) => s.id !== columnId)
    })
  }, [])

  const handleFilter = useCallback((columnId: string, value: string) => {
    setColumnFilters((prev) => {
      const filtered = prev.filter((f) => f.id !== columnId)
      if (value) {
        filtered.push({ id: columnId, value })
      }
      return filtered
    })
  }, [])

  const handleAddRow = useCallback(() => {
    if (!finalConfig.allowAddRows) return

    try {
      const newRow = dataGridService.addNewRow()
      setTableData((prev) => {
        if (!prev) return null
        return {
          ...prev,
          rows: [...prev.rows, newRow],
        }
      })
      vscodeApi.showInfo("New row added")
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to add row"
      vscodeApi.showError(errorMessage)
    }
  }, [dataGridService, finalConfig.allowAddRows, vscodeApi])

  const handleDeleteRow = useCallback(
    (rowIndex: number) => {
      if (!finalConfig.allowDeleteRows) return

      try {
        dataGridService.deleteRow(rowIndex)
        setTableData((prev) => {
          if (!prev) return null
          return {
            ...prev,
            rows: prev.rows.filter((_, index) => index !== rowIndex),
          }
        })
        vscodeApi.showInfo("Row marked for deletion")
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to delete row"
        vscodeApi.showError(errorMessage)
      }
    },
    [dataGridService, finalConfig.allowDeleteRows, vscodeApi]
  )

  const handleSaveChanges = useCallback(async () => {
    try {
      setIsLoading(true)
      await dataGridService.commitChanges()
      vscodeApi.showInfo("Changes saved successfully")
      await loadTableData() // Reload to get fresh data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save changes"
      vscodeApi.showError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [dataGridService, vscodeApi, loadTableData])

  const handleRollbackChanges = useCallback(() => {
    dataGridService.rollbackChanges()
    setEditingCell(null)
    vscodeApi.showInfo("Changes rolled back")
    loadTableData()
  }, [dataGridService, vscodeApi, loadTableData])

  const handleRefresh = useCallback(() => {
    loadTableData()
  }, [loadTableData])

  // Render loading state
  if (isLoading && !tableData) {
    return (
      <div className='data-grid-loading'>
        <div className='flex items-center justify-center p-8'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mr-3' />
          <span>Loading table data...</span>
        </div>
      </div>
    )
  }

  // Render error state
  if (error && !tableData) {
    return (
      <div className='data-grid-error'>
        <div className='p-8 text-center'>
          <div className='text-red-400 mb-4'>Error: {error}</div>
          <button type='button' onClick={handleRefresh} className='btn-primary'>
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Render empty state
  if (!tableData || tableData.rows.length === 0) {
    return (
      <div className='data-grid-empty'>
        <div className='p-8 text-center'>
          <div className='text-gray-400 mb-4'>No data available</div>
          {finalConfig.allowAddRows && (
            <button type='button' onClick={handleAddRow} className='btn-primary'>
              Add First Row
            </button>
          )}
        </div>
      </div>
    )
  }

  const hasChanges =
    dataGridService.getDirtyCells().length > 0 ||
    dataGridService.getAddedRows().length > 0 ||
    dataGridService.getDeletedRows().length > 0

  return (
    <div className='data-grid h-full flex flex-col'>
      {/* Toolbar */}
      <DataGridToolbar
        tableName={tableData.tableName}
        rowCount={tableData.totalRows}
        hasChanges={hasChanges}
        onAddRow={finalConfig.allowAddRows ? handleAddRow : undefined}
        onSave={handleSaveChanges}
        onRollback={handleRollbackChanges}
        onRefresh={handleRefresh}
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        isLoading={isLoading}
      />

      {/* Table */}
      <div className='data-grid-table-container flex-1 overflow-auto'>
        <table className='data-grid-table w-full'>
          <thead className='data-grid-header'>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className='data-grid-header-cell'
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
                {finalConfig.allowDeleteRows && (
                  <th className='data-grid-header-cell w-10'>Actions</th>
                )}
              </tr>
            ))}
          </thead>
          <tbody className='data-grid-body'>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className='data-grid-row'>
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className='data-grid-cell'
                    style={{ width: cell.column.getSize() }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
                {finalConfig.allowDeleteRows && (
                  <td className='data-grid-cell w-10'>
                    <button
                      type='button'
                      onClick={() => handleDeleteRow(row.index)}
                      className='text-red-400 hover:text-red-300 p-1'
                      title='Delete row'
                    >
                      <DeleteIcon />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {finalConfig.enablePagination && (
        <DataGridPagination
          table={table}
          pagination={pagination}
          totalRows={tableData.totalRows}
          isLoading={isLoading}
        />
      )}
    </div>
  )
}

// Sub-components will be defined in separate files
interface DataGridCellProps {
  value: CellValue
  row: Record<string, CellValue>
  column: ColumnDefinition
  rowIndex: number
  isEditing: boolean
  onEdit: (rowIndex: number, columnId: string) => void
  onCommit: (rowIndex: number, columnId: string, value: CellValue) => void
  onCancel: () => void
}

const DataGridCell: React.FC<DataGridCellProps> = ({
  value,
  row: _row,
  isEditing,
  onEdit,
  onCommit,
  onCancel,
  rowIndex,
  column,
}) => {
  const [editValue, setEditValue] = useState(value)

  useEffect(() => {
    setEditValue(value)
  }, [value])

  const handleDoubleClick = () => {
    onEdit(rowIndex, column.id)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onCommit(rowIndex, column.id, editValue)
    } else if (e.key === "Escape") {
      onCancel()
    }
  }

  if (isEditing) {
    return (
      <input
        type='text'
        value={String(editValue || "")}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={() => onCommit(rowIndex, column.id, editValue)}
        onKeyDown={handleKeyDown}
        className='data-grid-cell-input'
      />
    )
  }

  return (
    <div className='data-grid-cell-content editable' onDoubleClick={handleDoubleClick}>
      {value === null ? <span className='text-gray-400'>NULL</span> : String(value)}
    </div>
  )
}

interface DataGridHeaderProps {
  column: ColumnDefinition
  sorting: SortingState
  onSort?: (columnId: string) => void
  onFilter?: (columnId: string, value: string) => void
}

const DataGridHeader: React.FC<DataGridHeaderProps> = ({ column, sorting, onSort }) => {
  const sortState = sorting.find((s) => s.id === column.id)

  return (
    <div className='data-grid-header-content'>
      <div
        className={`data-grid-header-label ${onSort ? "sortable" : ""}`}
        onClick={() => onSort?.(column.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onSort?.(column.id)
          }
        }}
        tabIndex={onSort ? 0 : -1}
        role={onSort ? "button" : undefined}
      >
        {column.name}
        {sortState && <span className='ml-1'>{sortState.desc ? "↓" : "↑"}</span>}
      </div>
      {column.isPrimaryKey && (
        <span className='data-grid-primary-key-indicator' title='Primary Key'>
          🔑
        </span>
      )}
    </div>
  )
}

interface DataGridToolbarProps {
  tableName: string
  rowCount: number
  hasChanges: boolean
  onAddRow?: () => void
  onSave: () => void
  onRollback: () => void
  onRefresh: () => void
  globalFilter: string
  onGlobalFilterChange: (value: string) => void
  isLoading: boolean
}

const DataGridToolbar: React.FC<DataGridToolbarProps> = ({
  tableName,
  rowCount,
  hasChanges,
  onAddRow,
  onSave,
  onRollback,
  onRefresh,
  globalFilter,
  onGlobalFilterChange,
  isLoading,
}) => {
  return (
    <div className='data-grid-toolbar flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800'>
      <div className='flex items-center gap-4'>
        <h3 className='font-semibold text-white'>
          {tableName} ({rowCount} rows)
        </h3>
        {hasChanges && <span className='text-yellow-400 text-sm'>● Unsaved changes</span>}
      </div>

      <div className='flex items-center gap-2'>
        <input
          type='text'
          placeholder='Search all columns...'
          value={globalFilter}
          onChange={(e) => onGlobalFilterChange(e.target.value)}
          className='input-field text-sm w-48'
        />

        {onAddRow && (
          <button
            type='button'
            onClick={onAddRow}
            className='btn-primary text-sm'
            disabled={isLoading}
          >
            Add Row
          </button>
        )}

        <button
          type='button'
          onClick={onRefresh}
          className='btn-secondary text-sm'
          disabled={isLoading}
        >
          Refresh
        </button>

        {hasChanges && (
          <>
            <button
              type='button'
              onClick={onSave}
              className='btn-primary text-sm'
              disabled={isLoading}
            >
              Save
            </button>
            <button
              type='button'
              onClick={onRollback}
              className='btn-secondary text-sm'
              disabled={isLoading}
            >
              Rollback
            </button>
          </>
        )}
      </div>
    </div>
  )
}

interface DataGridPaginationProps {
  table: ReturnType<typeof useReactTable<Record<string, CellValue>>>
  pagination: PaginationState
  totalRows: number
  isLoading: boolean
}

const DataGridPagination: React.FC<DataGridPaginationProps> = ({
  table,
  pagination,
  totalRows,
  isLoading,
}) => {
  const totalPages = Math.ceil(totalRows / pagination.pageSize)

  return (
    <div className='data-grid-pagination flex items-center justify-between p-4 border-t border-gray-700 bg-gray-800'>
      <div className='text-sm text-gray-400'>
        Showing {pagination.pageIndex * pagination.pageSize + 1} to{" "}
        {Math.min((pagination.pageIndex + 1) * pagination.pageSize, totalRows)} of {totalRows} rows
      </div>

      <div className='flex items-center gap-2'>
        <button
          type='button'
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage() || isLoading}
          className='btn-secondary text-sm'
        >
          First
        </button>
        <button
          type='button'
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage() || isLoading}
          className='btn-secondary text-sm'
        >
          Previous
        </button>

        <span className='text-sm text-gray-400'>
          Page {pagination.pageIndex + 1} of {totalPages}
        </span>

        <button
          type='button'
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage() || isLoading}
          className='btn-secondary text-sm'
        >
          Next
        </button>
        <button
          type='button'
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          disabled={!table.getCanNextPage() || isLoading}
          className='btn-secondary text-sm'
        >
          Last
        </button>
      </div>
    </div>
  )
}

const DeleteIcon: React.FC = () => (
  <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20'>
    <path
      fillRule='evenodd'
      d='M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z'
      clipRule='evenodd'
    />
  </svg>
)

export default DataGrid
