import * as path from "node:path"
import * as vscode from "vscode"
import type {
  BaseMessage,
  ExecuteQueryMessage,
  OpenConnectionMessage,
} from "../shared/types/messages"

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
    // Get URIs for Vite dev server or built assets
    const isDevelopment = process.env.NODE_ENV === "development"

    if (isDevelopment) {
      // Development mode: use Vite dev server
      return this._getDevHtml()
    }
    // Production mode: use built assets
    return this._getProdHtml(webview)
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
    // Production HTML with built assets from Vite
    const webviewPath = vscode.Uri.joinPath(this._extensionUri, "dist", "webview")
    const indexPath = vscode.Uri.joinPath(webviewPath, "index.html")

    try {
      // Try to read the built index.html file from Vite
      const fs = require("node:fs")
      if (fs.existsSync(indexPath.fsPath)) {
        let htmlContent = fs.readFileSync(indexPath.fsPath, "utf8")

        // Transform asset paths to webview URIs
        htmlContent = htmlContent.replace(
          /href="\.\/assets\//g,
          `href="${webview.asWebviewUri(vscode.Uri.joinPath(webviewPath, "assets"))}/`
        )
        htmlContent = htmlContent.replace(
          /src="\.\/assets\//g,
          `src="${webview.asWebviewUri(vscode.Uri.joinPath(webviewPath, "assets"))}/`
        )

        // Update CSP for webview
        htmlContent = htmlContent.replace(
          /<meta http-equiv="Content-Security-Policy"[^>]*>/g,
          `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} https:; script-src ${webview.cspSource}; font-src ${webview.cspSource};">`
        )

        return htmlContent
      }
    } catch (error) {
      console.warn("Failed to read built HTML, falling back to static template:", error)
    }

    // Fallback to static HTML structure if built file is not available
    const styleSrc = webview.asWebviewUri(vscode.Uri.joinPath(webviewPath, "assets", "index.css"))
    const scriptSrc = webview.asWebviewUri(vscode.Uri.joinPath(webviewPath, "assets", "index.js"))

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} https:; script-src ${webview.cspSource}; font-src ${webview.cspSource};">
    <title>Database DataGrid Manager</title>
    <link rel="stylesheet" href="${styleSrc}">
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
    <script src="${scriptSrc}"></script>
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
