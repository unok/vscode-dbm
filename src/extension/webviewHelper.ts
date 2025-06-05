import * as fs from "node:fs"
import * as path from "node:path"
import * as vscode from "vscode"

/**
 * WebView用のリソースマネージャー
 * WSL環境でのファイルパス解決とCSP管理を行う
 */
export class WebViewResourceManager {
  private extensionUri: vscode.Uri
  private webview: vscode.Webview
  private nonce: string

  constructor(webview: vscode.Webview, extensionUri: vscode.Uri) {
    this.webview = webview
    this.extensionUri = extensionUri
    this.nonce = this.generateNonce()
  }

  /**
   * CSP用のnonceを生成
   */
  private generateNonce(): string {
    let text = ""
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length))
    }
    return text
  }

  /**
   * WebView用のHTMLを生成
   */
  public getHtmlContent(viewType: string): string {
    const isDevelopment = process.env.NODE_ENV === "development"

    if (isDevelopment) {
      return this.getDevHtml(viewType)
    }

    return this.getProdHtml(viewType)
  }

  /**
   * 開発環境用HTML
   */
  private getDevHtml(viewType: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Database Manager</title>
</head>
<body>
    <div id="root"></div>
    <script>
        window.initialViewType = "${viewType}";
    </script>
    <script type="module" src="http://localhost:5173/src/webview/main.tsx"></script>
</body>
</html>`
  }

  /**
   * プロダクション環境用HTML
   */
  private getProdHtml(viewType: string): string {
    const webviewPath = vscode.Uri.joinPath(this.extensionUri, "dist", "webview")

    try {
      // ビルドされたindex.htmlを読み込む
      const indexHtmlPath = vscode.Uri.joinPath(webviewPath, "index.html")
      let htmlContent = fs.readFileSync(indexHtmlPath.fsPath, "utf8")

      // アセットファイルを検出
      const assetsPath = vscode.Uri.joinPath(webviewPath, "assets")
      const assetFiles = this.findAssetFiles(assetsPath)

      // CSPヘッダーを追加
      const cspContent = this.generateCSP()
      htmlContent = this.insertCSP(htmlContent, cspContent)

      // アセットパスを変換
      htmlContent = this.transformAssetPaths(htmlContent, webviewPath, assetFiles)

      // nonceをスクリプトタグに追加
      htmlContent = this.addNonceToScripts(htmlContent)

      // VSCode APIを初期化
      htmlContent = this.injectVSCodeAPI(htmlContent, viewType)

      return htmlContent
    } catch (error) {
      console.error("Failed to load HTML:", error)
      return this.getFallbackHtml(viewType)
    }
  }

  /**
   * アセットファイルを検出
   */
  private findAssetFiles(assetsPath: vscode.Uri): Map<string, string> {
    const assetMap = new Map<string, string>()

    try {
      const files = fs.readdirSync(assetsPath.fsPath)

      for (const file of files) {
        if (file.startsWith("index-") && file.endsWith(".js")) {
          assetMap.set("main.js", file)
        } else if (file.startsWith("index-") && file.endsWith(".css")) {
          assetMap.set("main.css", file)
        }
        // その他のアセット（フォントなど）も記録
        assetMap.set(file, file)
      }
    } catch (error) {
      console.error("Failed to find assets:", error)
    }

    return assetMap
  }

  /**
   * CSPヘッダーを生成
   */
  private generateCSP(): string {
    return `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this.webview.cspSource} 'unsafe-inline'; img-src ${this.webview.cspSource} https: data:; script-src 'nonce-${this.nonce}'; font-src ${this.webview.cspSource} data:; connect-src ${this.webview.cspSource} https: ws:;">`
  }

  /**
   * CSPをHTMLに挿入
   */
  private insertCSP(html: string, csp: string): string {
    // 既存のCSPメタタグを削除
    const updatedHtml = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/g, "")

    // headタグ内の最初に新しいCSPを挿入
    return updatedHtml.replace(/<head>/i, `<head>\n    ${csp}`)
  }

  /**
   * アセットパスを変換
   */
  private transformAssetPaths(
    html: string,
    webviewPath: vscode.Uri,
    assetFiles: Map<string, string>
  ): string {
    // src="/assets/xxx" または href="/assets/xxx" のパターンを変換
    let updatedHtml = html.replace(
      /(?:src|href)="\/assets\/(.*?)"/g,
      (match: string, filename: string) => {
        const attr = match.startsWith("src") ? "src" : "href"
        const actualFile = assetFiles.get(filename) || filename
        const assetUri = this.webview.asWebviewUri(
          vscode.Uri.joinPath(webviewPath, "assets", actualFile)
        )
        return `${attr}="${assetUri}"`
      }
    )

    // 相対パスのアセットも変換（./assets/xxx）
    updatedHtml = updatedHtml.replace(
      /(?:src|href)="\.\/assets\/(.*?)"/g,
      (match: string, filename: string) => {
        const attr = match.startsWith("src") ? "src" : "href"
        const actualFile = assetFiles.get(filename) || filename
        const assetUri = this.webview.asWebviewUri(
          vscode.Uri.joinPath(webviewPath, "assets", actualFile)
        )
        return `${attr}="${assetUri}"`
      }
    )

    return updatedHtml
  }

  /**
   * スクリプトタグにnonceを追加
   */
  private addNonceToScripts(html: string): string {
    // すべてのscriptタグにnonceを追加
    return html.replace(/<script(\s+[^>]*)?>/g, (match: string, attributes: string) => {
      // すでにnonceがある場合はスキップ
      if (attributes?.includes("nonce=")) {
        return match
      }
      return `<script nonce="${this.nonce}"${attributes || ""}>`
    })
  }

  /**
   * VSCode APIを注入
   */
  private injectVSCodeAPI(html: string, viewType: string): string {
    const apiScript = `
    <script nonce="${this.nonce}">
        window.initialViewType = "${viewType}";
        // VSCode APIが既に存在する場合はそれを使用
        if (!window.acquireVsCodeApi) {
            window.acquireVsCodeApi = () => ({
                postMessage: (msg) => console.log('VSCode API:', msg),
                getState: () => ({}),
                setState: (state) => {}
            });
        }
    </script>
</body>`

    return html.replace("</body>", apiScript)
  }

  /**
   * フォールバックHTML
   */
  private getFallbackHtml(viewType: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    ${this.generateCSP()}
    <title>Database Manager</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
        }
        .error-container {
            text-align: center;
            padding: 20px;
        }
        .error-title {
            font-size: 1.2em;
            margin-bottom: 10px;
        }
        .error-message {
            color: var(--vscode-errorForeground);
            margin-bottom: 20px;
        }
        .error-actions {
            display: flex;
            gap: 10px;
            justify-content: center;
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            cursor: pointer;
            border-radius: 2px;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
    </style>
</head>
<body>
    <div class="error-container">
        <div class="error-title">Database Manager</div>
        <div class="error-message">
            リソースの読み込みに失敗しました。<br>
            拡張機能をビルドして再試行してください。
        </div>
        <div class="error-actions">
            <button onclick="window.location.reload()">再読み込み</button>
        </div>
    </div>
    <script nonce="${this.nonce}">
        window.initialViewType = "${viewType}";
        // エラー詳細をコンソールに出力
        console.error('WebView initialization failed. View type:', "${viewType}");
    </script>
</body>
</html>`
  }
}
