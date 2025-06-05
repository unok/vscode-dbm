import { beforeEach, describe, expect, it, vi } from "vitest"

import type * as vscode from "vscode"

// 簡単なモック設定（外部依存を避ける）
const mockVscode = {
  window: {
    registerWebviewViewProvider: vi.fn(),
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    onDidChangeActiveColorTheme: vi.fn(),
    activeColorTheme: { kind: 1 },
  },
  commands: {
    registerCommand: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    executeCommand: vi.fn().mockResolvedValue(undefined),
  },
  Uri: {
    joinPath: vi.fn().mockReturnValue({
      fsPath: "/mock/path",
      toString: () => "/mock/path",
    }),
  },
  ColorThemeKind: { Light: 1, Dark: 2, HighContrast: 3 },
}

// VSCodeモジュールをモック
vi.doMock("vscode", () => mockVscode)

describe("Extension Loading Fix", () => {
  let mockContext: Partial<vscode.ExtensionContext>

  beforeEach(() => {
    vi.clearAllMocks()

    mockContext = {
      subscriptions: [],
      extensionUri: {
        fsPath: "/mock/extension/path",
        toString: () => "/mock/extension/path",
      },
    }
  })

  it("修正後のactivationEventsが正しく設定されている", async () => {
    // package.jsonの内容を検証
    const packageJson = await import("../../../package.json")

    // activationEventsが空でないことを確認
    expect(packageJson.activationEvents).toBeDefined()
    expect(packageJson.activationEvents).toContain("onView:dbManager.webview")
  })

  it("エラーハンドリングが正常に動作する", async () => {
    // モックでエラーを発生させる
    mockVscode.window.registerWebviewViewProvider.mockImplementation(() => {
      throw new Error("Mock activation error")
    })

    // dynamicImportを使用してモジュールを読み込み
    const { activate } = await import("../../extension/extension")

    // エラーが適切にキャッチされることを確認
    expect(() => activate(mockContext)).toThrow("Mock activation error")
    expect(mockVscode.window.showErrorMessage).toHaveBeenCalled()
  })

  it("正常な場合は成功メッセージがログに出力される", async () => {
    // コンソールログをモック
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {
      // Intentionally empty mock implementation
    })

    const { activate } = await import("../../extension/extension")

    // 正常なアクティベーション
    activate(mockContext)

    // ログメッセージが出力されることを確認
    expect(consoleSpy).toHaveBeenCalledWith("Database Manager (DBM) extension is activating...")
    expect(consoleSpy).toHaveBeenCalledWith(
      "Database Manager (DBM) extension activated successfully"
    )

    consoleSpy.mockRestore()
  })

  it("WebViewProviderが確実に登録される", async () => {
    const { activate } = await import("../../extension/extension")

    activate(mockContext)

    expect(mockVscode.window.registerWebviewViewProvider).toHaveBeenCalledWith(
      "dbManager.webview",
      expect.any(Object)
    )
  })
})
