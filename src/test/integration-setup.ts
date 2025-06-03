import { afterAll, afterEach, beforeAll, beforeEach } from "vitest"

// 統合テスト用のセットアップ
beforeAll(async () => {
  // データベース起動待機
  await new Promise((resolve) => setTimeout(resolve, 5000))
})

beforeEach(() => {
  // 各テスト前の初期化
})

afterEach(() => {
  // 各テスト後のクリーンアップ
})

afterAll(async () => {})
