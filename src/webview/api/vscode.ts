/* eslint-disable @typescript-eslint/no-explicit-any */

// VSCode API types
interface VSCodeApi {
  postMessage(message: any): void
  getState(): any
  setState(state: any): void
}

declare global {
  interface Window {
    acquireVsCodeApi?: () => VSCodeApi
    initialViewType?: string
  }
}

class VSCodeWebViewAPI {
  private vscode: VSCodeApi | null = null
  private messageHandlers: Map<string, (data: any) => void> = new Map()
  private isInitialized = false

  constructor() {
    this.initialize()
  }

  private initialize() {
    try {
      // Acquire VSCode API if available
      if (typeof window !== "undefined" && window.acquireVsCodeApi) {
        this.vscode = window.acquireVsCodeApi()
        this.isInitialized = true

        // Listen for messages from extension
        window.addEventListener("message", this.handleMessage.bind(this))

        console.log("VSCode WebView API initialized")
      } else {
        console.warn("VSCode API not available - running in development mode")
        this.setupDevMode()
      }
    } catch (error) {
      console.error("Failed to initialize VSCode API:", error)
      this.setupDevMode()
    }
  }

  private setupDevMode() {
    // Mock VSCode API for development
    this.vscode = {
      postMessage: (message: any) => {
        console.log("Mock VSCode API - postMessage:", message)
      },
      getState: () => ({}),
      setState: (state: any) => {
        console.log("Mock VSCode API - setState:", state)
      },
    }
    this.isInitialized = true
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
  public postMessage(type: string, data?: any) {
    if (this.vscode) {
      this.vscode.postMessage({ type, data })
    }
  }

  public onMessage(type: string, handler: (data: any) => void) {
    this.messageHandlers.set(type, handler)
  }

  public removeMessageHandler(type: string) {
    this.messageHandlers.delete(type)
  }

  public getState() {
    return this.vscode?.getState() || {}
  }

  public setState(state: any) {
    this.vscode?.setState(state)
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

  public async openConnection(connectionData: any) {
    return new Promise((resolve) => {
      this.onMessage("connectionResult", resolve)
      this.postMessage("openConnection", connectionData)
    })
  }

  public async executeQuery(query: string) {
    return new Promise((resolve) => {
      this.onMessage("queryResult", resolve)
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
