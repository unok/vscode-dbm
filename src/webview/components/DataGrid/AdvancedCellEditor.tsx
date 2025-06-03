import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import type {
  CellValue,
  ColumnDefinition,
  EditableCell,
  ValidationResult,
} from "../../../shared/types/datagrid"

interface AdvancedCellEditorProps {
  cell: EditableCell
  column: ColumnDefinition
  onCommit: (value: CellValue) => Promise<void>
  onCancel: () => void
  onChange: (value: CellValue) => void
}

export const AdvancedCellEditor: React.FC<AdvancedCellEditorProps> = ({
  cell,
  column,
  onCommit,
  onCancel,
  onChange,
}) => {
  const [value, setValue] = useState<string>(String(cell.editedValue || ""))
  const [validation, _setValidation] = useState<ValidationResult | null>(null)
  const [isCommitting, setIsCommitting] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null)

  // Focus on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
      if ("select" in inputRef.current) {
        inputRef.current.select()
      }
    }
  }, [])

  // Update parent on value change with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const parsedValue = parseValue(value, column.type)
      onChange(parsedValue)
    }, 200)

    return () => clearTimeout(timeoutId)
  }, [value, onChange, column.type])

  const parseValue = useCallback(
    (input: string, dataType: string): CellValue => {
      if (input === "" || input === null || input === undefined) {
        return column.nullable ? null : ""
      }

      const type = dataType.toLowerCase()

      try {
        if (type.includes("int")) {
          const parsed = Number.parseInt(input, 10)
          return Number.isNaN(parsed) ? input : parsed
        }

        if (
          type.includes("decimal") ||
          type.includes("numeric") ||
          type.includes("float") ||
          type.includes("double")
        ) {
          const parsed = Number.parseFloat(input)
          return Number.isNaN(parsed) ? input : parsed
        }

        if (type.includes("bool")) {
          const lower = input.toLowerCase()
          if (["true", "1", "yes", "on"].includes(lower)) return true
          if (["false", "0", "no", "off"].includes(lower)) return false
          return input
        }

        if (type.includes("date") && !type.includes("time")) {
          // Validate date format
          const date = new Date(input)
          if (!Number.isNaN(date.getTime())) {
            return input
          }
        }

        if (type.includes("datetime") || type.includes("timestamp")) {
          const date = new Date(input)
          if (!Number.isNaN(date.getTime())) {
            return input
          }
        }

        if (type.includes("json")) {
          try {
            JSON.parse(input)
            return input
          } catch {
            return input // Let validation handle the error
          }
        }
      } catch {
        // Return original input if parsing fails
      }

      return input
    },
    [column.nullable]
  )

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case "Enter":
        if (!e.shiftKey) {
          e.preventDefault()
          handleCommit()
        }
        break
      case "Escape":
        e.preventDefault()
        onCancel()
        break
      case "Tab":
        // Allow natural tab behavior, but commit first
        handleCommit()
        break
    }
  }, [])

  const handleCommit = useCallback(async () => {
    if (isCommitting) return

    setIsCommitting(true)
    try {
      const parsedValue = parseValue(value, column.type)
      await onCommit(parsedValue)
    } catch (error) {
      console.error("Failed to commit cell edit:", error)
      // Stay in edit mode on error
      setIsCommitting(false)
    }
  }, [value, column.type, parseValue, onCommit, isCommitting])

  const handleBlur = useCallback(() => {
    // Small delay to allow clicking on validation tooltips or suggestions
    setTimeout(() => {
      handleCommit()
    }, 150)
  }, [handleCommit])

  const renderInput = () => {
    const baseProps = {
      ref: inputRef as any,
      value,
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
      ) => setValue(e.target.value),
      onKeyDown: handleKeyDown,
      onBlur: handleBlur,
      className: `cell-editor ${validation?.isValid === false ? "cell-editor-invalid" : ""} ${cell.isDirty ? "cell-editor-dirty" : ""}`,
      disabled: isCommitting,
    }

    const type = column.type.toLowerCase()

    // Special input types based on column type
    if (type.includes("bool")) {
      return (
        <select {...baseProps} value={String(value)}>
          <option value=''>Select...</option>
          <option value='true'>True</option>
          <option value='false'>False</option>
        </select>
      )
    }

    if (type.includes("date") && !type.includes("time")) {
      return <input {...baseProps} type='date' />
    }

    if (type.includes("datetime") || type.includes("timestamp")) {
      return <input {...baseProps} type='datetime-local' />
    }

    if (type.includes("time")) {
      return <input {...baseProps} type='time' />
    }

    if (type.includes("email")) {
      return <input {...baseProps} type='email' />
    }

    if (type.includes("url")) {
      return <input {...baseProps} type='url' />
    }

    if (
      type.includes("int") ||
      type.includes("decimal") ||
      type.includes("numeric") ||
      type.includes("float")
    ) {
      return <input {...baseProps} type='number' step={type.includes("int") ? "1" : "any"} />
    }

    if (type.includes("text") || (column.maxLength && column.maxLength > 255)) {
      return (
        <textarea
          {...baseProps}
          rows={Math.min(Math.max(2, Math.ceil(value.length / 50)), 6)}
          style={{ resize: "vertical", minHeight: "60px" }}
        />
      )
    }

    if (type.includes("json")) {
      return (
        <textarea
          {...baseProps}
          rows={4}
          style={{ resize: "vertical", fontFamily: "monospace" }}
          placeholder='Enter valid JSON...'
        />
      )
    }

    // Default text input
    return <input {...baseProps} type='text' maxLength={column.maxLength} />
  }

  return (
    <div className='cell-editor-container'>
      {renderInput()}

      {/* Validation feedback */}
      {validation && !validation.isValid && (
        <div className='validation-tooltip'>
          <div className='validation-errors'>
            {validation.errors.map((error, index) => (
              <div key={index} className='validation-error'>
                ❌ {error}
              </div>
            ))}
          </div>
          {validation.suggestions && validation.suggestions.length > 0 && (
            <div className='validation-suggestions'>
              <div className='suggestions-title'>💡 Suggestions:</div>
              {validation.suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className='validation-suggestion'
                  onClick={() => setValue(suggestion)}
                >
                  {suggestion}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Visual indicators */}
      {cell.isDirty && (
        <div className='edit-indicator dirty' title='Modified'>
          ●
        </div>
      )}

      {isCommitting && (
        <div className='edit-indicator saving' title='Saving...'>
          ⟳
        </div>
      )}

      {/* Column info tooltip */}
      <div className='column-info-tooltip'>
        <div className='column-type'>{column.type}</div>
        {column.nullable && <div className='column-nullable'>Nullable</div>}
        {column.maxLength && <div className='column-max-length'>Max: {column.maxLength}</div>}
        {column.defaultValue !== undefined && (
          <div className='column-default'>Default: {String(column.defaultValue)}</div>
        )}
      </div>

      {/* Keyboard shortcuts hint */}
      <div className='keyboard-shortcuts'>
        <div className='shortcut'>Enter: Save</div>
        <div className='shortcut'>Esc: Cancel</div>
        <div className='shortcut'>Tab: Save & Next</div>
      </div>
    </div>
  )
}
