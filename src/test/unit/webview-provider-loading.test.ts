import * as fs from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";
import { DatabaseWebViewProvider } from "../../extension/WebViewProvider";

// Mock Node.js fs module
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

// Mock VSCode API
vi.mock("vscode", () => ({
  Uri: {
    joinPath: vi.fn().mockReturnValue({
      fsPath: "/mock/path/index.html",
      toString: () => "/mock/path/index.html",
    }),
  },
  window: {
    onDidChangeActiveColorTheme: vi.fn(),
    activeColorTheme: {
      kind: 1, // ColorThemeKind.Light
    },
  },
  ColorThemeKind: {
    Light: 1,
    Dark: 2,
    HighContrast: 3,
  },
}));

describe("WebViewProvider Loading Issues", () => {
  let provider: DatabaseWebViewProvider;
  let mockWebviewView: vscode.WebviewView;
  let mockWebview: vscode.Webview;
  let mockExtensionUri: vscode.Uri;

  beforeEach(() => {
    vi.clearAllMocks();

    mockExtensionUri = {
      fsPath: "/mock/extension",
      toString: () => "/mock/extension",
    } as vscode.Uri;

    mockWebview = {
      html: "",
      options: {},
      onDidReceiveMessage: vi.fn(),
      postMessage: vi.fn(),
      asWebviewUri: vi.fn().mockReturnValue("vscode-webview://mock-uri"),
      cspSource: "vscode-webview:",
    } as unknown as vscode.Webview;

    mockWebviewView = {
      webview: mockWebview,
      show: vi.fn(),
    } as unknown as vscode.WebviewView;

    provider = new DatabaseWebViewProvider(mockExtensionUri);
  });

  describe("本番環境でのHTML生成問題", () => {
    beforeEach(() => {
      // 本番環境をシミュレート
      const _originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
    });

    it("ビルドファイルが存在しない場合、フォールバックHTMLが生成される", () => {
      // Given: ビルドファイルが存在しない
      vi.mocked(fs.existsSync).mockReturnValue(false);

      // When: WebViewを初期化
      provider.resolveWebviewView(
        mockWebviewView,
        {},
        {} as vscode.CancellationToken,
      );

      // Then: フォールバックHTMLが設定される
      expect(mockWebview.html).toContain("<!DOCTYPE html>");
      expect(mockWebview.html).toContain('<div id="root"></div>');
      expect(mockWebview.html).toContain("Database DataGrid Manager");
    });

    it("ビルドファイル読み込みに失敗した場合、エラーが投げられない", () => {
      // Given: ファイル読み込み時にエラーが発生
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error("File read error");
      });

      // When: WebViewを初期化
      expect(() => {
        provider.resolveWebviewView(
          mockWebviewView,
          {},
          {} as vscode.CancellationToken,
        );
      }).not.toThrow();

      // Then: フォールバックHTMLが使用される
      expect(mockWebview.html).toContain("<!DOCTYPE html>");
    });

    it("正常なビルドファイルが存在する場合、そのHTMLが使用される", () => {
      // Given: 正常なビルドファイル
      const mockHtmlContent = `<!DOCTYPE html>
<html>
<head><title>Built App</title></head>
<body>
<div id="root"></div>
<link href="./assets/index.css" rel="stylesheet">
<script src="./assets/index.js"></script>
</body>
</html>`;

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(mockHtmlContent);

      // When: WebViewを初期化
      provider.resolveWebviewView(
        mockWebviewView,
        {},
        {} as vscode.CancellationToken,
      );

      // Then: ビルドHTMLが変換されて使用される
      expect(mockWebview.html).toContain("Built App");
      expect(mockWebview.html).toContain("vscode-webview://mock-uri");
      expect(mockWebview.html).toContain("Content-Security-Policy");
    });
  });

  describe("開発環境でのロード問題", () => {
    beforeEach(() => {
      // 開発環境をシミュレート
      process.env.NODE_ENV = "development";
    });

    it("開発環境では Vite dev server への接続HTMLが生成される", () => {
      // When: WebViewを初期化
      provider.resolveWebviewView(
        mockWebviewView,
        {},
        {} as vscode.CancellationToken,
      );

      // Then: Vite dev server URLが含まれる
      expect(mockWebview.html).toContain("http://localhost:5173");
      expect(mockWebview.html).toContain("src/webview/main.tsx");
    });
  });

  describe("メッセージハンドリング初期化", () => {
    it("すべてのメッセージタイプが正常にハンドルされる", () => {
      // Given: 初期化済みのWebView
      provider.resolveWebviewView(
        mockWebviewView,
        {},
        {} as vscode.CancellationToken,
      );

      // When: 各種メッセージを送信（onDidReceiveMessageのコールバックを取得）
      const messageHandler = vi.mocked(mockWebview.onDidReceiveMessage).mock
        .calls[0][0];

      // Then: エラーが発生しない
      expect(() =>
        messageHandler({ type: "getConnectionStatus" }),
      ).not.toThrow();
      expect(() => messageHandler({ type: "getTheme" })).not.toThrow();
      expect(() =>
        messageHandler({
          type: "openConnection",
          data: { type: "mysql", host: "localhost" },
        }),
      ).not.toThrow();
      expect(() =>
        messageHandler({
          type: "executeQuery",
          data: { query: "SELECT 1" },
        }),
      ).not.toThrow();
    });

    it("theme change listenerが正常に設定される", () => {
      // When: WebViewを初期化
      provider.resolveWebviewView(
        mockWebviewView,
        {},
        {} as vscode.CancellationToken,
      );

      // Then: theme change listenerが設定される
      expect(vscode.window.onDidChangeActiveColorTheme).toHaveBeenCalled();
    });
  });

  describe("公開メソッド", () => {
    it("postMessage が _view が存在しない場合でもエラーにならない", () => {
      // Given: _view が未初期化

      // When: postMessage を呼び出し
      expect(() => {
        provider.postMessage({ type: "test", data: {} });
      }).not.toThrow();
    });

    it("reveal が _view が存在しない場合でもエラーにならない", () => {
      // Given: _view が未初期化

      // When: reveal を呼び出し
      expect(() => {
        provider.reveal();
      }).not.toThrow();
    });
  });
});
