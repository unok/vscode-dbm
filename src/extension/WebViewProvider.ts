import * as path from "node:path"
import * as vscode from "vscode"
import type { DatabaseConfig } from "../shared/types"
import type {
  BaseMessage,
  ConnectionInfo,
  DatabaseInfo,
  ExecuteQueryMessage,
  OpenConnectionMessage,
} from "../shared/types/messages"
import { DatabaseService } from "./services/DatabaseService"
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
  private databaseService: DatabaseService

  constructor(private readonly _extensionUri: vscode.Uri) {
    this.databaseService = DatabaseService.getInstance()
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

    // Register message listener for database service
    this.databaseService.addMessageListener("sidebar", (message) => {
      if (this._view) {
        this._view.webview.postMessage(message)
      }
    })

    // Message handling between extension and webview
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case "getConnectionStatus":
          this._sendConnectionStatus()
          break
        case "openConnection":
          await this._handleOpenConnection(message.data)
          break
        case "executeQuery":
          await this.databaseService.executeQuery(message.data)
          break
        case "showInfo":
          vscode.window.showInformationMessage(message.data.message)
          break
        case "showError":
          vscode.window.showErrorMessage(message.data.message)
          break
        case "getTheme":
          this._sendTheme()
          break
        case "saveConnection":
          await this._handleSaveConnection(message.data)
          break
        case "testConnection":
          await this._handleTestConnection(message.data)
          break
        case "getDefaultConnectionConfig":
          this._sendDefaultConnectionConfig()
          break
      }
    })

    // Listen for theme changes
    vscode.window.onDidChangeActiveColorTheme(() => {
      this._sendTheme()
    })
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // 開発環境かどうかを判定
    const isDevelopment =
      process.env.NODE_ENV === "development" || process.env.VSCODE_DEBUG === "true"

    if (isDevelopment) {
      return this._getDevHtml()
    }

    // プロダクション環境用の簡単なHTML
    const nonce = this.getNonce()

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline' https://cdnjs.cloudflare.com; font-src ${webview.cspSource} https://cdnjs.cloudflare.com; script-src 'nonce-${nonce}';">
    <title>DB Manager</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            font-family: var(--vscode-font-family);
        }
        .status {
            padding: 10px;
            margin: 10px 0;
            border-radius: 4px;
            border: 1px solid var(--vscode-panel-border);
        }
        button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin: 4px;
        }
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            background: var(--vscode-editor-background);
        }
        th, td {
            border: 1px solid var(--vscode-panel-border);
            padding: 8px;
            text-align: left;
        }
        th {
            background: var(--vscode-editorWidget-background);
            font-weight: bold;
        }
        tr:hover {
            background: var(--vscode-list-hoverBackground);
        }
    </style>
</head>
<body>
    <h2>Database Manager</h2>
    <div class="status" id="status">WebView読み込み中...</div>
    <div class="status" id="connectionStatus">データベース: 未接続</div>
    <button id="testBtn">メッセージテスト</button>
    <button id="connectBtn">デモ接続テスト</button>
    <button id="queryBtn">デモクエリ実行</button>
    <button id="dashboardBtn">ダッシュボードを開く</button>
    <div id="queryResults" style="margin-top: 20px;"></div>
    
    <script nonce="${nonce}">
        // Store VSCode API globally to prevent multiple acquisitions
        if (!window.vscode && window.acquireVsCodeApi) {
            window.vscode = acquireVsCodeApi();
        }
        const vscode = window.vscode;
        
        document.getElementById('status').textContent = 'WebView正常読み込み完了';
        
        // ボタンにイベントリスナーを追加
        document.getElementById('testBtn').addEventListener('click', function() {
            console.log('Test button clicked');
            vscode.postMessage({
                type: 'showInfo',
                data: { message: 'メッセージテスト成功!' }
            });
        });
        
        document.getElementById('connectBtn').addEventListener('click', function() {
            console.log('Connect button clicked');
            vscode.postMessage({
                type: 'openConnection',
                data: { type: 'sqlite' }
            });
        });
        
        document.getElementById('queryBtn').addEventListener('click', function() {
            console.log('Query button clicked');
            vscode.postMessage({
                type: 'executeQuery',
                data: { query: 'SELECT * FROM users' }
            });
        });
        
        document.getElementById('dashboardBtn').addEventListener('click', function() {
            console.log('Dashboard button clicked');
            vscode.postMessage({
                type: 'showInfo', 
                data: { message: 'ダッシュボード機能は開発中です' }
            });
        });
        
        
        // テーブル作成関数
        function createResultTable(rows) {
            if (!rows || rows.length === 0) return '<p>データなし</p>';
            
            const headers = Object.keys(rows[0]);
            let html = '<table>';
            
            // ヘッダー行
            html += '<thead><tr>';
            headers.forEach(header => {
                html += \`<th>\${header}</th>\`;
            });
            html += '</tr></thead>';
            
            // データ行
            html += '<tbody>';
            rows.forEach(row => {
                html += '<tr>';
                headers.forEach(header => {
                    const value = row[header] !== null && row[header] !== undefined ? row[header] : 'NULL';
                    html += \`<td>\${value}</td>\`;
                });
                html += '</tr>';
            });
            html += '</tbody></table>';
            
            return html;
        }
        
        window.addEventListener('message', event => {
            console.log('Received:', event.data);
            const message = event.data;
            
            // 接続状況の更新
            if (message.type === 'connectionStatus') {
                const status = message.data.connected ? 
                    \`データベース: 接続済み (\${message.data.activeConnection})\` : 
                    'データベース: 未接続';
                document.getElementById('connectionStatus').textContent = status;
            }
            
            // 接続結果の表示
            if (message.type === 'connectionResult') {
                const statusEl = document.getElementById('connectionStatus');
                if (message.data.success) {
                    statusEl.textContent = \`データベース: \${message.data.message}\`;
                    statusEl.style.color = 'var(--vscode-testing-iconPassed)';
                } else {
                    statusEl.textContent = \`接続エラー: \${message.data.message}\`;
                    statusEl.style.color = 'var(--vscode-testing-iconFailed)';
                }
            }
            
            // クエリ結果の表示
            if (message.type === 'queryResult') {
                const statusEl = document.getElementById('status');
                const resultsEl = document.getElementById('queryResults');
                
                if (message.data.success) {
                    statusEl.textContent = \`クエリ成功: \${message.data.message} (\${message.data.executionTime}ms)\`;
                    statusEl.style.color = 'var(--vscode-testing-iconPassed)';
                    console.log('Query results:', message.data.results);
                    
                    // テーブル形式で結果を表示
                    if (message.data.results && message.data.results.length > 0) {
                        const tableHtml = createResultTable(message.data.results);
                        resultsEl.innerHTML = tableHtml;
                    } else {
                        resultsEl.innerHTML = '<p>結果なし</p>';
                    }
                } else {
                    statusEl.textContent = \`クエリエラー: \${message.data.message}\`;
                    statusEl.style.color = 'var(--vscode-testing-iconFailed)';
                    resultsEl.innerHTML = '';
                }
            }
        });
    </script>
</body>
</html>`
  }

  private getNonce() {
    let text = ""
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length))
    }
    return text
  }

  private _getDevHtml() {
    // Simple development HTML with fallback UI
    const nonce = this.getNonce()

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https://cdnjs.cloudflare.com; font-src https://cdnjs.cloudflare.com; script-src 'nonce-${nonce}';">
    <title>Database Manager - Development</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            font-family: var(--vscode-font-family);
        }
        .dev-header {
            background: var(--vscode-editorWidget-background);
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            border: 1px solid var(--vscode-panel-border);
        }
        .status {
            padding: 10px;
            margin: 10px 0;
            border-radius: 4px;
            border: 1px solid var(--vscode-panel-border);
        }
        button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin: 4px;
        }
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .feature-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 16px;
            margin-top: 20px;
        }
        .feature-card {
            background: var(--vscode-editorWidget-background);
            padding: 16px;
            border-radius: 8px;
            border: 1px solid var(--vscode-panel-border);
        }
        .feature-title {
            color: var(--vscode-textLink-foreground);
            font-weight: bold;
            margin-bottom: 8px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            background: var(--vscode-editor-background);
        }
        th, td {
            border: 1px solid var(--vscode-panel-border);
            padding: 8px;
            text-align: left;
        }
        th {
            background: var(--vscode-editorWidget-background);
            font-weight: bold;
        }
        tr:hover {
            background: var(--vscode-list-hoverBackground);
        }
    </style>
</head>
<body>
    <div class="dev-header">
        <h1>🚀 Database Manager - Development Mode</h1>
        <p>VSCode拡張機能の開発環境で動作中です</p>
        <div class="status" id="connectionStatus">データベース: 未接続</div>
    </div>

    <div class="feature-grid">
        <div class="feature-card">
            <div class="feature-title">データベース接続</div>
            <p>各データベースタイプに接続をテストします</p>
            <button id="connectMySQLBtn">MySQL接続 (Docker:3307)</button>
            <button id="connectPostgreBtn">PostgreSQL接続 (Docker:5433)</button>
            <button id="connectSQLiteBtn">SQLite接続 (Memory)</button>
        </div>
        
        <div class="feature-card">
            <div class="feature-title">クエリ実行</div>
            <p>サンプルクエリを実行してデータを取得します</p>
            <button id="queryBtn">デモクエリ実行</button>
        </div>
        
        <div class="feature-card">
            <div class="feature-title">メッセージAPI</div>
            <p>VSCode拡張機能とのメッセージ通信をテストします</p>
            <button id="testBtn">メッセージテスト</button>
        </div>
    </div>

    <div id="queryResults" style="margin-top: 20px;"></div>
    <div class="status" id="status">準備完了</div>

    <script nonce="${nonce}">
        // Store VSCode API globally to prevent multiple acquisitions
        if (!window.vscode && window.acquireVsCodeApi) {
            window.vscode = acquireVsCodeApi();
        }
        const vscode = window.vscode;
        
        // MySQL接続テスト
        document.getElementById('connectMySQLBtn').addEventListener('click', function() {
            console.log('Development: MySQL Connect button clicked');
            vscode.postMessage({
                type: 'openConnection',
                data: { type: 'mysql' }
            });
        });
        
        // PostgreSQL接続テスト
        document.getElementById('connectPostgreBtn').addEventListener('click', function() {
            console.log('Development: PostgreSQL Connect button clicked');
            vscode.postMessage({
                type: 'openConnection',
                data: { type: 'postgresql' }
            });
        });
        
        // SQLite接続テスト
        document.getElementById('connectSQLiteBtn').addEventListener('click', function() {
            console.log('Development: SQLite Connect button clicked');
            vscode.postMessage({
                type: 'openConnection',
                data: { type: 'sqlite' }
            });
        });
        
        // クエリテスト
        document.getElementById('queryBtn').addEventListener('click', function() {
            console.log('Development: Query button clicked');
            vscode.postMessage({
                type: 'executeQuery',
                data: { query: 'SELECT * FROM users' }
            });
        });
        
        // メッセージテスト
        document.getElementById('testBtn').addEventListener('click', function() {
            console.log('Development: Test button clicked');
            vscode.postMessage({
                type: 'showInfo',
                data: { message: '開発環境でのメッセージテスト成功！' }
            });
        });
        
        // テーブル作成関数
        function createResultTable(rows) {
            if (!rows || rows.length === 0) return '<p>データなし</p>';
            
            const headers = Object.keys(rows[0]);
            let html = '<table>';
            
            html += '<thead><tr>';
            headers.forEach(header => {
                html += \`<th>\${header}</th>\`;
            });
            html += '</tr></thead>';
            
            html += '<tbody>';
            rows.forEach(row => {
                html += '<tr>';
                headers.forEach(header => {
                    const value = row[header] !== null && row[header] !== undefined ? row[header] : 'NULL';
                    html += \`<td>\${value}</td>\`;
                });
                html += '</tr>';
            });
            html += '</tbody></table>';
            
            return html;
        }
        
        // メッセージリスナー
        window.addEventListener('message', event => {
            console.log('Development: Received message:', event.data);
            const message = event.data;
            
            // 接続状況の更新
            if (message.type === 'connectionStatus') {
                const status = message.data.connected ? 
                    \`データベース: 接続済み (\${message.data.activeConnection})\` : 
                    'データベース: 未接続';
                document.getElementById('connectionStatus').textContent = status;
            }
            
            // 接続結果の表示
            if (message.type === 'connectionResult') {
                const statusEl = document.getElementById('connectionStatus');
                if (message.data.success) {
                    statusEl.textContent = \`データベース: \${message.data.message}\`;
                    statusEl.style.color = 'var(--vscode-testing-iconPassed)';
                } else {
                    statusEl.textContent = \`接続エラー: \${message.data.message}\`;
                    statusEl.style.color = 'var(--vscode-testing-iconFailed)';
                }
            }
            
            // クエリ結果の表示
            if (message.type === 'queryResult') {
                const statusEl = document.getElementById('status');
                const resultsEl = document.getElementById('queryResults');
                
                if (message.data.success) {
                    statusEl.textContent = \`クエリ成功: \${message.data.message} (\${message.data.executionTime}ms)\`;
                    statusEl.style.color = 'var(--vscode-testing-iconPassed)';
                    
                    if (message.data.results && message.data.results.length > 0) {
                        const tableHtml = createResultTable(message.data.results);
                        resultsEl.innerHTML = '<h3>クエリ結果:</h3>' + tableHtml;
                    } else {
                        resultsEl.innerHTML = '<p>結果なし</p>';
                    }
                } else {
                    statusEl.textContent = \`クエリエラー: \${message.data.message}\`;
                    statusEl.style.color = 'var(--vscode-testing-iconFailed)';
                    resultsEl.innerHTML = '';
                }
            }
        });
        
        console.log('Development WebView loaded successfully');
    </script>
</body>
</html>`
  }

  private _getProdHtml(webview: vscode.Webview) {
    // Find the actual JS file dynamically
    const webviewPath = vscode.Uri.joinPath(this._extensionUri, "dist", "webview")
    const assetsPath = vscode.Uri.joinPath(webviewPath, "assets")

    // Read JS filename from index.html (most reliable method)
    let jsFileName: string
    try {
      const fs = require("node:fs")
      const indexPath = vscode.Uri.joinPath(webviewPath, "index.html")
      const indexContent = fs.readFileSync(indexPath.fsPath, "utf-8")
      const scriptMatch = indexContent.match(/src="\.\/assets\/(index-[^"]+\.js)"/)

      if (scriptMatch) {
        jsFileName = scriptMatch[1]
      } else {
        throw new Error("No script tag found in index.html")
      }
    } catch (error) {
      console.error("[WebViewProvider] Failed to read index.html:", error)
      return this._getDevHtml() // Fallback to development HTML
    }

    // Generate URLs
    const nonce = getNonce()
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(assetsPath, jsFileName))

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline' https://cdnjs.cloudflare.com; img-src ${webview.cspSource} https: data:; script-src 'nonce-${nonce}'; font-src ${webview.cspSource} https://cdnjs.cloudflare.com; connect-src ${webview.cspSource} https: ws:;">
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
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline' https://cdnjs.cloudflare.com; img-src ${webview.cspSource} https: data:; script-src 'nonce-${nonce}'; font-src ${webview.cspSource} https://cdnjs.cloudflare.com; connect-src ${webview.cspSource} https: ws:;">
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

    const status = this.databaseService.getConnectionStatus()
    this._view.webview.postMessage({
      type: "connectionStatus",
      data: status,
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
    const result = await this.databaseService.connect(data)

    if (this._view) {
      this._view.webview.postMessage({
        type: "connectionResult",
        data: result,
      })
    }
  }

  private async _handleSaveConnection(data: DatabaseConfig) {
    try {
      // Save connection using DatabaseService
      await this.databaseService.saveConnection(data)
      vscode.window.showInformationMessage(`Connection "${data.name}" saved successfully`)

      if (this._view) {
        this._view.webview.postMessage({
          type: "connectionSaved",
          data: { success: true, connection: data },
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error("Save connection error:", error)
      vscode.window.showErrorMessage(`Failed to save connection: ${errorMessage}`)
      if (this._view) {
        this._view.webview.postMessage({
          type: "connectionSaved",
          data: { success: false, error: errorMessage },
        })
      }
    }
  }

  private async _handleTestConnection(data: DatabaseConfig) {
    try {
      // Convert DatabaseConfig to compatible format for database service
      const connectionData = {
        type: data.type,
        host: data.host || "",
        port: data.port || 0,
        database: data.database,
        username: data.username || "",
        password: data.password || "",
        ssl: typeof data.ssl === "boolean" ? data.ssl : false,
      }
      const result = await this.databaseService.connect(connectionData)
      if (this._view) {
        this._view.webview.postMessage({
          type: "connectionTestResult",
          data: result,
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      if (this._view) {
        this._view.webview.postMessage({
          type: "connectionTestResult",
          data: { success: false, message: errorMessage },
        })
      }
    }
  }

  private _sendDefaultConnectionConfig() {
    if (!this._view) return

    const config = vscode.workspace.getConfiguration("vscode-dbm")
    const defaultConfig = {
      host: config.get("mysql.host") || "localhost",
      port: config.get("mysql.port") || 3307,
      database: config.get("mysql.database") || "test_db",
      username: config.get("mysql.username") || "test_user",
    }
    this._view.webview.postMessage({
      type: "defaultConnectionConfig",
      data: defaultConfig,
    })
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
    this.databaseService.removeMessageListener("sidebar")
  }
}
