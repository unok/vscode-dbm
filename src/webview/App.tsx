import React, { Suspense, startTransition, useState, useEffect } from "react"
import { useVSCodeAPI } from "./api/vscode"
import { Layout } from "./components/Layout"
import { LoadingSpinner } from "./components/LoadingSpinner"
import { useVSCodeTheme } from "./hooks/useVSCodeTheme"
import { DevHelper } from "./utils/devHelper"

// React 19 lazy loading for main components
const DatabaseExplorer = React.lazy(() => import("./components/DatabaseExplorer"))
const DataGrid = React.lazy(() => import("./components/DataGrid"))
const SQLEditor = React.lazy(() => import("./components/SQLEditor"))

type View = "dashboard" | "explorer" | "datagrid" | "sql"

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>("dashboard")
  const theme = useVSCodeTheme()
  const vscodeApi = useVSCodeAPI()

  useEffect(() => {
    // Set initial view from VSCode if provided
    const initialView = vscodeApi.getInitialViewType() as View
    if (initialView && initialView !== "dashboard") {
      setCurrentView(initialView)
    }

    // Listen for view change messages from extension
    vscodeApi.onMessage("changeView", (data) => {
      if (data.viewType) {
        startTransition(() => {
          setCurrentView(data.viewType)
        })
      }
    })

    // Request initial theme
    vscodeApi.getTheme()

    return () => {
      vscodeApi.removeMessageHandler("changeView")
    }
  }, [vscodeApi])

  const handleViewChange = (view: View) => {
    startTransition(() => {
      setCurrentView(view)
    })
  }

  const renderContent = () => {
    switch (currentView) {
      case "explorer":
        return <DatabaseExplorer />
      case "datagrid":
        return <DataGrid />
      case "sql":
        return <SQLEditor />
      default:
        return <DashboardView onViewChange={handleViewChange} />
    }
  }

  return (
    <Layout currentView={currentView} onViewChange={handleViewChange} theme={theme}>
      <Suspense fallback={<LoadingSpinner />}>{renderContent()}</Suspense>
      <DevHelper.DevelopmentOverlay />
    </Layout>
  )
}

const DashboardView: React.FC<{ onViewChange: (view: View) => void }> = ({ onViewChange }) => {
  const vscodeApi = useVSCodeAPI()

  const handleTestConnection = async () => {
    try {
      vscodeApi.showInfo("Testing VSCode API communication...")
      const status = await vscodeApi.getConnectionStatus()
      console.log("Connection status:", status)
    } catch (error) {
      console.error("Connection test failed:", error)
    }
  }

  const handleTestHMR = () => {
    const isWorking = DevHelper.testHMR()
    vscodeApi.showInfo(`HMR ${isWorking ? "is working" : "is not available"}`)
  }
  return (
    <div className='p-6 space-y-6'>
      <header className='mb-8'>
        <h1 className='text-3xl font-bold text-blue-400 mb-2'>Database DataGrid Manager</h1>
        <p className='text-gray-300'>
          VSCode extension for advanced database management with DataGrid interface
        </p>
      </header>

      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8'>
        <div className='card p-6'>
          <h2 className='text-xl font-semibold text-green-400 mb-3'>データベース接続</h2>
          <p className='text-gray-300 mb-4'>MySQL、PostgreSQL、SQLiteに対応</p>
          <div className='space-x-2'>
            <button className='btn-primary' onClick={() => onViewChange("explorer")}>
              接続設定
            </button>
            <button className='btn-secondary' onClick={handleTestConnection}>
              API Test
            </button>
          </div>
        </div>

        <div className='card p-6'>
          <h2 className='text-xl font-semibold text-purple-400 mb-3'>DataGrid</h2>
          <p className='text-gray-300 mb-4'>直感的なテーブルデータ編集</p>
          <button className='btn-primary' onClick={() => onViewChange("datagrid")}>
            テーブル表示
          </button>
        </div>

        <div className='card p-6'>
          <h2 className='text-xl font-semibold text-orange-400 mb-3'>SQLエディタ</h2>
          <p className='text-gray-300 mb-4'>シンタックスハイライト対応</p>
          <button className='btn-primary' onClick={() => onViewChange("sql")}>
            クエリ実行
          </button>
        </div>
      </div>

      <div className='card p-6'>
        <h2 className='text-xl font-semibold text-yellow-400 mb-3'>
          🚀 フェーズ3: Vite WebView UI基盤 構築中
        </h2>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4 text-sm'>
          <div>
            <h3 className='font-semibold text-green-300 mb-2'>✅ 完了項目</h3>
            <ul className='text-gray-300 space-y-1'>
              <li>• React 19 concurrent rendering</li>
              <li>• Suspense boundaries</li>
              <li>• startTransition for smooth UI</li>
              <li>• VSCode theme integration</li>
              <li>• Tailwind CSS setup</li>
              <li>• WebView communication</li>
            </ul>
          </div>
          <div>
            <h3 className='font-semibold text-blue-300 mb-2'>🔄 進行中</h3>
            <ul className='text-gray-300 space-y-1'>
              <li>• フェーズ4: スキーマエクスプローラー</li>
              <li>• フェーズ5: TanStack Table DataGrid</li>
              <li>• フェーズ6: Monaco Editor SQLエディタ</li>
              <li>• Cursor AI統合機能</li>
            </ul>
            <div className='mt-4 space-x-2'>
              <button className='btn-secondary text-xs' onClick={handleTestHMR}>
                Test HMR
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
