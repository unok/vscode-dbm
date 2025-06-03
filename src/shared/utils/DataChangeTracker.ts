import type {
  TableData,
  CellValue,
  ChangeRecord,
  ChangeStatistics,
  CellChange,
  RowAddition,
  RowDeletion
} from '../types/datagrid'

export interface CellChangeRecord {
  rowIndex: number
  columnId: string
  originalValue: CellValue
  newValue: CellValue
  timestamp: Date
}

export interface RowAdditionRecord {
  rowIndex: number
  tempId: string
  data: Record<string, CellValue>
  timestamp: Date
}

export interface RowDeletionRecord {
  originalIndex: number
  data: Record<string, CellValue>
  primaryKeyValue: CellValue
  timestamp: Date
}

export class DataChangeTracker {
  private originalData: TableData | null = null
  private cellChanges: Map<string, CellChangeRecord> = new Map()
  private rowAdditions: Map<number, RowAdditionRecord> = new Map()
  private rowDeletions: Map<number, RowDeletionRecord> = new Map()
  private nextTempId = 1

  setInitialData(data: TableData): void {
    this.originalData = JSON.parse(JSON.stringify(data)) // Deep clone
    this.clearAll()
  }

  recordCellChange(rowIndex: number, columnId: string, originalValue: CellValue, newValue: CellValue): void {
    const cellKey = `${rowIndex}:${columnId}`
    
    // If reverting to original value, remove the change record
    const original = this.getOriginalCellValue(rowIndex, columnId)
    if (newValue === original) {
      this.cellChanges.delete(cellKey)
      return
    }

    // If there's already a change for this cell, update it but keep the original value
    const existingChange = this.cellChanges.get(cellKey)
    const actualOriginal = existingChange ? existingChange.originalValue : originalValue

    this.cellChanges.set(cellKey, {
      rowIndex,
      columnId,
      originalValue: actualOriginal,
      newValue,
      timestamp: new Date()
    })
  }

  recordRowAddition(rowIndex: number, data: Record<string, CellValue>): void {
    this.rowAdditions.set(rowIndex, {
      rowIndex,
      tempId: `temp_${this.nextTempId++}`,
      data: JSON.parse(JSON.stringify(data)), // Deep clone
      timestamp: new Date()
    })
  }

  recordRowDeletion(rowIndex: number, data: Record<string, CellValue>): void {
    // Get primary key value for tracking
    const primaryKeyColumn = this.originalData?.columns.find(col => col.isPrimaryKey)
    const primaryKeyValue = primaryKeyColumn ? data[primaryKeyColumn.id] : rowIndex

    this.rowDeletions.set(rowIndex, {
      originalIndex: rowIndex,
      data: JSON.parse(JSON.stringify(data)), // Deep clone
      primaryKeyValue,
      timestamp: new Date()
    })
  }

  getChangeRecord(): ChangeRecord {
    const modifiedCells = Array.from(this.cellChanges.values())
    const addedRows = Array.from(this.rowAdditions.values())
    const deletedRows = Array.from(this.rowDeletions.values())
    
    const affectedRows = new Set([
      ...modifiedCells.map(change => change.rowIndex),
      ...addedRows.map(addition => addition.rowIndex),
      ...deletedRows.map(deletion => deletion.originalIndex)
    ])

    return {
      modifiedCells,
      addedRows,
      deletedRows,
      affectedRows,
      totalChanges: modifiedCells.length + addedRows.length + deletedRows.length,
      lastModified: this.getLastModifiedTime()
    }
  }

  getStatistics(): ChangeStatistics {
    const modifiedCells = this.cellChanges.size
    const addedRows = this.rowAdditions.size
    const deletedRows = this.rowDeletions.size
    const totalChanges = modifiedCells + addedRows + deletedRows
    
    const affectedRows = new Set([
      ...Array.from(this.cellChanges.values()).map(change => change.rowIndex),
      ...Array.from(this.rowAdditions.keys()),
      ...Array.from(this.rowDeletions.keys())
    ]).size

    return {
      modifiedCells,
      addedRows,
      deletedRows,
      totalChanges,
      affectedRows
    }
  }

  getCellChange(rowIndex: number, columnId: string): CellChangeRecord | null {
    const cellKey = `${rowIndex}:${columnId}`
    return this.cellChanges.get(cellKey) || null
  }

  getOriginalCellValue(rowIndex: number, columnId: string): CellValue {
    if (!this.originalData || !this.originalData.rows[rowIndex]) {
      return null
    }
    return this.originalData.rows[rowIndex][columnId]
  }

  isNewRow(rowIndex: number): boolean {
    return this.rowAdditions.has(rowIndex)
  }

  isDeletedRow(rowIndex: number): boolean {
    return this.rowDeletions.has(rowIndex)
  }

  hasRowChanges(rowIndex: number): boolean {
    // Check if any cell in this row has been modified
    for (const [cellKey] of this.cellChanges) {
      const [rowIdx] = cellKey.split(':')
      if (parseInt(rowIdx) === rowIndex) {
        return true
      }
    }
    return false
  }

  rollbackAll(): void {
    this.clearAll()
  }

  rollbackCellChange(rowIndex: number, columnId: string): void {
    const cellKey = `${rowIndex}:${columnId}`
    this.cellChanges.delete(cellKey)
  }

  rollbackRowAddition(rowIndex: number): void {
    this.rowAdditions.delete(rowIndex)
  }

  rollbackRowDeletion(rowIndex: number): void {
    this.rowDeletions.delete(rowIndex)
  }

  getOriginalData(): TableData {
    if (!this.originalData) {
      throw new Error('No original data available')
    }
    return JSON.parse(JSON.stringify(this.originalData)) // Deep clone
  }

  /**
   * Get optimized changes - consolidates multiple changes to the same cell
   */
  getOptimizedChanges(): ChangeRecord {
    const changeRecord = this.getChangeRecord()
    
    // The cell changes are already optimized since we only keep the latest change per cell
    // Additional optimizations could be added here if needed
    
    return changeRecord
  }

  /**
   * Generate SQL statements for all changes
   */
  generateSQLStatements(tableName: string): string[] {
    const statements: string[] = []
    const changeRecord = this.getChangeRecord()

    // UPDATE statements for modified cells
    const rowUpdates = new Map<number, Record<string, CellValue>>()
    
    for (const cellChange of changeRecord.modifiedCells) {
      if (!rowUpdates.has(cellChange.rowIndex)) {
        rowUpdates.set(cellChange.rowIndex, {})
      }
      rowUpdates.get(cellChange.rowIndex)![cellChange.columnId] = cellChange.newValue
    }

    for (const [rowIndex, updates] of rowUpdates) {
      if (this.isDeletedRow(rowIndex) || this.isNewRow(rowIndex)) {
        continue // Skip rows that are being deleted or added
      }

      const setPairs = Object.entries(updates)
        .map(([col, val]) => `${col} = ${this.formatSQLValue(val)}`)
        .join(', ')
      
      const primaryKeyColumn = this.originalData?.columns.find(col => col.isPrimaryKey)
      if (primaryKeyColumn) {
        const originalRow = this.originalData?.rows[rowIndex]
        if (originalRow && originalRow[primaryKeyColumn.id] !== undefined) {
          const whereClause = `${primaryKeyColumn.id} = ${this.formatSQLValue(originalRow[primaryKeyColumn.id])}`
          statements.push(`UPDATE ${tableName} SET ${setPairs} WHERE ${whereClause}`)
        }
      }
    }

    // DELETE statements
    for (const deletedRow of changeRecord.deletedRows) {
      const primaryKeyColumn = this.originalData?.columns.find(col => col.isPrimaryKey)
      if (primaryKeyColumn) {
        const whereClause = `${primaryKeyColumn.id} = ${this.formatSQLValue(deletedRow.primaryKeyValue)}`
        statements.push(`DELETE FROM ${tableName} WHERE ${whereClause}`)
      }
    }

    // INSERT statements
    for (const addedRow of changeRecord.addedRows) {
      const columns = this.originalData?.columns
        .filter(col => !col.isAutoIncrement && addedRow.data[col.id] !== undefined)
        .map(col => col.id) || []
      
      if (columns.length > 0) {
        const values = columns
          .map(col => this.formatSQLValue(addedRow.data[col]))
          .join(', ')
        
        statements.push(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values})`)
      }
    }

    return statements
  }

  /**
   * Check if there are any pending changes
   */
  hasChanges(): boolean {
    return this.cellChanges.size > 0 || this.rowAdditions.size > 0 || this.rowDeletions.size > 0
  }

  /**
   * Get changes summary for UI display
   */
  getChangesSummary(): {
    description: string
    details: string[]
    canCommit: boolean
    warnings: string[]
  } {
    const stats = this.getStatistics()
    const warnings: string[] = []
    
    if (stats.deletedRows > 0) {
      warnings.push(`${stats.deletedRows} row(s) will be permanently deleted`)
    }

    let description = 'No changes'
    if (stats.totalChanges > 0) {
      const parts = []
      if (stats.modifiedCells > 0) parts.push(`${stats.modifiedCells} cell(s) modified`)
      if (stats.addedRows > 0) parts.push(`${stats.addedRows} row(s) added`)
      if (stats.deletedRows > 0) parts.push(`${stats.deletedRows} row(s) deleted`)
      description = parts.join(', ')
    }

    const details = []
    if (stats.modifiedCells > 0) {
      details.push(`Modified ${stats.modifiedCells} cell(s) across ${stats.affectedRows} row(s)`)
    }
    if (stats.addedRows > 0) {
      details.push(`Added ${stats.addedRows} new row(s)`)
    }
    if (stats.deletedRows > 0) {
      details.push(`Marked ${stats.deletedRows} row(s) for deletion`)
    }

    return {
      description,
      details,
      canCommit: stats.totalChanges > 0,
      warnings
    }
  }

  private clearAll(): void {
    this.cellChanges.clear()
    this.rowAdditions.clear()
    this.rowDeletions.clear()
    this.nextTempId = 1
  }

  private getLastModifiedTime(): Date | null {
    const allTimestamps = [
      ...Array.from(this.cellChanges.values()).map(change => change.timestamp),
      ...Array.from(this.rowAdditions.values()).map(addition => addition.timestamp),
      ...Array.from(this.rowDeletions.values()).map(deletion => deletion.timestamp)
    ]

    if (allTimestamps.length === 0) {
      return null
    }

    return new Date(Math.max(...allTimestamps.map(date => date.getTime())))
  }

  private formatSQLValue(value: CellValue): string {
    if (value === null || value === undefined) {
      return 'NULL'
    }
    
    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`
    }
    
    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE'
    }
    
    if (value instanceof Date) {
      return `'${value.toISOString()}'`
    }
    
    return String(value)
  }
}