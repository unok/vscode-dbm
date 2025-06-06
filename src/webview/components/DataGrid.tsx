import type React from "react"
import { useCallback, useEffect, useState } from "react"
import { useVSCodeAPI } from "../api/vscode"

interface SampleRow {
  id: number
  name: string
  email: string
  created_at: string
}

const DataGrid: React.FC = () => {
  const [data, setData] = useState<SampleRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedTable, setSelectedTable] = useState<"users" | "products" | "orders">("users")
  const vscodeApi = useVSCodeAPI()

  const sampleData = {
    users: [
      { id: 1, name: "Alice", email: "alice@example.com", created_at: "2024-01-01 10:00:00" },
      { id: 2, name: "Bob", email: "bob@example.com", created_at: "2024-01-01 11:00:00" },
      { id: 3, name: "Charlie", email: "charlie@example.com", created_at: "2024-01-01 12:00:00" },
    ],
    products: [
      { id: 1, name: "Laptop", email: "999.99", created_at: "Electronics" },
      { id: 2, name: "Book", email: "19.99", created_at: "Education" },
      { id: 3, name: "Coffee", email: "4.50", created_at: "Food" },
    ],
    orders: [
      { id: 1, name: "Order #1001", email: "Alice", created_at: "2024-01-01" },
      { id: 2, name: "Order #1002", email: "Bob", created_at: "2024-01-01" },
    ],
  }

  const loadTableData = useCallback(
    async (tableName: typeof selectedTable) => {
      setIsLoading(true)
      try {
        // シミュレーション: 実際にはVSCode APIを通じてデータを取得
        await new Promise((resolve) => setTimeout(resolve, 500))
        setData(sampleData[tableName])
        vscodeApi.showInfo(`${tableName} テーブルを読み込みました`)
      } catch (error) {
        console.error("Failed to load table data:", error)
      } finally {
        setIsLoading(false)
      }
    },
    [vscodeApi]
  )

  useEffect(() => {
    loadTableData(selectedTable)
  }, [selectedTable, loadTableData])

  const handleRefresh = () => {
    loadTableData(selectedTable)
  }

  const handleExecuteQuery = () => {
    vscodeApi.postMessage("executeQuery", { query: `SELECT * FROM ${selectedTable}` })
  }

  const getColumnHeaders = () => {
    switch (selectedTable) {
      case "users":
        return ["ID", "名前", "メール", "作成日時"]
      case "products":
        return ["ID", "商品名", "価格", "カテゴリ"]
      case "orders":
        return ["ID", "注文番号", "顧客", "注文日"]
      default:
        return ["ID", "名前", "メール", "作成日時"]
    }
  }

  const renderCellValue = (value: unknown) => {
    if (value === null || value === undefined) {
      return <span className='text-gray-400 italic'>NULL</span>
    }
    return String(value)
  }

  return (
    <div className='h-full flex flex-col bg-vscode-editor-background'>
      {/* Header */}
      <div className='p-4 border-b border-vscode-panel-border'>
        <div className='flex items-center justify-between mb-4'>
          <h2 className='text-lg font-semibold text-vscode-editor-foreground'>データグリッド</h2>
          <div className='flex space-x-2'>
            <button
              type='button'
              onClick={handleRefresh}
              disabled={isLoading}
              className='px-3 py-1 text-sm bg-vscode-button-background text-vscode-button-foreground rounded hover:bg-vscode-button-hoverBackground disabled:opacity-50'
            >
              {isLoading ? "読み込み中..." : "更新"}
            </button>
            <button
              type='button'
              onClick={handleExecuteQuery}
              className='px-3 py-1 text-sm bg-vscode-button-background text-vscode-button-foreground rounded hover:bg-vscode-button-hoverBackground'
            >
              クエリ実行
            </button>
          </div>
        </div>

        {/* Table Selector */}
        <div className='flex space-x-2'>
          {(["users", "products", "orders"] as const).map((table) => (
            <button
              type='button'
              key={table}
              onClick={() => setSelectedTable(table)}
              className={`px-3 py-1 text-sm rounded border ${
                selectedTable === table
                  ? "bg-vscode-button-background text-vscode-button-foreground border-vscode-button-background"
                  : "border-vscode-input-border text-vscode-input-foreground hover:bg-vscode-list-hoverBackground"
              }`}
            >
              {table}
            </button>
          ))}
        </div>
      </div>

      {/* Data Grid */}
      <div className='flex-1 overflow-auto'>
        {isLoading ? (
          <div className='flex items-center justify-center h-32'>
            <div className='text-vscode-descriptionForeground'>データを読み込み中...</div>
          </div>
        ) : (
          <div className='p-4'>
            <div className='bg-vscode-editorWidget-background border border-vscode-panel-border rounded overflow-hidden'>
              <table className='w-full'>
                <thead className='bg-vscode-editorWidget-background border-b border-vscode-panel-border'>
                  <tr>
                    {getColumnHeaders().map((header, index) => (
                      <th
                        key={index}
                        className='text-left p-3 font-medium text-vscode-editor-foreground border-r border-vscode-panel-border last:border-r-0'
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, _rowIndex) => (
                    <tr
                      key={row.id}
                      className='hover:bg-vscode-list-hoverBackground border-b border-vscode-panel-border last:border-b-0'
                    >
                      <td className='p-3 border-r border-vscode-panel-border last:border-r-0 text-vscode-editor-foreground'>
                        {renderCellValue(row.id)}
                      </td>
                      <td className='p-3 border-r border-vscode-panel-border last:border-r-0 text-vscode-editor-foreground'>
                        {renderCellValue(row.name)}
                      </td>
                      <td className='p-3 border-r border-vscode-panel-border last:border-r-0 text-vscode-editor-foreground'>
                        {renderCellValue(row.email)}
                      </td>
                      <td className='p-3 border-r border-vscode-panel-border last:border-r-0 text-vscode-editor-foreground'>
                        {renderCellValue(row.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className='mt-4 flex items-center justify-between text-sm text-vscode-descriptionForeground'>
              <div>{data.length} 行表示</div>
              <div className='text-xs'>💡 TanStack Table統合は開発中です</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default DataGrid
