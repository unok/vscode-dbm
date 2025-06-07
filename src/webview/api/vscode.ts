/* eslint-disable @typescript-eslint/no-explicit-any */

// VSCode API types
export interface ConnectionResult {
  success: boolean
  error?: string
  connectionId?: string
}

export interface QueryResult {
  success: boolean
  data?: Record<string, unknown>[]
  error?: string
  executionTime?: number
}
interface VSCodeApi {
  postMessage(message: Record<string, unknown>): void
  getState(): Record<string, unknown>
  setState(state: Record<string, unknown>): void
}

declare global {
  interface Window {
    acquireVsCodeApi?: () => VSCodeApi
    initialViewType?: string
  }
}

class VSCodeWebViewAPI {
  private vscode: VSCodeApi | null = null
  private messageHandlers: Map<string, (data: unknown) => void> = new Map()
  private isInitialized = false

  private initialize() {
    if (this.isInitialized) {
      return
    }

    try {
      // Check if VSCode API is already acquired via window property
      if (typeof window !== "undefined" && (window as unknown as { vscode?: VSCodeApi }).vscode) {
        this.vscode = (window as unknown as { vscode?: VSCodeApi }).vscode || null
        if (!this.vscode) return
        this.isInitialized = true
      } else if (typeof window !== "undefined" && window.acquireVsCodeApi) {
        // Acquire VSCode API if available
        this.vscode = window.acquireVsCodeApi()
        // Store it globally to prevent re-acquisition
        ;(window as unknown as { vscode?: VSCodeApi }).vscode = this.vscode
        this.isInitialized = true
      } else {
        console.warn("VSCode API not available - running in development mode")
        this.setupDevMode()
      }

      if (this.isInitialized && !window.addEventListener.toString().includes("handleMessage")) {
        // Listen for messages from extension
        window.addEventListener("message", this.handleMessage.bind(this))
      }
    } catch (error) {
      console.error("Failed to initialize VSCode API:", error)
      this.setupDevMode()
    }
  }

  private setupDevMode() {
    // 開発モードでは実際のVSCode APIが必要
    // モックAPIは提供せず、エラーを明確に報告
    console.error("VSCode API is required. Please run this extension within VSCode.")

    // 基本的なAPIのみ提供（エラー報告用）
    this.vscode = {
      postMessage: (message: Record<string, unknown>) => {
        console.warn("VSCode API not available. Message not sent:", message)
      },
      getState: () => {
        console.warn("VSCode API not available. Cannot get state.")
        return {}
      },
      setState: (state: Record<string, unknown>) => {
        console.warn("VSCode API not available. Cannot set state:", state)
      },
    }
    this.isInitialized = false // 初期化を失敗とマーク
  }

  private handleMessage(event: MessageEvent) {
    const message = event.data
    if (message.type && this.messageHandlers.has(message.type)) {
      const handler = this.messageHandlers.get(message.type)
      if (handler) {
        handler(message.data)
      }
    }
  }

  // Public API methods
  public postMessage(type: string, data?: unknown) {
    if (!this.isInitialized) {
      this.initialize()
    }
    if (this.vscode && this.isInitialized) {
      this.vscode.postMessage({ type, data })
    } else {
      console.error(`Cannot send message "${type}": VSCode API not available`)
    }
  }

  public onMessage(type: string, handler: (data: unknown) => void) {
    this.messageHandlers.set(type, handler)
  }

  public removeMessageHandler(type: string) {
    this.messageHandlers.delete(type)
  }

  public getState() {
    if (this.isInitialized) {
      return this.vscode?.getState() || {}
    }
    console.error("Cannot get state: VSCode API not available")
    return {}
  }

  public setState(state: Record<string, unknown>) {
    if (this.isInitialized) {
      this.vscode?.setState(state)
    } else {
      console.error("Cannot set state: VSCode API not available")
    }
  }

  public get isReady() {
    return this.isInitialized
  }

  // Database specific methods
  public async getConnectionStatus() {
    return new Promise((resolve) => {
      this.onMessage("connectionStatus", resolve)
      this.postMessage("getConnectionStatus")
    })
  }

  public async openConnection(connectionData: Record<string, unknown>): Promise<ConnectionResult> {
    return new Promise((resolve) => {
      this.onMessage("connectionResult", (data) => resolve(data as ConnectionResult))
      this.postMessage("openConnection", connectionData)
    })
  }

  public async executeQuery(query: string): Promise<QueryResult> {
    return new Promise((resolve) => {
      this.onMessage("queryResult", (data) => resolve(data as QueryResult))
      this.postMessage("executeQuery", { query })
    })
  }

  public async getTheme() {
    return new Promise((resolve) => {
      this.onMessage("themeChanged", resolve)
      this.postMessage("getTheme")
    })
  }

  public showInfo(message: string) {
    this.postMessage("showInfo", { message })
  }

  public showError(message: string) {
    this.postMessage("showError", { message })
  }

  // Get initial view type from window
  public getInitialViewType(): string {
    return window.initialViewType || "dashboard"
  }
}

// Export singleton instance
export const vscodeApi = new VSCodeWebViewAPI()

// React hook for VSCode API
export const useVSCodeAPI = () => {
  return vscodeApi
}
