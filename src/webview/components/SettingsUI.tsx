/**
 * SettingsUI - 設定画面コンポーネント
 * フェーズ12: ユーザビリティ向上機能
 */

import type React from "react"
import { useCallback, useState } from "react"
import type { WebViewSettings, WebViewSettingsService } from "../services/WebViewSettingsService"

interface SettingsUIProps {
  settingsService: WebViewSettingsService
  onClose: () => void
}

type SettingsTab = "general" | "editor" | "ui"

export const SettingsUI: React.FC<SettingsUIProps> = ({ settingsService, onClose }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general")
  const [currentSettings, setCurrentSettings] = useState<WebViewSettings>(
    settingsService.getSettings()
  )
  const [saveError, setSaveError] = useState<string>("")

  const updateSetting = useCallback(
    <K extends keyof WebViewSettings>(key: K, value: WebViewSettings[K]) => {
      const updated = { ...currentSettings, [key]: value }
      setCurrentSettings(updated)
      settingsService.updateSetting(key, value)
    },
    [currentSettings, settingsService]
  )

  const handleSave = useCallback(() => {
    try {
      settingsService.updateSettings(currentSettings)
      setSaveError("")
      onClose()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "保存に失敗しました")
    }
  }, [currentSettings, settingsService, onClose])

  const handleReset = useCallback(() => {
    const defaultSettings: WebViewSettings = {
      theme: "auto",
      fontSize: 14,
      autoSave: true,
      showLineNumbers: true,
      enableVirtualScrolling: true,
      maxRowsPerPage: 100,
    }
    setCurrentSettings(defaultSettings)
    settingsService.updateSettings(defaultSettings)
  }, [settingsService])

  const renderGeneralTab = () => (
    <div className='space-y-4'>
      <h3 className='text-lg font-semibold text-vscode-editor-foreground mb-4'>一般設定</h3>

      <div className='space-y-3'>
        <div>
          <label
            htmlFor='theme-select'
            className='block text-sm font-medium text-vscode-editor-foreground mb-1'
          >
            テーマ
          </label>
          <select
            id='theme-select'
            value={currentSettings.theme}
            onChange={(e) => updateSetting("theme", e.target.value as WebViewSettings["theme"])}
            className='w-full p-2 border border-vscode-input-border bg-vscode-input-background text-vscode-input-foreground rounded'
          >
            <option value='auto'>自動</option>
            <option value='light'>ライト</option>
            <option value='dark'>ダーク</option>
          </select>
        </div>

        <div>
          <label
            htmlFor='auto-save-checkbox'
            className='block text-sm font-medium text-vscode-editor-foreground mb-1'
          >
            自動保存
          </label>
          <input
            id='auto-save-checkbox'
            type='checkbox'
            checked={currentSettings.autoSave}
            onChange={(e) => updateSetting("autoSave", e.target.checked)}
            className='mr-2'
          />
          <span className='text-sm text-vscode-editor-foreground'>変更を自動保存する</span>
        </div>
      </div>
    </div>
  )

  const renderEditorTab = () => (
    <div className='space-y-4'>
      <h3 className='text-lg font-semibold text-vscode-editor-foreground mb-4'>エディタ設定</h3>

      <div className='space-y-3'>
        <div>
          <label
            htmlFor='font-size-input'
            className='block text-sm font-medium text-vscode-editor-foreground mb-1'
          >
            フォントサイズ
          </label>
          <input
            id='font-size-input'
            type='number'
            min='10'
            max='24'
            value={currentSettings.fontSize}
            onChange={(e) => updateSetting("fontSize", Number.parseInt(e.target.value, 10))}
            className='w-full p-2 border border-vscode-input-border bg-vscode-input-background text-vscode-input-foreground rounded'
          />
        </div>

        <div>
          <label
            htmlFor='line-numbers-checkbox'
            className='block text-sm font-medium text-vscode-editor-foreground mb-1'
          >
            行番号を表示
          </label>
          <input
            id='line-numbers-checkbox'
            type='checkbox'
            checked={currentSettings.showLineNumbers}
            onChange={(e) => updateSetting("showLineNumbers", e.target.checked)}
            className='mr-2'
          />
          <span className='text-sm text-vscode-editor-foreground'>SQLエディタで行番号を表示</span>
        </div>
      </div>
    </div>
  )

  const renderUITab = () => (
    <div className='space-y-4'>
      <h3 className='text-lg font-semibold text-vscode-editor-foreground mb-4'>UI設定</h3>

      <div className='space-y-3'>
        <div>
          <label
            htmlFor='virtual-scrolling-checkbox'
            className='block text-sm font-medium text-vscode-editor-foreground mb-1'
          >
            仮想スクロール
          </label>
          <input
            id='virtual-scrolling-checkbox'
            type='checkbox'
            checked={currentSettings.enableVirtualScrolling}
            onChange={(e) => updateSetting("enableVirtualScrolling", e.target.checked)}
            className='mr-2'
          />
          <span className='text-sm text-vscode-editor-foreground'>
            大量データの高速表示を有効にする
          </span>
        </div>

        <div>
          <label
            htmlFor='max-rows-input'
            className='block text-sm font-medium text-vscode-editor-foreground mb-1'
          >
            1ページあたりの最大行数
          </label>
          <input
            id='max-rows-input'
            type='number'
            min='10'
            max='1000'
            step='10'
            value={currentSettings.maxRowsPerPage}
            onChange={(e) => updateSetting("maxRowsPerPage", Number.parseInt(e.target.value, 10))}
            className='w-full p-2 border border-vscode-input-border bg-vscode-input-background text-vscode-input-foreground rounded'
          />
        </div>
      </div>
    </div>
  )

  const renderTabContent = () => {
    switch (activeTab) {
      case "general":
        return renderGeneralTab()
      case "editor":
        return renderEditorTab()
      case "ui":
        return renderUITab()
      default:
        return renderGeneralTab()
    }
  }

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
      <div className='bg-vscode-editor-background border border-vscode-panel-border rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden'>
        {/* Header */}
        <div className='flex items-center justify-between p-4 border-b border-vscode-panel-border'>
          <h2 className='text-xl font-semibold text-vscode-editor-foreground'>設定</h2>
          <button
            type='button'
            onClick={onClose}
            className='text-vscode-editor-foreground hover:bg-vscode-toolbar-hoverBackground p-1 rounded'
          >
            ✕
          </button>
        </div>

        <div className='flex h-full'>
          {/* Sidebar */}
          <div className='w-48 bg-vscode-sideBar-background border-r border-vscode-panel-border'>
            <nav className='p-2 space-y-1'>
              {[
                { id: "general", label: "一般" },
                { id: "editor", label: "エディタ" },
                { id: "ui", label: "UI" },
              ].map((tab) => (
                <button
                  type='button'
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as SettingsTab)}
                  className={`
                    w-full text-left px-3 py-2 rounded text-sm transition-colors
                    ${
                      activeTab === tab.id
                        ? "bg-vscode-list-activeSelectionBackground text-vscode-list-activeSelectionForeground"
                        : "text-vscode-sideBar-foreground hover:bg-vscode-list-hoverBackground"
                    }
                  `}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className='flex-1 flex flex-col'>
            <div className='flex-1 p-4 overflow-y-auto'>
              {renderTabContent()}

              {saveError && (
                <div className='mt-4 p-3 bg-vscode-inputValidation-errorBackground border border-vscode-inputValidation-errorBorder rounded text-vscode-inputValidation-errorForeground'>
                  {saveError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className='p-4 border-t border-vscode-panel-border flex justify-between'>
              <button
                type='button'
                onClick={handleReset}
                className='px-4 py-2 bg-vscode-button-secondaryBackground text-vscode-button-secondaryForeground rounded hover:bg-vscode-button-secondaryHoverBackground'
              >
                デフォルトに戻す
              </button>
              <div className='space-x-2'>
                <button
                  type='button'
                  onClick={onClose}
                  className='px-4 py-2 border border-vscode-button-border text-vscode-button-foreground rounded hover:bg-vscode-button-hoverBackground'
                >
                  キャンセル
                </button>
                <button
                  type='button'
                  onClick={handleSave}
                  className='px-4 py-2 bg-vscode-button-background text-vscode-button-foreground rounded hover:bg-vscode-button-hoverBackground'
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
