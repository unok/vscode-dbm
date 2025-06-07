import React, { useRef, useState } from "react"
import { useVSCodeAPI } from "../api/vscode"

interface QueryResult {
  [key: string]: unknown
}

const SQLEditor: React.FC = () => {
  const [query, setQuery] = useState("SELECT * FROM users LIMIT 10")
  const [results, setResults] = useState<QueryResult[]>([])
  const [isExecuting, setIsExecuting] = useState(false)
  const [executionTime, setExecutionTime] = useState<number | null>(null)
  const [error, setError] = useState<string>("")
  const [rowCount, setRowCount] = useState<number>(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const vscodeApi = useVSCodeAPI()

  // メッセージリスナーを設定
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data
      if (message.type === "queryResult") {
        setIsExecuting(false)
        if (message.data.success) {
          setResults(message.data.results || [])
          setRowCount(message.data.rowCount || 0)
          setExecutionTime(message.data.executionTime || 0)
          setError("")
        } else {
          setError(message.data.message || "クエリ実行エラー")
          setResults([])
          setRowCount(0)
        }
      }
    }
    window.addEventListener("message", handleMessage)
    return () => {
      window.removeEventListener("message", handleMessage)
    }
  }, [])

  const sampleQueries = [
    "SELECT * FROM users LIMIT 10",
    "SELECT * FROM products WHERE price > 100",
    "SELECT u.name, COUNT(o.id) as order_count FROM users u LEFT JOIN orders o ON u.id = o.user_id GROUP BY u.id",
    "INSERT INTO users (name, email) VALUES ('Test User', 'test@example.com')",
    "UPDATE users SET email = 'updated@example.com' WHERE id = 1",
  ]

  const handleExecuteQuery = () => {
    if (!query.trim()) {
      setError("クエリを入力してください")
      return
    }
    setIsExecuting(true)
    setError("")
    setResults([])
    vscodeApi.postMessage("executeQuery", { query: query.trim() })
  }

  const handleFormatSQL = () => {
    // 簡単なSQL整形
    const formatted = query
      .replace(/\s+/g, " ")
      .replace(
        /\b(SELECT|FROM|WHERE|ORDER BY|GROUP BY|HAVING|JOIN|LEFT JOIN|RIGHT JOIN|INNER JOIN|UNION|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/gi,
        "\n$1"
      )
      .replace(/\s*,\s*/g, ",\n  ")
      .trim()

    setQuery(formatted)
    vscodeApi.showInfo("SQLを整形しました")
  }

  const handleClearEditor = () => {
    setQuery("")
    setResults([])
    setError("")
    setExecutionTime(null)
  }

  const insertSampleQuery = (sampleQuery: string) => {
    setQuery(sampleQuery)
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }

  const renderResults = () => {
    if (error) {
      return (
        <div className='p-4 bg-red-50 border border-red-200 rounded'>
          <h3 className='font-medium text-red-800 mb-2'>エラー</h3>
          <p className='text-sm text-red-600'>{error}</p>
        </div>
      )
    }

    if (results.length === 0) {
      return (
        <div className='p-4 text-center text-vscode-descriptionForeground'>
          クエリを実行すると結果がここに表示されます
        </div>
      )
    }

    return (
      <div className='overflow-auto'>
        <div className='bg-vscode-editorWidget-background border border-vscode-panel-border rounded overflow-hidden'>
          <table className='w-full'>
            <thead className='bg-vscode-editorWidget-background border-b border-vscode-panel-border'>
              <tr>
                {Object.keys(results[0]).map((key) => (
                  <th
                    key={key}
                    className='text-left p-3 font-medium text-vscode-editor-foreground border-r border-vscode-panel-border last:border-r-0'
                  >
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((row, index) => (
                <tr
                  key={index}
                  className='hover:bg-vscode-list-hoverBackground border-b border-vscode-panel-border last:border-b-0'
                >
                  {Object.values(row).map((value, cellIndex) => (
                    <td
                      key={cellIndex}
                      className='p-3 border-r border-vscode-panel-border last:border-r-0 text-vscode-editor-foreground'
                    >
                      {value === null || value === undefined ? (
                        <span className='text-gray-400 italic'>NULL</span>
                      ) : (
                        String(value)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {executionTime !== null && (
          <div className='mt-2 text-sm text-vscode-descriptionForeground'>
            実行時間: {executionTime}ms ({rowCount}行)
          </div>
        )}
      </div>
    )
  }

  return (
    <div className='h-full flex flex-col bg-vscode-editor-background'>
      {/* Header */}
      <div className='p-4 border-b border-vscode-panel-border'>
        <div className='flex items-center justify-between mb-4'>
          <h2 className='text-lg font-semibold text-vscode-editor-foreground'>SQLエディタ</h2>
          <div className='flex space-x-2'>
            <button
              type='button'
              onClick={handleFormatSQL}
              className='px-3 py-1 text-sm bg-vscode-button-background text-vscode-button-foreground rounded hover:bg-vscode-button-hoverBackground'
            >
              整形
            </button>
            <button
              type='button'
              onClick={handleClearEditor}
              className='px-3 py-1 text-sm border border-vscode-input-border text-vscode-input-foreground rounded hover:bg-vscode-list-hoverBackground'
            >
              クリア
            </button>
            <button
              type='button'
              onClick={handleExecuteQuery}
              disabled={isExecuting}
              className='px-4 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50'
            >
              {isExecuting ? "実行中..." : "実行 (⌘+Enter)"}
            </button>
          </div>
        </div>

        {/* Sample Queries */}
        <div className='mb-4'>
          <h3 className='text-sm font-medium text-vscode-editor-foreground mb-2'>
            サンプルクエリ:
          </h3>
          <div className='flex flex-wrap gap-2'>
            {sampleQueries.map((sample, index) => (
              <button
                type='button'
                key={index}
                onClick={() => insertSampleQuery(sample)}
                className='px-2 py-1 text-xs border border-vscode-input-border text-vscode-input-foreground rounded hover:bg-vscode-list-hoverBackground'
                title={sample}
              >
                {sample.substring(0, 30)}...
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Editor Area */}
      <div className='flex-1 flex flex-col overflow-hidden'>
        <div className='flex-1 p-4'>
          <div className='h-full flex flex-col space-y-4'>
            {/* SQL Input */}
            <div className='flex-1 min-h-[200px]'>
              <label
                htmlFor='sql-query-input'
                className='block text-sm font-medium text-vscode-editor-foreground mb-2'
              >
                SQLクエリ:
              </label>
              <textarea
                id='sql-query-input'
                ref={textareaRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className='w-full h-full p-3 font-mono text-sm border border-vscode-input-border bg-vscode-input-background text-vscode-input-foreground rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500'
                placeholder='SQLクエリを入力してください...'
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault()
                    handleExecuteQuery()
                  }
                }}
              />
            </div>

            {/* Results */}
            <div className='flex-1 min-h-[200px]'>
              <h3 className='text-sm font-medium text-vscode-editor-foreground mb-2'>実行結果:</h3>
              <div className='h-full border border-vscode-panel-border rounded overflow-hidden'>
                {renderResults()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className='p-2 border-t border-vscode-panel-border bg-vscode-editorWidget-background'>
        <div className='text-xs text-vscode-descriptionForeground'>
          💡 Monaco Editor統合とシンタックスハイライトは開発中です
        </div>
      </div>
    </div>
  )
}

export default SQLEditor
