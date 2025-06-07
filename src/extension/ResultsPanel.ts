import * as vscode from "vscode";

interface QueryHistoryItem {
  id: string;
  query: string;
  connectionName: string;
  timestamp: Date;
  success: boolean;
  results?: Record<string, unknown>[];
  rowCount?: number;
  executionTime?: number;
  error?: string;
}

interface QueryResult {
  query: string;
  connectionName: string;
  success: boolean;
  results?: Record<string, unknown>[];
  rowCount?: number;
  executionTime?: number;
  error?: string;
}

export class ResultsPanel {
  public static readonly viewType = "dbManager.results";

  private static instance: ResultsPanel | undefined;
  private panel?: vscode.WebviewPanel;
  private extensionUri: vscode.Uri;
  private queryHistory: QueryHistoryItem[] = [];

  private constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
  }

  public static getInstance(extensionUri: vscode.Uri): ResultsPanel {
    if (!ResultsPanel.instance) {
      ResultsPanel.instance = new ResultsPanel(extensionUri);
    }
    return ResultsPanel.instance;
  }

  public async showResults(result: QueryResult): Promise<void> {
    // パネルがない場合は作成（下部に配置されるように設定）
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        ResultsPanel.viewType,
        "DB Results",
        {
          viewColumn: vscode.ViewColumn.Two, // エディタの隣に表示
          preserveFocus: false, // フォーカスを移動
        },
        {
          enableScripts: true,
          localResourceRoots: [this.extensionUri],
          retainContextWhenHidden: true,
        },
      );

      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });
    }

    // 履歴に追加
    this.queryHistory.unshift({
      id: Date.now().toString(),
      query: result.query,
      connectionName: result.connectionName,
      timestamp: new Date(),
      success: result.success,
      results: result.results,
      rowCount: result.rowCount,
      executionTime: result.executionTime,
      error: result.error,
    });

    // 履歴を最大100件に制限
    if (this.queryHistory.length > 100) {
      this.queryHistory = this.queryHistory.slice(0, 100);
    }

    // パネルを表示して内容を更新
    this.panel.reveal(vscode.ViewColumn.Beside, true);
    this.panel.webview.html = this.getWebviewContent();
  }

  private getWebviewContent(): string {
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>クエリ結果</title>
    <style>
        body {
            margin: 0;
            padding: 16px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
        }
        
        .history-item {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            margin-bottom: 16px;
            overflow: hidden;
        }
        
        .query-header {
            background: var(--vscode-editorWidget-background);
            padding: 12px 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .query-info {
            flex: 1;
        }
        
        .query-text {
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
            background: var(--vscode-textCodeBlock-background);
            padding: 8px;
            border-radius: 3px;
            margin: 4px 0;
            word-break: break-all;
        }
        
        .query-meta {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            display: flex;
            gap: 16px;
            align-items: center;
        }
        
        .status {
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: bold;
            text-transform: uppercase;
        }
        
        .status.success {
            background: var(--vscode-testing-iconPassed);
            color: var(--vscode-editor-background);
        }
        
        .status.error {
            background: var(--vscode-testing-iconFailed);
            color: var(--vscode-editor-background);
        }
        
        .results-content {
            padding: 16px;
        }
        
        .error-message {
            color: var(--vscode-errorForeground);
            background: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            padding: 12px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
        }
        
        .results-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            background: var(--vscode-editor-background);
        }
        
        .results-table th,
        .results-table td {
            border: 1px solid var(--vscode-panel-border);
            padding: 8px 12px;
            text-align: left;
            vertical-align: top;
        }
        
        .results-table th {
            background: var(--vscode-editorWidget-background);
            font-weight: 600;
            position: sticky;
            top: 0;
        }
        
        .results-table tr:nth-child(even) {
            background: var(--vscode-list-hoverBackground);
        }
        
        .null-value {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }
        
        .no-results {
            text-align: center;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
            padding: 32px;
        }
        
        .table-container {
            max-height: 400px;
            overflow: auto;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px;
        }
        
        .clear-history {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            padding: 6px 12px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
        }
        
        .clear-history:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
        }
        
        .header h2 {
            margin: 0;
        }
        
        .header-actions {
            display: flex;
            gap: 8px;
        }
        
        .export-csv {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
        }
        
        .export-csv:hover {
            background: var(--vscode-button-hoverBackground);
        }
    </style>
</head>
<body>
    <div class="header">
        <h2>クエリ結果</h2>
        <div class="header-actions">
            <button class="export-csv" onclick="exportToCSV()">CSVエクスポート</button>
            <button class="clear-history" onclick="clearHistory()">履歴をクリア</button>
        </div>
    </div>
    
    <div class="history-container">
        ${this.renderHistory()}
    </div>

    <script nonce="${nonce}">
        function clearHistory() {
            if (confirm('クエリ履歴をすべてクリアしますか？')) {
                // 実装予定: 履歴クリア機能
                document.querySelector('.history-container').innerHTML = '<div class="no-results">履歴がありません</div>';
            }
        }
        
        function exportToCSV() {
            // 最新の結果をCSVでエクスポート
            const firstTable = document.querySelector('.results-table');
            if (!firstTable) {
                alert('エクスポートできる結果がありません');
                return;
            }
            
            const rows = firstTable.querySelectorAll('tr');
            let csv = '';
            
            rows.forEach(row => {
                const cells = row.querySelectorAll('th, td');
                const rowData = Array.from(cells).map(cell => {
                    let text = cell.textContent.trim();
                    // CSVエスケープ
                    if (text.includes(',') || text.includes('"') || text.includes('\\n')) {
                        text = '"' + text.replace(/"/g, '""') + '"';
                    }
                    return text;
                });
                csv += rowData.join(',') + '\\n';
            });
            
            // ダウンロード
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'query_results_' + new Date().toISOString().slice(0, 19).replace(/:/g, '-') + '.csv';
            link.click();
        }
        
        // テーブルのセルをクリックで値をコピー
        document.addEventListener('click', function(e) {
            if (e.target.tagName === 'TD') {
                const text = e.target.textContent;
                if (text !== 'NULL') {
                    navigator.clipboard.writeText(text).then(() => {
                        // 簡単なフィードバック
                        const original = e.target.style.background;
                        e.target.style.background = 'var(--vscode-focusBorder)';
                        setTimeout(() => {
                            e.target.style.background = original;
                        }, 200);
                    });
                }
            }
        });
    </script>
</body>
</html>`;
  }

  private renderHistory(): string {
    if (this.queryHistory.length === 0) {
      return '<div class="no-results">クエリ履歴がありません</div>';
    }

    return this.queryHistory
      .map(
        (item) => `
      <div class="history-item">
        <div class="query-header">
          <div class="query-info">
            <div class="query-text">${this.escapeHtml(item.query)}</div>
            <div class="query-meta">
              <span>📅 ${item.timestamp.toLocaleString()}</span>
              <span>🔗 ${item.connectionName}</span>
              ${
                item.success
                  ? `<span>📊 ${item.rowCount || 0}行</span>
                 <span>⏱️ ${item.executionTime || 0}ms</span>`
                  : ""
              }
            </div>
          </div>
          <div class="status ${item.success ? "success" : "error"}">
            ${item.success ? "SUCCESS" : "ERROR"}
          </div>
        </div>
        <div class="results-content">
          ${item.success ? this.renderResults(item.results || []) : this.renderError(item.error || "Unknown error")}
        </div>
      </div>
    `,
      )
      .join("");
  }

  private renderResults(results: Record<string, unknown>[]): string {
    if (!results || results.length === 0) {
      return '<div class="no-results">結果なし</div>';
    }

    const headers = Object.keys(results[0]);

    return `
      <div class="table-container">
        <table class="results-table">
          <thead>
            <tr>
              ${headers.map((header) => `<th>${this.escapeHtml(header)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${results
              .map(
                (row) => `
              <tr>
                ${headers
                  .map((header) => {
                    const value = row[header];
                    if (value === null || value === undefined) {
                      return '<td class="null-value">NULL</td>';
                    }
                    return `<td>${this.escapeHtml(String(value))}</td>`;
                  })
                  .join("")}
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  private renderError(error: string): string {
    return `<div class="error-message">${this.escapeHtml(error)}</div>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  private getNonce(): string {
    let text = "";
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
