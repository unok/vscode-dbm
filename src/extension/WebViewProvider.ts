import * as path from "node:path"
import * as vscode from "vscode"
import {
  type DatabaseProxy,
  type DatabaseProxyConfig,
  DatabaseProxyFactory,
} from "../shared/database/DatabaseProxy"
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
  private _databaseProxy?: DatabaseProxy
  private _isConnected = false
  private _connectionType?: string

  constructor(private readonly _extensionUri: vscode.Uri) {}

  private async _connectDatabase(
    type: "mysql" | "postgresql" | "sqlite",
    config?: Partial<DatabaseProxyConfig>
  ): Promise<boolean> {
    try {
      // 接続中の場合は切断
      if (this._databaseProxy) {
        await this._databaseProxy.disconnect()
      }

      // 設定を環境変数、VSCode設定、ユーザー入力の順で取得
      const vscodeConfig = vscode.workspace.getConfiguration("vscode-dbm")

      const defaultConfigs = {
        mysql: {
          host:
            config?.host || process.env.MYSQL_HOST || vscodeConfig.get("mysql.host") || "localhost",
          port:
            config?.port ||
            (process.env.MYSQL_PORT ? Number.parseInt(process.env.MYSQL_PORT, 10) : null) ||
            vscodeConfig.get("mysql.port") ||
            3307, // Changed to 3307 for Docker test environment
          database:
            config?.database ||
            process.env.MYSQL_DATABASE ||
            vscodeConfig.get("mysql.database") ||
            "test_db",
          username:
            config?.username ||
            process.env.MYSQL_USER ||
            vscodeConfig.get("mysql.username") ||
            "test_user", // Changed to test_user for Docker environment
          password:
            config?.password ||
            process.env.MYSQL_PASSWORD ||
            vscodeConfig.get("mysql.password") ||
            "test_password", // Changed to test_password for Docker environment
        },
        postgresql: {
          host:
            config?.host ||
            process.env.POSTGRES_HOST ||
            vscodeConfig.get("postgresql.host") ||
            "localhost",
          port:
            config?.port ||
            (process.env.POSTGRES_PORT ? Number.parseInt(process.env.POSTGRES_PORT, 10) : null) ||
            vscodeConfig.get("postgresql.port") ||
            5433, // Changed to 5433 for Docker test environment
          database:
            config?.database ||
            process.env.POSTGRES_DB ||
            vscodeConfig.get("postgresql.database") ||
            "test_db",
          username:
            config?.username ||
            process.env.POSTGRES_USER ||
            vscodeConfig.get("postgresql.username") ||
            "test_user", // Changed to test_user for Docker environment
          password:
            config?.password ||
            process.env.POSTGRES_PASSWORD ||
            vscodeConfig.get("postgresql.password") ||
            "test_password", // Changed to test_password for Docker environment
        },
        sqlite: {
          database:
            config?.database ||
            process.env.SQLITE_DATABASE ||
            vscodeConfig.get("sqlite.database") ||
            ":memory:",
        },
      }

      // データベースタイプに応じて接続
      switch (type) {
        case "mysql": {
          const mysqlConfig = defaultConfigs.mysql
          this._databaseProxy = DatabaseProxyFactory.createMySQL(
            mysqlConfig.host,
            mysqlConfig.port,
            mysqlConfig.database,
            mysqlConfig.username,
            mysqlConfig.password
          )
          this._connectionType = `MySQL (${mysqlConfig.host}:${mysqlConfig.port})`
          break
        }
        case "postgresql": {
          const pgConfig = defaultConfigs.postgresql
          this._databaseProxy = DatabaseProxyFactory.createPostgreSQL(
            pgConfig.host,
            pgConfig.port,
            pgConfig.database,
            pgConfig.username,
            pgConfig.password
          )
          this._connectionType = `PostgreSQL (${pgConfig.host}:${pgConfig.port})`
          break
        }
        case "sqlite": {
          const sqliteConfig = defaultConfigs.sqlite
          this._databaseProxy = DatabaseProxyFactory.createSQLite(sqliteConfig.database)
          this._connectionType = `SQLite (${sqliteConfig.database})`
          break
        }
        default:
          throw new Error(`Unsupported database type: ${type}`)
      }

      const connected = await this._databaseProxy.connect()
      this._isConnected = connected

      if (connected) {
        return true
      }

      // フォールバック: SQLiteに自動切り替え
      if (type !== "sqlite") {
        console.warn(`${type} connection failed, falling back to SQLite`)
        return await this._connectDatabase("sqlite", { database: ":memory:" })
      }

      return false
    } catch (error) {
      console.error("Database connection failed:", error)

      // フォールバック: SQLiteに自動切り替え
      if (type !== "sqlite") {
        console.warn(`${type} connection failed with error: ${error}, falling back to SQLite`)
        try {
          return await this._connectDatabase("sqlite", { database: ":memory:" })
        } catch (fallbackError) {
          console.error("SQLite fallback also failed:", fallbackError)
        }
      }

      this._isConnected = false
      return false
    }
  }

  private async _disconnectDatabase(): Promise<void> {
    if (this._databaseProxy) {
      await this._databaseProxy.disconnect()
      this._databaseProxy = undefined
    }
    this._isConnected = false
    this._connectionType = undefined
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
        case "showInfo":
          vscode.window.showInformationMessage(message.data.message)
          break
        case "showError":
          vscode.window.showErrorMessage(message.data.message)
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
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
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
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
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

    this._view.webview.postMessage({
      type: "connectionStatus",
      data: {
        connected: this._isConnected,
        databases: this._isConnected ? [this._connectionType || "Database"] : [],
        activeConnection: this._isConnected ? this._connectionType : undefined,
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
      // データベースタイプを決定（デフォルトはMySQL）
      const dbType =
        data.type === "postgresql" ? "postgresql" : data.type === "sqlite" ? "sqlite" : "mysql"

      // 接続設定を渡す
      const config: Partial<DatabaseProxyConfig> = {
        host: data.host,
        port: data.port,
        database: data.database,
        username: data.username,
        password: data.password,
      }

      const success = await this._connectDatabase(dbType, config)

      if (success) {
        vscode.window.showInformationMessage(`${this._connectionType} 接続成功`)

        // 接続状況を更新
        this._sendConnectionStatus()

        if (this._view) {
          this._view.webview.postMessage({
            type: "connectionResult",
            data: {
              success: true,
              message: `${this._connectionType} に接続しました`,
            },
          })
        }
      } else {
        throw new Error("データベース接続に失敗しました")
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "不明なエラー"
      vscode.window.showErrorMessage(`接続エラー: ${errorMessage}`)

      if (this._view) {
        this._view.webview.postMessage({
          type: "connectionResult",
          data: {
            success: false,
            message: errorMessage,
          },
        })
      }
    }
  }

  private async _handleExecuteQuery(data: { query?: string }) {
    if (!this._databaseProxy || !this._isConnected) {
      vscode.window.showWarningMessage("データベースに接続されていません")

      if (this._view) {
        this._view.webview.postMessage({
          type: "queryResult",
          data: {
            success: false,
            results: [],
            message: "データベースに接続されていません",
          },
        })
      }
      return
    }

    try {
      const query = data.query || "SELECT * FROM users LIMIT 10"

      // DatabaseProxyを使用してクエリ実行
      const result = await this._databaseProxy.query(query)

      if (result.success) {
        vscode.window.showInformationMessage(
          `クエリ実行成功: ${result.rowCount}行取得 (${result.executionTime}ms) - ${this._connectionType}`
        )

        if (this._view) {
          this._view.webview.postMessage({
            type: "queryResult",
            data: {
              success: true,
              results: result.rows || [],
              rowCount: result.rowCount || 0,
              executionTime: result.executionTime || 0,
              message: `${result.rowCount}行を取得しました (${this._connectionType})`,
            },
          })
        }
      } else {
        throw new Error(result.error || "クエリ実行に失敗しました")
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "不明なエラー"
      vscode.window.showErrorMessage(`クエリエラー: ${errorMessage}`)

      if (this._view) {
        this._view.webview.postMessage({
          type: "queryResult",
          data: {
            success: false,
            results: [],
            message: errorMessage,
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
    await this._disconnectDatabase()
  }
}
