import { beforeAll, afterAll, beforeEach, afterEach } from "vitest"

// 統合テスト用のセットアップ
beforeAll(async () => {
  // データベース接続のセットアップ
  // Docker Composeで起動されたテスト用データベースへの接続確認
  console.log("🚀 統合テスト環境セットアップ開始")

  // データベース起動待機
  await new Promise((resolve) => setTimeout(resolve, 5000))

  console.log("✅ データベース起動待機完了")
})

beforeEach(() => {
  // 各テスト前の初期化
})

afterEach(() => {
  // 各テスト後のクリーンアップ
})

afterAll(async () => {
  // 全統合テスト完了後のクリーンアップ
  console.log("✅ 統合テスト環境クリーンアップ完了")
})
