import * as path from "node:path"
import * as vscode from "vscode"
import type {
  BaseMessage,
  ExecuteQueryMessage,
  OpenConnectionMessage,
} from "../shared/types/messages"
import { WebViewResourceManager } from "./webviewHelper"

// Helper function to generate nonce for CSP
function getNonce() {
  let text = ""
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}

export class DatabaseWebViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "dbManager.webview"

  private _view?: vscode.WebviewView

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    }

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview)

    // Message handling between extension and webview
    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.type) {
        case "getConnectionStatus":
          this._sendConnectionStatus()
          break
        case "openConnection":
          this._handleOpenConnection(message.data)
          break
        case "executeQuery":
          this._handleExecuteQuery(message.data)
          break
        case "getTheme":
          this._sendTheme()
          break
      }
    })

    // Listen for theme changes
    vscode.window.onDidChangeActiveColorTheme(() => {
      this._sendTheme()
    })
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // WebViewResourceManagerを使用してHTMLを生成
    const resourceManager = new WebViewResourceManager(webview, this._extensionUri)
    return resourceManager.getHtmlContent("dashboard")
  }

  private _getDevHtml() {
    // Development HTML that connects to Vite dev server
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Database DataGrid Manager</title>
</head>
<body>
    <div id="root"></div>
    <script type="module" src="http://localhost:5173/src/webview/main.tsx"></script>
</body>
</html>`
  }

  private _getProdHtml(webview: vscode.Webview) {
    // Find the actual JS file dynamically
    const webviewPath = vscode.Uri.joinPath(this._extensionUri, "dist", "webview")
    const assetsPath = vscode.Uri.joinPath(webviewPath, "assets")

    let jsFileName = "index-C_gadd4f.js" // fallback
    try {
      const fs = require("node:fs")
      const files = fs.readdirSync(assetsPath.fsPath)
      const jsFile = files.find((file: string) => file.startsWith("index-") && file.endsWith(".js"))
      if (jsFile) {
        jsFileName = jsFile
      }
    } catch (error) {
      console.error("[WebViewProvider] Failed to read assets directory:", error)
    }

    // Generate URLs
    const nonce = getNonce()
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(assetsPath, jsFileName))

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} https: data:; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; connect-src ${webview.cspSource} https: ws:;">
    <title>Database DataGrid Manager</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            overflow: hidden;
        }
        #root {
            width: 100vw;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        /* VSCode theme variables */
        :root {
            --vscode-primary: var(--vscode-button-background);
            --vscode-primary-hover: var(--vscode-button-hoverBackground);
            --vscode-secondary: var(--vscode-button-secondaryBackground);
            --vscode-border: var(--vscode-panel-border);
            --vscode-input-bg: var(--vscode-input-background);
            --vscode-input-border: var(--vscode-input-border);
        }
    </style>
</head>
<body>
    <div id="root"></div>
    <script nonce="${nonce}">
        window.initialViewType = "dashboard";
        window.acquireVsCodeApi = window.acquireVsCodeApi || (() => ({
            postMessage: (msg) => console.log('VSCode API:', msg),
            getState: () => ({}),
            setState: (state) => {}
        }));
        
        // Ensure DOM is loaded before React app
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                console.log('[WebViewProvider] DOM loaded, root element exists:', !!document.getElementById('root'));
            });
        } else {
            console.log('[WebViewProvider] DOM already loaded, root element exists:', !!document.getElementById('root'));
        }
    </script>
    <script nonce="${nonce}" src="${scriptUri}" defer></script>
</body>
</html>`
  }

  private _getFallbackHtml(webview: vscode.Webview) {
    const webviewPath = vscode.Uri.joinPath(this._extensionUri, "dist", "webview")
    const nonce = getNonce()

    // Try to find the actual built files
    const fs = require("node:fs")
    const assetsPath = vscode.Uri.joinPath(webviewPath, "assets")
    let scriptSrc = ""
    let styleSrc = ""

    try {
      const files = fs.readdirSync(assetsPath.fsPath)
      const jsFile = files.find((f: string) => f.startsWith("index-") && f.endsWith(".js"))
      const cssFile = files.find((f: string) => f.startsWith("index-") && f.endsWith(".css"))

      if (jsFile) {
        scriptSrc = webview.asWebviewUri(vscode.Uri.joinPath(assetsPath, jsFile)).toString()
      }
      if (cssFile) {
        styleSrc = webview.asWebviewUri(vscode.Uri.joinPath(assetsPath, cssFile)).toString()
      }
    } catch (error) {
      console.error("Failed to find assets:", error)
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} https: data:; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; connect-src ${webview.cspSource} https: ws:;">
    <title>Database DataGrid Manager</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            overflow: hidden;
        }
        #root {
            width: 100vw;
            height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }
        .loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
        }
        .loading-text {
            font-size: 14px;
            opacity: 0.8;
        }
        .error {
            padding: 16px;
            text-align: center;
            color: var(--vscode-errorForeground);
        }
        /* VSCode theme variables */
        :root {
            --vscode-primary: var(--vscode-button-background);
            --vscode-primary-hover: var(--vscode-button-hoverBackground);
            --vscode-secondary: var(--vscode-button-secondaryBackground);
            --vscode-border: var(--vscode-panel-border);
            --vscode-input-bg: var(--vscode-input-background);
            --vscode-input-border: var(--vscode-input-border);
        }
    </style>
</head>
<body>
    <div id="root">
        <div class="loading">
            <div class="loading-text">Database Manager を初期化中...</div>
        </div>
    </div>
    <script>
        // Initialize VSCode API
        window.initialViewType = "dashboard";
        window.acquireVsCodeApi = window.acquireVsCodeApi || (() => ({
            postMessage: (msg) => console.log('VSCode API:', msg),
            getState: () => ({}),
            setState: (state) => {}
        }));
        
        // Fallback error handling
        window.addEventListener('error', function(e) {
            const root = document.getElementById('root');
            if (root) {
                root.innerHTML = '<div class="error">リソースの読み込みに失敗しました。<br>拡張機能を再読み込みしてください。</div>';
            }
        });
    </script>
    ${scriptSrc ? `<script nonce="${nonce}" src="${scriptSrc}"></script>` : ""}
    ${styleSrc ? `<link rel="stylesheet" href="${styleSrc}">` : ""}
    </script>
</body>
</html>`
  }

  private _sendConnectionStatus() {
    if (!this._view) return

    this._view.webview.postMessage({
      type: "connectionStatus",
      data: {
        connected: false,
        databases: [],
      },
    })
  }

  private _sendTheme() {
    if (!this._view) return

    const theme = vscode.window.activeColorTheme
    this._view.webview.postMessage({
      type: "themeChanged",
      data: {
        kind: theme.kind === vscode.ColorThemeKind.Light ? "light" : "dark",
      },
    })
  }

  private _handleOpenConnection(data: OpenConnectionMessage["data"]) {
    // Handle database connection request
    vscode.window.showInformationMessage(`Opening connection to: ${data.type}`)

    // This will integrate with the database connection logic from Phase 2
    // For now, just acknowledge
    if (this._view) {
      this._view.webview.postMessage({
        type: "connectionResult",
        data: {
          success: true,
          message: "Connection logic will be integrated in next phase",
        },
      })
    }
  }

  private _handleExecuteQuery(data: ExecuteQueryMessage["data"]) {
    // Handle SQL query execution
    vscode.window.showInformationMessage(`Executing query: ${data.query}`)

    // This will integrate with the database execution logic
    if (this._view) {
      this._view.webview.postMessage({
        type: "queryResult",
        data: {
          success: true,
          results: [],
          message: "Query execution will be implemented in SQL editor phase",
        },
      })
    }
  }

  // Public methods for external communication
  public postMessage(message: BaseMessage) {
    if (this._view) {
      this._view.webview.postMessage(message)
    }
  }

  public reveal() {
    if (this._view) {
      this._view.show?.(true)
    }
  }
}
