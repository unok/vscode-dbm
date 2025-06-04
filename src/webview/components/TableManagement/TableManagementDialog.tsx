import type React from "react"
import { useCallback, useEffect, useState } from "react"
import { TableManagementService } from "../../../shared/services/TableManagementService"
import type { DatabaseConnection } from "../../../shared/types/sql"
import type {
  ColumnDefinition,
  ConstraintDefinition,
  IndexDefinition,
  TableDefinition,
} from "../../../shared/types/table-management"
import { useVSCodeAPI } from "../../api/vscode"
import { ColumnEditor } from "./ColumnEditor"
import { ConstraintEditor } from "./ConstraintEditor"
import { IndexEditor } from "./IndexEditor"
import { TablePreview } from "./TablePreview"

interface TableManagementDialogProps {
  isOpen: boolean
  mode: "create" | "edit"
  initialTable?: TableDefinition
  connection: DatabaseConnection
  onSave: (tableDefinition: TableDefinition) => void
  onCancel: () => void
}

export const TableManagementDialog: React.FC<TableManagementDialogProps> = ({
  isOpen,
  mode,
  initialTable,
  connection,
  onSave,
  onCancel,
}) => {
  const vscodeApi = useVSCodeAPI()
  const [tableService] = useState(() => new TableManagementService())
  const [activeTab, setActiveTab] = useState<"basic" | "columns" | "constraints" | "indexes">(
    "basic"
  )
  const [generatedSQL, setGeneratedSQL] = useState<string>("")
  const [isGenerating, setIsGenerating] = useState(false)

  const [tableDefinition, setTableDefinition] = useState<TableDefinition>({
    name: "",
    schema: "public",
    comment: "",
    columns: [],
    constraints: [],
    indexes: [],
  })

  // Initialize table definition
  useEffect(() => {
    if (isOpen) {
      if (initialTable) {
        setTableDefinition(initialTable)
      } else {
        setTableDefinition({
          name: "",
          schema: "public",
          comment: "",
          columns: [],
          constraints: [],
          indexes: [],
        })
      }
      setActiveTab("basic")
      setGeneratedSQL("")
    }
  }, [isOpen, initialTable])

  // Generate SQL when table definition changes
  useEffect(() => {
    if (tableDefinition.name && tableDefinition.columns.length > 0) {
      generateSQL()
    }
  }, [tableDefinition])

  const generateSQL = useCallback(async () => {
    setIsGenerating(true)
    try {
      const sql = await tableService.generateCreateTableSQL(tableDefinition, connection)
      setGeneratedSQL(sql)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      vscodeApi.showError(`Failed to generate SQL: ${message}`)
    } finally {
      setIsGenerating(false)
    }
  }, [tableDefinition, connection, tableService, vscodeApi])

  const validateTableDefinition = useCallback((): boolean => {
    try {
      // Validate table name
      tableService.validateTableName(tableDefinition.name)

      // Validate at least one column
      if (tableDefinition.columns.length === 0) {
        vscodeApi.showError("Table must have at least one column")
        return false
      }

      // Validate column names
      for (const column of tableDefinition.columns) {
        tableService.validateColumnName(column.name)
        tableService.validateDataType(column.dataType, connection)
      }

      // Validate constraints
      for (const constraint of tableDefinition.constraints || []) {
        tableService.validateConstraint(constraint)
      }

      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      vscodeApi.showError(message)
      return false
    }
  }, [tableDefinition, tableService, connection, vscodeApi])

  const handleSave = useCallback(() => {
    if (!validateTableDefinition()) {
      return
    }

    onSave(tableDefinition)
    vscodeApi.showInfo("Table definition saved successfully")
  }, [tableDefinition, validateTableDefinition, onSave, vscodeApi])

  const updateTableBasicInfo = useCallback(
    (field: keyof Pick<TableDefinition, "name" | "schema" | "comment">, value: string) => {
      setTableDefinition((prev) => ({
        ...prev,
        [field]: value,
      }))
    },
    []
  )

  const updateColumns = useCallback((columns: ColumnDefinition[]) => {
    setTableDefinition((prev) => ({
      ...prev,
      columns,
    }))
  }, [])

  const updateConstraints = useCallback((constraints: ConstraintDefinition[]) => {
    setTableDefinition((prev) => ({
      ...prev,
      constraints,
    }))
  }, [])

  const updateIndexes = useCallback((indexes: IndexDefinition[]) => {
    setTableDefinition((prev) => ({
      ...prev,
      indexes,
    }))
  }, [])

  if (!isOpen) {
    return null
  }

  const tabs = [
    { id: "basic" as const, label: "Basic Info", count: 0 },
    { id: "columns" as const, label: "Columns", count: tableDefinition.columns.length },
    {
      id: "constraints" as const,
      label: "Constraints",
      count: tableDefinition.constraints?.length || 0,
    },
    { id: "indexes" as const, label: "Indexes", count: tableDefinition.indexes?.length || 0 },
  ]

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
      <div className='bg-white rounded-lg shadow-xl w-full max-w-6xl h-5/6 flex flex-col'>
        {/* Header */}
        <div className='p-6 border-b border-gray-200'>
          <h2 className='text-2xl font-bold text-gray-900'>
            {mode === "create" ? "Create Table" : "Edit Table"}
          </h2>
          <p className='text-sm text-gray-600 mt-1'>
            Database: {connection.database} ({connection.type})
          </p>
        </div>

        {/* Tab Navigation */}
        <div className='border-b border-gray-200'>
          <nav className='flex space-x-8 px-6'>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className='ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs'>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div className='flex-1 flex overflow-hidden'>
          {/* Main Content */}
          <div className='flex-1 overflow-y-auto p-6'>
            {activeTab === "basic" && (
              <div className='space-y-6'>
                <div className='grid grid-cols-2 gap-6'>
                  <div>
                    <label
                      htmlFor='tableName'
                      className='block text-sm font-medium text-gray-700 mb-2'
                    >
                      Table Name <span className='text-red-500'>*</span>
                    </label>
                    <input
                      id='tableName'
                      type='text'
                      value={tableDefinition.name}
                      onChange={(e) => updateTableBasicInfo("name", e.target.value)}
                      className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                      placeholder='users'
                      required
                    />
                  </div>

                  <div>
                    <label
                      htmlFor='schema'
                      className='block text-sm font-medium text-gray-700 mb-2'
                    >
                      Schema
                    </label>
                    <input
                      id='schema'
                      type='text'
                      value={tableDefinition.schema}
                      onChange={(e) => updateTableBasicInfo("schema", e.target.value)}
                      className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                      placeholder='public'
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor='comment' className='block text-sm font-medium text-gray-700 mb-2'>
                    Comment
                  </label>
                  <textarea
                    id='comment'
                    value={tableDefinition.comment || ""}
                    onChange={(e) => updateTableBasicInfo("comment", e.target.value)}
                    rows={3}
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                    placeholder='Optional table description...'
                  />
                </div>
              </div>
            )}

            {activeTab === "columns" && (
              <ColumnEditor
                columns={tableDefinition.columns}
                databaseType={connection.type}
                onChange={updateColumns}
              />
            )}

            {activeTab === "constraints" && (
              <ConstraintEditor
                constraints={tableDefinition.constraints || []}
                columns={tableDefinition.columns}
                tableName={tableDefinition.name}
                onChange={updateConstraints}
              />
            )}

            {activeTab === "indexes" && (
              <IndexEditor
                indexes={tableDefinition.indexes || []}
                columns={tableDefinition.columns}
                tableName={tableDefinition.name}
                databaseType={connection.type}
                onChange={updateIndexes}
              />
            )}
          </div>

          {/* SQL Preview Sidebar */}
          <div className='w-96 border-l border-gray-200 bg-gray-50'>
            <TablePreview
              tableDefinition={tableDefinition}
              generatedSQL={generatedSQL}
              isGenerating={isGenerating}
              onRegenerate={generateSQL}
            />
          </div>
        </div>

        {/* Footer */}
        <div className='p-6 border-t border-gray-200 flex justify-end space-x-3'>
          <button
            type='button'
            onClick={onCancel}
            className='px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500'
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={handleSave}
            className='px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
            disabled={!tableDefinition.name || tableDefinition.columns.length === 0}
          >
            {mode === "create" ? "Create Table" : "Update Table"}
          </button>
        </div>
      </div>
    </div>
  )
}
