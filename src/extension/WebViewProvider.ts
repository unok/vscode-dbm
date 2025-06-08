import * as vscode from "vscode";
import type { DatabaseConfig } from "../shared/types";
import type {
  BaseMessage,
  OpenConnectionMessage,
} from "../shared/types/messages";
import { DatabaseService } from "./services/DatabaseService";

// Helper function to generate nonce for CSP
function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export class DatabaseWebViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "dbManager.webview";

  private view?: vscode.WebviewView;
  private databaseService: DatabaseService;

  constructor(private readonly extensionUri: vscode.Uri) {
    this.databaseService = DatabaseService.getInstance();
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    // Register message listener for database service
    this.databaseService.addMessageListener("sidebar", (message) => {
      if (this.view) {
        this.view.webview.postMessage(message);
      }
    });

    // Message handling between extension and webview
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case "getConnectionStatus":
          this.sendConnectionStatus();
          break;
        case "openConnection":
          await this.handleOpenConnection(message.data);
          break;
        case "executeQuery":
          await this.databaseService.executeQuery(message.data);
          break;
        case "showInfo":
          vscode.window.showInformationMessage(message.data.message);
          break;
        case "showError":
          vscode.window.showErrorMessage(message.data.message);
          break;
        case "getTheme":
          this.sendTheme();
          break;
        case "saveConnection":
          await this.handleSaveConnection(message.data);
          break;
        case "testConnection":
          await this.handleTestConnection(message.data);
          break;
        case "getSavedConnections":
          this.sendSavedConnections();
          break;
        case "getActiveConnections":
          this.sendActiveConnections();
          break;
        case "disconnectConnection":
          await this.handleDisconnectConnection(message.data);
          break;
        case "getSchema":
          await this.handleGetSchema();
          break;
        case "getTableMetadataWithConstraints":
          await this.handleGetTableMetadataWithConstraints(message.data);
          break;
      }
    });

    // Listen for theme changes
    vscode.window.onDidChangeActiveColorTheme(() => {
      this.sendTheme();
    });
  }

  private getHtmlForWebview(webview: vscode.Webview) {
    // 開発環境かどうかを判定
    const isDevelopment =
      process.env.NODE_ENV === "development" ||
      process.env.VSCODE_DEBUG === "true";

    if (isDevelopment) {
      return this.getDevHtml();
    }

    // プロダクション環境用の簡単なHTML
    const nonce = this.getNonce();

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
                html += '<th>' + header + '</th>';
            });
            html += '</tr></thead>';
            
            // データ行
            html += '<tbody>';
            rows.forEach(row => {
                html += '<tr>';
                headers.forEach(header => {
                    const value = row[header] !== null && row[header] !== undefined ? row[header] : 'NULL';
                    html += '<td>' + value + '</td>';
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
                    'データベース: 接続済み (' + message.data.activeConnection + ')' : 
                    'データベース: 未接続';
                document.getElementById('connectionStatus').textContent = status;
            }
            
            // 接続結果の表示
            if (message.type === 'connectionResult') {
                const statusEl = document.getElementById('connectionStatus');
                if (message.data.success) {
                    statusEl.textContent = 'データベース: ' + message.data.message;
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
                    statusEl.textContent = 'クエリ成功: ' + message.data.message + ' (' + message.data.executionTime + 'ms)';
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
                    statusEl.textContent = 'クエリエラー: ' + message.data.message;
                    statusEl.style.color = 'var(--vscode-testing-iconFailed)';
                    resultsEl.innerHTML = '';
                }
            }
        });
    </script>
</body>
</html>`;
  }

  private getNonce() {
    let text = "";
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  private getDevHtml() {
    // Simple development HTML with table details only
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https://cdnjs.cloudflare.com; font-src https://cdnjs.cloudflare.com; script-src 'nonce-${nonce}';">
    <title>Quick Actions</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            font-family: var(--vscode-font-family);
            overflow-x: hidden;
        }
        
        /* Table Details Styles - Clean Design */
        .table-details {
            font-family: var(--vscode-font-family);
            font-size: 12px;
            padding: 12px;
        }
        
        .detail-section {
            margin-bottom: 16px;
            background: var(--vscode-sideBar-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            overflow: hidden;
        }
        
        .detail-title {
            background: var(--vscode-editorWidget-background);
            color: var(--vscode-editor-foreground);
            margin: 0;
            padding: 8px 12px;
            font-size: 13px;
            font-weight: 600;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .table-info {
            padding: 12px;
        }
        
        .table-comment {
            background: var(--vscode-editorGutter-background);
            color: var(--vscode-editor-foreground);
            padding: 8px;
            margin: 0 0 8px 0;
            border-radius: 4px;
            font-style: italic;
            border-left: 3px solid var(--vscode-focusBorder);
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
        }
        
        .info-item {
            font-size: 11px;
        }
        
        .info-label {
            color: var(--vscode-descriptionForeground);
            font-weight: 500;
        }
        
        .info-value {
            color: var(--vscode-editor-foreground);
            margin-left: 4px;
        }
        
        /* Columns Container */
        .columns-container, .constraints-container, .indexes-container {
            max-height: 250px;
            overflow-y: auto;
            padding: 8px;
        }
        
        .column-card, .constraint-card, .index-card {
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            margin-bottom: 6px;
            padding: 8px 10px;
            transition: all 0.2s ease;
        }
        
        .column-card:hover, .constraint-card:hover, .index-card:hover {
            background: var(--vscode-list-hoverBackground);
            border-color: var(--vscode-focusBorder);
        }
        
        .column-header, .constraint-header, .index-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 4px;
        }
        
        .column-name, .constraint-name, .index-name {
            font-weight: 600;
            color: var(--vscode-editor-foreground);
            font-size: 12px;
        }
        
        .column-type {
            color: var(--vscode-descriptionForeground);
            font-size: 10px;
            font-family: 'Courier New', monospace;
            background: var(--vscode-badge-background);
            padding: 2px 6px;
            border-radius: 3px;
        }
        
        .column-badges {
            margin-top: 4px;
        }
        
        .column-comment {
            margin-top: 6px;
            padding: 4px 6px;
            background: var(--vscode-editorGutter-background);
            color: var(--vscode-editor-foreground);
            border-radius: 3px;
            font-size: 10px;
            font-style: italic;
            border-left: 2px solid var(--vscode-textLink-foreground);
        }
        
        .constraint-details, .index-details {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
        }
        
        .constraint-type-badge {
            font-size: 9px;
            font-weight: bold;
            padding: 2px 6px;
            border-radius: 3px;
            text-transform: uppercase;
        }
        
        .constraint-type-badge.foreign_key {
            background: var(--vscode-charts-purple);
            color: white;
        }
        
        .constraint-type-badge.unique {
            background: var(--vscode-charts-blue);
            color: white;
        }
        
        .constraint-type-badge.check {
            background: var(--vscode-charts-orange);
            color: white;
        }
        
        /* Badges */
        .badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 9px;
            font-weight: bold;
            margin-right: 4px;
            text-transform: uppercase;
        }
        
        .badge.pk {
            background: var(--vscode-charts-red);
            color: white;
        }
        
        .badge.fk {
            background: var(--vscode-charts-purple);
            color: white;
        }
        
        .badge.nn {
            background: var(--vscode-charts-yellow);
            color: black;
        }
        
        .badge.unique {
            background: var(--vscode-charts-blue);
            color: white;
        }
        
        .loading {
            text-align: center;
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
            padding: 16px;
            font-style: italic;
        }
    </style>
</head>
<body>
    <!-- Table Details Section -->
    <div id="tableDetailsSection" style="display: none;">
        <div id="tableDetailsContent"></div>
    </div>

    <script nonce="${nonce}">
        // Store VSCode API globally to prevent multiple acquisitions
        if (!window.vscode && window.acquireVsCodeApi) {
            window.vscode = acquireVsCodeApi();
        }
        const vscode = window.vscode;
        
        // テーブル詳細表示関数
        function displayTableDetails(tableData) {
            const section = document.getElementById('tableDetailsSection');
            const content = document.getElementById('tableDetailsContent');
            
            if (!tableData) {
                content.innerHTML = '<div class="table-details"><p class="loading">テーブルデータが見つかりません</p></div>';
                section.style.display = 'block';
                return;
            }
            
            let html = '<div class="table-details">';
            
            // テーブル基本情報
            html += '<div class="detail-section">';
            html += '<h4 class="detail-title">📋 ' + (tableData.name || 'N/A') + '</h4>';
            html += '<div class="table-info">';
            if (tableData.comment) {
                html += '<p class="table-comment">' + tableData.comment + '</p>';
            }
            html += '<div class="info-grid">';
            html += '<div class="info-item"><span class="info-label">スキーマ:</span> <span class="info-value">' + (tableData.schema || 'public') + '</span></div>';
            html += '<div class="info-item"><span class="info-label">行数:</span> <span class="info-value">' + (tableData.rowCount || 'N/A') + '</span></div>';
            html += '</div>';
            html += '</div>';
            html += '</div>';
            
            // カラム情報
            if (tableData.columns && tableData.columns.length > 0) {
                html += '<div class="detail-section">';
                html += '<h4 class="detail-title">📝 カラム (' + tableData.columns.length + ')</h4>';
                html += '<div class="columns-container">';
                tableData.columns.forEach(column => {
                    const badges = [];
                    if (column.isPrimaryKey) badges.push('<span class="badge pk">PK</span>');
                    if (column.isForeignKey) badges.push('<span class="badge fk">FK</span>');
                    if (!column.isNullable) badges.push('<span class="badge nn">NOT NULL</span>');
                    
                    html += '<div class="column-card">';
                    html += '<div class="column-header">';
                    html += '<span class="column-name">' + column.name + '</span>';
                    html += '<span class="column-type">' + column.type + '</span>';
                    html += '</div>';
                    if (badges.length > 0) {
                        html += '<div class="column-badges">' + badges.join(' ') + '</div>';
                    }
                    if (column.comment) {
                        html += '<div class="column-comment">' + column.comment + '</div>';
                    }
                    html += '</div>';
                });
                html += '</div>';
                html += '</div>';
            }
            
            // 制約情報（NOT NULL と PRIMARY KEY を除外）
            const meaningfulConstraints = tableData.constraints ? 
                tableData.constraints.filter(constraint => 
                    !constraint.type.includes('not_null') && 
                    !constraint.type.includes('primary_key') &&
                    constraint.type !== 'not_null' &&
                    constraint.type !== 'primary_key'
                ) : [];
                
            if (meaningfulConstraints.length > 0) {
                html += '<div class="detail-section">';
                html += '<h4 class="detail-title">🔗 制約 (' + meaningfulConstraints.length + ')</h4>';
                html += '<div class="constraints-container">';
                meaningfulConstraints.forEach(constraint => {
                    // 制約タイプの日本語表示
                    let typeDisplay = constraint.type;
                    switch(constraint.type) {
                        case 'foreign_key': typeDisplay = '外部キー'; break;
                        case 'unique': typeDisplay = 'ユニーク'; break;
                        case 'check': typeDisplay = 'チェック'; break;
                        case 'exclusion': typeDisplay = '排他'; break;
                        default: typeDisplay = constraint.type.toUpperCase();
                    }
                    
                    html += '<div class="constraint-card">';
                    html += '<div class="constraint-header">';
                    html += '<span class="constraint-name">' + constraint.name + '</span>';
                    html += '<span class="constraint-type-badge ' + constraint.type + '">' + typeDisplay + '</span>';
                    html += '</div>';
                    if (constraint.columns && constraint.columns.length > 0) {
                        html += '<div class="constraint-details">カラム: ' + constraint.columns.join(', ') + '</div>';
                    }
                    if (constraint.referencedTable) {
                        html += '<div class="constraint-details">参照先: ' + constraint.referencedTable;
                        if (constraint.referencedColumns && constraint.referencedColumns.length > 0) {
                            html += ' (' + constraint.referencedColumns.join(', ') + ')';
                        }
                        html += '</div>';
                    }
                    html += '</div>';
                });
                html += '</div>';
                html += '</div>';
            }
            
            // インデックス情報
            if (tableData.indexes && tableData.indexes.length > 0) {
                html += '<div class="detail-section">';
                html += '<h4 class="detail-title">⚡ インデックス (' + tableData.indexes.length + ')</h4>';
                html += '<div class="indexes-container">';
                tableData.indexes.forEach(index => {
                    html += '<div class="index-card">';
                    html += '<div class="index-header">';
                    html += '<span class="index-name">' + index.name + '</span>';
                    if (index.isUnique) html += '<span class="badge unique">UNIQUE</span>';
                    html += '</div>';
                    if (index.columns && index.columns.length > 0) {
                        html += '<div class="index-details">カラム: ' + index.columns.join(', ') + '</div>';
                    }
                    html += '</div>';
                });
                html += '</div>';
                html += '</div>';
            }
            
            html += '</div>';
            
            content.innerHTML = html;
            section.style.display = 'block';
        }
        
        // メッセージリスナー（テーブル詳細専用）
        window.addEventListener('message', event => {
            console.log('QuickAction: Received message:', event.data);
            const message = event.data;
            
            // テーブル詳細の表示
            if (message.type === 'showTableDetails') {
                console.log('Displaying table details:', message.data);
                displayTableDetails(message.data);
            }
        });
        
        console.log('QuickAction WebView loaded successfully');
    </script>
</body>
</html>`;
  }

  // 残りのメソッドは元のファイルと同じ...
  // (他のメソッドをここに追加...)

  /**
   * 指定されたテーブルの詳細情報を表示
   */
  async showTableDetails(tableName: string): Promise<void> {
    console.log("WebViewProvider.showTableDetails called with tableName:", tableName);
    console.log("tableName type:", typeof tableName);
    console.log("tableName string representation:", String(tableName));
    
    // tableNameが文字列でない場合はエラーを出す
    if (typeof tableName !== 'string') {
      const errorMessage = `無効なテーブル名: 文字列が期待されますが、${typeof tableName}型が渡されました。値: ${String(tableName)}`;
      console.error(errorMessage);
      vscode.window.showErrorMessage(errorMessage);
      return;
    }
    
    // 空文字列チェック
    if (!tableName.trim()) {
      const errorMessage = "テーブル名が空です";
      console.error(errorMessage);
      vscode.window.showErrorMessage(errorMessage);
      return;
    }
    
    if (!this.view) {
      console.log("No view available");
      return;
    }

    try {
      // アクティブな接続を取得
      const activeConnections = this.databaseService.getActiveConnections();
      console.log("Active connections:", activeConnections.length);
      
      if (activeConnections.length === 0) {
        vscode.window.showWarningMessage(
          "アクティブなデータベース接続がありません",
        );
        return;
      }

      // 最初のアクティブ接続を使用（複数ある場合は改善の余地あり）
      const connectionId = activeConnections[0].id;
      console.log("Using connection ID:", connectionId);

      // テーブルの詳細メタデータを取得
      console.log("Getting table metadata for:", tableName);
      const tableMetadata =
        await this.databaseService.getTableMetadataWithConstraints(
          tableName.trim(),
          undefined, // schema
          connectionId,
        );

      console.log("Got table metadata:", tableMetadata);

      // WebViewにテーブル詳細表示メッセージを送信
      this.view.webview.postMessage({
        type: "showTableDetails",
        data: tableMetadata,
      });

      // WebViewを前面に表示
      this.view.show?.(true);
    } catch (error) {
      console.error("Error in showTableDetails:", error);
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラー";
      vscode.window.showErrorMessage(
        `テーブル詳細の取得に失敗しました: ${errorMessage}`,
      );
    }
  }

  // 他のメソッドも継続...
  private sendConnectionStatus() {
    if (!this.view) return;

    const status = this.databaseService.getConnectionStatus();
    this.view.webview.postMessage({
      type: "connectionStatus",
      data: status,
    });
  }

  private sendTheme() {
    if (!this.view) return;

    const theme = vscode.window.activeColorTheme;
    this.view.webview.postMessage({
      type: "themeChanged",
      data: {
        kind: theme.kind === vscode.ColorThemeKind.Light ? "light" : "dark",
      },
    });
  }

  private async handleOpenConnection(data: OpenConnectionMessage["data"]) {
    const result = await this.databaseService.connect(data);

    if (this.view) {
      this.view.webview.postMessage({
        type: "connectionResult",
        data: result,
      });
    }
  }

  private async handleSaveConnection(data: DatabaseConfig) {
    try {
      // Save connection using DatabaseService
      await this.databaseService.saveConnection(data);
      vscode.window.showInformationMessage(
        `Connection "${data.name}" saved successfully`,
      );

      if (this.view) {
        this.view.webview.postMessage({
          type: "connectionSaved",
          data: { success: true, connection: data },
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Save connection error:", error);
      vscode.window.showErrorMessage(
        `Failed to save connection: ${errorMessage}`,
      );
      if (this.view) {
        this.view.webview.postMessage({
          type: "connectionSaved",
          data: { success: false, error: errorMessage },
        });
      }
    }
  }

  private async handleTestConnection(data: DatabaseConfig) {
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
      };
      const result = await this.databaseService.connect(connectionData);
      if (this.view) {
        this.view.webview.postMessage({
          type: "connectionTestResult",
          data: result,
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      if (this.view) {
        this.view.webview.postMessage({
          type: "connectionTestResult",
          data: { success: false, message: errorMessage },
        });
      }
    }
  }

  private sendSavedConnections() {
    if (!this.view) return;

    const connections = this.databaseService.getSavedConnections();
    this.view.webview.postMessage({
      type: "savedConnections",
      data: { connections },
    });
  }

  private sendActiveConnections() {
    if (!this.view) return;

    const connections = this.databaseService.getActiveConnections();
    this.view.webview.postMessage({
      type: "activeConnections",
      data: { connections },
    });
  }

  private async handleDisconnectConnection(data: { connectionId: string }) {
    try {
      await this.databaseService.disconnect(data.connectionId);
      // 切断後、更新された接続一覧を送信
      this.sendActiveConnections();
      this.sendConnectionStatus();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Disconnect connection error:", error);
      vscode.window.showErrorMessage(`Failed to disconnect: ${errorMessage}`);
    }
  }

  private async handleGetSchema() {
    try {
      const schema = await this.databaseService.getSchema();
      if (this.view) {
        this.view.webview.postMessage({
          type: "schema",
          data: schema,
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Get schema error:", error);
      if (this.view) {
        this.view.webview.postMessage({
          type: "schemaError",
          data: { message: errorMessage },
        });
      }
    }
  }

  private async handleGetTableMetadataWithConstraints(data: {
    tableName: string;
    schema?: string;
  }) {
    try {
      const tableMetadata =
        await this.databaseService.getTableMetadataWithConstraints(
          data.tableName,
          data.schema,
        );
      if (this.view) {
        this.view.webview.postMessage({
          type: "tableMetadataWithConstraints",
          data: tableMetadata,
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Get table metadata error:", error);
      if (this.view) {
        this.view.webview.postMessage({
          type: "tableMetadataError",
          data: { message: errorMessage },
        });
      }
    }
  }

  // Public methods for external communication
  public postMessage(message: BaseMessage) {
    if (this.view) {
      this.view.webview.postMessage(message);
    }
  }

  public reveal() {
    if (this.view) {
      this.view.show?.(true);
    }
  }

  public async cleanup() {
    this.databaseService.removeMessageListener("sidebar");
  }
}