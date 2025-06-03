import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { DatabaseConnection } from "../../shared/database/DatabaseConnection"
import { DatabaseMetadataService } from "../../shared/services/DatabaseMetadataService"
import type { ColumnMetadata, DatabaseSchema, TableMetadata } from "../../shared/types/schema"

// Mock database connection
const mockConnection = {
  query: vi.fn(),
  isConnected: vi.fn(),
  getType: vi.fn(),
  close: vi.fn(),
} as unknown as DatabaseConnection

describe("DatabaseMetadataService", () => {
  let metadataService: DatabaseMetadataService

  beforeEach(() => {
    metadataService = new DatabaseMetadataService()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("getSchema", () => {
    it("should retrieve complete database schema", async () => {
      // Arrange
      const mockTables = [
        { name: "users", schema: "public" },
        { name: "posts", schema: "public" },
      ]
      const mockViews = [{ name: "user_posts_view", schema: "public" }]

      mockConnection.query
        .mockResolvedValueOnce({ rows: mockTables }) // tables query
        .mockResolvedValueOnce({ rows: mockViews }) // views query

      // Act
      const schema = await metadataService.getSchema(mockConnection)

      // Assert
      expect(schema).toBeDefined()
      expect(schema.tables).toHaveLength(2)
      expect(schema.views).toHaveLength(1)
      expect(schema.tables[0].name).toBe("users")
      expect(schema.views[0].name).toBe("user_posts_view")
    })

    it("should handle databases without schema support", async () => {
      // Arrange
      mockConnection.getType.mockReturnValue("sqlite")
      const mockTables = [{ name: "users" }, { name: "posts" }]

      mockConnection.query.mockResolvedValueOnce({ rows: mockTables })

      // Act
      const schema = await metadataService.getSchema(mockConnection)

      // Assert
      expect(schema.tables).toHaveLength(2)
      expect(schema.tables[0].schema).toBeUndefined()
    })

    it("should throw error when connection is not established", async () => {
      // Arrange
      mockConnection.isConnected.mockReturnValue(false)

      // Act & Assert
      await expect(metadataService.getSchema(mockConnection)).rejects.toThrow(
        "Database connection is not established"
      )
    })
  })

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
      ]

      mockConnection.query.mockResolvedValueOnce({ rows: mockColumns })

      // Act
      const tableMetadata = await metadataService.getTableMetadata(mockConnection, "users")

      // Assert
      expect(tableMetadata).toBeDefined()
      expect(tableMetadata.name).toBe("users")
      expect(tableMetadata.columns).toHaveLength(3)
      expect(tableMetadata.columns[0].isPrimaryKey).toBe(true)
      expect(tableMetadata.columns[1].nullable).toBe(false)
      expect(tableMetadata.columns[2].nullable).toBe(true)
    })

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
      ]

      mockConnection.query.mockResolvedValueOnce({ rows: mockColumns })

      // Act
      const tableMetadata = await metadataService.getTableMetadata(mockConnection, "posts")

      // Assert
      expect(tableMetadata.columns[0].foreignKeyTarget).toEqual({
        table: "users",
        column: "id",
      })
    })

    it("should handle table not found", async () => {
      // Arrange
      mockConnection.query.mockResolvedValueOnce({ rows: [] })

      // Act & Assert
      await expect(metadataService.getTableMetadata(mockConnection, "nonexistent")).rejects.toThrow(
        'Table "nonexistent" not found'
      )
    })
  })

  describe("getTableRowCount", () => {
    it("should return accurate row count", async () => {
      // Arrange
      mockConnection.query.mockResolvedValueOnce({
        rows: [{ count: "1234" }],
      })

      // Act
      const rowCount = await metadataService.getTableRowCount(mockConnection, "users")

      // Assert
      expect(rowCount).toBe(1234)
      expect(mockConnection.query).toHaveBeenCalledWith('SELECT COUNT(*) as count FROM "users"')
    })

    it("should handle empty tables", async () => {
      // Arrange
      mockConnection.query.mockResolvedValueOnce({
        rows: [{ count: "0" }],
      })

      // Act
      const rowCount = await metadataService.getTableRowCount(mockConnection, "empty_table")

      // Assert
      expect(rowCount).toBe(0)
    })
  })

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
      } as DatabaseSchema

      // Act
      const results = metadataService.searchTables(mockSchema, "user")

      // Assert
      expect(results).toHaveLength(2)
      expect(results[0].name).toBe("users")
      expect(results[1].name).toBe("user_profiles")
    })

    it("should return empty array when no matches found", async () => {
      // Arrange
      const mockSchema = {
        tables: [
          { name: "posts", columns: [] },
          { name: "comments", columns: [] },
        ],
        views: [],
      } as DatabaseSchema

      // Act
      const results = metadataService.searchTables(mockSchema, "xyz")

      // Assert
      expect(results).toHaveLength(0)
    })

    it("should be case insensitive", async () => {
      // Arrange
      const mockSchema = {
        tables: [
          { name: "Users", columns: [] },
          { name: "POSTS", columns: [] },
        ],
        views: [],
      } as DatabaseSchema

      // Act
      const results = metadataService.searchTables(mockSchema, "USER")

      // Assert
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe("Users")
    })
  })

  describe("getDatabaseType specific queries", () => {
    it("should use MySQL specific queries", async () => {
      // Arrange
      mockConnection.getType.mockReturnValue("mysql")
      mockConnection.query.mockResolvedValueOnce({ rows: [] })

      // Act
      await metadataService.getSchema(mockConnection)

      // Assert
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("INFORMATION_SCHEMA.TABLES")
      )
    })

    it("should use PostgreSQL specific queries", async () => {
      // Arrange
      mockConnection.getType.mockReturnValue("postgresql")
      mockConnection.query.mockResolvedValueOnce({ rows: [] })

      // Act
      await metadataService.getSchema(mockConnection)

      // Assert
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("information_schema.tables")
      )
    })

    it("should use SQLite specific queries", async () => {
      // Arrange
      mockConnection.getType.mockReturnValue("sqlite")
      mockConnection.query.mockResolvedValueOnce({ rows: [] })

      // Act
      await metadataService.getSchema(mockConnection)

      // Assert
      expect(mockConnection.query).toHaveBeenCalledWith(expect.stringContaining("sqlite_master"))
    })
  })

  describe("caching", () => {
    it("should cache schema results", async () => {
      // Arrange
      const mockTables = [{ name: "users", schema: "public" }]
      mockConnection.query.mockResolvedValue({ rows: mockTables })

      // Act
      await metadataService.getSchema(mockConnection)
      await metadataService.getSchema(mockConnection)

      // Assert
      expect(mockConnection.query).toHaveBeenCalledTimes(2) // tables + views
    })

    it("should invalidate cache when refreshSchema is called", async () => {
      // Arrange
      const mockTables = [{ name: "users", schema: "public" }]
      mockConnection.query.mockResolvedValue({ rows: mockTables })

      // Act
      await metadataService.getSchema(mockConnection)
      metadataService.refreshSchema(mockConnection)
      await metadataService.getSchema(mockConnection)

      // Assert
      expect(mockConnection.query).toHaveBeenCalledTimes(4) // 2 calls x (tables + views)
    })
  })
})
