import type React from "react"
import { useEffect, useState } from "react"
import type { ColumnDefinition, TableData } from "../../../shared/types/datagrid"
import { AdvancedDataGrid } from "./AdvancedDataGrid"
import "../../../webview/styles/advanced-datagrid.css"

/**
 * Demo component showcasing the Advanced DataGrid with all features enabled
 * This demonstrates Phase 7 implementation including:
 * - Advanced inline editing with validation
 * - Data change tracking and visual indicators
 * - Bulk editing operations
 * - Copy and paste functionality
 * - Virtual scrolling for large datasets
 * - Performance optimization features
 * - Cursor AI smart default value generation
 */
export const AdvancedDataGridDemo: React.FC = () => {
  const [tableData, setTableData] = useState<TableData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Sample data for demonstration
  useEffect(() => {
    const loadSampleData = async () => {
      // Simulate loading data
      await new Promise((resolve) => setTimeout(resolve, 1000))

      const columns: ColumnDefinition[] = [
        {
          id: "id",
          name: "ID",
          type: "int",
          isPrimaryKey: true,
          isAutoIncrement: true,
          nullable: false,
        },
        {
          id: "email",
          name: "Email",
          type: "varchar(255)",
          nullable: false,
          isPrimaryKey: false,
          isAutoIncrement: false,
          maxLength: 255,
        },
        {
          id: "first_name",
          name: "First Name",
          type: "varchar(100)",
          nullable: false,
          isPrimaryKey: false,
          isAutoIncrement: false,
          maxLength: 100,
        },
        {
          id: "last_name",
          name: "Last Name",
          type: "varchar(100)",
          nullable: false,
          isPrimaryKey: false,
          isAutoIncrement: false,
          maxLength: 100,
        },
        {
          id: "age",
          name: "Age",
          type: "int",
          nullable: true,
          isPrimaryKey: false,
          isAutoIncrement: false,
        },
        {
          id: "salary",
          name: "Salary",
          type: "decimal(10,2)",
          nullable: true,
          isPrimaryKey: false,
          isAutoIncrement: false,
        },
        {
          id: "is_active",
          name: "Active",
          type: "boolean",
          nullable: false,
          isPrimaryKey: false,
          isAutoIncrement: false,
          defaultValue: true,
        },
        {
          id: "created_at",
          name: "Created At",
          type: "datetime",
          nullable: false,
          isPrimaryKey: false,
          isAutoIncrement: false,
          defaultValue: new Date().toISOString(),
        },
        {
          id: "profile_uuid",
          name: "Profile UUID",
          type: "uuid",
          nullable: true,
          isPrimaryKey: false,
          isAutoIncrement: false,
        },
      ]

      // Generate sample rows
      const rows = []
      for (let i = 1; i <= 1000; i++) {
        rows.push({
          id: i,
          email: `user${i}@example.com`,
          first_name: `User${i}`,
          last_name: `Lastname${i}`,
          age: 20 + (i % 50),
          salary: 30000 + i * 1000,
          is_active: i % 3 !== 0,
          created_at: new Date(Date.now() - i * 86400000).toISOString(),
          profile_uuid:
            i % 5 === 0
              ? `${i}${i}${i}${i}${i}${i}${i}${i}-${i}${i}${i}${i}-4${i}${i}${i}-${i}${i}${i}${i}-${i}${i}${i}${i}${i}${i}${i}${i}${i}${i}${i}${i}`
              : null,
        })
      }

      const data: TableData = {
        tableName: "users",
        columns,
        rows,
        totalRows: rows.length,
        offset: 0,
        limit: 50,
      }

      setTableData(data)
      setIsLoading(false)
    }

    loadSampleData()
  }, [])

  const handleDataChange = (updatedData: TableData) => {
    setTableData(updatedData)
  }

  if (isLoading) {
    return (
      <div className='loading-container'>
        <div className='loading-spinner'>🔄</div>
        <div className='loading-text'>Loading Advanced DataGrid Demo...</div>
      </div>
    )
  }

  if (!tableData) {
    return (
      <div className='error-container'>
        <div className='error-text'>Failed to load sample data</div>
      </div>
    )
  }

  return (
    <div className='advanced-datagrid-demo'>
      <div className='demo-header'>
        <h1>Advanced DataGrid - Phase 7 Demo</h1>
        <div className='demo-description'>This demo showcases all Phase 7 advanced features:</div>
        <ul className='feature-list'>
          <li>✅ Advanced inline editing with real-time validation</li>
          <li>✅ Data change tracking with visual indicators</li>
          <li>✅ Bulk editing operations with preview</li>
          <li>✅ Copy and paste functionality</li>
          <li>✅ Virtual scrolling for 1000+ rows</li>
          <li>✅ Performance optimization with debouncing</li>
          <li>✅ Cursor AI smart default value generation</li>
        </ul>
        <div className='demo-instructions'>
          <strong>Try these features:</strong>
          <ul>
            <li>Double-click any cell to edit (except ID column)</li>
            <li>Select multiple rows and use "Bulk Edit" button</li>
            <li>Copy cells with Ctrl+C, paste with Ctrl+V</li>
            <li>Click "Changes" button to see change tracking</li>
            <li>Use "AI Assistant" for smart default generation</li>
            <li>Scroll through the virtual list of 1000 rows</li>
          </ul>
        </div>
      </div>

      <div className='demo-content'>
        <AdvancedDataGrid
          data={tableData}
          onDataChange={handleDataChange}
          enableVirtualScrolling={true}
          enableBulkOperations={true}
          enableCopyPaste={true}
          enableAIIntegration={true}
          containerHeight={600}
          readOnly={false}
        />
      </div>

      <div className='demo-footer'>
        <div className='performance-stats'>
          <div className='stat'>
            <span className='stat-label'>Total Rows:</span>
            <span className='stat-value'>{tableData.totalRows}</span>
          </div>
          <div className='stat'>
            <span className='stat-label'>Columns:</span>
            <span className='stat-value'>{tableData.columns.length}</span>
          </div>
          <div className='stat'>
            <span className='stat-label'>Rendered:</span>
            <span className='stat-value'>~20 rows (virtualized)</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Additional CSS for demo styling
const demoStyles = `
.advanced-datagrid-demo {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
  font-family: var(--vscode-font-family);
}

.demo-header {
  margin-bottom: 20px;
  padding: 20px;
  background: var(--vscode-textCodeBlock-background);
  border-radius: 6px;
  border: 1px solid var(--vscode-panel-border);
}

.demo-header h1 {
  margin: 0 0 10px 0;
  color: var(--vscode-foreground);
  font-size: 24px;
}

.demo-description {
  color: var(--vscode-descriptionForeground);
  margin-bottom: 16px;
  font-size: 14px;
}

.feature-list {
  list-style: none;
  padding: 0;
  margin: 0 0 16px 0;
}

.feature-list li {
  padding: 4px 0;
  color: var(--vscode-foreground);
  font-size: 13px;
}

.demo-instructions {
  background: var(--vscode-inputValidation-infoBackground);
  padding: 12px;
  border-radius: 4px;
  border: 1px solid var(--vscode-inputValidation-infoBorder);
}

.demo-instructions strong {
  color: var(--vscode-inputValidation-infoForeground);
  display: block;
  margin-bottom: 8px;
}

.demo-instructions ul {
  margin: 0;
  padding-left: 20px;
  font-size: 12px;
  color: var(--vscode-inputValidation-infoForeground);
}

.demo-instructions li {
  margin-bottom: 4px;
}

.demo-content {
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 20px;
}

.demo-footer {
  padding: 16px;
  background: var(--vscode-textCodeBlock-background);
  border-radius: 6px;
  border: 1px solid var(--vscode-panel-border);
}

.performance-stats {
  display: flex;
  gap: 24px;
  justify-content: center;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-label {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--vscode-focusBorder);
}

.loading-container,
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
}

.loading-spinner {
  font-size: 24px;
  animation: spin 1s linear infinite;
  margin-bottom: 12px;
}

.loading-text,
.error-text {
  color: var(--vscode-foreground);
  font-size: 14px;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`

// Inject demo styles
if (typeof document !== "undefined") {
  const styleElement = document.createElement("style")
  styleElement.textContent = demoStyles
  document.head.appendChild(styleElement)
}
