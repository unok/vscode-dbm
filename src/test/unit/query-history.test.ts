import { QueryHistoryManager } from "@/shared/services/QueryHistoryManager"
import type { QueryHistoryEntry } from "@/shared/types/advanced-sql"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

describe("QueryHistoryManager", () => {
  let historyManager: QueryHistoryManager
  let mockStorage: { getItem: vi.Mock; setItem: vi.Mock; removeItem: vi.Mock }

  beforeEach(() => {
    // Mock VSCode storage
    mockStorage = {
      get: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue(undefined),
    }

    historyManager = new QueryHistoryManager(mockStorage)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("クエリの追加", () => {
    test("新しいクエリを履歴に追加する", async () => {
      const query = "SELECT * FROM users"
      const context = {
        connection: { id: "conn-1", database: "testdb" },
        user: "testuser",
      }

      const entry = await historyManager.addEntry(query, context)

      expect(entry).toMatchObject({
        sql: query,
        connection: "conn-1",
        database: "testdb",
        user: "testuser",
        executedAt: expect.any(Date),
        id: expect.any(String),
      })
    })

    test("実行結果を含むクエリを追加する", async () => {
      const query = "SELECT COUNT(*) FROM users"
      const context = {
        connection: { id: "conn-1", database: "testdb" },
        user: "testuser",
      }
      const result = {
        rowCount: 1,
        executionTime: 45,
        success: true,
      }

      const entry = await historyManager.addEntry(query, context, result)

      expect(entry).toMatchObject({
        sql: query,
        executionTime: 45,
        rowCount: 1,
        success: true,
      })
    })

    test("重複するクエリは最新のものを保持する", async () => {
      const query = "SELECT * FROM users"
      const connectionId = "conn-1"

      // 既存の履歴をモック
      mockStorage.get.mockResolvedValue([
        {
          id: "old-id",
          query,
          connectionId,
          executedAt: new Date("2024-01-01"),
        },
      ])

      await historyManager.addQuery(query, connectionId)

      const updateCall = mockStorage.update.mock.calls[0]
      const updatedHistory = updateCall[1]

      expect(updatedHistory).toHaveLength(1)
      expect(updatedHistory[0].id).not.toBe("old-id")
      expect(updatedHistory[0].executedAt).not.toEqual(new Date("2024-01-01"))
    })
  })

  describe("履歴の取得", () => {
    test("すべての履歴を取得する", async () => {
      const mockHistory = [
        {
          id: "1",
          query: "SELECT * FROM users",
          connectionId: "conn-1",
          executedAt: new Date(),
        },
        {
          id: "2",
          query: "SELECT * FROM posts",
          connectionId: "conn-1",
          executedAt: new Date(),
        },
      ]

      mockStorage.get.mockResolvedValue(mockHistory)

      const history = await historyManager.getHistory()

      expect(history).toEqual(mockHistory)
    })

    test("接続IDでフィルタリングする", async () => {
      const mockHistory = [
        {
          id: "1",
          query: "SELECT * FROM users",
          connectionId: "conn-1",
          executedAt: new Date(),
        },
        {
          id: "2",
          query: "SELECT * FROM posts",
          connectionId: "conn-2",
          executedAt: new Date(),
        },
      ]

      mockStorage.get.mockResolvedValue(mockHistory)

      const history = await historyManager.getHistory({ connectionId: "conn-1" })

      expect(history).toHaveLength(1)
      expect(history[0].connectionId).toBe("conn-1")
    })

    test("期間でフィルタリングする", async () => {
      const mockHistory = [
        {
          id: "1",
          query: "SELECT * FROM old_data",
          connectionId: "conn-1",
          executedAt: new Date("2024-01-01"),
        },
        {
          id: "2",
          query: "SELECT * FROM recent_data",
          connectionId: "conn-1",
          executedAt: new Date("2024-12-01"),
        },
      ]

      mockStorage.get.mockResolvedValue(mockHistory)

      const history = await historyManager.getHistory({
        startDate: new Date("2024-06-01"),
        endDate: new Date("2024-12-31"),
      })

      expect(history).toHaveLength(1)
      expect(history[0].query).toContain("recent_data")
    })

    test("制限数を指定して取得する", async () => {
      const mockHistory = Array.from({ length: 100 }, (_, i) => ({
        id: String(i),
        query: `SELECT ${i} FROM table`,
        connectionId: "conn-1",
        executedAt: new Date(Date.now() - i * 1000),
      }))

      mockStorage.get.mockResolvedValue(mockHistory)

      const history = await historyManager.getHistory({ limit: 10 })

      expect(history).toHaveLength(10)
      expect(history[0].id).toBe("0") // 最新のものから
    })
  })

  describe("履歴の検索", () => {
    test("クエリテキストで検索する", async () => {
      const mockHistory = [
        {
          id: "1",
          query: "SELECT * FROM users WHERE active = true",
          connectionId: "conn-1",
          executedAt: new Date(),
        },
        {
          id: "2",
          query: "SELECT * FROM posts",
          connectionId: "conn-1",
          executedAt: new Date(),
        },
      ]

      mockStorage.get.mockResolvedValue(mockHistory)

      const results = await historyManager.searchHistory("users")

      expect(results).toHaveLength(1)
      expect(results[0].query).toContain("users")
    })

    test("大文字小文字を無視して検索する", async () => {
      const mockHistory = [
        {
          id: "1",
          query: "SELECT * FROM USERS",
          connectionId: "conn-1",
          executedAt: new Date(),
        },
      ]

      mockStorage.get.mockResolvedValue(mockHistory)

      const results = await historyManager.searchHistory("users")

      expect(results).toHaveLength(1)
    })

    test("正規表現で検索する", async () => {
      const mockHistory = [
        {
          id: "1",
          query: "SELECT user_id, user_name FROM users",
          connectionId: "conn-1",
          executedAt: new Date(),
        },
        {
          id: "2",
          query: "SELECT post_id FROM posts",
          connectionId: "conn-1",
          executedAt: new Date(),
        },
      ]

      mockStorage.get.mockResolvedValue(mockHistory)

      const results = await historyManager.searchHistory(/user_\w+/)

      expect(results).toHaveLength(1)
      expect(results[0].query).toContain("user_id")
    })
  })

  describe("履歴の削除", () => {
    test("特定のエントリを削除する", async () => {
      const mockHistory = [
        {
          id: "1",
          query: "SELECT * FROM users",
          connectionId: "conn-1",
          executedAt: new Date(),
        },
        {
          id: "2",
          query: "SELECT * FROM posts",
          connectionId: "conn-1",
          executedAt: new Date(),
        },
      ]

      mockStorage.get.mockResolvedValue(mockHistory)

      await historyManager.deleteEntry("1")

      const updateCall = mockStorage.update.mock.calls[0]
      const updatedHistory = updateCall[1]

      expect(updatedHistory).toHaveLength(1)
      expect(updatedHistory[0].id).toBe("2")
    })

    test("すべての履歴をクリアする", async () => {
      const mockHistory = [
        {
          id: "1",
          query: "SELECT * FROM users",
          connectionId: "conn-1",
          executedAt: new Date(),
        },
      ]

      mockStorage.get.mockResolvedValue(mockHistory)

      await historyManager.clearHistory()

      expect(mockStorage.update).toHaveBeenCalledWith("queryHistory", [])
    })

    test("接続IDごとに履歴をクリアする", async () => {
      const mockHistory = [
        {
          id: "1",
          query: "SELECT * FROM users",
          connectionId: "conn-1",
          executedAt: new Date(),
        },
        {
          id: "2",
          query: "SELECT * FROM posts",
          connectionId: "conn-2",
          executedAt: new Date(),
        },
      ]

      mockStorage.get.mockResolvedValue(mockHistory)

      await historyManager.clearHistory("conn-1")

      const updateCall = mockStorage.update.mock.calls[0]
      const updatedHistory = updateCall[1]

      expect(updatedHistory).toHaveLength(1)
      expect(updatedHistory[0].connectionId).toBe("conn-2")
    })
  })

  describe("お気に入り機能", () => {
    test("クエリをお気に入りに追加する", async () => {
      const mockHistory = [
        {
          id: "1",
          query: "SELECT * FROM users",
          connectionId: "conn-1",
          executedAt: new Date(),
          isFavorite: false,
        },
      ]

      mockStorage.get.mockResolvedValue(mockHistory)

      await historyManager.toggleFavorite("1")

      const updateCall = mockStorage.update.mock.calls[0]
      const updatedHistory = updateCall[1]

      expect(updatedHistory[0].isFavorite).toBe(true)
    })

    test("お気に入りのみを取得する", async () => {
      const mockHistory = [
        {
          id: "1",
          query: "SELECT * FROM users",
          connectionId: "conn-1",
          executedAt: new Date(),
          isFavorite: true,
        },
        {
          id: "2",
          query: "SELECT * FROM posts",
          connectionId: "conn-1",
          executedAt: new Date(),
          isFavorite: false,
        },
      ]

      mockStorage.get.mockResolvedValue(mockHistory)

      const favorites = await historyManager.getFavorites()

      expect(favorites).toHaveLength(1)
      expect(favorites[0].isFavorite).toBe(true)
    })
  })

  describe("統計情報", () => {
    test("実行頻度の高いクエリを取得する", async () => {
      const mockHistory = [
        {
          id: "1",
          query: "SELECT * FROM users",
          connectionId: "conn-1",
          executedAt: new Date(),
        },
        {
          id: "2",
          query: "SELECT * FROM users",
          connectionId: "conn-1",
          executedAt: new Date(),
        },
        {
          id: "3",
          query: "SELECT * FROM posts",
          connectionId: "conn-1",
          executedAt: new Date(),
        },
      ]

      mockStorage.get.mockResolvedValue(mockHistory)

      const frequent = await historyManager.getFrequentQueries(1)

      expect(frequent).toHaveLength(1)
      expect(frequent[0].query).toBe("SELECT * FROM users")
      expect(frequent[0].count).toBe(2)
    })

    test("平均実行時間を計算する", async () => {
      const mockHistory = [
        {
          id: "1",
          query: "SELECT * FROM users",
          connectionId: "conn-1",
          executedAt: new Date(),
          result: { executionTime: 100 },
        },
        {
          id: "2",
          query: "SELECT * FROM users",
          connectionId: "conn-1",
          executedAt: new Date(),
          result: { executionTime: 200 },
        },
      ]

      mockStorage.get.mockResolvedValue(mockHistory)

      const stats = await historyManager.getQueryStats("SELECT * FROM users")

      expect(stats.averageExecutionTime).toBe(150)
      expect(stats.executionCount).toBe(2)
    })
  })

  describe("エクスポート/インポート", () => {
    test("履歴をJSON形式でエクスポートする", async () => {
      const mockHistory = [
        {
          id: "1",
          query: "SELECT * FROM users",
          connectionId: "conn-1",
          executedAt: new Date("2024-01-01"),
        },
      ]

      mockStorage.get.mockResolvedValue(mockHistory)

      const exported = await historyManager.exportHistory()

      expect(exported).toContain('"query":"SELECT * FROM users"')
      expect(exported).toContain('"connectionId":"conn-1"')
    })

    test("JSON形式の履歴をインポートする", async () => {
      const importData = JSON.stringify([
        {
          id: "1",
          query: "SELECT * FROM imported",
          connectionId: "conn-1",
          executedAt: "2024-01-01T00:00:00.000Z",
        },
      ])

      await historyManager.importHistory(importData)

      expect(mockStorage.update).toHaveBeenCalledWith(
        "queryHistory",
        expect.arrayContaining([
          expect.objectContaining({
            query: "SELECT * FROM imported",
            executedAt: expect.any(Date),
          }),
        ])
      )
    })
  })
})
