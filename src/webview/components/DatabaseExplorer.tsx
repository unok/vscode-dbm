import type React from "react"
import { useState } from "react"
import { useVSCodeAPI } from "../api/vscode"

const DatabaseExplorer: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false)
  const vscodeApi = useVSCodeAPI()

  const handleConnect = async (type: "mysql" | "postgresql" | "sqlite") => {
    try {
      vscodeApi.showInfo(`${type} 接続中...`)
      // 実際の接続処理はExtension側で実行
      vscodeApi.postMessage("openConnection", { type })
      setIsConnected(true)
    } catch (error) {
      console.error("Connection failed:", error)
    }
  }

  return (
    <div className='h-full flex flex-col bg-vscode-editor-background'>
      <div className='p-4 border-b border-vscode-panel-border'>
        <h2 className='text-lg font-semibold text-vscode-editor-foreground mb-4'>
          データベースエクスプローラー
        </h2>

        {isConnected ? (
          <div className='text-center py-8'>
            <div className='text-green-400 mb-2'>✅ 接続完了</div>
            <p className='text-sm text-vscode-descriptionForeground'>
              スキーマエクスプローラー機能は開発中です
            </p>
            <button
              onClick={() => setIsConnected(false)}
              className='mt-3 px-4 py-2 bg-vscode-button-background text-vscode-button-foreground rounded hover:bg-vscode-button-hoverBackground'
            >
              切断
            </button>
          </div>
        ) : (
          <div className='space-y-3'>
            <p className='text-sm text-vscode-descriptionForeground mb-3'>
              データベースに接続してスキーマを参照
            </p>

            <div className='grid grid-cols-1 gap-2'>
              <button
                onClick={() => handleConnect("mysql")}
                className='flex items-center p-3 border border-vscode-input-border rounded hover:bg-vscode-list-hoverBackground'
              >
                <span className='mr-2'>🐬</span>
                <div className='text-left'>
                  <div className='font-medium text-vscode-editor-foreground'>MySQL</div>
                  <div className='text-xs text-vscode-descriptionForeground'>Docker:3307</div>
                </div>
              </button>

              <button
                onClick={() => handleConnect("postgresql")}
                className='flex items-center p-3 border border-vscode-input-border rounded hover:bg-vscode-list-hoverBackground'
              >
                <span className='mr-2'>🐘</span>
                <div className='text-left'>
                  <div className='font-medium text-vscode-editor-foreground'>PostgreSQL</div>
                  <div className='text-xs text-vscode-descriptionForeground'>Docker:5433</div>
                </div>
              </button>

              <button
                onClick={() => handleConnect("sqlite")}
                className='flex items-center p-3 border border-vscode-input-border rounded hover:bg-vscode-list-hoverBackground'
              >
                <span className='mr-2'>📁</span>
                <div className='text-left'>
                  <div className='font-medium text-vscode-editor-foreground'>SQLite</div>
                  <div className='text-xs text-vscode-descriptionForeground'>Memory</div>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {isConnected && (
        <div className='flex-1 p-4'>
          <div className='bg-vscode-editorWidget-background border border-vscode-panel-border rounded p-4'>
            <h3 className='font-medium text-vscode-editor-foreground mb-3'>📊 データベース構造</h3>
            <div className='space-y-2 text-sm text-vscode-descriptionForeground'>
              <div>📁 テーブル (3)</div>
              <div className='ml-4'>📄 users</div>
              <div className='ml-4'>📄 products</div>
              <div className='ml-4'>📄 orders</div>
              <div>👁️ ビュー (1)</div>
              <div className='ml-4'>📄 user_orders</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DatabaseExplorer
