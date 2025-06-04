import { AdvancedSQLAutoCompleter } from "@/shared/services/AdvancedSQLAutoCompleter"
import { QueryHistoryManager } from "@/shared/services/QueryHistoryManager"
import { SQLFormatter } from "@/shared/services/SQLFormatter"
import type { CompletionContext } from "@/shared/types/advanced-sql"
import type { DatabaseSchema } from "@/shared/types/sql"
import { beforeEach, describe, expect, test, vi } from "vitest"

describe("Advanced SQL Features Implementation", () => {
  describe("AdvancedSQLAutoCompleter", () => {
    let autoCompleter: AdvancedSQLAutoCompleter
    const mockSchema: DatabaseSchema = {
      tables: [
        {
          name: "users",
          columns: [
            { name: "id", type: "INTEGER", nullable: false },
            { name: "name", type: "VARCHAR(100)", nullable: false },
            { name: "email", type: "VARCHAR(255)", nullable: false },
          ],
        },
        {
          name: "posts",
          columns: [
            { name: "id", type: "INTEGER", nullable: false },
            { name: "user_id", type: "INTEGER", nullable: false },
            { name: "title", type: "VARCHAR(200)", nullable: false },
          ],
        },
      ],
      functions: ["COUNT", "SUM", "AVG", "MAX", "MIN"],
    }

    beforeEach(() => {
      autoCompleter = new AdvancedSQLAutoCompleter(mockSchema)
    })

    test("completes table names after FROM", async () => {
      const context: CompletionContext = {
        sql: "SELECT * FROM ",
        position: 14,
      }

      const result = await autoCompleter.getCompletions(context)

      expect(result.suggestions).toContainEqual(
        expect.objectContaining({
          text: "users",
          type: "table",
        })
      )
      expect(result.suggestions).toContainEqual(
        expect.objectContaining({
          text: "posts",
          type: "table",
        })
      )
    })

    test("completes column names after SELECT", async () => {
      const context: CompletionContext = {
        sql: "SELECT ",
        position: 7,
      }

      const result = await autoCompleter.getCompletions(context)

      // Should include columns with table prefix
      expect(result.suggestions).toContainEqual(
        expect.objectContaining({
          text: "users.id",
          type: "column",
        })
      )
    })

    test("completes functions", async () => {
      const context: CompletionContext = {
        sql: "SELECT C",
        position: 8,
      }

      const result = await autoCompleter.getCompletions(context)

      expect(result.suggestions).toContainEqual(
        expect.objectContaining({
          text: "COUNT",
          type: "function",
        })
      )
    })

    test("returns suggestions array", async () => {
      const context: CompletionContext = {
        sql: "SELECT * FROM ",
        position: 14,
      }

      const result = await autoCompleter.getCompletions(context)

      // Should return an object with suggestions array
      expect(result).toHaveProperty("suggestions")
      expect(Array.isArray(result.suggestions)).toBe(true)
      expect(result.suggestions.length).toBeGreaterThan(0)
    })
  })

  describe("SQLFormatter", () => {
    let formatter: SQLFormatter

    beforeEach(() => {
      formatter = new SQLFormatter()
    })

    test("formats simple SELECT statement", () => {
      const input = "SELECT id, name FROM users WHERE active = true"
      const formatted = formatter.format(input)

      expect(formatted).toContain("SELECT")
      expect(formatted).toContain("FROM")
      expect(formatted).toContain("WHERE")
      expect(formatted.split("\n").length).toBeGreaterThan(1)
    })

    test("formats with custom options", () => {
      const input = "SELECT * FROM users"
      const formatted = formatter.format(input, {
        keywordCase: "lower",
        indentSize: 4,
      })

      expect(formatted).toContain("select")
      expect(formatted).toContain("from")
    })

    test("preserves comments", () => {
      const input = `-- This is a comment
SELECT * FROM users`
      const formatted = formatter.format(input)

      expect(formatted).toContain("-- This is a comment")
    })

    test("handles complex queries", () => {
      const input =
        "SELECT u.name, COUNT(p.id) FROM users u LEFT JOIN posts p ON u.id = p.user_id GROUP BY u.name"
      const formatted = formatter.format(input)

      expect(formatted).toContain("LEFT JOIN")
      expect(formatted.toLowerCase()).toContain("group")
      expect(formatted.toLowerCase()).toContain("by")
      expect(formatted.split("\n").length).toBeGreaterThan(1)
    })
  })

  describe("QueryHistoryManager", () => {
    let historyManager: QueryHistoryManager

    beforeEach(() => {
      historyManager = new QueryHistoryManager()
    })

    test("adds entries to history", async () => {
      const context = {
        connection: { id: "conn-1", database: "testdb" },
        user: "testuser",
      }

      const entry = await historyManager.addEntry("SELECT * FROM users", context)

      expect(entry).toHaveProperty("id")
      expect(entry.sql).toBe("SELECT * FROM users")
      expect(entry.database).toBe("testdb")
      expect(entry.user).toBe("testuser")
    })

    test("retrieves history entries", async () => {
      const context = {
        connection: { id: "conn-1", database: "testdb" },
        user: "testuser",
      }

      await historyManager.addEntry("SELECT * FROM users", context)
      await historyManager.addEntry("SELECT * FROM posts", context)

      const history = await historyManager.getHistory()
      expect(history).toHaveLength(2)
      expect(history[0].sql).toBe("SELECT * FROM posts") // Most recent first
    })

    test("searches history", async () => {
      const context = {
        connection: { id: "conn-1", database: "testdb" },
        user: "testuser",
      }

      await historyManager.addEntry("SELECT * FROM users", context)
      await historyManager.addEntry("SELECT * FROM posts", context)

      const results = await historyManager.searchHistory({
        searchText: "users",
      })

      expect(results).toHaveLength(1)
      expect(results[0].sql).toContain("users")
    })

    test("manages favorites", async () => {
      const context = {
        connection: { id: "conn-1", database: "testdb" },
        user: "testuser",
      }

      const entry = await historyManager.addEntry("SELECT * FROM users", context)
      await historyManager.toggleFavorite(entry.id)

      const favorites = await historyManager.getFavorites()
      expect(favorites).toHaveLength(1)
      expect(favorites[0].id).toBe(entry.id)
    })

    test("exports history as JSON", async () => {
      const context = {
        connection: { id: "conn-1", database: "testdb" },
        user: "testuser",
      }

      await historyManager.addEntry("SELECT * FROM users", context)

      const exported = await historyManager.exportHistory("json")
      const parsed = JSON.parse(exported)

      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed[0]).toHaveProperty("sql", "SELECT * FROM users")
    })

    test("calculates statistics", async () => {
      const context = {
        connection: { id: "conn-1", database: "testdb" },
        user: "testuser",
      }

      await historyManager.addEntry("SELECT * FROM users", context, {
        executionTime: 100,
        success: true,
      })
      await historyManager.addEntry("SELECT * FROM posts", context, {
        executionTime: 200,
        success: true,
      })

      const stats = await historyManager.getStatistics()

      expect(stats.total).toBe(2)
      expect(stats.successful).toBe(2)
      expect(stats.avgExecutionTime).toBe(150)
    })
  })
})
