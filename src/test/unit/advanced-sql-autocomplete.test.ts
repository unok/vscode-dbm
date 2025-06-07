import { beforeEach, describe, expect, test, vi } from "vitest";
import { AdvancedSQLAutoCompleter } from "@/shared/services/AdvancedSQLAutoCompleter";
import type { DatabaseMetadataService } from "@/shared/services/DatabaseMetadataService";
import type { DatabaseTable } from "@/shared/types/schema";

// Mock Monaco Editor types
const mockMonaco = {
  languages: {
    CompletionItemKind: {
      Keyword: 1,
      Function: 2,
      Field: 3,
      Variable: 4,
      Class: 5,
      Interface: 6,
      Module: 7,
      Property: 8,
      Method: 9,
      Enum: 10,
      Value: 11,
      Constant: 12,
      Text: 13,
      Color: 14,
      File: 15,
      Reference: 16,
      Folder: 17,
      TypeParameter: 18,
      Snippet: 19,
    },
    CompletionItemInsertTextRule: {
      InsertAsSnippet: 4,
    },
  },
};

describe("AdvancedSQLAutoCompleter", () => {
  let autoCompleter: AdvancedSQLAutoCompleter;
  let mockMetadataService: DatabaseMetadataService;

  const mockTables: DatabaseTable[] = [
    {
      name: "users",
      schema: "public",
      columns: [
        {
          name: "id",
          dataType: "INTEGER",
          nullable: false,
          isPrimaryKey: true,
        },
        { name: "name", dataType: "VARCHAR(100)", nullable: false },
        { name: "email", dataType: "VARCHAR(255)", nullable: false },
        { name: "created_at", dataType: "TIMESTAMP", nullable: false },
      ],
    },
    {
      name: "posts",
      schema: "public",
      columns: [
        {
          name: "id",
          dataType: "INTEGER",
          nullable: false,
          isPrimaryKey: true,
        },
        {
          name: "user_id",
          dataType: "INTEGER",
          nullable: false,
          isForeignKey: true,
        },
        { name: "title", dataType: "VARCHAR(200)", nullable: false },
        { name: "content", dataType: "TEXT", nullable: true },
        { name: "published_at", dataType: "TIMESTAMP", nullable: true },
      ],
    },
  ];

  beforeEach(() => {
    mockMetadataService = {
      getTables: vi.fn().mockResolvedValue(mockTables),
      getColumns: vi.fn().mockImplementation((table: string) => {
        const foundTable = mockTables.find((t) => t.name === table);
        return Promise.resolve(foundTable?.columns || []);
      }),
      getFunctions: vi.fn().mockResolvedValue([
        { name: "COUNT", description: "Count rows" },
        { name: "SUM", description: "Sum values" },
        { name: "AVG", description: "Average values" },
      ]),
    } as DatabaseMetadataService;

    autoCompleter = new AdvancedSQLAutoCompleter(
      mockMetadataService,
      mockMonaco as typeof import("monaco-editor").languages,
    );
  });

  describe("キーワード補完", () => {
    test("SELECT文の後にキーワードを提案する", async () => {
      const suggestions = await autoCompleter.getSuggestions("SELECT ", 7);

      expect(suggestions).toContainEqual(
        expect.objectContaining({
          label: "DISTINCT",
          kind: mockMonaco.languages.CompletionItemKind.Keyword,
        }),
      );
      expect(suggestions).toContainEqual(
        expect.objectContaining({
          label: "*",
          kind: mockMonaco.languages.CompletionItemKind.Keyword,
        }),
      );
    });

    test("FROM句の後にテーブル名を提案する", async () => {
      const suggestions = await autoCompleter.getSuggestions(
        "SELECT * FROM ",
        14,
      );

      expect(suggestions).toContainEqual(
        expect.objectContaining({
          label: "users",
          kind: mockMonaco.languages.CompletionItemKind.Class,
          detail: "Table",
        }),
      );
      expect(suggestions).toContainEqual(
        expect.objectContaining({
          label: "posts",
          kind: mockMonaco.languages.CompletionItemKind.Class,
          detail: "Table",
        }),
      );
    });
  });

  describe("テーブル補完", () => {
    test("テーブル名の部分一致で補完候補を絞り込む", async () => {
      const suggestions = await autoCompleter.getSuggestions(
        "SELECT * FROM us",
        16,
      );

      expect(suggestions).toContainEqual(
        expect.objectContaining({
          label: "users",
          kind: mockMonaco.languages.CompletionItemKind.Class,
        }),
      );
      expect(suggestions).not.toContainEqual(
        expect.objectContaining({
          label: "posts",
        }),
      );
    });

    test("エイリアス付きテーブルの補完", async () => {
      const suggestions = await autoCompleter.getSuggestions(
        "SELECT * FROM users u, ",
        23,
      );

      expect(suggestions).toContainEqual(
        expect.objectContaining({
          label: "posts",
          kind: mockMonaco.languages.CompletionItemKind.Class,
        }),
      );
    });
  });

  describe("カラム補完", () => {
    test("テーブル名の後にカラムを提案する", async () => {
      const suggestions = await autoCompleter.getSuggestions(
        "SELECT users.",
        13,
      );

      expect(suggestions).toContainEqual(
        expect.objectContaining({
          label: "id",
          kind: mockMonaco.languages.CompletionItemKind.Field,
          detail: "INTEGER",
        }),
      );
      expect(suggestions).toContainEqual(
        expect.objectContaining({
          label: "name",
          kind: mockMonaco.languages.CompletionItemKind.Field,
          detail: "VARCHAR(100)",
        }),
      );
    });

    test("エイリアスでのカラム補完", async () => {
      const context = "SELECT u. FROM users u";
      const suggestions = await autoCompleter.getSuggestions(context, 9);

      expect(suggestions).toContainEqual(
        expect.objectContaining({
          label: "email",
          kind: mockMonaco.languages.CompletionItemKind.Field,
        }),
      );
    });

    test("JOIN句でのカラム補完", async () => {
      const context = "SELECT * FROM users u JOIN posts p ON u.id = p.";
      const suggestions = await autoCompleter.getSuggestions(
        context,
        context.length,
      );

      expect(suggestions).toContainEqual(
        expect.objectContaining({
          label: "user_id",
          kind: mockMonaco.languages.CompletionItemKind.Field,
          detail: "INTEGER",
        }),
      );
    });
  });

  describe("関数補完", () => {
    test("集計関数の補完", async () => {
      const suggestions = await autoCompleter.getSuggestions("SELECT C", 8);

      expect(suggestions).toContainEqual(
        expect.objectContaining({
          label: "COUNT",
          kind: mockMonaco.languages.CompletionItemKind.Function,
          insertText: "COUNT(${1:column})",
          insertTextRules:
            mockMonaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        }),
      );
    });

    test("関数の引数内でのカラム補完", async () => {
      const context = "SELECT COUNT(u.) FROM users u";
      const suggestions = await autoCompleter.getSuggestions(context, 15);

      expect(suggestions).toContainEqual(
        expect.objectContaining({
          label: "id",
          kind: mockMonaco.languages.CompletionItemKind.Field,
        }),
      );
    });
  });

  describe("スニペット補完", () => {
    test("SELECT文のスニペット", async () => {
      const suggestions = await autoCompleter.getSuggestions("SEL", 3);

      expect(suggestions).toContainEqual(
        expect.objectContaining({
          label: "SELECT",
          kind: mockMonaco.languages.CompletionItemKind.Snippet,
          insertText: "SELECT ${1:columns} FROM ${2:table}",
          insertTextRules:
            mockMonaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        }),
      );
    });

    test("JOIN文のスニペット", async () => {
      const suggestions = await autoCompleter.getSuggestions("JOIN", 4);

      expect(suggestions).toContainEqual(
        expect.objectContaining({
          label: "JOIN",
          kind: mockMonaco.languages.CompletionItemKind.Snippet,
          insertText: "JOIN ${1:table} ON ${2:condition}",
          insertTextRules:
            mockMonaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        }),
      );
    });
  });

  describe("複雑なクエリでの補完", () => {
    test("サブクエリ内での補完", async () => {
      const context = "SELECT * FROM users WHERE id IN (SELECT user_id FROM ";
      const suggestions = await autoCompleter.getSuggestions(
        context,
        context.length,
      );

      expect(suggestions).toContainEqual(
        expect.objectContaining({
          label: "posts",
          kind: mockMonaco.languages.CompletionItemKind.Class,
        }),
      );
    });

    test("複数JOIN文での補完", async () => {
      const context = `
        SELECT u.name, p.title
        FROM users u
        JOIN posts p ON u.id = p.user_id
        WHERE u.
      `;
      const suggestions = await autoCompleter.getSuggestions(
        context,
        context.lastIndexOf("u.") + 2,
      );

      expect(suggestions).toContainEqual(
        expect.objectContaining({
          label: "email",
          kind: mockMonaco.languages.CompletionItemKind.Field,
        }),
      );
    });
  });

  describe("コンテキスト認識", () => {
    test("WHERE句でのカラム補完", async () => {
      const context = "SELECT * FROM users WHERE ";
      const suggestions = await autoCompleter.getSuggestions(
        context,
        context.length,
      );

      expect(suggestions).toContainEqual(
        expect.objectContaining({
          label: "users.id",
          kind: mockMonaco.languages.CompletionItemKind.Field,
        }),
      );
      expect(suggestions).toContainEqual(
        expect.objectContaining({
          label: "users.email",
          kind: mockMonaco.languages.CompletionItemKind.Field,
        }),
      );
    });

    test("ORDER BY句でのカラム補完", async () => {
      const context = "SELECT * FROM posts ORDER BY ";
      const suggestions = await autoCompleter.getSuggestions(
        context,
        context.length,
      );

      expect(suggestions).toContainEqual(
        expect.objectContaining({
          label: "posts.published_at",
          kind: mockMonaco.languages.CompletionItemKind.Field,
        }),
      );
    });
  });

  describe("パフォーマンス", () => {
    test("大量のテーブルでも高速に補完候補を返す", async () => {
      // 1000個のテーブルをモック
      const manyTables = Array.from({ length: 1000 }, (_, i) => ({
        name: `table_${i}`,
        schema: "public",
        columns: [
          {
            name: "id",
            dataType: "INTEGER",
            nullable: false,
            isPrimaryKey: true,
          },
          { name: "data", dataType: "TEXT", nullable: true },
        ],
      }));

      vi.mocked(mockMetadataService.getTables).mockResolvedValue(manyTables);

      const start = performance.now();
      const suggestions = await autoCompleter.getSuggestions(
        "SELECT * FROM table_5",
        21,
      );
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100); // 100ms以内
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions).toContainEqual(
        expect.objectContaining({
          label: "table_50",
        }),
      );
    });
  });

  describe("エラーハンドリング", () => {
    test("メタデータ取得エラー時は基本的な補完のみ提供", async () => {
      vi.mocked(mockMetadataService.getTables).mockRejectedValue(
        new Error("Connection error"),
      );

      const suggestions = await autoCompleter.getSuggestions("SELECT ", 7);

      // キーワード補完は動作する
      expect(suggestions).toContainEqual(
        expect.objectContaining({
          label: "DISTINCT",
          kind: mockMonaco.languages.CompletionItemKind.Keyword,
        }),
      );

      // テーブル補完は空
      const tableSuggestions = await autoCompleter.getSuggestions(
        "SELECT * FROM ",
        14,
      );
      const tables = tableSuggestions.filter(
        (s) => s.kind === mockMonaco.languages.CompletionItemKind.Class,
      );
      expect(tables).toHaveLength(0);
    });
  });
});
