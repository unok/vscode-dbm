import * as path from "node:path"
import * as vscode from "vscode"
import type { DatabaseConnection } from "../shared/database/DatabaseConnection"
import { MySQLDriver } from "../shared/database/drivers/MySQLDriver"
import { PostgreSQLDriver } from "../shared/database/drivers/PostgreSQLDriver"
import { SQLiteDriver } from "../shared/database/drivers/SQLiteDriver"
import { DatabaseMetadataService } from "../shared/services/DatabaseMetadataService"
import type { DatabaseConfig } from "../shared/types"
import type {
  BaseMessage,
  ConnectionInfo,
  DatabaseInfo,
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
  private _connections = new Map<string, DatabaseConnection>()
  private _activeConnection?: string
  private _metadataService = new DatabaseMetadataService()

  constructor(private readonly _extensionUri: vscode.Uri) {}

  private _createConnection(config: DatabaseConfig): DatabaseConnection {
    switch (config.type) {
      case "mysql":
        return new MySQLDriver(config)
      case "postgresql":
        return new PostgreSQLDriver(config)
      case "sqlite":
        return new SQLiteDriver(config)
      default:
        throw new Error(`Unsupported database type: ${config.type}`)
    }
  }

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
        case "disconnectConnection":
          this._handleDisconnectConnection(message.data)
          break
        case "getTableData":
          this._handleGetTableData(message.data)
          break
        case "getSchema":
          this._handleGetSchema(message.data)
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

  private async _sendConnectionStatus() {
    if (!this._view) return

    const connections: ConnectionInfo[] = []
    const databases: DatabaseInfo[] = []

    for (const [id, connection] of this._connections) {
      const isConnected = await connection.isConnected()
      const config = connection.getConnectionInfo()
      connections.push({
        id,
        name: config.name || `${config.type}-${config.host}`,
        type: config.type,
        host: config.host || "localhost",
        port: config.port || 3306,
        database: config.database || "default",
        username: config.username || "user",
        isConnected,
        lastConnected: isConnected ? new Date() : undefined,
      })

      if (isConnected && this._activeConnection === id) {
        try {
          const schema = await this._metadataService.getSchema(connection)
          const config = connection.getConnectionInfo()
          databases.push({
            name: schema.name || config.database || "unknown",
            type: config.type,
            tables: schema.tables.map((table) => ({
              name: table.name,
              schema: table.schema || "default",
              columns: table.columns.map((col) => ({
                name: col.name,
                type: col.type,
                nullable: col.nullable,
                defaultValue: col.defaultValue || undefined,
                isPrimaryKey: col.isPrimaryKey,
                isForeignKey: col.isForeignKey,
                foreignKeyTarget: col.foreignKeyTarget
                  ? {
                      table: col.foreignKeyTarget.table,
                      column: col.foreignKeyTarget.column,
                    }
                  : undefined,
              })),
              rowCount: table.rowCount || 0,
            })),
            views: schema.views.map((view) => ({
              name: view.name,
              schema: view.schema || "default",
              definition: view.definition,
            })),
          })
        } catch (error) {
          console.error("Failed to get database schema:", error)
        }
      }
    }

    this._view.webview.postMessage({
      type: "connectionStatus",
      data: {
        connected: this._activeConnection
          ? (await this._connections.get(this._activeConnection)?.isConnected()) || false
          : false,
        databases,
        activeConnection: this._activeConnection
          ? connections.find((c) => c.id === this._activeConnection)
          : undefined,
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

  private async _handleOpenConnection(data: OpenConnectionMessage["data"]) {
    try {
      const connectionId = `${data.type}-${data.host}-${data.port}-${data.database}`

      // Close existing connection if any
      if (this._activeConnection) {
        await this._handleDisconnectConnection({ connectionId: this._activeConnection })
      }

      // Create new connection
      const connection = this._createConnection({
        id: connectionId,
        name: `${data.type}-${data.host}`,
        type: data.type,
        host: data.host,
        port: data.port,
        database: data.database,
        username: data.username,
        password: data.password,
        ssl: data.ssl || false,
      })

      // Test connection
      await connection.connect()
      await connection.query("SELECT 1")

      // Store connection
      this._connections.set(connectionId, connection)
      this._activeConnection = connectionId

      vscode.window.showInformationMessage(`✅ 接続成功: ${data.type} - ${data.host}:${data.port}`)

      if (this._view) {
        this._view.webview.postMessage({
          type: "connectionResult",
          data: {
            success: true,
            message: "接続が正常に確立されました",
            connection: {
              id: connectionId,
              name: `${data.type}-${data.host}`,
              type: data.type,
              host: data.host,
              port: data.port,
              database: data.database,
              username: data.username,
              isConnected: true,
              lastConnected: new Date(),
            },
          },
        })
      }

      // Send updated connection status
      await this._sendConnectionStatus()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      vscode.window.showErrorMessage(`❌ 接続失敗: ${errorMessage}`)

      if (this._view) {
        this._view.webview.postMessage({
          type: "connectionResult",
          data: {
            success: false,
            message: `接続に失敗しました: ${errorMessage}`,
            error: errorMessage,
          },
        })
      }
    }
  }

  private async _handleExecuteQuery(data: ExecuteQueryMessage["data"]) {
    try {
      const connectionId = data.connection || this._activeConnection
      if (!connectionId) {
        throw new Error("アクティブな接続がありません")
      }

      const connection = this._connections.get(connectionId)
      if (!connection) {
        throw new Error("指定された接続が見つかりません")
      }

      const isConnected = await connection.isConnected()
      if (!isConnected) {
        throw new Error("データベースに接続されていません")
      }

      const startTime = Date.now()
      const result = await connection.query(data.query)
      const executionTime = Date.now() - startTime

      if (this._view) {
        this._view.webview.postMessage({
          type: "queryResult",
          data: {
            success: true,
            results: Array.isArray(result)
              ? result.map((row) => ({
                  columns: Object.keys(row),
                  rows: [Object.values(row)],
                }))
              : [
                  {
                    columns: Object.keys(result),
                    rows: [Object.values(result)],
                  },
                ],
            executionTime,
          },
        })
      }

      vscode.window.showInformationMessage(`✅ クエリ実行完了 (${executionTime}ms)`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      vscode.window.showErrorMessage(`❌ クエリ実行失敗: ${errorMessage}`)

      if (this._view) {
        this._view.webview.postMessage({
          type: "queryResult",
          data: {
            success: false,
            results: [],
            error: errorMessage,
          },
        })
      }
    }
  }

  private async _handleDisconnectConnection(data: { connectionId: string }) {
    try {
      const connection = this._connections.get(data.connectionId)
      if (connection) {
        await connection.disconnect()
        this._connections.delete(data.connectionId)

        if (this._activeConnection === data.connectionId) {
          this._activeConnection = undefined
        }

        vscode.window.showInformationMessage("接続を切断しました")
        await this._sendConnectionStatus()
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      vscode.window.showErrorMessage(`切断中にエラーが発生しました: ${errorMessage}`)
    }
  }

  private async _handleGetTableData(data: {
    tableName: string
    schema?: string
    limit?: number
    offset?: number
  }) {
    try {
      if (!this._activeConnection) {
        throw new Error("アクティブな接続がありません")
      }

      const connection = this._connections.get(this._activeConnection)
      if (!connection) {
        throw new Error("接続が見つかりません")
      }

      // Build SELECT query for table data
      const query = `SELECT * FROM ${data.schema ? `${data.schema}.` : ""}${data.tableName} LIMIT ${data.limit || 100} OFFSET ${data.offset || 0}`
      const tableData = await connection.query(query)

      if (this._view) {
        this._view.webview.postMessage({
          type: "tableData",
          data: {
            success: true,
            tableName: data.tableName,
            data: tableData,
          },
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      if (this._view) {
        this._view.webview.postMessage({
          type: "tableData",
          data: {
            success: false,
            error: errorMessage,
          },
        })
      }
    }
  }

  private async _handleGetSchema(_data: { refresh?: boolean }) {
    try {
      if (!this._activeConnection) {
        throw new Error("アクティブな接続がありません")
      }

      const connection = this._connections.get(this._activeConnection)
      if (!connection) {
        throw new Error("接続が見つかりません")
      }

      const schema = await this._metadataService.getSchema(connection)

      if (this._view) {
        this._view.webview.postMessage({
          type: "schemaData",
          data: {
            success: true,
            schema,
          },
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      if (this._view) {
        this._view.webview.postMessage({
          type: "schemaData",
          data: {
            success: false,
            error: errorMessage,
          },
        })
      }
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

  public async cleanup() {
    // Clean up all connections when extension is deactivated
    for (const [id, connection] of this._connections) {
      try {
        await connection.disconnect()
      } catch (error) {
        console.error(`Failed to disconnect ${id}:`, error)
      }
    }
    this._connections.clear()
    this._activeConnection = undefined
  }
}
