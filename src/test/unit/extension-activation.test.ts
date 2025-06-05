import { beforeEach, describe, expect, it, vi } from "vitest"
import * as vscode from "vscode"
import { activate, deactivate } from "../../extension/extension"

// Mock VSCode API
vi.mock("vscode", () => ({
  window: {
    registerWebviewViewProvider: vi.fn(),
    showInformationMessage: vi.fn(),
    onDidChangeActiveColorTheme: vi.fn(),
    activeColorTheme: {
      kind: 1, // ColorThemeKind.Light
    },
  },
  commands: {
    registerCommand: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    executeCommand: vi.fn().mockResolvedValue(undefined),
  },
  Uri: {
    joinPath: vi.fn().mockReturnValue({ fsPath: "/mock/path", toString: () => "/mock/path" }),
  },
  ColorThemeKind: {
    Light: 1,
    Dark: 2,
    HighContrast: 3,
  },
  ViewColumn: {
    One: 1,
  },
  workspace: {
    getConfiguration: vi.fn().mockReturnValue({
      get: vi.fn(),
    }),
  },
}))

describe("Extension Activation", () => {
  let mockContext: vscode.ExtensionContext

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Create mock extension context
    mockContext = {
      subscriptions: [],
      extensionUri: {
        fsPath: "/mock/extension/path",
        toString: () => "/mock/extension/path",
      } as vscode.Uri,
      globalState: {
        get: vi.fn(),
        update: vi.fn(),
        keys: vi.fn().mockReturnValue([]),
      },
      workspaceState: {
        get: vi.fn(),
        update: vi.fn(),
        keys: vi.fn().mockReturnValue([]),
      },
      extensionPath: "/mock/extension/path",
      storagePath: "/mock/storage",
      globalStoragePath: "/mock/global-storage",
      logPath: "/mock/log",
      asAbsolutePath: vi.fn().mockImplementation((path: string) => `/mock/extension/path/${path}`),
      environmentVariableCollection: {
        persistent: true,
        replace: vi.fn(),
        append: vi.fn(),
        prepend: vi.fn(),
        get: vi.fn(),
        forEach: vi.fn(),
        delete: vi.fn(),
        clear: vi.fn(),
      },
    } as vscode.ExtensionContext
  })

  describe("activate()", () => {
    it("拡張機能が正常にアクティベートされる", async () => {
      // Given: 正常なコンテキスト

      // When: アクティベーション実行
      activate(mockContext)

      // Then: 必要なコンポーネントが登録される
      expect(vscode.window.registerWebviewViewProvider).toHaveBeenCalledWith(
        "dbManager.webview",
        expect.any(Object)
      )

      expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
        "vscode-dbm.openConnection",
        expect.any(Function)
      )

      expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
        "vscode-dbm.newQuery",
        expect.any(Function)
      )

      expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
        "vscode-dbm.openDataGrid",
        expect.any(Function)
      )

      expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
        "vscode-dbm.openDashboard",
        expect.any(Function)
      )

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        "setContext",
        "vscode-dbm:hasConnection",
        false
      )
    })

    it("subscriptionsに登録されたコマンドが5個ある", () => {
      // Given: 初期状態のコンテキスト
      expect(mockContext.subscriptions).toHaveLength(0)

      // When: アクティベーション実行
      activate(mockContext)

      // Then: subscriptionsに WebViewProvider + 4つのコマンドが登録される
      expect(mockContext.subscriptions).toHaveLength(5)
    })

    it("開発環境の検出が正常に動作する", () => {
      // Given: 開発環境の設定
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = "development"

      // When: アクティベーション実行
      activate(mockContext)

      // Then: エラーが発生しない
      expect(mockContext.subscriptions).toHaveLength(5)

      // Cleanup
      process.env.NODE_ENV = originalEnv
    })

    it("本番環境でも正常に動作する", () => {
      // Given: 本番環境の設定
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = "production"

      // When: アクティベーション実行
      activate(mockContext)

      // Then: エラーが発生しない
      expect(mockContext.subscriptions).toHaveLength(5)

      // Cleanup
      process.env.NODE_ENV = originalEnv
    })
  })

  describe("deactivate()", () => {
    it("deactivateが正常に実行される", () => {
      // Given: アクティベート済みの拡張機能
      activate(mockContext)

      // When: ディアクティベーション実行
      expect(() => deactivate()).not.toThrow()

      // Then: エラーが発生しない
    })
  })

  describe("拡張機能ロード問題の再現テスト", () => {
    it("activationEventsが空の場合でもアクティベートできる", () => {
      // Given: activationEventsが空の状態（package.jsonで確認済み）

      // When: アクティベーション実行
      expect(() => activate(mockContext)).not.toThrow()

      // Then: 正常に初期化される
      expect(mockContext.subscriptions).toHaveLength(5)
    })

    it("WebViewProviderが初期化時にエラーを起こさない", () => {
      // Given: 正常なコンテキスト

      // When: WebViewProvider初期化
      expect(() => activate(mockContext)).not.toThrow()

      // Then: WebViewProviderが正常に登録される
      expect(vscode.window.registerWebviewViewProvider).toHaveBeenCalled()
    })
  })
})
