import type React from "react"
import { useCallback, useEffect, useState } from "react"
import { useVSCodeAPI } from "../api/vscode"

interface TableRow {
  [key: string]: unknown
}

const DataGrid: React.FC = () => {
  const [data, setData] = useState<TableRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedTable, setSelectedTable] = useState<string>("users")
  const [columns, setColumns] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const vscodeApi = useVSCodeAPI()

  // メッセージリスナーを設定
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data
      if (message.type === "queryResult") {
        if (message.data.success) {
          const results = message.data.results || []
          setData(results)
          // カラム名を動的に設定
          if (results.length > 0) {
            setColumns(Object.keys(results[0]))
          } else {
            setColumns([])
          }
          setError(null)
        } else {
          setError(message.data.message || "クエリ実行エラー")
          setData([])
          setColumns([])
        }
        setIsLoading(false)
      }
    }

    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [])

  const loadTableData = useCallback(
    async (tableName: string) => {
      setIsLoading(true)
      setError(null)
      try {
        // VSCode APIを通じて実際のデータベースからデータを取得
        vscodeApi.postMessage("executeQuery", { query: `SELECT * FROM ${tableName} LIMIT 100` })
      } catch (error) {
        console.error("Failed to load table data:", error)
        setError("データの読み込みに失敗しました")
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
    // 実際のカラム名をそのまま表示
    return columns
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

        {/* Table Input */}
        <div className='flex items-center space-x-2'>
          <label className='text-sm text-vscode-editor-foreground'>テーブル名:</label>
          <input
            type='text'
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value)}
            className='px-2 py-1 text-sm bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded focus:outline-none focus:border-vscode-focusBorder'
            placeholder='テーブル名を入力'
          />
          <button
            type='button'
            onClick={() => loadTableData(selectedTable)}
            disabled={isLoading || !selectedTable}
            className='px-3 py-1 text-sm bg-vscode-button-background text-vscode-button-foreground rounded hover:bg-vscode-button-hoverBackground disabled:opacity-50'
          >
            読み込み
          </button>
        </div>
      </div>

      {/* Data Grid */}
      <div className='flex-1 overflow-auto'>
        {error ? (
          <div className='flex items-center justify-center h-32'>
            <div className='text-red-500'>エラー: {error}</div>
          </div>
        ) : isLoading ? (
          <div className='flex items-center justify-center h-32'>
            <div className='text-vscode-descriptionForeground'>データを読み込み中...</div>
          </div>
        ) : (
          <div className='p-4'>
            <div className='bg-vscode-editorWidget-background border border-vscode-panel-border rounded overflow-hidden'>
              {data.length === 0 ? (
                <div className='p-8 text-center text-vscode-descriptionForeground'>
                  データがありません
                </div>
              ) : (
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
                    {data.map((row, rowIndex) => (
                      <tr
                        key={rowIndex}
                        className='hover:bg-vscode-list-hoverBackground border-b border-vscode-panel-border last:border-b-0'
                      >
                        {columns.map((column, colIndex) => (
                          <td
                            key={colIndex}
                            className='p-3 border-r border-vscode-panel-border last:border-r-0 text-vscode-editor-foreground'
                          >
                            {renderCellValue(row[column])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
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
