import type React from "react"
import { useCallback, useEffect, useState } from "react"
import type { DatabaseConfig } from "../../shared/types"
import { useVSCodeAPI } from "../api/vscode"

interface ConnectionConfigDialogProps {
  isOpen: boolean
  initialConfig?: DatabaseConfig
  onSave: (config: DatabaseConfig) => void
  onCancel: () => void
  onTest?: (config: DatabaseConfig) => Promise<{ success: boolean; message: string }>
}

export const ConnectionConfigDialog: React.FC<ConnectionConfigDialogProps> = ({
  isOpen,
  initialConfig,
  onSave,
  onCancel,
  onTest,
}) => {
  const vscodeApi = useVSCodeAPI()
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  // 環境変数やVSCode設定からデフォルト値を取得
  const getDefaultConfig = useCallback(() => {
    // WebView内では直接環境変数にアクセスできないため、VSCode APIから取得
    return {
      id: "",
      name: "",
      type: "mysql" as const,
      host: "localhost", // デフォルト値、実際の値はVSCode設定から取得
      port: 3306,
      database: "",
      username: "",
      password: "",
      ssl: false,
    }
  }, [])

  const [config, setConfig] = useState<Partial<DatabaseConfig>>(getDefaultConfig())

  // VSCode設定からデフォルト値を取得
  useEffect(() => {
    if (isOpen && !initialConfig) {
      // VSCode設定を要求
      vscodeApi.postMessage("getDefaultConnectionConfig", {})
    }
  }, [isOpen, initialConfig, vscodeApi])

  // VSCodeからの設定レスポンスを処理
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data
      if (message.type === "defaultConnectionConfig") {
        const defaultConfig = message.data
        setConfig((prev) => ({
          ...prev,
          host: defaultConfig.host || prev.host,
          port: defaultConfig.port || prev.port,
          database: defaultConfig.database || prev.database,
          username: defaultConfig.username || prev.username,
          // パスワードはセキュリティ上デフォルトで空
        }))
      }
    }

    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [])

  // Initialize config when dialog opens or initialConfig changes
  useEffect(() => {
    if (isOpen && initialConfig) {
      setConfig(initialConfig)
    } else if (isOpen && !initialConfig) {
      // Generate new ID for new connections
      setConfig((prev) => ({
        ...prev,
        id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      }))
    }
  }, [isOpen, initialConfig])

  // Update port when database type changes
  useEffect(() => {
    const defaultPorts = {
      mysql: 3306,
      postgresql: 5432,
      sqlite: 0,
    }
    if (config.type && config.type !== "sqlite") {
      setConfig((prev) => ({
        ...prev,
        port: defaultPorts[config.type as keyof typeof defaultPorts],
      }))
    }
  }, [config.type])

  const handleInputChange = useCallback(
    (field: keyof DatabaseConfig) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.type === "checkbox" ? e.target.checked : e.target.value
      let processedValue: unknown = value

      if (field === "port") {
        processedValue = Number.parseInt(value as string, 10)
      } else if (field === "ssl" && e.target.type === "checkbox") {
        processedValue = value as boolean
      }

      setConfig((prev) => ({
        ...prev,
        [field]: processedValue,
      }))
    },
    []
  )

  const handleTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setConfig((prev) => ({
      ...prev,
      type: e.target.value as DatabaseConfig["type"],
    }))
  }, [])

  const handleTestConnection = useCallback(async () => {
    if (!validateConfig()) {
      return
    }

    setIsTestingConnection(true)
    setTestResult(null)

    try {
      const testConfig = { ...config } as DatabaseConfig
      if (onTest) {
        const result = await onTest(testConfig)
        setTestResult(result)
        if (result.success) {
          vscodeApi.showInfo("Connection test successful!")
        } else {
          vscodeApi.showError(`Connection test failed: ${result.message}`)
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      setTestResult({ success: false, message })
      vscodeApi.showError(`Connection test failed: ${message}`)
    } finally {
      setIsTestingConnection(false)
    }
  }, [config, onTest, vscodeApi])

  const validateConfig = useCallback((): boolean => {
    if (!config.name?.trim()) {
      vscodeApi.showError("Connection name is required")
      return false
    }

    if (config.type !== "sqlite") {
      if (!config.host?.trim()) {
        vscodeApi.showError("Host is required")
        return false
      }
      if (!config.username?.trim()) {
        vscodeApi.showError("Username is required")
        return false
      }
    }

    if (!config.database?.trim() && config.type === "sqlite") {
      vscodeApi.showError("Database path is required for SQLite")
      return false
    }

    return true
  }, [config, vscodeApi])

  const handleSave = useCallback(() => {
    if (!validateConfig()) {
      return
    }

    const finalConfig = { ...config } as DatabaseConfig

    // Note: Password encryption is handled on the extension side
    onSave(finalConfig)
    vscodeApi.showInfo("Connection saved successfully")
  }, [config, onSave, validateConfig, vscodeApi])

  if (!isOpen) {
    return null
  }

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
      <div className='bg-vscode-editor-background rounded-lg shadow-xl w-full max-w-md p-6 border border-vscode-panel-border'>
        <h2 className='text-xl font-bold mb-4 text-vscode-editor-foreground'>
          {initialConfig ? "Edit Connection" : "New Connection"}
        </h2>

        <form onSubmit={(e) => e.preventDefault()} className='space-y-4'>
          {/* Connection Name */}
          <div>
            <label
              htmlFor='name'
              className='block text-sm font-medium text-vscode-editor-foreground mb-1'
            >
              Connection Name <span className='text-red-500'>*</span>
            </label>
            <input
              id='name'
              type='text'
              value={config.name || ""}
              onChange={handleInputChange("name")}
              className='w-full px-3 py-2 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded-md focus:outline-none focus:border-vscode-focusBorder'
              placeholder='My Database'
              required
            />
          </div>

          {/* Database Type */}
          <div>
            <label
              htmlFor='type'
              className='block text-sm font-medium text-vscode-editor-foreground mb-1'
            >
              Database Type <span className='text-red-500'>*</span>
            </label>
            <select
              id='type'
              value={config.type || "mysql"}
              onChange={handleTypeChange}
              className='w-full px-3 py-2 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded-md focus:outline-none focus:border-vscode-focusBorder'
            >
              <option value='mysql'>MySQL</option>
              <option value='postgresql'>PostgreSQL</option>
              <option value='sqlite'>SQLite</option>
            </select>
          </div>

          {/* Host and Port (not for SQLite) */}
          {config.type !== "sqlite" && (
            <>
              <div className='grid grid-cols-3 gap-4'>
                <div className='col-span-2'>
                  <label
                    htmlFor='host'
                    className='block text-sm font-medium text-vscode-editor-foreground mb-1'
                  >
                    Host <span className='text-red-500'>*</span>
                  </label>
                  <input
                    id='host'
                    type='text'
                    value={config.host || ""}
                    onChange={handleInputChange("host")}
                    className='w-full px-3 py-2 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded-md focus:outline-none focus:border-vscode-focusBorder'
                    placeholder='localhost'
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor='port'
                    className='block text-sm font-medium text-vscode-editor-foreground mb-1'
                  >
                    Port <span className='text-red-500'>*</span>
                  </label>
                  <input
                    id='port'
                    type='number'
                    value={config.port || 3306}
                    onChange={handleInputChange("port")}
                    className='w-full px-3 py-2 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded-md focus:outline-none focus:border-vscode-focusBorder'
                    required
                  />
                </div>
              </div>

              {/* Username */}
              <div>
                <label
                  htmlFor='username'
                  className='block text-sm font-medium text-vscode-editor-foreground mb-1'
                >
                  Username <span className='text-red-500'>*</span>
                </label>
                <input
                  id='username'
                  type='text'
                  value={config.username || ""}
                  onChange={handleInputChange("username")}
                  className='w-full px-3 py-2 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded-md focus:outline-none focus:border-vscode-focusBorder'
                  placeholder='root'
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor='password'
                  className='block text-sm font-medium text-vscode-editor-foreground mb-1'
                >
                  Password
                </label>
                <input
                  id='password'
                  type='password'
                  value={config.password || ""}
                  onChange={handleInputChange("password")}
                  className='w-full px-3 py-2 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded-md focus:outline-none focus:border-vscode-focusBorder'
                  placeholder='••••••••'
                />
              </div>
            </>
          )}

          {/* Database */}
          <div>
            <label
              htmlFor='database'
              className='block text-sm font-medium text-vscode-editor-foreground mb-1'
            >
              {config.type === "sqlite" ? "Database Path" : "Database Name"}{" "}
              <span className='text-red-500'>*</span>
            </label>
            <input
              id='database'
              type='text'
              value={config.database || ""}
              onChange={handleInputChange("database")}
              className='w-full px-3 py-2 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded-md focus:outline-none focus:border-vscode-focusBorder'
              placeholder={config.type === "sqlite" ? "/path/to/database.db" : "mydatabase"}
              required
            />
          </div>

          {/* SSL Option */}
          {config.type !== "sqlite" && (
            <div className='flex items-center'>
              <input
                id='ssl'
                type='checkbox'
                checked={typeof config.ssl === "boolean" ? config.ssl : false}
                onChange={handleInputChange("ssl")}
                className='h-4 w-4 text-vscode-checkbox-foreground bg-vscode-checkbox-background border border-vscode-checkbox-border rounded'
              />
              <label htmlFor='ssl' className='ml-2 block text-sm text-vscode-editor-foreground'>
                Use SSL/TLS
              </label>
            </div>
          )}

          {/* Test Result */}
          {testResult && (
            <div
              className={`p-3 rounded-md border ${
                testResult.success
                  ? "bg-vscode-terminal-ansiGreen bg-opacity-20 text-vscode-terminal-ansiGreen border-vscode-terminal-ansiGreen"
                  : "bg-vscode-errorForeground bg-opacity-20 text-vscode-errorForeground border-vscode-errorForeground"
              }`}
            >
              <p className='text-sm'>{testResult.message}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className='flex justify-end gap-2 pt-4'>
            <button
              type='button'
              onClick={onCancel}
              className='px-4 py-2 border border-vscode-button-border rounded-md text-vscode-button-foreground bg-vscode-button-secondaryBackground hover:bg-vscode-button-secondaryHoverBackground focus:outline-none'
            >
              Cancel
            </button>
            <button
              type='button'
              onClick={handleTestConnection}
              disabled={isTestingConnection}
              className='px-4 py-2 bg-vscode-button-background text-vscode-button-foreground rounded-md hover:bg-vscode-button-hoverBackground focus:outline-none disabled:opacity-50'
            >
              {isTestingConnection ? "Testing..." : "Test Connection"}
            </button>
            <button
              type='button'
              onClick={handleSave}
              className='px-4 py-2 bg-vscode-button-background text-vscode-button-foreground rounded-md hover:bg-vscode-button-hoverBackground focus:outline-none'
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
