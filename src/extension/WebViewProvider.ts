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
        case "webviewReady":
          console.log("WebView ready notification received:", message.data);
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

    console.log("getHtmlForWebview called");
    console.log("NODE_ENV:", process.env.NODE_ENV);
    console.log("VSCODE_DEBUG:", process.env.VSCODE_DEBUG);
    console.log("isDevelopment:", isDevelopment);

    if (isDevelopment) {
      console.log("Using getDevHtml()");
      return this.getDevHtml();
    }

    console.log("Using production HTML");

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
    <h2>📋 クイックアクション</h2>
    <div class="status" id="status">WebView読み込み中...</div>
    <button id="testTableBtn">テーブル詳細テスト</button>
    <div id="tableDetailsSection" style="margin-top: 20px;">
        <div id="tableDetailsContent"></div>
    </div>
    <div id="debugInfo" style="margin-top: 10px; font-size: 11px; color: var(--vscode-descriptionForeground);"></div>
    
    <script nonce="${nonce}">
        // Store VSCode API globally to prevent multiple acquisitions
        if (!window.vscode && window.acquireVsCodeApi) {
            window.vscode = acquireVsCodeApi();
        }
        const vscode = window.vscode;
        
        document.getElementById('status').textContent = 'WebView正常読み込み完了';
        
        // デバッグ情報を画面に表示
        const debugInfo = document.getElementById('debugInfo');
        if (debugInfo) {
            debugInfo.innerHTML = 'WebView読み込み完了: ' + new Date().toLocaleTimeString() + '<br>プロダクション環境';
            if (window.vscode) {
                debugInfo.innerHTML += '<br>VSCode API利用可能';
            } else {
                debugInfo.innerHTML += '<br>VSCode API利用不可';
            }
        }
        
        // テーブル詳細表示関数（プロダクション環境用）
        function displayTableDetails(tableData) {
            console.log('displayTableDetails called with:', tableData);
            const content = document.getElementById('tableDetailsContent');
            
            if (!tableData) {
                content.innerHTML = '<p>テーブルデータが見つかりません</p>';
                return;
            }
            
            let html = '<div style="border: 1px solid var(--vscode-panel-border); padding: 15px; border-radius: 4px;">';
            html += '<h3>' + (tableData.name || 'N/A') + '</h3>';
            
            if (tableData.columns && tableData.columns.length > 0) {
                html += '<h4>カラム (' + tableData.columns.length + ')</h4>';
                html += '<div style="max-height: 300px; overflow-y: auto;">';
                tableData.columns.forEach(column => {
                    html += '<div style="margin: 5px 0; padding: 8px; background: var(--vscode-editorWidget-background); border-radius: 3px;">';
                    html += '<strong>' + column.name + '</strong> (' + column.type + ')';
                    if (column.isPrimaryKey) html += ' [PK]';
                    if (!column.isNullable) html += ' [NOT NULL]';
                    if (column.comment) html += '<br><em>' + column.comment + '</em>';
                    html += '</div>';
                });
                html += '</div>';
            }
            
            html += '</div>';
            content.innerHTML = html;
        }
        
        // テストボタンのイベントリスナー
        const testTableBtn = document.getElementById('testTableBtn');
        if (testTableBtn) {
            testTableBtn.addEventListener('click', function() {
                console.log('Test table button clicked');
                if (debugInfo) {
                    debugInfo.innerHTML += '<br>テストボタンクリック: ' + new Date().toLocaleTimeString();
                }
                
                displayTableDetails({
                    name: 'プロダクション_テストテーブル',
                    columns: [
                        { name: 'id', type: 'int', isPrimaryKey: true, isNullable: false },
                        { name: 'name', type: 'varchar', isNullable: false, comment: 'プロダクション環境テスト' }
                    ],
                    rowCount: 42
                });
            });
        }
        
        
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
            
            // デバッグ情報を更新
            if (debugInfo) {
                debugInfo.innerHTML += '<br>メッセージ受信: ' + message.type + ' - ' + new Date().toLocaleTimeString();
            }
            
            // テーブル詳細の表示
            if (message.type === 'showTableDetails') {
                console.log('Displaying table details:', message.data);
                try {
                    displayTableDetails(message.data);
                    if (debugInfo) {
                        debugInfo.innerHTML += '<br>テーブル詳細表示成功';
                    }
                } catch (error) {
                    console.error('Error displaying table details:', error);
                    if (debugInfo) {
                        debugInfo.innerHTML += '<br>エラー: ' + error.message;
                    }
                }
            }
            
            // 接続状況の更新
            else if (message.type === 'connectionStatus') {
                const status = message.data.connected ? 
                    'データベース: 接続済み (' + message.data.activeConnection + ')' : 
                    'データベース: 未接続';
                document.getElementById('status').textContent = status;
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
    
    console.log("Generated nonce:", nonce);

    const html = `<!DOCTYPE html>
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
            flex-direction: column;
            gap: 4px;
            margin-bottom: 4px;
        }
        
        .column-section {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }
        
        .column-section.name-section {
            font-weight: 600;
            color: var(--vscode-editor-foreground);
        }
        
        .column-section.type-section {
            margin-left: 0;
        }
        
        .column-section.other-section {
            margin-left: 0;
        }
        
        .column-name, .constraint-name, .index-name {
            font-weight: 600;
            color: var(--vscode-editor-foreground);
            font-size: 12px;
        }
        
        .column-type {
            color: var(--vscode-textLink-foreground);
            font-size: 12px;
            font-family: 'Courier New', monospace;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-focusBorder);
            padding: 3px 8px;
            border-radius: 4px;
            font-weight: 600;
        }
        
        .column-comment {
            margin-left: 8px;
            padding: 2px 6px;
            background: var(--vscode-editorGutter-background);
            color: var(--vscode-editor-foreground);
            border-radius: 3px;
            font-size: 10px;
            font-style: italic;
            border-left: 2px solid var(--vscode-textLink-foreground);
            flex-shrink: 0;
        }
        
        .constraint-details, .index-details {
            font-size: 11px;
            color: var(--vscode-editor-foreground);
            margin-top: 4px;
            line-height: 1.4;
        }
        
        .constraint-details strong {
            color: var(--vscode-textLink-foreground);
            font-weight: 600;
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
            margin-left: 8px;
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
    <div id="tableDetailsSection" style="display: block;">
        <div id="tableDetailsContent">
            <div style="padding: 20px; color: var(--vscode-editor-foreground); background: var(--vscode-editor-background);">
                <h3>📋 クイックアクション</h3>
                <p>テーブルをクリックすると詳細情報が表示されます</p>
                <button id="testBtn" style="margin: 10px 0; padding: 5px 10px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 3px; cursor: pointer;">テスト表示</button>
                <div id="debugInfo" style="margin-top: 10px; font-size: 11px; color: var(--vscode-descriptionForeground);"></div>
            </div>
        </div>
    </div>

    <script nonce="${nonce}">
        // Store VSCode API globally to prevent multiple acquisitions
        if (!window.vscode && window.acquireVsCodeApi) {
            window.vscode = acquireVsCodeApi();
        }
        const vscode = window.vscode;
        
        // テーブル詳細表示関数
        function displayTableDetails(tableData) {
            console.log('displayTableDetails called with:', tableData);
            const section = document.getElementById('tableDetailsSection');
            const content = document.getElementById('tableDetailsContent');
            
            console.log('section element:', section);
            console.log('content element:', content);
            
            if (!tableData) {
                console.log('No table data provided');
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
                html += '<table class="columns-table">';
                tableData.columns.forEach(column => {
                    const badges = [];
                    if (column.isPrimaryKey) badges.push('<span class="badge pk">PK</span>');
                    if (column.isForeignKey) badges.push('<span class="badge fk">FK</span>');
                    if (!column.isNullable) badges.push('<span class="badge nn">NOT NULL</span>');
                    
                    html += '<tr>';
                    
                    // 1. カラム名
                    html += '<td class="col-name">' + column.name + '</td>';
                    
                    // 2. 型（短縮表示）
                    let displayType = column.type;
                    if (displayType) {
                        displayType = displayType
                            .replace(/timestamp without time zone/gi, 'timestamp')
                            .replace(/timestamp with time zone/gi, 'timestampz')
                            .replace(/character varying/gi, 'varchar')
                            .replace(/double precision/gi, 'double');
                    }
                    html += '<td class="col-type"><span class="column-type">' + displayType + '</span></td>';
                    
                    // 3. その他（バッジ、コメント）
                    html += '<td class="col-other">';
                    if (badges.length > 0) {
                        html += badges.join(' ');
                    }
                    if (column.comment) {
                        if (badges.length > 0) html += ' ';
                        html += '<span class="column-comment">' + column.comment + '</span>';
                    }
                    html += '</td>';
                    
                    html += '</tr>';
                });
                html += '</table>';
                html += '</div>';
                html += '</div>';
            }
            
            // 制約情報（NOT NULL、PRIMARY KEY、単一カラムのUNIQUE、not_null名前を含む制約 を除外）
            const meaningfulConstraints = tableData.constraints ? 
                tableData.constraints.filter(constraint => {
                    // NOT NULL と PRIMARY KEY は除外
                    if (constraint.type.includes('not_null') || 
                        constraint.type.includes('primary_key') ||
                        constraint.type === 'not_null' ||
                        constraint.type === 'primary_key') {
                        return false;
                    }
                    
                    // 制約名に not_null が含まれる場合は除外
                    if (constraint.name && constraint.name.includes('not_null')) {
                        return false;
                    }
                    
                    // UNIQUE制約は全て除外（カラムに既に表示されているため）
                    if (constraint.type === 'unique' || constraint.type.includes('unique')) {
                        return false;
                    }
                    
                    return true;
                }) : [];
                
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
                    
                    // 分かりやすい制約名を生成
                    let displayName = '';
                    if (constraint.type === 'foreign_key' && constraint.referencedTable) {
                        displayName = '🔗 ' + (constraint.columns ? constraint.columns.join(', ') : '') + ' → ' + constraint.referencedTable;
                    } else if (constraint.type === 'unique') {
                        displayName = '✨ ユニーク: ' + (constraint.columns ? constraint.columns.join(', ') : '');
                    } else if (constraint.type === 'check') {
                        displayName = '✅ チェック: ' + (constraint.columns ? constraint.columns.join(', ') : '');
                    } else {
                        displayName = typeDisplay + ': ' + (constraint.columns ? constraint.columns.join(', ') : constraint.name);
                    }
                    
                    html += '<span class="constraint-name">' + displayName + '</span>';
                    html += '<span class="constraint-type-badge ' + constraint.type + '">' + typeDisplay + '</span>';
                    html += '</div>';
                    
                    // 詳細説明
                    html += '<div class="constraint-details">';
                    if (constraint.type === 'foreign_key' && constraint.referencedTable) {
                        html += '外部キー制約: このカラムの値は ' + constraint.referencedTable + ' テーブルに存在しなければなりません';
                        if (constraint.referencedColumns && constraint.referencedColumns.length > 0) {
                            html += ' (' + constraint.referencedColumns.join(', ') + ' カラムを参照)';
                        }
                    } else if (constraint.type === 'unique') {
                        html += 'ユニーク制約: このカラムの値はテーブル内で一意でなければなりません';
                    } else if (constraint.type === 'check') {
                        html += 'チェック制約: このカラムの値は特定の条件を満たす必要があります';
                    }
                    html += '</div>';
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
                    // デバッグ用のログ出力
                    console.log('Index data:', JSON.stringify(index, null, 2));
                    
                    html += '<div class="index-card">';
                    html += '<div class="index-header">';
                    
                    // インデックス名とカラム情報を一行で表示
                    let indexDisplay = index.name || 'インデックス名不明';
                    
                    // カラム情報の取得を改善（DatabaseMetadataServiceの形式に対応）
                    let columnInfo = '';
                    
                    // 実際のデータ構造をログ出力
                    console.log('Index columns property:', index.columns);
                    console.log('Index columns type:', typeof index.columns);
                    console.log('Index columns Array.isArray:', Array.isArray(index.columns));
                    
                    if (index.columns && Array.isArray(index.columns) && index.columns.length > 0) {
                        // カラムが配列の場合（DatabaseMetadataServiceの標準形式）
                        const validColumns = index.columns.filter(col => 
                            col !== undefined && col !== null && col !== '' && col !== 'undefined'
                        );
                        columnInfo = validColumns.join(', ');
                        console.log('Using columns array:', validColumns);
                    } else if (typeof index.columns === 'string' && index.columns) {
                        // カラムが文字列の場合
                        columnInfo = index.columns;
                        console.log('Using columns string:', index.columns);
                    } else if (index.column && typeof index.column === 'string') {
                        // 単一カラムの場合
                        columnInfo = index.column;
                        console.log('Using column property:', index.column);
                    } else if (index.columnName && typeof index.columnName === 'string') {
                        // columnName プロパティの場合
                        columnInfo = index.columnName;
                        console.log('Using columnName property:', index.columnName);
                    } else {
                        // オブジェクトの全プロパティをチェック
                        const keys = Object.keys(index);
                        console.log('All index keys:', keys);
                        for (const key of keys) {
                            const value = index[key];
                            console.log('Checking key "' + key + '":', value, typeof value);
                            if (key.toLowerCase().includes('column') && value && 
                                (typeof value === 'string' || Array.isArray(value))) {
                                if (Array.isArray(value)) {
                                    columnInfo = value.filter(function(v) { return v; }).join(', ');
                                } else {
                                    columnInfo = value;
                                }
                                console.log('Found column info in "' + key + '":', columnInfo);
                                break;
                            }
                        }
                    }
                    
                    // 一行表示: インデックス名 (対象カラム) [UNIQUE]
                    html += '<span class="index-name">' + indexDisplay;
                    if (columnInfo) {
                        html += ' <span style="color: var(--vscode-descriptionForeground);">(' + columnInfo + ')</span>';
                    } else {
                        html += ' <span style="color: var(--vscode-errorForeground);">(カラム不明)</span>';
                    }
                    html += '</span>';
                    
                    if (index.isUnique) {
                        html += ' <span class="badge unique">UNIQUE</span>';
                    }
                    
                    html += '</div>';
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
            
            // デバッグ情報を更新
            const debugInfo = document.getElementById('debugInfo');
            if (debugInfo) {
                debugInfo.innerHTML += '<br>メッセージ受信: ' + message.type + ' - ' + new Date().toLocaleTimeString();
            }
            
            // テーブル詳細の表示
            if (message.type === 'showTableDetails') {
                console.log('Displaying table details:', message.data);
                try {
                    displayTableDetails(message.data);
                    console.log('Table details displayed successfully');
                    if (debugInfo) {
                        debugInfo.innerHTML += '<br>テーブル詳細表示成功';
                    }
                } catch (error) {
                    console.error('Error displaying table details:', error);
                    if (debugInfo) {
                        debugInfo.innerHTML += '<br>エラー: ' + error.message;
                    }
                }
            } else {
                console.log('Unknown message type:', message.type);
            }
        });
        
        console.log('QuickAction WebView loaded successfully');
        
        // エラーハンドリング
        window.addEventListener('error', function(e) {
            console.error('WebView Error:', e.error);
            console.error('Error message:', e.message);
            console.error('Error filename:', e.filename);
            console.error('Error line:', e.lineno);
            console.error('Error column:', e.colno);
            
            const debugInfo = document.getElementById('debugInfo');
            if (debugInfo) {
                debugInfo.innerHTML += '<br><span style="color: red;">エラー: ' + e.message + ' (行:' + e.lineno + ')</span>';
            }
        });
        
        // デバッグ情報を画面に表示
        const debugInfo = document.getElementById('debugInfo');
        if (debugInfo) {
            debugInfo.innerHTML = 'WebView読み込み完了: ' + new Date().toLocaleTimeString();
        }
        
        // WebView読み込み完了を拡張機能に通知
        if (window.vscode) {
            window.vscode.postMessage({
                type: 'webviewReady',
                data: { message: 'QuickAction WebView is ready' }
            });
            
            if (debugInfo) {
                debugInfo.innerHTML += '<br>VSCode API利用可能';
            }
        } else {
            if (debugInfo) {
                debugInfo.innerHTML += '<br>VSCode API利用不可';
            }
        }
        
        // テストボタンのイベントリスナー
        const testBtn = document.getElementById('testBtn');
        if (testBtn) {
            testBtn.addEventListener('click', () => {
                console.log('Test button clicked - displaying test table');
                const debugInfo = document.getElementById('debugInfo');
                if (debugInfo) {
                    debugInfo.innerHTML += '<br>テストボタンクリック: ' + new Date().toLocaleTimeString();
                }
                
                displayTableDetails({
                    name: 'テストテーブル',
                    schema: 'public',
                    columns: [
                        { name: 'id', type: 'int', isPrimaryKey: true, isNullable: false },
                        { name: 'name', type: 'varchar', isNullable: false, comment: 'テスト名前' },
                        { name: 'created_at', type: 'timestamp', isNullable: true }
                    ],
                    constraints: [
                        { name: 'fk_test', type: 'foreign_key', columns: ['name'], referencedTable: 'other_table' }
                    ],
                    indexes: [
                        { name: 'idx_name', columns: ['name'], isUnique: false }
                    ],
                    rowCount: 100
                });
            });
        }
        
        // 自動テスト（10秒後）
        setTimeout(() => {
            console.log('QuickAction: Auto-testing message reception...');
            const debugInfo = document.getElementById('debugInfo');
            if (debugInfo) {
                debugInfo.innerHTML += '<br>自動テスト実行: ' + new Date().toLocaleTimeString();
            }
        }, 10000);
    </script>
</body>
</html>`;
    
    console.log("Generated HTML length:", html.length);
    console.log("HTML preview (first 500 chars):", html.substring(0, 500));
    
    return html;
  }

  // 残りのメソッドは元のファイルと同じ...
  // (他のメソッドをここに追加...)

  /**
   * 指定されたテーブルの詳細情報を表示
   */
  async showTableDetails(tableName: string): Promise<void> {
    console.log(
      "WebViewProvider.showTableDetails called with tableName:",
      tableName,
    );
    console.log("tableName type:", typeof tableName);
    console.log("tableName string representation:", String(tableName));

    // tableNameが文字列でない場合はエラーを出す
    if (typeof tableName !== "string") {
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

      // WebViewを前面に表示
      console.log("Showing WebView panel");
      console.log("WebView visible:", this.view.visible);
      this.view.show?.(true);
      
      // WebViewが表示されたかを確認
      setTimeout(() => {
        console.log("After show - WebView visible:", this.view?.visible);
      }, 50);
      
      // WebViewが表示されるまで少し待機
      setTimeout(() => {
        if (!this.view) {
          console.error("WebView is null when trying to send message");
          return;
        }
        
        // WebViewにテーブル詳細表示メッセージを送信
        console.log("Sending showTableDetails message to WebView");
        const message = {
          type: "showTableDetails",
          data: tableMetadata,
        };
        console.log("Message content:", message);
        
        this.view.webview.postMessage(message);
        console.log("Message sent successfully");
      }, 200);
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
