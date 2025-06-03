import { beforeEach, describe, expect, it } from "vitest"

// 単体テストの例
describe("単体テストサンプル", () => {
  beforeEach(() => {
    // 各テスト前の初期化
  })

  it("基本的なテストが動作する", () => {
    const result = 1 + 1
    expect(result).toBe(2)
  })

  it("非同期テストのサンプル", async () => {
    const promise = Promise.resolve("テスト完了")
    await expect(promise).resolves.toBe("テスト完了")
  })
})
