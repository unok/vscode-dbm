import type React from "react"
import { useCallback, useState } from "react"
import type { ColumnDefinition } from "../../../shared/types/table-management"
import { DATA_TYPE_MAPPINGS } from "../../../shared/types/table-management"

interface ColumnEditorProps {
  columns: ColumnDefinition[]
  databaseType: string
  onChange: (columns: ColumnDefinition[]) => void
}

export const ColumnEditor: React.FC<ColumnEditorProps> = ({ columns, databaseType, onChange }) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const availableDataTypes = Object.values(
    DATA_TYPE_MAPPINGS[databaseType as keyof typeof DATA_TYPE_MAPPINGS] || {}
  )

  const addColumn = useCallback(() => {
    const newColumn: ColumnDefinition = {
      name: `column_${columns.length + 1}`,
      dataType: availableDataTypes[0] || "VARCHAR(255)",
      nullable: true,
      isPrimaryKey: false,
      autoIncrement: false,
    }

    onChange([...columns, newColumn])
    setEditingIndex(columns.length)
  }, [columns, availableDataTypes, onChange])

  const updateColumn = useCallback(
    (index: number, field: keyof ColumnDefinition, value: any) => {
      const newColumns = [...columns]
      newColumns[index] = {
        ...newColumns[index],
        [field]: value,
      }

      // Auto-adjust related fields
      if (field === "isPrimaryKey" && value) {
        newColumns[index].nullable = false
        // Remove primary key from other columns
        newColumns.forEach((col, i) => {
          if (i !== index) {
            col.isPrimaryKey = false
          }
        })
      }

      if (field === "nullable" && value && newColumns[index].isPrimaryKey) {
        newColumns[index].isPrimaryKey = false
      }

      onChange(newColumns)
    },
    [columns, onChange]
  )

  const removeColumn = useCallback(
    (index: number) => {
      const newColumns = columns.filter((_, i) => i !== index)
      onChange(newColumns)
      setEditingIndex(null)
    },
    [columns, onChange]
  )

  const moveColumn = useCallback(
    (fromIndex: number, toIndex: number) => {
      const newColumns = [...columns]
      const [movedColumn] = newColumns.splice(fromIndex, 1)
      newColumns.splice(toIndex, 0, movedColumn)
      onChange(newColumns)
    },
    [columns, onChange]
  )

  const parseDataType = (dataType: string) => {
    const match = dataType.match(/^(\w+)(\(([^)]+)\))?/)
    if (!match) return { type: dataType, length: "", precision: "", scale: "" }

    const [, type, , params] = match
    if (!params) return { type, length: "", precision: "", scale: "" }

    if (params.includes(",")) {
      const [precision, scale] = params.split(",").map((s) => s.trim())
      return { type, length: "", precision, scale }
    }

    return { type, length: params, precision: "", scale: "" }
  }

  const buildDataType = (type: string, length: string, precision: string, scale: string) => {
    if (precision && scale) {
      return `${type}(${precision},${scale})`
    }
    if (length) {
      return `${type}(${length})`
    }
    return type
  }

  return (
    <div className='space-y-4'>
      <div className='flex justify-between items-center'>
        <h3 className='text-lg font-medium text-gray-900'>Table Columns</h3>
        <button
          onClick={addColumn}
          className='px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
        >
          Add Column
        </button>
      </div>

      {columns.length === 0 ? (
        <div className='text-center py-8 text-gray-500'>
          <p>No columns defined. Click "Add Column" to get started.</p>
        </div>
      ) : (
        <div className='overflow-x-auto'>
          <table className='min-w-full divide-y divide-gray-200'>
            <thead className='bg-gray-50'>
              <tr>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Column Name
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Data Type
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Length/Precision
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Nullable
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Primary Key
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Auto Increment
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Default Value
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className='bg-white divide-y divide-gray-200'>
              {columns.map((column, index) => {
                const { type, length, precision, scale } = parseDataType(column.dataType)
                const isEditing = editingIndex === index

                return (
                  <tr key={index} className={isEditing ? "bg-blue-50" : "hover:bg-gray-50"}>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <input
                        type='text'
                        value={column.name}
                        onChange={(e) => updateColumn(index, "name", e.target.value)}
                        onFocus={() => setEditingIndex(index)}
                        onBlur={() => setEditingIndex(null)}
                        className='w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500'
                        placeholder='column_name'
                      />
                    </td>

                    <td className='px-6 py-4 whitespace-nowrap'>
                      <select
                        value={type}
                        onChange={(e) => {
                          const newDataType = buildDataType(
                            e.target.value,
                            length,
                            precision,
                            scale
                          )
                          updateColumn(index, "dataType", newDataType)
                        }}
                        className='w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500'
                      >
                        {availableDataTypes.map((dataType) => (
                          <option key={dataType} value={dataType}>
                            {dataType}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className='px-6 py-4 whitespace-nowrap'>
                      {type.includes("VARCHAR") || type.includes("CHAR") ? (
                        <input
                          type='number'
                          value={length}
                          onChange={(e) => {
                            const newDataType = buildDataType(
                              type,
                              e.target.value,
                              precision,
                              scale
                            )
                            updateColumn(index, "dataType", newDataType)
                          }}
                          className='w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500'
                          placeholder='255'
                          min='1'
                        />
                      ) : type.includes("DECIMAL") || type.includes("NUMERIC") ? (
                        <div className='flex space-x-1'>
                          <input
                            type='number'
                            value={precision}
                            onChange={(e) => {
                              const newDataType = buildDataType(type, length, e.target.value, scale)
                              updateColumn(index, "dataType", newDataType)
                            }}
                            className='w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500'
                            placeholder='10'
                            min='1'
                          />
                          <span className='text-gray-500'>,</span>
                          <input
                            type='number'
                            value={scale}
                            onChange={(e) => {
                              const newDataType = buildDataType(
                                type,
                                length,
                                precision,
                                e.target.value
                              )
                              updateColumn(index, "dataType", newDataType)
                            }}
                            className='w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500'
                            placeholder='2'
                            min='0'
                          />
                        </div>
                      ) : (
                        <span className='text-gray-400 text-sm'>N/A</span>
                      )}
                    </td>

                    <td className='px-6 py-4 whitespace-nowrap text-center'>
                      <input
                        type='checkbox'
                        checked={column.nullable}
                        onChange={(e) => updateColumn(index, "nullable", e.target.checked)}
                        disabled={column.isPrimaryKey}
                        className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
                      />
                    </td>

                    <td className='px-6 py-4 whitespace-nowrap text-center'>
                      <input
                        type='checkbox'
                        checked={column.isPrimaryKey || false}
                        onChange={(e) => updateColumn(index, "isPrimaryKey", e.target.checked)}
                        className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
                      />
                    </td>

                    <td className='px-6 py-4 whitespace-nowrap text-center'>
                      <input
                        type='checkbox'
                        checked={column.autoIncrement || false}
                        onChange={(e) => updateColumn(index, "autoIncrement", e.target.checked)}
                        disabled={
                          !column.isPrimaryKey ||
                          !["INT", "INTEGER", "BIGINT", "SERIAL", "BIGSERIAL"].some((t) =>
                            type.includes(t)
                          )
                        }
                        className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
                      />
                    </td>

                    <td className='px-6 py-4 whitespace-nowrap'>
                      <input
                        type='text'
                        value={column.defaultValue?.toString() || ""}
                        onChange={(e) => {
                          const value = e.target.value
                          updateColumn(index, "defaultValue", value === "" ? undefined : value)
                        }}
                        className='w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500'
                        placeholder='NULL'
                      />
                    </td>

                    <td className='px-6 py-4 whitespace-nowrap text-sm font-medium'>
                      <div className='flex space-x-2'>
                        <button
                          onClick={() => moveColumn(index, Math.max(0, index - 1))}
                          disabled={index === 0}
                          className='text-gray-400 hover:text-gray-600 disabled:opacity-25'
                          title='Move up'
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moveColumn(index, Math.min(columns.length - 1, index + 1))}
                          disabled={index === columns.length - 1}
                          className='text-gray-400 hover:text-gray-600 disabled:opacity-25'
                          title='Move down'
                        >
                          ↓
                        </button>
                        <button
                          onClick={() => removeColumn(index)}
                          className='text-red-600 hover:text-red-900'
                          title='Remove column'
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {columns.length > 0 && (
        <div className='mt-4 p-4 bg-blue-50 rounded-md'>
          <h4 className='text-sm font-medium text-blue-900 mb-2'>Column Guidelines:</h4>
          <ul className='text-sm text-blue-800 space-y-1'>
            <li>• Primary key columns cannot be nullable</li>
            <li>• Auto increment is only available for integer primary key columns</li>
            <li>• Use VARCHAR for variable-length text, CHAR for fixed-length</li>
            <li>• DECIMAL/NUMERIC requires precision (total digits) and scale (decimal places)</li>
          </ul>
        </div>
      )}
    </div>
  )
}
