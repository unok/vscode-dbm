import type React from 'react'
import { useCallback, useState } from 'react'
import type { AdvancedDataGridService } from '../../../shared/services/AdvancedDataGridService'
import type {
  BulkEditOperation,
  BulkOperationPreview,
  BulkOperationResult,
  CellValue,
  ColumnDefinition
} from '../../../shared/types/datagrid'

interface BulkEditPanelProps {
  selectedRows: number[]
  columns: ColumnDefinition[]
  onExecute: (operation: BulkEditOperation) => Promise<void>
  onClose: () => void
  service: AdvancedDataGridService
}

type BulkOperationType = 'update' | 'delete' | 'find-replace'

export const BulkEditPanel: React.FC<BulkEditPanelProps> = ({
  selectedRows,
  columns,
  onExecute,
  onClose,
  service
}) => {
  const [operationType, setOperationType] = useState<BulkOperationType>('update')
  const [selectedColumn, setSelectedColumn] = useState<string>('')
  const [newValue, setNewValue] = useState<string>('')
  const [findValue, setFindValue] = useState<string>('')
  const [replaceValue, setReplaceValue] = useState<string>('')
  const [useCondition, setUseCondition] = useState(false)
  const [conditionColumn, setConditionColumn] = useState<string>('')
  const [conditionOperator, setConditionOperator] = useState<'=' | '!=' | '>' | '<' | 'contains' | 'starts_with'>('=')
  const [conditionValue, setConditionValue] = useState<string>('')
  const [preview, setPreview] = useState<BulkOperationPreview | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)

  const editableColumns = columns.filter(col => !col.isPrimaryKey && !col.isAutoIncrement)

  const buildCondition = useCallback((row: Record<string, CellValue>): boolean => {
    if (!useCondition || !conditionColumn || conditionValue === '') {
      return true
    }

    const cellValue = row[conditionColumn]
    const compareValue = conditionValue

    switch (conditionOperator) {
      case '=':
        return String(cellValue) === compareValue
      case '!=':
        return String(cellValue) !== compareValue
      case '>':
        return Number(cellValue) > Number(compareValue)
      case '<':
        return Number(cellValue) < Number(compareValue)
      case 'contains':
        return String(cellValue).toLowerCase().includes(compareValue.toLowerCase())
      case 'starts_with':
        return String(cellValue).toLowerCase().startsWith(compareValue.toLowerCase())
      default:
        return true
    }
  }, [useCondition, conditionColumn, conditionOperator, conditionValue])

  const buildOperation = useCallback((): BulkEditOperation => {
    const column = columns.find(col => col.id === selectedColumn)
    
    const baseOperation = {
      rowIndices: selectedRows,
      condition: useCondition ? buildCondition : undefined
    }

    switch (operationType) {
      case 'update':
        return {
          ...baseOperation,
          type: 'update',
          columnId: selectedColumn,
          value: parseValue(newValue, column?.type || 'text')
        }

      case 'find-replace':
        return {
          ...baseOperation,
          type: 'update',
          columnId: selectedColumn,
          valueFunction: (row: Record<string, CellValue>) => {
            const currentValue = String(row[selectedColumn] || '')
            return currentValue.replace(new RegExp(findValue, 'g'), replaceValue)
          }
        }

      case 'delete':
        return {
          ...baseOperation,
          type: 'delete'
        }

      default:
        throw new Error('Invalid operation type')
    }
  }, [operationType, selectedRows, selectedColumn, newValue, findValue, replaceValue, useCondition, buildCondition, columns])

  const parseValue = (input: string, dataType: string): CellValue => {
    if (input === '' || input === null || input === undefined) {
      return null
    }

    const type = dataType.toLowerCase()

    try {
      if (type.includes('int')) {
        const parsed = Number.parseInt(input, 10)
        return isNaN(parsed) ? input : parsed
      }
      
      if (type.includes('decimal') || type.includes('numeric') || type.includes('float') || type.includes('double')) {
        const parsed = Number.parseFloat(input)
        return isNaN(parsed) ? input : parsed
      }
      
      if (type.includes('bool')) {
        const lower = input.toLowerCase()
        if (['true', '1', 'yes', 'on'].includes(lower)) return true
        if (['false', '0', 'no', 'off'].includes(lower)) return false
        return input
      }
    } catch {
      // Return original input if parsing fails
    }

    return input
  }

  const handlePreview = useCallback(async () => {
    try {
      const operation = buildOperation()
      const previewResult = service.previewBulkOperation(operation)
      setPreview(previewResult)
    } catch (error) {
      console.error('Preview failed:', error)
    }
  }, [buildOperation, service])

  const handleExecute = useCallback(async () => {
    if (isExecuting) return

    setIsExecuting(true)
    try {
      const operation = buildOperation()
      await onExecute(operation)
      onClose()
    } catch (error) {
      console.error('Bulk operation failed:', error)
    } finally {
      setIsExecuting(false)
    }
  }, [buildOperation, onExecute, onClose, isExecuting])

  const isValidOperation = (): boolean => {
    if (selectedRows.length === 0) return false

    switch (operationType) {
      case 'update':
        return selectedColumn !== '' && newValue !== ''
      case 'find-replace':
        return selectedColumn !== '' && findValue !== ''
      case 'delete':
        return true
      default:
        return false
    }
  }

  return (
    <div className="bulk-edit-panel">
      <div className="panel-header">
        <h3>Bulk Edit Operations</h3>
        <button className="close-button" onClick={onClose}>✕</button>
      </div>

      <div className="panel-content">
        <div className="operation-selection">
          <label>Operation Type:</label>
          <select
            value={operationType}
            onChange={(e) => setOperationType(e.target.value as BulkOperationType)}
          >
            <option value="update">Update Values</option>
            <option value="find-replace">Find & Replace</option>
            <option value="delete">Delete Rows</option>
          </select>
        </div>

        {operationType !== 'delete' && (
          <div className="column-selection">
            <label>Target Column:</label>
            <select
              value={selectedColumn}
              onChange={(e) => setSelectedColumn(e.target.value)}
            >
              <option value="">Select Column...</option>
              {editableColumns.map(column => (
                <option key={column.id} value={column.id}>
                  {column.name} ({column.type})
                </option>
              ))}
            </select>
          </div>
        )}

        {operationType === 'update' && (
          <div className="value-input">
            <label>New Value:</label>
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Enter new value..."
            />
          </div>
        )}

        {operationType === 'find-replace' && (
          <div className="find-replace-inputs">
            <div className="input-group">
              <label>Find:</label>
              <input
                type="text"
                value={findValue}
                onChange={(e) => setFindValue(e.target.value)}
                placeholder="Text to find..."
              />
            </div>
            <div className="input-group">
              <label>Replace with:</label>
              <input
                type="text"
                value={replaceValue}
                onChange={(e) => setReplaceValue(e.target.value)}
                placeholder="Replacement text..."
              />
            </div>
          </div>
        )}

        {/* Conditional execution */}
        <div className="condition-section">
          <label>
            <input
              type="checkbox"
              checked={useCondition}
              onChange={(e) => setUseCondition(e.target.checked)}
            />
            Apply condition
          </label>

          {useCondition && (
            <div className="condition-builder">
              <select
                value={conditionColumn}
                onChange={(e) => setConditionColumn(e.target.value)}
              >
                <option value="">Select Column...</option>
                {columns.map(column => (
                  <option key={column.id} value={column.id}>
                    {column.name}
                  </option>
                ))}
              </select>

              <select
                value={conditionOperator}
                onChange={(e) => setConditionOperator(e.target.value as any)}
              >
                <option value="=">=</option>
                <option value="!=">!=</option>
                <option value=">">&gt;</option>
                <option value="<">&lt;</option>
                <option value="contains">contains</option>
                <option value="starts_with">starts with</option>
              </select>

              <input
                type="text"
                value={conditionValue}
                onChange={(e) => setConditionValue(e.target.value)}
                placeholder="Condition value..."
              />
            </div>
          )}
        </div>

        {/* Target rows info */}
        <div className="target-info">
          <div className="info-item">
            <strong>Selected Rows:</strong> {selectedRows.length}
          </div>
          {preview && (
            <div className="info-item">
              <strong>Will Affect:</strong> {preview.willAffect} rows
            </div>
          )}
        </div>

        {/* Preview */}
        {preview && preview.changes.length > 0 && (
          <div className="preview-section">
            <h4>Preview Changes:</h4>
            <div className="preview-changes">
              {preview.changes.slice(0, 10).map((change, index) => (
                <div key={index} className="preview-change">
                  <span className="row-index">Row {change.rowIndex}:</span>
                  <span className="change-value">
                    {String(change.currentValue)} → {String(change.newValue)}
                  </span>
                </div>
              ))}
              {preview.changes.length > 10 && (
                <div className="preview-more">
                  ...and {preview.changes.length - 10} more changes
                </div>
              )}
            </div>
          </div>
        )}

        {/* Warning for delete operation */}
        {operationType === 'delete' && (
          <div className="warning-section">
            ⚠️ This will permanently delete {selectedRows.length} rows. This action cannot be undone.
          </div>
        )}
      </div>

      <div className="panel-actions">
        <button
          className="preview-button"
          onClick={handlePreview}
          disabled={!isValidOperation()}
        >
          Preview Changes
        </button>
        
        <button
          className="execute-button"
          onClick={handleExecute}
          disabled={!isValidOperation() || isExecuting}
        >
          {isExecuting ? 'Executing...' : 'Execute Operation'}
        </button>
        
        <button className="cancel-button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  )
}