/**
 * SettingsUI - 設定画面コンポーネント
 * フェーズ12: ユーザビリティ向上機能
 */

import type React from "react"
import { useCallback, useRef, useState } from "react"
import type {
  AppSettings,
  SettingsService,
  SettingsValidationError,
} from "../../shared/services/SettingsService"

interface SettingsUIProps {
  settingsService: SettingsService
  onClose: () => void
}

type SettingsTab = "general" | "database" | "editor" | "ui" | "advanced"

export const SettingsUI: React.FC<SettingsUIProps> = ({ settingsService, onClose }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general")
  const [currentSettings, setCurrentSettings] = useState<AppSettings>(settingsService.getSettings())
  const [validationErrors, setValidationErrors] = useState<SettingsValidationError[]>([])
  const [saveError, setSaveError] = useState<string>("")
  const [importError, setImportError] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const updateSettings = useCallback(
    (newSettings: Partial<AppSettings>) => {
      const updated = {
        ...currentSettings,
        ...newSettings,
        general: { ...currentSettings.general, ...newSettings.general },
        database: { ...currentSettings.database, ...newSettings.database },
        editor: { ...currentSettings.editor, ...newSettings.editor },
        ui: { ...currentSettings.ui, ...newSettings.ui },
        advanced: { ...currentSettings.advanced, ...newSettings.advanced },
      }
      setCurrentSettings(updated)

      // Validate changes
      const errors = settingsService.validateSettings(newSettings)
      setValidationErrors(errors)
    },
    [currentSettings, settingsService]
  )

  const handleSave = useCallback(() => {
    try {
      setSaveError("")
      const errors = settingsService.validateSettings(currentSettings)
      if (errors.length > 0) {
        setValidationErrors(errors)
        return
      }

      settingsService.updateSettings(currentSettings)
      onClose()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save settings")
    }
  }, [currentSettings, settingsService, onClose])

  const handleCancel = useCallback(() => {
    setCurrentSettings(settingsService.getSettings())
    onClose()
  }, [settingsService, onClose])

  const handleReset = useCallback(() => {
    settingsService.resetToDefaults()
    setCurrentSettings(settingsService.getSettings())
    setValidationErrors([])
  }, [settingsService])

  const handleExport = useCallback(() => {
    const settingsJson = settingsService.exportSettings()
    const blob = new Blob([settingsJson], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "vscode-dbm-settings.json"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [settingsService])

  const handleImport = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      setImportError("")
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string
          settingsService.importSettings(content)
          setCurrentSettings(settingsService.getSettings())
          setValidationErrors([])
        } catch (error) {
          setImportError(error instanceof Error ? error.message : "Invalid settings file")
        }
      }
      reader.readAsText(file)
    },
    [settingsService]
  )

  const getErrorForField = useCallback(
    (field: string) => {
      return validationErrors.find((error) => error.field === field)?.message
    },
    [validationErrors]
  )

  const renderGeneralSettings = () => (
    <div className='space-y-4'>
      <div className='flex items-center space-x-2'>
        <input
          type='checkbox'
          id='autoSaveQueries'
          checked={currentSettings.general.autoSaveQueries}
          onChange={(e) =>
            updateSettings({
              general: { ...currentSettings.general, autoSaveQueries: e.target.checked },
            })
          }
          className='rounded border-gray-300'
        />
        <label htmlFor='autoSaveQueries' className='text-sm font-medium'>
          Auto-save queries
        </label>
      </div>

      <div className='flex items-center space-x-2'>
        <input
          type='checkbox'
          id='rememberWindowSize'
          checked={currentSettings.general.rememberWindowSize}
          onChange={(e) =>
            updateSettings({
              general: { ...currentSettings.general, rememberWindowSize: e.target.checked },
            })
          }
          className='rounded border-gray-300'
        />
        <label htmlFor='rememberWindowSize' className='text-sm font-medium'>
          Remember window size
        </label>
      </div>

      <div className='flex items-center space-x-2'>
        <input
          type='checkbox'
          id='checkForUpdates'
          checked={currentSettings.general.checkForUpdates}
          onChange={(e) =>
            updateSettings({
              general: { ...currentSettings.general, checkForUpdates: e.target.checked },
            })
          }
          className='rounded border-gray-300'
        />
        <label htmlFor='checkForUpdates' className='text-sm font-medium'>
          Check for updates
        </label>
      </div>

      <div className='flex items-center space-x-2'>
        <input
          type='checkbox'
          id='autoBackup'
          checked={currentSettings.general.autoBackup}
          onChange={(e) =>
            updateSettings({
              general: { ...currentSettings.general, autoBackup: e.target.checked },
            })
          }
          className='rounded border-gray-300'
        />
        <label htmlFor='autoBackup' className='text-sm font-medium'>
          Auto backup
        </label>
      </div>

      <div className='space-y-1'>
        <label htmlFor='backupInterval' className='block text-sm font-medium'>
          Backup interval (minutes)
        </label>
        <input
          type='number'
          id='backupInterval'
          value={currentSettings.general.backupInterval}
          onChange={(e) =>
            updateSettings({
              general: {
                ...currentSettings.general,
                backupInterval: Number.parseInt(e.target.value, 10),
              },
            })
          }
          min='1'
          max='1440'
          className='block w-full rounded border-gray-300 px-3 py-2 text-sm'
        />
        {getErrorForField("general.backupInterval") && (
          <p className='text-red-500 text-xs'>{getErrorForField("general.backupInterval")}</p>
        )}
      </div>
    </div>
  )

  const renderDatabaseSettings = () => (
    <div className='space-y-4'>
      <div className='space-y-1'>
        <label htmlFor='connectionTimeout' className='block text-sm font-medium'>
          Connection timeout (seconds)
        </label>
        <input
          type='number'
          id='connectionTimeout'
          value={currentSettings.database.connectionTimeout}
          onChange={(e) =>
            updateSettings({
              database: {
                ...currentSettings.database,
                connectionTimeout: Number.parseInt(e.target.value, 10),
              },
            })
          }
          min='1'
          className='block w-full rounded border-gray-300 px-3 py-2 text-sm'
        />
        {getErrorForField("database.connectionTimeout") && (
          <p className='text-red-500 text-xs'>{getErrorForField("database.connectionTimeout")}</p>
        )}
      </div>

      <div className='space-y-1'>
        <label htmlFor='queryTimeout' className='block text-sm font-medium'>
          Query timeout (seconds)
        </label>
        <input
          type='number'
          id='queryTimeout'
          value={currentSettings.database.queryTimeout}
          onChange={(e) =>
            updateSettings({
              database: {
                ...currentSettings.database,
                queryTimeout: Number.parseInt(e.target.value, 10),
              },
            })
          }
          min='1'
          className='block w-full rounded border-gray-300 px-3 py-2 text-sm'
        />
        {getErrorForField("database.queryTimeout") && (
          <p className='text-red-500 text-xs'>{getErrorForField("database.queryTimeout")}</p>
        )}
      </div>

      <div className='space-y-1'>
        <label htmlFor='maxConnections' className='block text-sm font-medium'>
          Max connections
        </label>
        <input
          type='number'
          id='maxConnections'
          value={currentSettings.database.maxConnections}
          onChange={(e) =>
            updateSettings({
              database: {
                ...currentSettings.database,
                maxConnections: Number.parseInt(e.target.value, 10),
              },
            })
          }
          min='1'
          max='50'
          className='block w-full rounded border-gray-300 px-3 py-2 text-sm'
        />
        {getErrorForField("database.maxConnections") && (
          <p className='text-red-500 text-xs'>{getErrorForField("database.maxConnections")}</p>
        )}
      </div>

      <div className='flex items-center space-x-2'>
        <input
          type='checkbox'
          id='autoRefreshSchema'
          checked={currentSettings.database.autoRefreshSchema}
          onChange={(e) =>
            updateSettings({
              database: { ...currentSettings.database, autoRefreshSchema: e.target.checked },
            })
          }
          className='rounded border-gray-300'
        />
        <label htmlFor='autoRefreshSchema' className='text-sm font-medium'>
          Auto-refresh schema
        </label>
      </div>

      <div className='flex items-center space-x-2'>
        <input
          type='checkbox'
          id='encryptPasswords'
          checked={currentSettings.database.encryptPasswords}
          onChange={(e) =>
            updateSettings({
              database: { ...currentSettings.database, encryptPasswords: e.target.checked },
            })
          }
          className='rounded border-gray-300'
        />
        <label htmlFor='encryptPasswords' className='text-sm font-medium'>
          Encrypt passwords
        </label>
      </div>
    </div>
  )

  const renderEditorSettings = () => (
    <div className='space-y-4'>
      <div className='space-y-1'>
        <label htmlFor='tabSize' className='block text-sm font-medium'>
          Tab size
        </label>
        <input
          type='number'
          id='tabSize'
          value={currentSettings.editor.tabSize}
          onChange={(e) =>
            updateSettings({
              editor: { ...currentSettings.editor, tabSize: Number.parseInt(e.target.value, 10) },
            })
          }
          min='1'
          max='8'
          className='block w-full rounded border-gray-300 px-3 py-2 text-sm'
        />
        {getErrorForField("editor.tabSize") && (
          <p className='text-red-500 text-xs'>{getErrorForField("editor.tabSize")}</p>
        )}
      </div>

      <div className='flex items-center space-x-2'>
        <input
          type='checkbox'
          id='insertSpaces'
          checked={currentSettings.editor.insertSpaces}
          onChange={(e) =>
            updateSettings({
              editor: { ...currentSettings.editor, insertSpaces: e.target.checked },
            })
          }
          className='rounded border-gray-300'
        />
        <label htmlFor='insertSpaces' className='text-sm font-medium'>
          Insert spaces
        </label>
      </div>

      <div className='flex items-center space-x-2'>
        <input
          type='checkbox'
          id='wordWrap'
          checked={currentSettings.editor.wordWrap}
          onChange={(e) =>
            updateSettings({
              editor: { ...currentSettings.editor, wordWrap: e.target.checked },
            })
          }
          className='rounded border-gray-300'
        />
        <label htmlFor='wordWrap' className='text-sm font-medium'>
          Word wrap
        </label>
      </div>

      <div className='flex items-center space-x-2'>
        <input
          type='checkbox'
          id='autoComplete'
          checked={currentSettings.editor.autoComplete}
          onChange={(e) =>
            updateSettings({
              editor: { ...currentSettings.editor, autoComplete: e.target.checked },
            })
          }
          className='rounded border-gray-300'
        />
        <label htmlFor='autoComplete' className='text-sm font-medium'>
          Auto-complete
        </label>
      </div>

      <div className='flex items-center space-x-2'>
        <input
          type='checkbox'
          id='showMinimap'
          checked={currentSettings.editor.showMinimap}
          onChange={(e) =>
            updateSettings({
              editor: { ...currentSettings.editor, showMinimap: e.target.checked },
            })
          }
          className='rounded border-gray-300'
        />
        <label htmlFor='showMinimap' className='text-sm font-medium'>
          Show minimap
        </label>
      </div>

      <div className='flex items-center space-x-2'>
        <input
          type='checkbox'
          id='formatOnSave'
          checked={currentSettings.editor.formatOnSave}
          onChange={(e) =>
            updateSettings({
              editor: { ...currentSettings.editor, formatOnSave: e.target.checked },
            })
          }
          className='rounded border-gray-300'
        />
        <label htmlFor='formatOnSave' className='text-sm font-medium'>
          Format on save
        </label>
      </div>
    </div>
  )

  const renderUISettings = () => (
    <div className='space-y-4'>
      <div className='space-y-1'>
        <label htmlFor='theme' className='block text-sm font-medium'>
          Theme
        </label>
        <select
          id='theme'
          value={currentSettings.ui.theme}
          onChange={(e) =>
            updateSettings({
              ui: { ...currentSettings.ui, theme: e.target.value as "auto" | "light" | "dark" },
            })
          }
          className='block w-full rounded border-gray-300 px-3 py-2 text-sm'
        >
          <option value='auto'>Auto</option>
          <option value='light'>Light</option>
          <option value='dark'>Dark</option>
        </select>
      </div>

      <div className='space-y-1'>
        <label htmlFor='uiFontSize' className='block text-sm font-medium'>
          Font size
        </label>
        <input
          type='number'
          id='uiFontSize'
          value={currentSettings.ui.fontSize}
          onChange={(e) =>
            updateSettings({
              ui: { ...currentSettings.ui, fontSize: Number.parseInt(e.target.value, 10) },
            })
          }
          min='8'
          max='30'
          className='block w-full rounded border-gray-300 px-3 py-2 text-sm'
        />
        {getErrorForField("ui.fontSize") && (
          <p className='text-red-500 text-xs'>{getErrorForField("ui.fontSize")}</p>
        )}
      </div>

      <div className='flex items-center space-x-2'>
        <input
          type='checkbox'
          id='showLineNumbers'
          checked={currentSettings.ui.showLineNumbers}
          onChange={(e) =>
            updateSettings({
              ui: { ...currentSettings.ui, showLineNumbers: e.target.checked },
            })
          }
          className='rounded border-gray-300'
        />
        <label htmlFor='showLineNumbers' className='text-sm font-medium'>
          Show line numbers
        </label>
      </div>

      <div className='flex items-center space-x-2'>
        <input
          type='checkbox'
          id='showStatusBar'
          checked={currentSettings.ui.showStatusBar}
          onChange={(e) =>
            updateSettings({
              ui: { ...currentSettings.ui, showStatusBar: e.target.checked },
            })
          }
          className='rounded border-gray-300'
        />
        <label htmlFor='showStatusBar' className='text-sm font-medium'>
          Show status bar
        </label>
      </div>

      <div className='flex items-center space-x-2'>
        <input
          type='checkbox'
          id='compactMode'
          checked={currentSettings.ui.compactMode}
          onChange={(e) =>
            updateSettings({
              ui: { ...currentSettings.ui, compactMode: e.target.checked },
            })
          }
          className='rounded border-gray-300'
        />
        <label htmlFor='compactMode' className='text-sm font-medium'>
          Compact mode
        </label>
      </div>

      <div className='flex items-center space-x-2'>
        <input
          type='checkbox'
          id='animationsEnabled'
          checked={currentSettings.ui.animationsEnabled}
          onChange={(e) =>
            updateSettings({
              ui: { ...currentSettings.ui, animationsEnabled: e.target.checked },
            })
          }
          className='rounded border-gray-300'
        />
        <label htmlFor='animationsEnabled' className='text-sm font-medium'>
          Enable animations
        </label>
      </div>
    </div>
  )

  const renderAdvancedSettings = () => (
    <div className='space-y-4'>
      <div className='flex items-center space-x-2'>
        <input
          type='checkbox'
          id='debugMode'
          checked={currentSettings.advanced.debugMode}
          onChange={(e) =>
            updateSettings({
              advanced: { ...currentSettings.advanced, debugMode: e.target.checked },
            })
          }
          className='rounded border-gray-300'
        />
        <label htmlFor='debugMode' className='text-sm font-medium'>
          Debug mode
        </label>
      </div>

      <div className='flex items-center space-x-2'>
        <input
          type='checkbox'
          id='enableTelemetry'
          checked={currentSettings.advanced.enableTelemetry}
          onChange={(e) =>
            updateSettings({
              advanced: { ...currentSettings.advanced, enableTelemetry: e.target.checked },
            })
          }
          className='rounded border-gray-300'
        />
        <label htmlFor='enableTelemetry' className='text-sm font-medium'>
          Enable telemetry
        </label>
      </div>

      <div className='space-y-1'>
        <label htmlFor='logLevel' className='block text-sm font-medium'>
          Log level
        </label>
        <select
          id='logLevel'
          value={currentSettings.advanced.logLevel}
          onChange={(e) =>
            updateSettings({
              advanced: {
                ...currentSettings.advanced,
                logLevel: e.target.value as "error" | "warn" | "info" | "debug",
              },
            })
          }
          className='block w-full rounded border-gray-300 px-3 py-2 text-sm'
        >
          <option value='error'>Error</option>
          <option value='warn'>Warning</option>
          <option value='info'>Info</option>
          <option value='debug'>Debug</option>
        </select>
      </div>

      <div className='space-y-1'>
        <label htmlFor='maxLogFiles' className='block text-sm font-medium'>
          Max log files
        </label>
        <input
          type='number'
          id='maxLogFiles'
          value={currentSettings.advanced.maxLogFiles}
          onChange={(e) =>
            updateSettings({
              advanced: {
                ...currentSettings.advanced,
                maxLogFiles: Number.parseInt(e.target.value, 10),
              },
            })
          }
          min='1'
          max='100'
          className='block w-full rounded border-gray-300 px-3 py-2 text-sm'
        />
        {getErrorForField("advanced.maxLogFiles") && (
          <p className='text-red-500 text-xs'>{getErrorForField("advanced.maxLogFiles")}</p>
        )}
      </div>

      <div className='flex items-center space-x-2'>
        <input
          type='checkbox'
          id='performanceMonitoring'
          checked={currentSettings.advanced.performanceMonitoring}
          onChange={(e) =>
            updateSettings({
              advanced: { ...currentSettings.advanced, performanceMonitoring: e.target.checked },
            })
          }
          className='rounded border-gray-300'
        />
        <label htmlFor='performanceMonitoring' className='text-sm font-medium'>
          Performance monitoring
        </label>
      </div>

      <div className='flex items-center space-x-2'>
        <input
          type='checkbox'
          id='experimentalFeatures'
          checked={currentSettings.advanced.experimentalFeatures}
          onChange={(e) =>
            updateSettings({
              advanced: { ...currentSettings.advanced, experimentalFeatures: e.target.checked },
            })
          }
          className='rounded border-gray-300'
        />
        <label htmlFor='experimentalFeatures' className='text-sm font-medium'>
          Experimental features
        </label>
      </div>

      <div className='border-t pt-4 space-y-4'>
        <h3 className='text-lg font-medium'>Import/Export</h3>

        <div className='flex space-x-2'>
          <button
            type='button'
            onClick={handleExport}
            className='px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700'
          >
            Export Settings
          </button>

          <button
            type='button'
            onClick={() => fileInputRef.current?.click()}
            className='px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700'
          >
            Import Settings
          </button>
        </div>

        <input
          ref={fileInputRef}
          type='file'
          accept='.json'
          onChange={handleImport}
          className='hidden'
          aria-label='Import settings file'
        />

        {importError && <p className='text-red-500 text-sm'>{importError}</p>}
      </div>
    </div>
  )

  const renderTabContent = () => {
    switch (activeTab) {
      case "general":
        return renderGeneralSettings()
      case "database":
        return renderDatabaseSettings()
      case "editor":
        return renderEditorSettings()
      case "ui":
        return renderUISettings()
      case "advanced":
        return renderAdvancedSettings()
      default:
        return null
    }
  }

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
      <div
        className='bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden'
        role='dialog'
        aria-labelledby='settings-title'
      >
        <div className='flex h-full'>
          {/* Settings Navigation */}
          <div className='w-48 bg-gray-50 border-r'>
            <div className='p-4 border-b'>
              <h2 id='settings-title' className='text-lg font-semibold'>
                Settings
              </h2>
            </div>
            <nav className='p-2'>
              <button
                type='button'
                onClick={() => setActiveTab("general")}
                className={`w-full text-left px-3 py-2 rounded text-sm ${
                  activeTab === "general" ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"
                }`}
                role='tab'
                tabIndex={0}
              >
                General
              </button>
              <button
                type='button'
                onClick={() => setActiveTab("database")}
                className={`w-full text-left px-3 py-2 rounded text-sm ${
                  activeTab === "database" ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"
                }`}
                role='tab'
                tabIndex={0}
              >
                Database
              </button>
              <button
                type='button'
                onClick={() => setActiveTab("editor")}
                className={`w-full text-left px-3 py-2 rounded text-sm ${
                  activeTab === "editor" ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"
                }`}
                role='tab'
                tabIndex={0}
              >
                Editor
              </button>
              <button
                type='button'
                onClick={() => setActiveTab("ui")}
                className={`w-full text-left px-3 py-2 rounded text-sm ${
                  activeTab === "ui" ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"
                }`}
                role='tab'
                tabIndex={0}
              >
                UI
              </button>
              <button
                type='button'
                onClick={() => setActiveTab("advanced")}
                className={`w-full text-left px-3 py-2 rounded text-sm ${
                  activeTab === "advanced" ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"
                }`}
                role='tab'
                tabIndex={0}
              >
                Advanced
              </button>
            </nav>
          </div>

          {/* Settings Content */}
          <div className='flex-1 flex flex-col'>
            <div className='flex-1 p-6 overflow-y-auto'>{renderTabContent()}</div>

            {/* Actions */}
            <div className='border-t p-4 bg-gray-50'>
              {saveError && <p className='text-red-500 text-sm mb-2'>{saveError}</p>}
              <div className='flex justify-between'>
                <button
                  type='button'
                  onClick={handleReset}
                  className='px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50'
                >
                  Reset to Defaults
                </button>

                <div className='space-x-2'>
                  <button
                    type='button'
                    onClick={handleCancel}
                    className='px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50'
                  >
                    Cancel
                  </button>
                  <button
                    type='button'
                    onClick={handleSave}
                    className='px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700'
                    disabled={validationErrors.length > 0}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
