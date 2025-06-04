import type React from "react"
import { useCallback, useState } from "react"
import type { ColumnDefinition, IndexDefinition } from "../../../shared/types/table-management"
import { DATABASE_FEATURES } from "../../../shared/types/table-management"

interface IndexEditorProps {
  indexes: IndexDefinition[]
  columns: ColumnDefinition[]
  tableName: string
  databaseType: string
  onChange: (indexes: IndexDefinition[]) => void
}

export const IndexEditor: React.FC<IndexEditorProps> = ({
  indexes,
  columns,
  tableName,
  databaseType,
  onChange,
}) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const features = DATABASE_FEATURES[databaseType] || DATABASE_FEATURES.mysql

  const indexTypes: { value: IndexDefinition["type"]; label: string; description: string }[] = [
    {
      value: "BTREE",
      label: "B-Tree",
      description: "Default balanced tree index for most queries",
    },
    { value: "HASH", label: "Hash", description: "Fast equality lookups (MySQL)" },
    { value: "GIN", label: "GIN", description: "Generalized Inverted Index (PostgreSQL)" },
    { value: "GIST", label: "GiST", description: "Generalized Search Tree (PostgreSQL)" },
    { value: "SPGIST", label: "SP-GiST", description: "Space-partitioned GiST (PostgreSQL)" },
    { value: "BRIN", label: "BRIN", description: "Block Range Index (PostgreSQL)" },
  ]

  const addIndex = useCallback(() => {
    const indexName = `idx_${tableName}_${indexes.length + 1}`

    const newIndex: IndexDefinition = {
      name: indexName,
      tableName,
      columns: [],
      unique: false,
      type: "BTREE",
    }

    onChange([...indexes, newIndex])
    setEditingIndex(indexes.length)
  }, [indexes, tableName, onChange])

  const updateIndex = useCallback(
    (index: number, field: keyof IndexDefinition, value: any) => {
      const newIndexes = [...indexes]
      newIndexes[index] = {
        ...newIndexes[index],
        [field]: value,
      }
      onChange(newIndexes)
    },
    [indexes, onChange]
  )

  const removeIndex = useCallback(
    (index: number) => {
      const newIndexes = indexes.filter((_, i) => i !== index)
      onChange(newIndexes)
      setEditingIndex(null)
    },
    [indexes, onChange]
  )

  const updateIndexColumns = useCallback(
    (index: number, selectedColumns: string[]) => {
      updateIndex(index, "columns", selectedColumns)
    },
    [updateIndex]
  )

  const updateIncludeColumns = useCallback(
    (index: number, selectedColumns: string[]) => {
      updateIndex(index, "include", selectedColumns)
    },
    [updateIndex]
  )

  const moveColumnUp = useCallback(
    (indexIdx: number, columnIdx: number) => {
      if (columnIdx === 0) return

      const currentIndex = indexes[indexIdx]
      const newColumns = [...currentIndex.columns]
      ;[newColumns[columnIdx - 1], newColumns[columnIdx]] = [
        newColumns[columnIdx],
        newColumns[columnIdx - 1],
      ]
      updateIndexColumns(indexIdx, newColumns)
    },
    [indexes, updateIndexColumns]
  )

  const moveColumnDown = useCallback(
    (indexIdx: number, columnIdx: number) => {
      const currentIndex = indexes[indexIdx]
      if (columnIdx === currentIndex.columns.length - 1) return

      const newColumns = [...currentIndex.columns]
      ;[newColumns[columnIdx], newColumns[columnIdx + 1]] = [
        newColumns[columnIdx + 1],
        newColumns[columnIdx],
      ]
      updateIndexColumns(indexIdx, newColumns)
    },
    [indexes, updateIndexColumns]
  )

  const removeColumnFromIndex = useCallback(
    (indexIdx: number, columnName: string) => {
      const currentIndex = indexes[indexIdx]
      const newColumns = currentIndex.columns.filter((col) => col !== columnName)
      updateIndexColumns(indexIdx, newColumns)
    },
    [indexes, updateIndexColumns]
  )

  return (
    <div className='space-y-4'>
      <div className='flex justify-between items-center'>
        <h3 className='text-lg font-medium text-gray-900'>Table Indexes</h3>
        <button
          onClick={addIndex}
          disabled={columns.length === 0}
          className='px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50'
        >
          Add Index
        </button>
      </div>

      {indexes.length === 0 ? (
        <div className='text-center py-8 text-gray-500'>
          <p>
            No indexes defined. Add columns first, then create indexes to improve query performance.
          </p>
        </div>
      ) : (
        <div className='space-y-4'>
          {indexes.map((index, indexIdx) => {
            const isEditing = editingIndex === indexIdx

            return (
              <div
                key={indexIdx}
                className={`p-4 border rounded-lg ${isEditing ? "border-blue-500 bg-blue-50" : "border-gray-200"}`}
              >
                <div className='flex justify-between items-start mb-4'>
                  <div className='flex-1'>
                    <div className='flex items-center space-x-4 mb-3'>
                      <div className='flex items-center space-x-2'>
                        <input
                          type='checkbox'
                          checked={index.unique}
                          onChange={(e) => updateIndex(indexIdx, "unique", e.target.checked)}
                          className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
                        />
                        <span className='text-sm text-gray-700'>Unique</span>
                      </div>
                      <input
                        type='text'
                        value={index.name}
                        onChange={(e) => updateIndex(indexIdx, "name", e.target.value)}
                        onFocus={() => setEditingIndex(indexIdx)}
                        className='flex-1 px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500'
                        placeholder='Index name'
                      />
                    </div>

                    <div className='space-y-3'>
                      {/* Index Type */}
                      <div>
                        <label className='block text-sm font-medium text-gray-700 mb-1'>
                          Index Type
                        </label>
                        <select
                          value={index.type || "BTREE"}
                          onChange={(e) =>
                            updateIndex(indexIdx, "type", e.target.value as IndexDefinition["type"])
                          }
                          className='w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500'
                        >
                          {indexTypes.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label} - {type.description}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Index Columns */}
                      <div>
                        <label className='block text-sm font-medium text-gray-700 mb-2'>
                          Index Columns (order matters for performance)
                        </label>

                        {index.columns.length > 0 && (
                          <div className='mb-3 space-y-2'>
                            {index.columns.map((columnName, columnIdx) => (
                              <div
                                key={columnName}
                                className='flex items-center space-x-2 p-2 bg-gray-50 rounded'
                              >
                                <span className='text-sm font-medium text-gray-700 flex-1'>
                                  {columnIdx + 1}. {columnName}
                                </span>
                                <button
                                  onClick={() => moveColumnUp(indexIdx, columnIdx)}
                                  disabled={columnIdx === 0}
                                  className='text-gray-400 hover:text-gray-600 disabled:opacity-25'
                                  title='Move up'
                                >
                                  ↑
                                </button>
                                <button
                                  onClick={() => moveColumnDown(indexIdx, columnIdx)}
                                  disabled={columnIdx === index.columns.length - 1}
                                  className='text-gray-400 hover:text-gray-600 disabled:opacity-25'
                                  title='Move down'
                                >
                                  ↓
                                </button>
                                <button
                                  onClick={() => removeColumnFromIndex(indexIdx, columnName)}
                                  className='text-red-600 hover:text-red-900'
                                  title='Remove column'
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className='flex flex-wrap gap-2'>
                          {columns
                            .filter((column) => !index.columns.includes(column.name))
                            .map((column) => (
                              <button
                                key={column.name}
                                onClick={() => {
                                  updateIndexColumns(indexIdx, [...index.columns, column.name])
                                }}
                                className='px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200'
                              >
                                + {column.name}
                              </button>
                            ))}
                        </div>
                      </div>

                      {/* Covering Index (PostgreSQL) */}
                      {features.supportsCoveringIndexes && (
                        <div>
                          <label className='block text-sm font-medium text-gray-700 mb-1'>
                            Include Columns (covering index)
                          </label>
                          <div className='flex flex-wrap gap-2'>
                            {columns
                              .filter((column) => !index.columns.includes(column.name))
                              .map((column) => (
                                <label key={column.name} className='flex items-center'>
                                  <input
                                    type='checkbox'
                                    checked={index.include?.includes(column.name) || false}
                                    onChange={(e) => {
                                      const currentInclude = index.include || []
                                      const newInclude = e.target.checked
                                        ? [...currentInclude, column.name]
                                        : currentInclude.filter((c) => c !== column.name)
                                      updateIncludeColumns(indexIdx, newInclude)
                                    }}
                                    className='mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
                                  />
                                  <span className='text-sm text-gray-700'>{column.name}</span>
                                </label>
                              ))}
                          </div>
                          <p className='text-xs text-gray-500 mt-1'>
                            Include columns are stored in the index but not part of the search key
                          </p>
                        </div>
                      )}

                      {/* Partial Index (PostgreSQL/SQLite) */}
                      {features.supportsPartialIndexes && (
                        <div>
                          <label className='block text-sm font-medium text-gray-700 mb-1'>
                            WHERE Clause (partial index)
                          </label>
                          <input
                            type='text'
                            value={index.where || ""}
                            onChange={(e) =>
                              updateIndex(indexIdx, "where", e.target.value || undefined)
                            }
                            className='w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500'
                            placeholder='active = true'
                          />
                          <p className='text-xs text-gray-500 mt-1'>
                            Only index rows matching this condition
                          </p>
                        </div>
                      )}

                      {/* Comment */}
                      <div>
                        <label className='block text-sm font-medium text-gray-700 mb-1'>
                          Comment
                        </label>
                        <input
                          type='text'
                          value={index.comment || ""}
                          onChange={(e) =>
                            updateIndex(indexIdx, "comment", e.target.value || undefined)
                          }
                          className='w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500'
                          placeholder='Optional index description'
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => removeIndex(indexIdx)}
                    className='ml-4 text-red-600 hover:text-red-900'
                    title='Remove index'
                  >
                    ✕
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {indexes.length > 0 && (
        <div className='mt-4 p-4 bg-blue-50 rounded-md'>
          <h4 className='text-sm font-medium text-blue-900 mb-2'>Index Guidelines:</h4>
          <ul className='text-sm text-blue-800 space-y-1'>
            <li>• Column order in composite indexes affects performance significantly</li>
            <li>• Place most selective columns first in composite indexes</li>
            <li>• Unique indexes automatically enforce uniqueness constraints</li>
            <li>• Partial indexes can significantly reduce index size and maintenance cost</li>
            <li>• Consider covering indexes to avoid table lookups for query-only columns</li>
          </ul>
        </div>
      )}
    </div>
  )
}
