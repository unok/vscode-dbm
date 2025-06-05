import { beforeEach, describe, expect, it, vi } from "vitest"
import type * as vscode from "vscode"
import { WebViewResourceManager } from "../../extension/webviewHelper"

// VSCodeのモック
vi.mock("vscode", () => ({
  Uri: {
    joinPath: vi.fn((base, ...segments) => ({
      fsPath: `${base.fsPath}/${segments.join("/")}`,
      path: `${base.path}/${segments.join("/")}`,
      scheme: base.scheme || "file",
      authority: base.authority || "",
      query: base.query || "",
      fragment: base.fragment || "",
      with: vi.fn(),
      toString: vi.fn(() => `${base.scheme}://${base.authority}${base.path}/${segments.join("/")}`),
    })),
    file: vi.fn((path) => ({
      fsPath: path,
      path: path,
      scheme: "file",
      authority: "",
      query: "",
      fragment: "",
      with: vi.fn(),
      toString: vi.fn(() => `file://${path}`),
    })),
  },
}))

// fsのモック
vi.mock("fs", () => ({
  readFileSync: vi.fn((path: string) => {
    if (path.includes("index.html")) {
      return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Test</title>
</head>
<body>
    <div id="root"></div>
    <script src="/assets/index-abc123.js"></script>
    <link href="/assets/index-def456.css" rel="stylesheet">
</body>
</html>`
    }
    return ""
  }),
  readdirSync: vi.fn((path: string) => {
    if (path.includes("assets")) {
      return ["index-abc123.js", "index-def456.css", "codicon-font.ttf"]
    }
    return []
  }),
}))

describe("WebViewResourceManager", () => {
  let mockWebview: Partial<vscode.Webview>
  let mockExtensionUri: Partial<vscode.Uri>
  let resourceManager: WebViewResourceManager

  beforeEach(() => {
    vi.clearAllMocks()

    mockWebview = {
      cspSource: "vscode-webview:",
      asWebviewUri: vi.fn((uri: Partial<vscode.Uri>) => ({
        toString: () => `vscode-webview://extension/${uri.path}`,
      })),
    }

    mockExtensionUri = {
      fsPath: "/home/user/extensions/vscode-dbm",
      path: "/home/user/extensions/vscode-dbm",
      scheme: "file",
      authority: "",
      query: "",
      fragment: "",
    }

    resourceManager = new WebViewResourceManager(mockWebview, mockExtensionUri)
  })

  it("開発環境では開発用HTMLを返す", () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = "development"

    const html = resourceManager.getHtmlContent("dashboard")

    expect(html).toContain("http://localhost:5173")
    expect(html).toContain('window.initialViewType = "dashboard"')

    process.env.NODE_ENV = originalEnv
  })

  it("本番環境ではアセットパスを正しく変換する", () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = "production"

    const html = resourceManager.getHtmlContent("dashboard")

    // アセットパスが変換されていることを確認
    expect(html).toContain("vscode-webview://extension/")
    expect(html).toContain("index-abc123.js")
    expect(html).not.toContain("/assets/index-abc123.js")

    // CSPが正しく設定されていることを確認
    expect(html).toContain("Content-Security-Policy")
    expect(html).toContain("nonce=")

    // VSCode APIが初期化されていることを確認
    expect(html).toContain('window.initialViewType = "dashboard"')

    process.env.NODE_ENV = originalEnv
  })

  it("スクリプトタグにnonceが追加される", () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = "production"

    const html = resourceManager.getHtmlContent("sql")

    // すべてのscriptタグにnonceが含まれていることを確認
    const scriptMatches = html.match(/<script[^>]*>/g) || []
    for (const script of scriptMatches) {
      expect(script).toContain('nonce="')
    }

    process.env.NODE_ENV = originalEnv
  })

  it("エラー時にフォールバックHTMLを返す", () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = "production"

    // fsモックをエラーを投げるように変更
    const fs = require("node:fs")
    fs.readFileSync = vi.fn(() => {
      throw new Error("File not found")
    })

    const html = resourceManager.getHtmlContent("dashboard")

    // フォールバックHTMLの内容を確認
    expect(html).toContain("リソースの読み込みに失敗しました")
    expect(html).toContain("再読み込み")
    expect(html).toContain("Database Manager")

    process.env.NODE_ENV = originalEnv
  })

  it("WSL環境でのパス解決が正しく動作する", () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = "production"

    // WSL環境をシミュレート
    mockExtensionUri.fsPath = "/mnt/c/Users/user/extensions/vscode-dbm"
    mockWebview.asWebviewUri = vi.fn((uri: Partial<vscode.Uri>) => ({
      toString: () => `vscode-webview://extension/${uri.path.replace(/^\/mnt\/[a-z]/, "")}`,
    }))

    const html = resourceManager.getHtmlContent("dashboard")

    // WSLパスが正しく処理されていることを確認
    expect(mockWebview.asWebviewUri).toHaveBeenCalled()
    expect(html).toContain("vscode-webview://extension/")

    process.env.NODE_ENV = originalEnv
  })

  it("複数のアセットタイプが正しく処理される", () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = "production"

    const fs = require("node:fs")
    fs.readFileSync = vi.fn(
      () => `
      <script src="/assets/vendor-xyz789.js"></script>
      <link href="/assets/styles-abc123.css" rel="stylesheet">
      <img src="/assets/logo.png">
      <link href="/assets/font.woff2" rel="stylesheet">
    `
    )

    const html = resourceManager.getHtmlContent("dashboard")

    // 各種アセットが正しく変換されていることを確認
    expect(html).toContain('src="vscode-webview://extension/')
    expect(html).toContain('href="vscode-webview://extension/')
    expect(html).not.toContain('src="/assets/')
    expect(html).not.toContain('href="/assets/')

    process.env.NODE_ENV = originalEnv
  })
})
