import React from "react"

export const App: React.FC = () => {
  return (
    <div className='min-h-screen bg-gray-900 text-white p-4'>
      <div className='max-w-7xl mx-auto'>
        <header className='mb-8'>
          <h1 className='text-3xl font-bold text-blue-400 mb-2'>Database DataGrid Manager</h1>
          <p className='text-gray-300'>
            VSCode extension for advanced database management with DataGrid interface
          </p>
        </header>

        <main>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8'>
            <div className='bg-gray-800 rounded-lg p-6 border border-gray-700'>
              <h2 className='text-xl font-semibold text-green-400 mb-3'>データベース接続</h2>
              <p className='text-gray-300 mb-4'>MySQL、PostgreSQL、SQLiteに対応</p>
              <button className='bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white'>
                接続設定
              </button>
            </div>

            <div className='bg-gray-800 rounded-lg p-6 border border-gray-700'>
              <h2 className='text-xl font-semibold text-purple-400 mb-3'>DataGrid</h2>
              <p className='text-gray-300 mb-4'>直感的なテーブルデータ編集</p>
              <button className='bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded text-white'>
                テーブル表示
              </button>
            </div>

            <div className='bg-gray-800 rounded-lg p-6 border border-gray-700'>
              <h2 className='text-xl font-semibold text-orange-400 mb-3'>SQLエディタ</h2>
              <p className='text-gray-300 mb-4'>シンタックスハイライト対応</p>
              <button className='bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded text-white'>
                クエリ実行
              </button>
            </div>
          </div>

          <div className='bg-gray-800 rounded-lg p-6 border border-gray-700'>
            <h2 className='text-xl font-semibold text-yellow-400 mb-3'>
              🚀 フェーズ1: 基盤構築完了
            </h2>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4 text-sm'>
              <div>
                <h3 className='font-semibold text-green-300 mb-2'>✅ 完了項目</h3>
                <ul className='text-gray-300 space-y-1'>
                  <li>• Dev Container環境構築</li>
                  <li>• Docker Compose設定</li>
                  <li>• React 19 + Vite環境</li>
                  <li>• TypeScript設定</li>
                  <li>• Vitest + TDD環境</li>
                  <li>• MSW (Mock Service Worker)</li>
                </ul>
              </div>
              <div>
                <h3 className='font-semibold text-blue-300 mb-2'>🔄 次のステップ</h3>
                <ul className='text-gray-300 space-y-1'>
                  <li>• フェーズ2: データベース接続基盤</li>
                  <li>• フェーズ3: Vite WebView UI基盤</li>
                  <li>• フェーズ4: スキーマエクスプローラー</li>
                  <li>• フェーズ5: TanStack Table DataGrid</li>
                </ul>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
