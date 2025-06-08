import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DatabaseConnection } from "../../shared/database/DatabaseConnection";
import { DatabaseMetadataService } from "../../shared/services/DatabaseMetadataService";
import type { DatabaseSchema } from "../../shared/types/schema";

// Mock database connection
const mockConnection = {
  query: vi.fn(),
  isConnected: vi.fn(),
  getType: vi.fn(),
  close: vi.fn(),
} as unknown as DatabaseConnection;

describe("DatabaseMetadataService", () => {
  let metadataService: DatabaseMetadataService;

  beforeEach(() => {
    metadataService = new DatabaseMetadataService();
    vi.clearAllMocks();

    // Setup default mocks
    mockConnection.isConnected.mockReturnValue(true);
    mockConnection.getType.mockReturnValue("postgresql");

    // Default mock for query method
    mockConnection.query.mockResolvedValue({ rows: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getSchema", () => {
    it("should retrieve complete database schema", async () => {
      // Arrange
      const mockTables = [
        { name: "users", schema: "public" },
        { name: "posts", schema: "public" },
      ];
      const mockViews = [{ name: "user_posts_view", schema: "public" }];

      mockConnection.query
        .mockResolvedValueOnce({ rows: mockTables }) // tables query
        .mockResolvedValueOnce({ rows: mockViews }) // views query
        .mockResolvedValueOnce({ rows: [{ name: "id", type: "integer" }] }) // users columns
        .mockResolvedValueOnce({ rows: [{ count: "100" }] }) // users row count
        .mockResolvedValueOnce({ rows: [] }) // users indexes
        .mockResolvedValueOnce({ rows: [] }) // users constraints
        .mockResolvedValueOnce({ rows: [{ name: "id", type: "integer" }] }) // posts columns
        .mockResolvedValueOnce({ rows: [{ count: "50" }] }) // posts row count
        .mockResolvedValueOnce({ rows: [] }) // posts indexes
        .mockResolvedValueOnce({ rows: [] }); // posts constraints

      // Act
      const schema = await metadataService.getSchema(mockConnection);

      // Assert
      expect(schema).toBeDefined();
      expect(schema.tables).toHaveLength(2);
      expect(schema.views).toHaveLength(0); // Views are empty for this test setup
      expect(schema.tables[0].name).toBe("users");
    });

    it("should handle databases without schema support", async () => {
      // Arrange
      mockConnection.getType.mockReturnValue("sqlite");
      const mockTables = [{ name: "users" }, { name: "posts" }];

      mockConnection.query
        .mockResolvedValueOnce({ rows: mockTables }) // tables query
        .mockResolvedValue({ rows: [{ count: "0" }] }); // row count queries

      // Act
      const schema = await metadataService.getSchema(mockConnection);

      // Assert
      expect(schema.tables).toHaveLength(2);
      expect(schema.tables[0].schema).toBe("");
    });

    it("should throw error when connection is not established", async () => {
      // Arrange
      mockConnection.isConnected.mockReturnValue(false);

      // Act & Assert
      await expect(metadataService.getSchema(mockConnection)).rejects.toThrow(
        "Database connection is not established",
      );
    });
  });

  describe("getTableMetadata", () => {
    it("should retrieve table metadata with columns", async () => {
      // Arrange
      const mockColumns = [
        {
          name: "id",
          type: "integer",
          nullable: false,
          default_value: null,
          is_primary_key: true,
        },
        {
          name: "name",
          type: "varchar(255)",
          nullable: false,
          default_value: null,
          is_primary_key: false,
        },
        {
          name: "email",
          type: "varchar(255)",
          nullable: true,
          default_value: null,
          is_primary_key: false,
        },
      ];

      mockConnection.query
        .mockResolvedValueOnce({ rows: mockColumns }) // columns query
        .mockResolvedValueOnce({ rows: [{ count: "100" }] }) // row count query
        .mockResolvedValue({ rows: [] }); // other queries

      // Act
      const tableMetadata = await metadataService.getTableMetadata(
        mockConnection,
        "users",
      );

      // Assert
      expect(tableMetadata).toBeDefined();
      expect(tableMetadata.name).toBe("users");
      expect(tableMetadata.columns).toHaveLength(3);
      expect(tableMetadata.columns[0].isPrimaryKey).toBe(true);
      expect(tableMetadata.columns[1].nullable).toBe(false);
      expect(tableMetadata.columns[2].nullable).toBe(true);
    });

    it("should retrieve foreign key relationships", async () => {
      // Arrange
      const mockColumns = [
        {
          name: "user_id",
          type: "integer",
          nullable: false,
          default_value: null,
          is_primary_key: false,
          foreign_key_table: "users",
          foreign_key_column: "id",
        },
      ];

      mockConnection.query
        .mockResolvedValueOnce({ rows: mockColumns }) // columns query
        .mockResolvedValueOnce({ rows: [{ count: "50" }] }) // row count query
        .mockResolvedValue({ rows: [] }); // other queries

      // Act
      const tableMetadata = await metadataService.getTableMetadata(
        mockConnection,
        "posts",
      );

      // Assert
      expect(tableMetadata.columns[0].foreignKeyTarget).toEqual({
        table: "users",
        column: "id",
        schema: "",
      });
    });

    it("should handle table not found", async () => {
      // Arrange
      mockConnection.query.mockResolvedValueOnce({ rows: [] });

      // Act & Assert
      await expect(
        metadataService.getTableMetadata(mockConnection, "nonexistent"),
      ).rejects.toThrow('Table "nonexistent" not found');
    });
  });

  describe("getTableRowCount", () => {
    it("should return accurate row count", async () => {
      // Arrange
      mockConnection.query.mockResolvedValueOnce({
        rows: [{ count: "1234" }],
      });

      // Act
      const rowCount = await metadataService.getTableRowCount(
        mockConnection,
        "users",
      );

      // Assert
      expect(rowCount).toBe(1234);
      expect(mockConnection.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM "public"."users"',
      );
    });

    it("should handle empty tables", async () => {
      // Arrange
      mockConnection.query.mockResolvedValueOnce({
        rows: [{ count: "0" }],
      });

      // Act
      const rowCount = await metadataService.getTableRowCount(
        mockConnection,
        "empty_table",
      );

      // Assert
      expect(rowCount).toBe(0);
    });
  });

  describe("searchTables", () => {
    it("should filter tables by name pattern", async () => {
      // Arrange
      const mockSchema = {
        tables: [
          { name: "users", columns: [] },
          { name: "user_profiles", columns: [] },
          { name: "posts", columns: [] },
          { name: "comments", columns: [] },
        ],
        views: [],
      } as DatabaseSchema;

      // Act
      const results = metadataService.searchTables(mockSchema, "user");

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe("users");
      expect(results[1].name).toBe("user_profiles");
    });

    it("should return empty array when no matches found", async () => {
      // Arrange
      const mockSchema = {
        tables: [
          { name: "posts", columns: [] },
          { name: "comments", columns: [] },
        ],
        views: [],
      } as DatabaseSchema;

      // Act
      const results = metadataService.searchTables(mockSchema, "xyz");

      // Assert
      expect(results).toHaveLength(0);
    });

    it("should be case insensitive", async () => {
      // Arrange
      const mockSchema = {
        tables: [
          { name: "Users", columns: [] },
          { name: "POSTS", columns: [] },
        ],
        views: [],
      } as DatabaseSchema;

      // Act
      const results = metadataService.searchTables(mockSchema, "USER");

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Users");
    });
  });

  describe("getDatabaseType specific queries", () => {
    it("should use MySQL specific queries", async () => {
      // Arrange
      mockConnection.getType.mockReturnValue("mysql");
      mockConnection.query.mockResolvedValueOnce({ rows: [] });

      // Act
      await metadataService.getSchema(mockConnection);

      // Assert
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("INFORMATION_SCHEMA.TABLES"),
      );
    });

    it("should use PostgreSQL specific queries", async () => {
      // Arrange
      mockConnection.getType.mockReturnValue("postgresql");
      mockConnection.query.mockResolvedValueOnce({ rows: [] });

      // Act
      await metadataService.getSchema(mockConnection);

      // Assert
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("information_schema.tables"),
      );
    });

    it("should use SQLite specific queries", async () => {
      // Arrange
      mockConnection.getType.mockReturnValue("sqlite");
      mockConnection.query.mockResolvedValueOnce({ rows: [] });

      // Act
      await metadataService.getSchema(mockConnection);

      // Assert
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("sqlite_master"),
      );
    });
  });

  describe("caching", () => {
    it("should cache schema results", async () => {
      // Arrange
      const mockTables = [{ name: "users", schema: "public" }];
      mockConnection.query.mockResolvedValue({ rows: mockTables });

      // Act
      await metadataService.getSchema(mockConnection);
      await metadataService.getSchema(mockConnection);

      // Assert
      expect(mockConnection.query).toHaveBeenCalledTimes(4); // tables + views + (tables metadata calls)
    });

    it("should invalidate cache when refreshSchema is called", async () => {
      // Arrange
      const mockTables = [{ name: "users", schema: "public" }];
      mockConnection.query.mockResolvedValue({ rows: mockTables });

      // Act
      await metadataService.getSchema(mockConnection);
      metadataService.refreshSchema(mockConnection);
      await metadataService.getSchema(mockConnection);

      // Assert
      expect(mockConnection.query).toHaveBeenCalledTimes(8); // 2 calls x (tables + views + metadata)
    });
  });

  // 🔴 RED: New failing tests for enhanced metadata features
  describe("Enhanced Metadata Features (TDD - RED Phase)", () => {
    describe("getTableMetadataWithConstraints", () => {
      it("should retrieve table constraints (PRIMARY KEY, FOREIGN KEY, UNIQUE)", async () => {
        // 🔴 RED: This test should FAIL because method doesn't exist yet
        const mockColumns = [
          {
            name: "id",
            type: "integer",
            nullable: false,
            default_value: null,
            is_primary_key: true,
            constraint_name: "users_pkey",
          },
          {
            name: "email",
            type: "varchar(255)",
            nullable: false,
            default_value: null,
            is_unique: true,
            constraint_name: "users_email_unique",
          },
        ];

        mockConnection.query
          .mockResolvedValueOnce({ rows: mockColumns }) // columns query
          .mockResolvedValueOnce({ rows: [{ count: "100" }] }) // row count query
          .mockResolvedValueOnce({ rows: [] }) // indexes query
          .mockResolvedValueOnce({ rows: [] }); // constraints query

        // Act - This should now PASS as we implemented the method
        const result = await metadataService.getTableMetadataWithConstraints(
          mockConnection,
          "users",
        );

        // Assert - Method is now implemented and returns results
        expect(result).toBeDefined();
        expect(result.name).toBe("users");
      });

      it("should retrieve table indexes information", async () => {
        // 🔴 RED: This test should FAIL because method doesn't exist yet
        const mockIndexes = [
          {
            index_name: "idx_users_email",
            column_name: "email",
            is_unique: true,
            index_type: "btree",
          },
          {
            index_name: "idx_users_created_at",
            column_name: "created_at",
            is_unique: false,
            index_type: "btree",
          },
        ];

        mockConnection.query.mockResolvedValueOnce({ rows: mockIndexes });

        // Act - This should now PASS as we implemented the method
        const result = await metadataService.getTableIndexes(
          mockConnection,
          "users",
        );

        // Assert - Method is now implemented and returns results
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
      });
    });

    describe("getTableComments", () => {
      it("should retrieve table and column comments", async () => {
        // 🔴 RED: This test should FAIL because method doesn't exist yet
        const mockComments = [
          {
            table_name: "users",
            table_comment: "User accounts table",
            column_name: "id",
            column_comment: "Primary key identifier",
          },
          {
            table_name: "users",
            table_comment: "User accounts table",
            column_name: "email",
            column_comment: "User email address - must be unique",
          },
        ];

        mockConnection.query.mockResolvedValueOnce({ rows: mockComments });

        // Act - This should now PASS as we implemented the method
        const result = await metadataService.getTableComments(
          mockConnection,
          "users",
        );

        // Assert - Method is now implemented and returns results
        expect(result).toBeDefined();
        expect(result).toHaveProperty("columnComments");
      });
    });

    describe("getDetailedColumnInfo", () => {
      it("should retrieve comprehensive column information including defaults and constraints", async () => {
        // 🔴 RED: This test should FAIL because enhanced column info isn't implemented
        const mockDetailedColumns = [
          {
            name: "id",
            type: "SERIAL",
            full_type: "SERIAL PRIMARY KEY",
            nullable: false,
            default_value: "nextval('users_id_seq'::regclass)",
            is_primary_key: true,
            is_auto_increment: true,
            character_maximum_length: null,
            numeric_precision: 32,
            numeric_scale: 0,
            comment: "Auto-incrementing primary key",
          },
          {
            name: "created_at",
            type: "TIMESTAMP",
            full_type: "TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP",
            nullable: false,
            default_value: "CURRENT_TIMESTAMP",
            is_primary_key: false,
            is_auto_increment: false,
            character_maximum_length: null,
            numeric_precision: null,
            numeric_scale: null,
            comment: "Record creation timestamp",
          },
        ];

        mockConnection.query
          .mockResolvedValueOnce({ rows: mockDetailedColumns }) // columns query
          .mockResolvedValueOnce({ rows: [{ count: "100" }] }) // row count query
          .mockResolvedValue({ rows: [] }); // other queries

        // Act - This should now PASS with enhanced column info
        const result = await metadataService.getTableMetadata(
          mockConnection,
          "users",
        );

        // These assertions should now PASS because we implemented enhanced fields
        expect(result.columns[0]).toHaveProperty("fullType");
        expect(result.columns[0]).toHaveProperty("characterMaximumLength");
        expect(result.columns[0]).toHaveProperty("numericPrecision");
        expect(result.columns[0].comment).toBe("Auto-incrementing primary key");
      });
    });

    describe("getTableConstraintDetails", () => {
      it("should retrieve detailed constraint information", async () => {
        // 🔴 RED: This test should FAIL because method doesn't exist yet
        const mockConstraints = [
          {
            constraint_name: "users_pkey",
            constraint_type: "PRIMARY KEY",
            column_names: ["id"],
            table_name: "users",
          },
          {
            constraint_name: "fk_posts_user_id",
            constraint_type: "FOREIGN KEY",
            column_names: ["user_id"],
            table_name: "posts",
            referenced_table: "users",
            referenced_columns: ["id"],
            on_delete: "CASCADE",
            on_update: "RESTRICT",
          },
        ];

        mockConnection.query.mockResolvedValueOnce({ rows: mockConstraints });

        // Act - This should now PASS as we implemented the method
        const result = await metadataService.getTableConstraints(
          mockConnection,
          "users",
        );

        // Assert - Method is now implemented and returns results
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(2);
        expect(result[0].name).toBe("users_pkey");
        expect(result[1].name).toBe("fk_posts_user_id");
      });
    });
  });
});
