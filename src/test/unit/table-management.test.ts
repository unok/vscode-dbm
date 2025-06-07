import { beforeEach, describe, expect, test, vi } from "vitest";
import { TableManagementService } from "@/shared/services/TableManagementService";
import type { DatabaseConnection } from "@/shared/types/sql";
import type {
  ColumnDefinition,
  ConstraintDefinition,
  IndexDefinition,
  TableDefinition,
} from "@/shared/types/table-management";

describe("TableManagementService", () => {
  let tableService: TableManagementService;
  let mockConnection: DatabaseConnection;

  beforeEach(() => {
    mockConnection = {
      id: "test-conn",
      name: "Test Connection",
      type: "mysql",
      database: "testdb",
      host: "localhost",
      port: 3306,
      username: "user",
    };

    tableService = new TableManagementService();
  });

  describe("テーブル作成", () => {
    test("基本的なテーブルを作成する", async () => {
      const tableDefinition: TableDefinition = {
        name: "users",
        schema: "public",
        columns: [
          {
            name: "id",
            dataType: "INTEGER",
            nullable: false,
            isPrimaryKey: true,
            autoIncrement: true,
          },
          {
            name: "name",
            dataType: "VARCHAR(100)",
            nullable: false,
          },
          {
            name: "email",
            dataType: "VARCHAR(255)",
            nullable: false,
          },
        ],
      };

      const sql = await tableService.generateCreateTableSQL(
        tableDefinition,
        mockConnection,
      );

      expect(sql).toContain("CREATE TABLE");
      expect(sql).toContain("users");
      expect(sql).toContain("id INTEGER NOT NULL AUTO_INCREMENT");
      expect(sql).toContain("name VARCHAR(100) NOT NULL");
      expect(sql).toContain("email VARCHAR(255) NOT NULL");
      expect(sql).toContain("PRIMARY KEY (id)");
    });

    test("制約付きテーブルを作成する", async () => {
      const tableDefinition: TableDefinition = {
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
          {
            name: "title",
            dataType: "VARCHAR(200)",
            nullable: false,
          },
        ],
        constraints: [
          {
            name: "fk_posts_user_id",
            type: "FOREIGN_KEY",
            columns: ["user_id"],
            referencedTable: "users",
            referencedColumns: ["id"],
            onDelete: "CASCADE",
            onUpdate: "CASCADE",
          },
        ],
      };

      const sql = await tableService.generateCreateTableSQL(
        tableDefinition,
        mockConnection,
      );

      expect(sql).toContain("FOREIGN KEY (user_id) REFERENCES users(id)");
      expect(sql).toContain("ON DELETE CASCADE");
      expect(sql).toContain("ON UPDATE CASCADE");
    });

    test("PostgreSQL用のSQLを生成する", async () => {
      const pgConnection = { ...mockConnection, type: "postgresql" as const };
      const tableDefinition: TableDefinition = {
        name: "users",
        schema: "public",
        columns: [
          {
            name: "id",
            dataType: "SERIAL",
            nullable: false,
            isPrimaryKey: true,
          },
          {
            name: "created_at",
            dataType: "TIMESTAMP",
            nullable: false,
            defaultValue: "NOW()",
          },
        ],
      };

      const sql = await tableService.generateCreateTableSQL(
        tableDefinition,
        pgConnection,
      );

      expect(sql).toContain("id SERIAL NOT NULL");
      expect(sql).toContain("created_at TIMESTAMP NOT NULL DEFAULT NOW()");
    });
  });

  describe("テーブル変更", () => {
    test("カラムを追加する", async () => {
      const columnDefinition: ColumnDefinition = {
        name: "created_at",
        dataType: "TIMESTAMP",
        nullable: false,
        defaultValue: "CURRENT_TIMESTAMP",
      };

      const sql = await tableService.generateAddColumnSQL(
        "users",
        columnDefinition,
        mockConnection,
      );

      expect(sql).toContain("ALTER TABLE users");
      expect(sql).toContain(
        "ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP",
      );
    });

    test("カラムを変更する", async () => {
      const oldColumn: ColumnDefinition = {
        name: "name",
        dataType: "VARCHAR(50)",
        nullable: false,
      };

      const newColumn: ColumnDefinition = {
        name: "name",
        dataType: "VARCHAR(100)",
        nullable: true,
      };

      const sql = await tableService.generateModifyColumnSQL(
        "users",
        oldColumn,
        newColumn,
        mockConnection,
      );

      expect(sql).toContain("ALTER TABLE users");
      expect(sql).toContain("MODIFY COLUMN name VARCHAR(100)");
    });

    test("カラムを削除する", async () => {
      const sql = await tableService.generateDropColumnSQL(
        "users",
        "middle_name",
        mockConnection,
      );

      expect(sql).toContain("ALTER TABLE users DROP COLUMN middle_name");
    });

    test("テーブル名を変更する", async () => {
      const sql = await tableService.generateRenameTableSQL(
        "old_users",
        "users",
        mockConnection,
      );

      expect(sql).toContain("RENAME TABLE old_users TO users");
    });
  });

  describe("制約管理", () => {
    test("PRIMARY KEY制約を追加する", async () => {
      const constraint: ConstraintDefinition = {
        name: "pk_users_id",
        type: "PRIMARY_KEY",
        columns: ["id"],
      };

      const sql = await tableService.generateAddConstraintSQL(
        "users",
        constraint,
        mockConnection,
      );

      expect(sql).toContain("ALTER TABLE users");
      expect(sql).toContain("ADD CONSTRAINT pk_users_id PRIMARY KEY (id)");
    });

    test("FOREIGN KEY制約を追加する", async () => {
      const constraint: ConstraintDefinition = {
        name: "fk_posts_user",
        type: "FOREIGN_KEY",
        columns: ["user_id"],
        referencedTable: "users",
        referencedColumns: ["id"],
        onDelete: "SET_NULL",
        onUpdate: "RESTRICT",
      };

      const sql = await tableService.generateAddConstraintSQL(
        "posts",
        constraint,
        mockConnection,
      );

      expect(sql).toContain("ADD CONSTRAINT fk_posts_user");
      expect(sql).toContain("FOREIGN KEY (user_id) REFERENCES users(id)");
      expect(sql).toContain("ON DELETE SET NULL");
      expect(sql).toContain("ON UPDATE RESTRICT");
    });

    test("UNIQUE制約を追加する", async () => {
      const constraint: ConstraintDefinition = {
        name: "uk_users_email",
        type: "UNIQUE",
        columns: ["email"],
      };

      const sql = await tableService.generateAddConstraintSQL(
        "users",
        constraint,
        mockConnection,
      );

      expect(sql).toContain("ADD CONSTRAINT uk_users_email UNIQUE (email)");
    });

    test("CHECK制約を追加する", async () => {
      const constraint: ConstraintDefinition = {
        name: "ck_users_age",
        type: "CHECK",
        checkExpression: "age >= 0 AND age <= 150",
      };

      const sql = await tableService.generateAddConstraintSQL(
        "users",
        constraint,
        mockConnection,
      );

      expect(sql).toContain(
        "ADD CONSTRAINT ck_users_age CHECK (age >= 0 AND age <= 150)",
      );
    });

    test("制約を削除する", async () => {
      const sql = await tableService.generateDropConstraintSQL(
        "users",
        "uk_users_email",
        mockConnection,
      );

      expect(sql).toContain("ALTER TABLE users DROP CONSTRAINT uk_users_email");
    });
  });

  describe("インデックス管理", () => {
    test("通常のインデックスを作成する", async () => {
      const indexDefinition: IndexDefinition = {
        name: "idx_users_email",
        tableName: "users",
        columns: ["email"],
        unique: false,
      };

      const sql = await tableService.generateCreateIndexSQL(
        indexDefinition,
        mockConnection,
      );

      expect(sql).toContain("CREATE INDEX idx_users_email ON users (email)");
    });

    test("UNIQUE インデックスを作成する", async () => {
      const indexDefinition: IndexDefinition = {
        name: "uk_users_username",
        tableName: "users",
        columns: ["username"],
        unique: true,
      };

      const sql = await tableService.generateCreateIndexSQL(
        indexDefinition,
        mockConnection,
      );

      expect(sql).toContain(
        "CREATE UNIQUE INDEX uk_users_username ON users (username)",
      );
    });

    test("複合インデックスを作成する", async () => {
      const indexDefinition: IndexDefinition = {
        name: "idx_posts_user_created",
        tableName: "posts",
        columns: ["user_id", "created_at"],
        unique: false,
      };

      const sql = await tableService.generateCreateIndexSQL(
        indexDefinition,
        mockConnection,
      );

      expect(sql).toContain(
        "CREATE INDEX idx_posts_user_created ON posts (user_id, created_at)",
      );
    });

    test("部分インデックスを作成する（PostgreSQL）", async () => {
      const pgConnection = { ...mockConnection, type: "postgresql" as const };
      const indexDefinition: IndexDefinition = {
        name: "idx_users_active_email",
        tableName: "users",
        columns: ["email"],
        unique: false,
        where: "active = true",
      };

      const sql = await tableService.generateCreateIndexSQL(
        indexDefinition,
        pgConnection,
      );

      expect(sql).toContain(
        "CREATE INDEX idx_users_active_email ON users (email) WHERE active = true",
      );
    });

    test("インデックスを削除する", async () => {
      const sql = await tableService.generateDropIndexSQL(
        "idx_users_email",
        mockConnection,
      );

      expect(sql).toContain("DROP INDEX idx_users_email");
    });
  });

  describe("テーブル削除", () => {
    test("テーブルを削除する", async () => {
      const sql = await tableService.generateDropTableSQL(
        "old_table",
        mockConnection,
      );

      expect(sql).toContain("DROP TABLE old_table");
    });

    test("存在チェック付きでテーブルを削除する", async () => {
      const sql = await tableService.generateDropTableSQL(
        "old_table",
        mockConnection,
        true,
      );

      expect(sql).toContain("DROP TABLE IF EXISTS old_table");
    });
  });

  describe("バリデーション", () => {
    test("無効なテーブル名を検証する", () => {
      expect(() => {
        tableService.validateTableName("123invalid");
      }).toThrow("Invalid table name");

      expect(() => {
        tableService.validateTableName("select");
      }).toThrow("Reserved keyword");
    });

    test("無効なカラム名を検証する", () => {
      expect(() => {
        tableService.validateColumnName("order");
      }).toThrow("Reserved keyword");

      expect(() => {
        tableService.validateColumnName("");
      }).toThrow("Column name cannot be empty");
    });

    test("データ型の互換性を検証する", () => {
      expect(() => {
        tableService.validateDataType("INVALID_TYPE", mockConnection);
      }).toThrow("Unsupported data type");
    });

    test("制約の整合性を検証する", () => {
      const invalidConstraint: ConstraintDefinition = {
        name: "fk_invalid",
        type: "FOREIGN_KEY",
        columns: ["user_id"],
        // referencedTable が未定義
      };

      expect(() => {
        tableService.validateConstraint(invalidConstraint);
      }).toThrow("Referenced table is required for foreign key constraint");
    });
  });

  describe("DDL実行", () => {
    test("テーブル作成DDLを実行する", async () => {
      const mockExecuteSql = vi.fn().mockResolvedValue({ success: true });
      vi.spyOn(tableService, "executeSQL").mockImplementation(mockExecuteSql);

      const tableDefinition: TableDefinition = {
        name: "test_table",
        schema: "public",
        columns: [
          {
            name: "id",
            dataType: "INTEGER",
            nullable: false,
            isPrimaryKey: true,
          },
        ],
      };

      const result = await tableService.createTable(
        tableDefinition,
        mockConnection,
      );

      expect(result.success).toBe(true);
      expect(mockExecuteSql).toHaveBeenCalledWith(
        expect.stringContaining("CREATE TABLE test_table"),
        mockConnection,
      );
    });

    test("テーブル変更DDLを実行する", async () => {
      const mockExecuteSql = vi.fn().mockResolvedValue({ success: true });
      vi.spyOn(tableService, "executeSQL").mockImplementation(mockExecuteSql);

      const columnDefinition: ColumnDefinition = {
        name: "new_column",
        dataType: "VARCHAR(50)",
        nullable: true,
      };

      const result = await tableService.addColumn(
        "test_table",
        columnDefinition,
        mockConnection,
      );

      expect(result.success).toBe(true);
      expect(mockExecuteSql).toHaveBeenCalledWith(
        expect.stringContaining("ALTER TABLE test_table ADD COLUMN"),
        mockConnection,
      );
    });

    test("DDL実行エラーを処理する", async () => {
      const mockExecuteSql = vi
        .fn()
        .mockRejectedValue(new Error("Table already exists"));
      vi.spyOn(tableService, "executeSQL").mockImplementation(mockExecuteSql);

      const tableDefinition: TableDefinition = {
        name: "existing_table",
        schema: "public",
        columns: [],
      };

      const result = await tableService.createTable(
        tableDefinition,
        mockConnection,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Table already exists");
    });
  });

  describe("データベース固有の機能", () => {
    test("MySQL用のAUTO_INCREMENTを処理する", async () => {
      const tableDefinition: TableDefinition = {
        name: "users",
        schema: "public",
        columns: [
          {
            name: "id",
            dataType: "INTEGER",
            nullable: false,
            isPrimaryKey: true,
            autoIncrement: true,
          },
        ],
      };

      const sql = await tableService.generateCreateTableSQL(
        tableDefinition,
        mockConnection,
      );

      expect(sql).toContain("AUTO_INCREMENT");
    });

    test("PostgreSQL用のSERIALを処理する", async () => {
      const pgConnection = { ...mockConnection, type: "postgresql" as const };
      const tableDefinition: TableDefinition = {
        name: "users",
        schema: "public",
        columns: [
          {
            name: "id",
            dataType: "SERIAL",
            nullable: false,
            isPrimaryKey: true,
          },
        ],
      };

      const sql = await tableService.generateCreateTableSQL(
        tableDefinition,
        pgConnection,
      );

      expect(sql).toContain("SERIAL");
      expect(sql).not.toContain("AUTO_INCREMENT");
    });

    test("SQLite用の制約を処理する", async () => {
      const sqliteConnection = { ...mockConnection, type: "sqlite" as const };
      const constraint: ConstraintDefinition = {
        name: "fk_posts_user",
        type: "FOREIGN_KEY",
        columns: ["user_id"],
        referencedTable: "users",
        referencedColumns: ["id"],
      };

      const sql = await tableService.generateAddConstraintSQL(
        "posts",
        constraint,
        sqliteConnection,
      );

      // SQLiteは制約の後付け追加に制限があることを考慮
      expect(sql).toBeDefined();
    });
  });

  describe("パフォーマンス", () => {
    test("大量のカラムを持つテーブルのSQL生成", async () => {
      const columns: ColumnDefinition[] = Array.from(
        { length: 100 },
        (_, i) => ({
          name: `column_${i}`,
          dataType: "VARCHAR(255)",
          nullable: true,
        }),
      );

      const tableDefinition: TableDefinition = {
        name: "large_table",
        schema: "public",
        columns,
      };

      const start = performance.now();
      const sql = await tableService.generateCreateTableSQL(
        tableDefinition,
        mockConnection,
      );
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100); // 100ms以内
      expect(sql).toContain("large_table");
      expect(sql.split("\n").length).toBeGreaterThan(100);
    });
  });
});
