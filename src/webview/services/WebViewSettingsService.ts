/**
 * WebView専用設定サービス
 * Node.jsモジュールを使用しない、ブラウザ環境対応版
 */

export interface WebViewSettings {
  theme: "dark" | "light" | "auto"
  fontSize: number
  autoSave: boolean
  showLineNumbers: boolean
  enableVirtualScrolling: boolean
  maxRowsPerPage: number
}

export class WebViewSettingsService {
  private settings: WebViewSettings = {
    theme: "auto",
    fontSize: 14,
    autoSave: true,
    showLineNumbers: true,
    enableVirtualScrolling: true,
    maxRowsPerPage: 100,
  }

  private get vscodeApi() {
    // Use globally stored VSCode API if available
    return (
      (
        window as unknown as {
          vscode?: {
            getState: () => unknown
            setState: (state: unknown) => void
            postMessage: (message: unknown) => void
          }
        }
      ).vscode || null
    )
  }

  constructor() {
    // VSCodeの状態から設定を復元
    const savedState = this.vscodeApi?.getState() as
      | { settings?: Partial<WebViewSettings> }
      | undefined
    if (savedState?.settings) {
      this.settings = { ...this.settings, ...savedState.settings }
    }
  }

  getSettings(): WebViewSettings {
    return { ...this.settings }
  }

  updateSetting<K extends keyof WebViewSettings>(key: K, value: WebViewSettings[K]): void {
    this.settings[key] = value
    this.saveToVSCode()
  }

  updateSettings(newSettings: Partial<WebViewSettings>): void {
    this.settings = { ...this.settings, ...newSettings }
    this.saveToVSCode()
  }

  private saveToVSCode(): void {
    // VSCodeの状態に保存
    const currentState = (this.vscodeApi?.getState() as Record<string, unknown>) || {}
    this.vscodeApi?.setState({
      ...currentState,
      settings: this.settings,
    })

    // Extension側にも通知
    this.vscodeApi?.postMessage({
      type: "settingsUpdated",
      data: this.settings,
    })
  }

  async loadFromExtension(): Promise<void> {
    return new Promise((resolve) => {
      // Extension側に設定を要求
      this.vscodeApi?.postMessage({
        type: "requestSettings",
        data: {},
      })

      // レスポンスを待機
      const handler = (event: MessageEvent) => {
        const message = event.data as { type?: string; data?: Partial<WebViewSettings> }
        if (message?.type === "settingsResponse" && message.data) {
          this.settings = { ...this.settings, ...message.data }
          window.removeEventListener("message", handler)
          resolve()
        }
      }

      window.addEventListener("message", handler)

      // タイムアウト処理
      setTimeout(() => {
        window.removeEventListener("message", handler)
        resolve()
      }, 1000)
    })
  }

  exportSettings(): string {
    return JSON.stringify(this.settings, null, 2)
  }

  importSettings(jsonData: string): boolean {
    try {
      const importedSettings = JSON.parse(jsonData)

      // 設定の検証
      if (typeof importedSettings !== "object") {
        throw new Error("Invalid settings format")
      }

      // 既知のキーのみを受け入れ
      const validKeys = Object.keys(this.settings) as Array<keyof WebViewSettings>
      const filteredSettings: Partial<WebViewSettings> = {}

      for (const key of validKeys) {
        if (key in importedSettings) {
          filteredSettings[key] = importedSettings[key]
        }
      }

      this.updateSettings(filteredSettings)
      return true
    } catch (error) {
      console.error("Settings import failed:", error)
      return false
    }
  }
}
