import { beforeEach, describe, expect, test } from "vitest";
import {
  AdvancedSQLAutoCompleter,
  type CompletionContext,
} from "../../shared/services/AdvancedSQLAutoCompleter";
import {
  BookmarkManager,
  type QueryBookmark,
} from "../../shared/services/BookmarkManager";
import {
  type HistorySearchOptions,
  QueryHistoryManager,
} from "../../shared/services/QueryHistoryManager";
import { QueryPlanAnalyzer } from "../../shared/services/QueryPlanAnalyzer";
import {
  type FormatOptions,
  SQLFormatter,
} from "../../shared/services/SQLFormatter";
import type {
  DatabaseSchema,
  QueryExecutionContext,
} from "../../shared/types/sql";

describe("AdvancedSQLAutoCompleter", () => {
  let autoCompleter: AdvancedSQLAutoCompleter;
  let mockSchema: DatabaseSchema;

  beforeEach(() => {
    mockSchema = {
      database: "test_db",
      tables: [
        {
          name: "users",
          columns: [
            {
              name: "id",
              type: "integer",
              nullable: false,
              isPrimaryKey: true,
            },
            {
              name: "email",
              type: "varchar(255)",
              nullable: false,
              isPrimaryKey: false,
            },
            {
              name: "first_name",
              type: "varchar(100)",
              nullable: true,
              isPrimaryKey: false,
            },
            {
              name: "last_name",
              type: "varchar(100)",
              nullable: true,
              isPrimaryKey: false,
            },
            {
              name: "created_at",
              type: "timestamp",
              nullable: false,
              isPrimaryKey: false,
            },
          ],
        },
        {
          name: "orders",
          columns: [
            {
              name: "id",
              type: "integer",
              nullable: false,
              isPrimaryKey: true,
            },
            {
              name: "user_id",
              type: "integer",
              nullable: false,
              isPrimaryKey: false,
            },
            {
              name: "amount",
              type: "decimal(10,2)",
              nullable: false,
              isPrimaryKey: false,
            },
            {
              name: "status",
              type: "varchar(50)",
              nullable: false,
              isPrimaryKey: false,
            },
            {
              name: "order_date",
              type: "timestamp",
              nullable: false,
              isPrimaryKey: false,
            },
          ],
        },
      ],
      views: [],
      procedures: [],
      functions: [
        "COUNT",
        "SUM",
        "AVG",
        "MAX",
        "MIN",
        "CONCAT",
        "UPPER",
        "LOWER",
      ],
    };

    autoCompleter = new AdvancedSQLAutoCompleter(mockSchema);
  });

  describe("Table and Column Completion", () => {
    test("should complete table names after FROM keyword", async () => {
      const sql = "SELECT * FROM ";
      const position = sql.length;
      const context: CompletionContext = {
        sql,
        position,
        cursorPosition: position,
      };

      const result = await autoCompleter.getCompletions(context);

      expect(result.suggestions).toHaveLength(2);
      expect(result.suggestions[0].text).toBe("users");
      expect(result.suggestions[1].text).toBe("orders");
      expect(result.suggestions[0].type).toBe("table");
    });

    test("should complete column names after SELECT keyword", async () => {
      const sql = "SELECT ";
      const position = sql.length;
      const context: CompletionContext = {
        sql,
        position,
        cursorPosition: position,
      };

      const result = await autoCompleter.getCompletions(context);

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions.some((s) => s.text === "users.id")).toBe(true);
      expect(result.suggestions.some((s) => s.text === "users.email")).toBe(
        true,
      );
    });

    test("should complete column names with table alias", async () => {
      const sql = "SELECT u. FROM users u";
      const position = 9; // After "u."
      const context: CompletionContext = {
        sql,
        position,
        cursorPosition: position,
      };

      const result = await autoCompleter.getCompletions(context);

      expect(result.suggestions).toHaveLength(5); // users table has 5 columns
      expect(result.suggestions[0].text).toBe("id");
      expect(result.suggestions[1].text).toBe("email");
      expect(result.suggestions[0].type).toBe("column");
    });

    test("should complete JOIN syntax", async () => {
      const sql = "SELECT * FROM users u ";
      const position = sql.length;
      const context: CompletionContext = {
        sql,
        position,
        cursorPosition: position,
      };

      const result = await autoCompleter.getCompletions(context);

      expect(
        result.suggestions.some((s) => s.text.includes("INNER JOIN")),
      ).toBe(true);
      expect(result.suggestions.some((s) => s.text.includes("LEFT JOIN"))).toBe(
        true,
      );
      expect(
        result.suggestions.some((s) => s.text.includes("RIGHT JOIN")),
      ).toBe(true);
    });
  });

  describe("Function Completion", () => {
    test("should complete SQL functions", async () => {
      const sql = "SELECT C";
      const position = sql.length;
      const context: CompletionContext = {
        sql,
        position,
        cursorPosition: position,
      };

      const result = await autoCompleter.getCompletions(context);

      expect(
        result.suggestions.some(
          (s) => s.text === "COUNT" && s.type === "function",
        ),
      ).toBe(true);
      expect(
        result.suggestions.some(
          (s) => s.text === "CONCAT" && s.type === "function",
        ),
      ).toBe(true);
    });

    test("should provide function templates with parameters", async () => {
      const sql = "SELECT COUNT(";
      const position = sql.length;
      const context: CompletionContext = {
        sql,
        position,
        cursorPosition: position,
      };

      const result = await autoCompleter.getCompletions(context);

      expect(result.suggestions.some((s) => s.text.includes("*"))).toBe(true);
      expect(result.suggestions.some((s) => s.text.includes("DISTINCT"))).toBe(
        true,
      );
    });
  });

  describe("Subquery Completion", () => {
    test("should complete subquery context", async () => {
      const sql = "SELECT * FROM users WHERE id IN (";
      const position = sql.length;
      const context: CompletionContext = {
        sql,
        position,
        cursorPosition: position,
      };

      const result = await autoCompleter.getCompletions(context);

      expect(result.suggestions.some((s) => s.text.startsWith("SELECT"))).toBe(
        true,
      );
      expect(result.suggestions.some((s) => s.type === "subquery")).toBe(true);
    });
  });

  describe("Performance", () => {
    test("should complete suggestions within reasonable time", async () => {
      const sql = "SELECT u.";
      const position = sql.length;
      const context: CompletionContext = {
        sql,
        position,
        cursorPosition: position,
      };

      const startTime = Date.now();
      await autoCompleter.getCompletions(context);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });
  });
});

describe("SQLFormatter", () => {
  let formatter: SQLFormatter;

  beforeEach(() => {
    formatter = new SQLFormatter();
  });

  describe("Basic Formatting", () => {
    test("should format simple SELECT statement", () => {
      const sql = "select * from users where id=1";
      const options: FormatOptions = {
        keywordCase: "upper",
        indentSize: 2,
        lineBreakBeforeKeywords: true,
      };

      const formatted = formatter.format(sql, options);

      expect(formatted).toContain("SELECT");
      expect(formatted).toContain("FROM");
      expect(formatted).toContain("WHERE");
      expect(formatted).toMatch(/\n\s+FROM/);
    });

    test("should format complex JOIN query", () => {
      const sql =
        "select u.id,u.email,o.amount from users u inner join orders o on u.id=o.user_id where u.created_at>'2023-01-01'";

      const formatted = formatter.format(sql);

      expect(formatted).toContain("INNER JOIN");
      expect(formatted).toContain("ON");
      expect(formatted.split("\n").length).toBeGreaterThan(1);
    });

    test("should handle nested subqueries", () => {
      const sql =
        "select * from users where id in (select user_id from orders where amount>(select avg(amount) from orders))";

      const formatted = formatter.format(sql);

      expect(formatted).toContain("(\n");
      expect(formatted).toContain(")\n");
      expect(formatted.split("\n").length).toBeGreaterThan(3);
    });
  });

  describe("Formatting Options", () => {
    test("should respect keyword case option", () => {
      const sql = "select * from users";

      const upperCase = formatter.format(sql, { keywordCase: "upper" });
      const lowerCase = formatter.format(sql, { keywordCase: "lower" });

      expect(upperCase).toContain("SELECT");
      expect(lowerCase).toContain("select");
    });

    test("should respect indentation options", () => {
      const sql = "select * from users where id=1";

      const twoSpaces = formatter.format(sql, { indentSize: 2 });
      const fourSpaces = formatter.format(sql, { indentSize: 4 });

      const twoSpacesMatch = twoSpaces.match(/\n {2}\w/);
      const fourSpacesMatch = fourSpaces.match(/\n {4}\w/);

      expect(twoSpacesMatch).toBeTruthy();
      expect(fourSpacesMatch).toBeTruthy();
    });

    test("should preserve comments", () => {
      const sql = "SELECT * -- Get all users\nFROM users /* Main table */";

      const formatted = formatter.format(sql);

      expect(formatted).toContain("-- Get all users");
      expect(formatted).toContain("/* Main table */");
    });
  });

  describe("Error Handling", () => {
    test("should handle malformed SQL gracefully", () => {
      const sql = "SELECT * FROM users WHERE";

      expect(() => formatter.format(sql)).not.toThrow();
      const formatted = formatter.format(sql);
      expect(formatted).toBeTruthy();
    });
  });
});

describe("QueryHistoryManager", () => {
  let historyManager: QueryHistoryManager;
  let mockContext: QueryExecutionContext;

  beforeEach(() => {
    historyManager = new QueryHistoryManager();
    mockContext = {
      connection: { id: "test-connection", database: "test_db" },
      user: "test_user",
    } as QueryExecutionContext;
  });

  describe("History Storage", () => {
    test("should store query execution history", async () => {
      const sql = "SELECT * FROM users";
      const result = { rowCount: 10, executionTime: 150 };

      await historyManager.addEntry(sql, mockContext, result);

      const history = await historyManager.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].sql).toBe(sql);
      expect(history[0].executionTime).toBe(150);
    });

    test("should store multiple queries with timestamps", async () => {
      await historyManager.addEntry("SELECT * FROM users", mockContext, {
        rowCount: 10,
      });
      await historyManager.addEntry("SELECT * FROM orders", mockContext, {
        rowCount: 5,
      });

      const history = await historyManager.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].executedAt).toBeInstanceOf(Date);
      expect(history[1].executedAt).toBeInstanceOf(Date);
    });

    test("should limit history size", async () => {
      // Add more than the default limit
      for (let i = 0; i < 1100; i++) {
        await historyManager.addEntry(`SELECT ${i}`, mockContext, {
          rowCount: 1,
        });
      }

      const history = await historyManager.getHistory();
      expect(history.length).toBeLessThanOrEqual(1000); // Default limit
    });
  });

  describe("History Search", () => {
    beforeEach(async () => {
      await historyManager.addEntry(
        "SELECT * FROM users WHERE email = 'test@example.com'",
        mockContext,
        { rowCount: 1 },
      );
      await historyManager.addEntry(
        "UPDATE users SET last_name = 'Smith'",
        mockContext,
        {
          rowCount: 5,
        },
      );
      await historyManager.addEntry(
        "SELECT COUNT(*) FROM orders",
        mockContext,
        { rowCount: 1 },
      );
    });

    test("should search by SQL text", async () => {
      const options: HistorySearchOptions = { searchText: "users" };
      const results = await historyManager.searchHistory(options);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.sql.includes("users"))).toBe(true);
    });

    test("should filter by date range", async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const options: HistorySearchOptions = { startDate: yesterday };

      const results = await historyManager.searchHistory(options);
      expect(results.length).toBeGreaterThan(0);
    });

    test("should filter by execution time", async () => {
      // Add a slow query
      await historyManager.addEntry("SELECT * FROM large_table", mockContext, {
        rowCount: 1000,
        executionTime: 5000,
      });

      const options: HistorySearchOptions = { minExecutionTime: 4000 };
      const results = await historyManager.searchHistory(options);

      expect(results).toHaveLength(1);
      expect(results[0].executionTime).toBeGreaterThan(4000);
    });
  });

  describe("Favorites", () => {
    test("should mark queries as favorite", async () => {
      await historyManager.addEntry("SELECT * FROM users", mockContext, {
        rowCount: 10,
      });
      const history = await historyManager.getHistory();
      const queryId = history[0].id;

      await historyManager.toggleFavorite(queryId);

      const favorites = await historyManager.getFavorites();
      expect(favorites).toHaveLength(1);
      expect(favorites[0].id).toBe(queryId);
    });

    test("should remove from favorites", async () => {
      await historyManager.addEntry("SELECT * FROM users", mockContext, {
        rowCount: 10,
      });
      const history = await historyManager.getHistory();
      const queryId = history[0].id;

      await historyManager.toggleFavorite(queryId);
      await historyManager.toggleFavorite(queryId); // Toggle again

      const favorites = await historyManager.getFavorites();
      expect(favorites).toHaveLength(0);
    });
  });
});

describe("QueryPlanAnalyzer", () => {
  let analyzer: QueryPlanAnalyzer;
  let mockContext: QueryExecutionContext;

  beforeEach(() => {
    analyzer = new QueryPlanAnalyzer();
    mockContext = {
      connection: { id: "test-connection", type: "postgresql" },
      user: "test_user",
    } as QueryExecutionContext;
  });

  describe("Plan Analysis", () => {
    test("should analyze simple SELECT query plan", async () => {
      const sql = "SELECT * FROM users WHERE id = 1";

      const plan = await analyzer.getQueryPlan(sql, mockContext);

      expect(plan).toBeDefined();
      expect(plan.query).toBe(sql);
      expect(plan.nodes).toHaveLength(1);
      expect(plan.totalCost).toBeGreaterThan(0);
    });

    test("should analyze JOIN query plan", async () => {
      const sql =
        "SELECT u.*, o.* FROM users u JOIN orders o ON u.id = o.user_id";

      const plan = await analyzer.getQueryPlan(sql, mockContext);

      expect(plan.nodes.length).toBeGreaterThan(1);
      expect(plan.nodes.some((n) => n.operation.includes("Join"))).toBe(true);
    });

    test("should identify performance bottlenecks", async () => {
      const sql = "SELECT * FROM users WHERE email LIKE '%example%'";

      const plan = await analyzer.getQueryPlan(sql, mockContext);
      const warnings = analyzer.analyzePerformance(plan);

      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some((w) => w.severity === "high")).toBe(true);
    });
  });

  describe("Plan Visualization", () => {
    test("should convert plan to tree structure", async () => {
      const sql =
        "SELECT u.*, o.* FROM users u JOIN orders o ON u.id = o.user_id";

      const plan = await analyzer.getQueryPlan(sql, mockContext);
      const tree = analyzer.planToTree(plan);

      expect(tree).toBeDefined();
      expect(tree.children).toBeDefined();
      expect(tree.children.length).toBeGreaterThan(0);
    });

    test("should calculate relative costs", async () => {
      const sql = "SELECT * FROM users WHERE id = 1";

      const plan = await analyzer.getQueryPlan(sql, mockContext);

      for (const node of plan.nodes) {
        expect(node.relativeCost).toBeGreaterThanOrEqual(0);
        expect(node.relativeCost).toBeLessThanOrEqual(100);
      }
    });
  });

  describe("Database-specific Plans", () => {
    test("should handle PostgreSQL EXPLAIN format", async () => {
      const postgresContext = {
        ...mockContext,
        connection: { ...mockContext.connection, type: "postgresql" },
      };
      const sql = "SELECT * FROM users";

      const plan = await analyzer.getQueryPlan(sql, postgresContext);

      expect(plan).toBeDefined();
      expect(plan.databaseType).toBe("postgresql");
    });

    test("should handle MySQL EXPLAIN format", async () => {
      const mysqlContext = {
        ...mockContext,
        connection: { ...mockContext.connection, type: "mysql" },
      };
      const sql = "SELECT * FROM users";

      const plan = await analyzer.getQueryPlan(sql, mysqlContext);

      expect(plan).toBeDefined();
      expect(plan.databaseType).toBe("mysql");
    });
  });
});

describe("BookmarkManager", () => {
  let bookmarkManager: BookmarkManager;

  beforeEach(() => {
    bookmarkManager = new BookmarkManager();
  });

  describe("Bookmark Management", () => {
    test("should create new bookmark", async () => {
      const bookmark: Omit<QueryBookmark, "id" | "createdAt" | "updatedAt"> = {
        name: "Get all users",
        sql: "SELECT * FROM users",
        description: "Retrieve all user records",
        category: "Users",
        tags: ["users", "select"],
      };

      const created = await bookmarkManager.createBookmark(bookmark);

      expect(created.id).toBeDefined();
      expect(created.name).toBe(bookmark.name);
      expect(created.createdAt).toBeInstanceOf(Date);
    });

    test("should list all bookmarks", async () => {
      await bookmarkManager.createBookmark({
        name: "Bookmark 1",
        sql: "SELECT 1",
        description: "",
        category: "Test",
        tags: [],
      });

      await bookmarkManager.createBookmark({
        name: "Bookmark 2",
        sql: "SELECT 2",
        description: "",
        category: "Test",
        tags: [],
      });

      const bookmarks = await bookmarkManager.getBookmarks();
      expect(bookmarks).toHaveLength(2);
    });

    test("should update existing bookmark", async () => {
      const bookmark = await bookmarkManager.createBookmark({
        name: "Original Name",
        sql: "SELECT * FROM users",
        description: "",
        category: "Users",
        tags: [],
      });

      const updated = await bookmarkManager.updateBookmark(bookmark.id, {
        name: "Updated Name",
        description: "Updated description",
      });

      expect(updated.name).toBe("Updated Name");
      expect(updated.description).toBe("Updated description");
      expect(updated.updatedAt.getTime()).toBeGreaterThan(
        updated.createdAt.getTime(),
      );
    });

    test("should delete bookmark", async () => {
      const bookmark = await bookmarkManager.createBookmark({
        name: "To Delete",
        sql: "SELECT 1",
        description: "",
        category: "Test",
        tags: [],
      });

      await bookmarkManager.deleteBookmark(bookmark.id);

      const bookmarks = await bookmarkManager.getBookmarks();
      expect(bookmarks.find((b) => b.id === bookmark.id)).toBeUndefined();
    });
  });

  describe("Search and Filter", () => {
    beforeEach(async () => {
      await bookmarkManager.createBookmark({
        name: "Get Users",
        sql: "SELECT * FROM users",
        description: "Get all users",
        category: "Users",
        tags: ["users", "select"],
      });

      await bookmarkManager.createBookmark({
        name: "Count Orders",
        sql: "SELECT COUNT(*) FROM orders",
        description: "Count all orders",
        category: "Analytics",
        tags: ["orders", "count"],
      });
    });

    test("should search by name", async () => {
      const results = await bookmarkManager.searchBookmarks("Users");
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Get Users");
    });

    test("should filter by category", async () => {
      const results = await bookmarkManager.getBookmarksByCategory("Analytics");
      expect(results).toHaveLength(1);
      expect(results[0].category).toBe("Analytics");
    });

    test("should filter by tags", async () => {
      const results = await bookmarkManager.getBookmarksByTag("count");
      expect(results).toHaveLength(1);
      expect(results[0].tags).toContain("count");
    });
  });

  describe("Categories", () => {
    test("should get all categories", async () => {
      await bookmarkManager.createBookmark({
        name: "Test 1",
        sql: "SELECT 1",
        description: "",
        category: "Category A",
        tags: [],
      });

      await bookmarkManager.createBookmark({
        name: "Test 2",
        sql: "SELECT 2",
        description: "",
        category: "Category B",
        tags: [],
      });

      const categories = await bookmarkManager.getCategories();
      expect(categories).toContain("Category A");
      expect(categories).toContain("Category B");
      expect(categories).toHaveLength(2);
    });

    test("should get all tags", async () => {
      await bookmarkManager.createBookmark({
        name: "Test 1",
        sql: "SELECT 1",
        description: "",
        category: "Test",
        tags: ["tag1", "tag2"],
      });

      await bookmarkManager.createBookmark({
        name: "Test 2",
        sql: "SELECT 2",
        description: "",
        category: "Test",
        tags: ["tag2", "tag3"],
      });

      const tags = await bookmarkManager.getAllTags();
      expect(tags).toContain("tag1");
      expect(tags).toContain("tag2");
      expect(tags).toContain("tag3");
      expect(tags).toHaveLength(3);
    });
  });
});
