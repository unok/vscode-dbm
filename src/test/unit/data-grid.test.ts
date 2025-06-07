import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataGridService } from "../../shared/services/DataGridService";
import type {
  ColumnDefinition,
  EditableCell,
  TableData,
} from "../../shared/types/datagrid";
import { UUIDGenerator } from "../../shared/utils/UUIDGenerator";

// Mock TanStack Table
vi.mock("@tanstack/react-table", () => ({
  useReactTable: vi.fn(),
  getCoreRowModel: vi.fn(),
  getSortedRowModel: vi.fn(),
  getFilteredRowModel: vi.fn(),
  getPaginationRowModel: vi.fn(),
  flexRender: vi.fn(),
}));

describe("DataGridService", () => {
  let dataGridService: DataGridService;
  let mockTableData: TableData;

  beforeEach(() => {
    dataGridService = new DataGridService();
    mockTableData = {
      tableName: "users",
      columns: [
        {
          id: "id",
          name: "id",
          type: "integer",
          nullable: false,
          isPrimaryKey: true,
          isAutoIncrement: true,
        },
        {
          id: "email",
          name: "email",
          type: "varchar(255)",
          nullable: false,
          isPrimaryKey: false,
          isAutoIncrement: false,
        },
        {
          id: "name",
          name: "name",
          type: "varchar(100)",
          nullable: true,
          isPrimaryKey: false,
          isAutoIncrement: false,
        },
        {
          id: "created_at",
          name: "created_at",
          type: "timestamp",
          nullable: false,
          isPrimaryKey: false,
          isAutoIncrement: false,
        },
      ],
      rows: [
        {
          id: 1,
          email: "john@example.com",
          name: "John Doe",
          created_at: "2023-01-01T10:00:00Z",
        },
        {
          id: 2,
          email: "jane@example.com",
          name: "Jane Smith",
          created_at: "2023-01-02T11:00:00Z",
        },
        {
          id: 3,
          email: "bob@example.com",
          name: null,
          created_at: "2023-01-03T12:00:00Z",
        },
      ],
      totalRows: 3,
      offset: 0,
      limit: 50,
    };
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Table Data Loading", () => {
    it("should load table data correctly", async () => {
      // Act
      const result = await dataGridService.loadTableData("users", {
        offset: 0,
        limit: 50,
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.tableName).toBe("users");
      expect(result.rows).toHaveLength(3);
      expect(result.columns).toHaveLength(4);
    });

    it("should handle pagination parameters", async () => {
      // Act
      const result = await dataGridService.loadTableData("users", {
        offset: 10,
        limit: 25,
      });

      // Assert
      expect(result.offset).toBe(10);
      expect(result.limit).toBe(25);
    });

    it("should handle empty tables", async () => {
      // Arrange
      const _emptyTableData: TableData = {
        ...mockTableData,
        rows: [],
        totalRows: 0,
      };

      // Act
      const result = await dataGridService.loadTableData("empty_table", {
        offset: 0,
        limit: 50,
      });

      // Assert
      expect(result.rows).toHaveLength(0);
      expect(result.totalRows).toBe(0);
    });

    it("should throw error for non-existent table", async () => {
      // Act & Assert
      await expect(
        dataGridService.loadTableData("non_existent", { offset: 0, limit: 50 }),
      ).rejects.toThrow('Table "non_existent" not found');
    });
  });

  describe("Column Definition Processing", () => {
    it("should process column definitions correctly", () => {
      // Act
      const columns = dataGridService.processColumnDefinitions(
        mockTableData.columns,
      );

      // Assert
      expect(columns).toHaveLength(4);
      expect(columns[0].id).toBe("id");
      expect(columns[0].header).toBe("id");
      expect(columns[0].meta?.isPrimaryKey).toBe(true);
      expect(columns[1].meta?.nullable).toBe(false);
      expect(columns[2].meta?.nullable).toBe(true);
    });

    it("should set appropriate cell types based on data type", () => {
      // Act
      const columns = dataGridService.processColumnDefinitions(
        mockTableData.columns,
      );

      // Assert
      expect(columns[0].meta?.cellType).toBe("number");
      expect(columns[1].meta?.cellType).toBe("text");
      expect(columns[3].meta?.cellType).toBe("datetime");
    });

    it("should handle primary key columns specially", () => {
      // Act
      const columns = dataGridService.processColumnDefinitions(
        mockTableData.columns,
      );
      const primaryKeyColumn = columns.find((col) => col.meta?.isPrimaryKey);

      // Assert
      expect(primaryKeyColumn).toBeDefined();
      expect(primaryKeyColumn?.meta?.editable).toBe(false);
    });
  });

  describe("Cell Editing", () => {
    it("should validate cell value types", () => {
      // Arrange
      const integerColumn: ColumnDefinition = {
        id: "age",
        name: "age",
        type: "integer",
        nullable: false,
        isPrimaryKey: false,
        isAutoIncrement: false,
      };

      // Act & Assert
      expect(dataGridService.validateCellValue("25", integerColumn)).toBe(true);
      expect(dataGridService.validateCellValue("abc", integerColumn)).toBe(
        false,
      );
      expect(dataGridService.validateCellValue("", integerColumn)).toBe(false);
    });

    it("should handle nullable columns correctly", () => {
      // Arrange
      const nullableColumn: ColumnDefinition = {
        id: "name",
        name: "name",
        type: "varchar(100)",
        nullable: true,
        isPrimaryKey: false,
        isAutoIncrement: false,
      };

      // Act & Assert
      expect(dataGridService.validateCellValue("", nullableColumn)).toBe(true);
      expect(dataGridService.validateCellValue(null, nullableColumn)).toBe(
        true,
      );
    });

    it("should create editable cell state", () => {
      // Arrange
      const _cell: EditableCell = {
        rowIndex: 0,
        columnId: "name",
        originalValue: "John Doe",
        editedValue: "John Updated",
        isDirty: true,
        isValid: true,
      };

      // Act
      const result = dataGridService.createEditableCell(0, "name", "John Doe");

      // Assert
      expect(result.rowIndex).toBe(0);
      expect(result.columnId).toBe("name");
      expect(result.originalValue).toBe("John Doe");
      expect(result.isDirty).toBe(false);
      expect(result.isValid).toBe(true);
    });

    it("should track dirty cells", () => {
      // Arrange
      dataGridService.setTableData(mockTableData);

      // Act
      dataGridService.updateCellValue(0, "name", "Updated Name");

      // Assert
      const dirtyCells = dataGridService.getDirtyCells();
      expect(dirtyCells).toHaveLength(1);
      expect(dirtyCells[0].columnId).toBe("name");
      expect(dirtyCells[0].editedValue).toBe("Updated Name");
    });

    it("should prevent editing of non-editable columns", () => {
      // Arrange
      dataGridService.setTableData(mockTableData);

      // Act & Assert
      expect(() => dataGridService.updateCellValue(0, "id", "999")).toThrow(
        'Column "id" is not editable',
      );
    });
  });

  describe("Row Operations", () => {
    it("should add new row with default values", () => {
      // Arrange
      dataGridService.setTableData(mockTableData);

      // Act
      const newRow = dataGridService.addNewRow();

      // Assert
      expect(newRow).toBeDefined();
      expect(newRow.id).toBeUndefined(); // Auto-increment should be empty
      expect(newRow.email).toBe("");
      expect(newRow.name).toBeNull(); // Nullable field
      expect(newRow.created_at).toBeTruthy(); // Should have default timestamp
    });

    it("should delete row and track for deletion", () => {
      // Arrange
      dataGridService.setTableData(mockTableData);

      // Act
      dataGridService.deleteRow(1);

      // Assert
      const deletedRows = dataGridService.getDeletedRows();
      expect(deletedRows).toHaveLength(1);
      expect(deletedRows[0].id).toBe(2); // Second row (index 1)
    });

    it("should duplicate existing row", () => {
      // Arrange
      dataGridService.setTableData(mockTableData);

      // Act
      const duplicatedRow = dataGridService.duplicateRow(0);

      // Assert
      expect(duplicatedRow.email).toBe("john@example.com");
      expect(duplicatedRow.name).toBe("John Doe");
      expect(duplicatedRow.id).toBeUndefined(); // Primary key should be cleared
    });
  });

  describe("Sorting and Filtering", () => {
    it("should apply sorting to data", () => {
      // Arrange
      dataGridService.setTableData(mockTableData);

      // Act
      const sortedData = dataGridService.applySorting([
        { id: "name", desc: false },
      ]);

      // Assert
      expect(sortedData[0].name).toBe("Jane Smith");
      expect(sortedData[1].name).toBe("John Doe");
      expect(sortedData[2].name).toBeNull();
    });

    it("should apply column filters", () => {
      // Arrange
      dataGridService.setTableData(mockTableData);

      // Act
      const filteredData = dataGridService.applyFilters([
        { id: "email", value: "john" },
      ]);

      // Assert
      expect(filteredData).toHaveLength(1);
      expect(filteredData[0].email).toBe("john@example.com");
    });

    it("should apply global search filter", () => {
      // Arrange
      dataGridService.setTableData(mockTableData);

      // Act
      const searchResults = dataGridService.applyGlobalFilter("Jane");

      // Assert
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].name).toBe("Jane Smith");
    });
  });

  describe("Data Persistence", () => {
    it("should generate SQL statements for changes", () => {
      // Arrange
      dataGridService.setTableData(mockTableData);
      dataGridService.updateCellValue(0, "name", "Updated John");
      dataGridService.deleteRow(1);
      dataGridService.addNewRow();

      // Act
      const sqlStatements = dataGridService.generateSQLStatements();

      // Assert
      expect(sqlStatements).toHaveLength(3);
      expect(sqlStatements[0]).toContain("UPDATE users SET");
      expect(sqlStatements[1]).toContain("DELETE FROM users WHERE");
      expect(sqlStatements[2]).toContain("INSERT INTO users");
    });

    it("should rollback all changes", () => {
      // Arrange
      dataGridService.setTableData(mockTableData);
      dataGridService.updateCellValue(0, "name", "Updated John");
      dataGridService.deleteRow(1);

      // Act
      dataGridService.rollbackChanges();

      // Assert
      expect(dataGridService.getDirtyCells()).toHaveLength(0);
      expect(dataGridService.getDeletedRows()).toHaveLength(0);
      expect(dataGridService.getAddedRows()).toHaveLength(0);
    });

    it("should commit changes and clear dirty state", async () => {
      // Arrange
      dataGridService.setTableData(mockTableData);
      dataGridService.updateCellValue(0, "name", "Updated John");

      // Act
      await dataGridService.commitChanges();

      // Assert
      expect(dataGridService.getDirtyCells()).toHaveLength(0);
    });
  });

  describe("Performance Optimization", () => {
    it("should handle large datasets efficiently", () => {
      // Arrange
      const largeDataset: TableData = {
        ...mockTableData,
        rows: Array.from({ length: 10000 }, (_, i) => ({
          id: i + 1,
          email: `user${i}@example.com`,
          name: `User ${i}`,
          created_at: new Date().toISOString(),
        })),
        totalRows: 10000,
      };

      // Act
      const startTime = performance.now();
      dataGridService.setTableData(largeDataset);
      const endTime = performance.now();

      // Assert
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });

    it("should virtualize rows for memory efficiency", () => {
      // Arrange
      const virtualizedData = dataGridService.getVirtualizedRows(
        mockTableData.rows,
        {
          startIndex: 0,
          endIndex: 2,
        },
      );

      // Assert
      expect(virtualizedData).toHaveLength(3);
    });
  });
});

describe("UUIDGenerator", () => {
  let uuidGenerator: UUIDGenerator;

  beforeEach(() => {
    uuidGenerator = new UUIDGenerator();
  });

  describe("UUID v4 Generation", () => {
    it("should generate valid UUID v4", () => {
      // Act
      const uuid = uuidGenerator.generateV4();

      // Assert
      expect(uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it("should generate unique UUIDs", () => {
      // Act
      const uuid1 = uuidGenerator.generateV4();
      const uuid2 = uuidGenerator.generateV4();

      // Assert
      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe("UUID v7 Generation", () => {
    it("should generate valid UUID v7 with timestamp ordering", () => {
      // Act
      const uuid1 = uuidGenerator.generateV7();
      const uuid2 = uuidGenerator.generateV7();

      // Assert
      expect(uuid1).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(uuid2).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(uuid1.localeCompare(uuid2)).toBeLessThan(0); // UUID v7 should be sortable by time
    });
  });

  describe("Default Value Generation", () => {
    it("should generate appropriate default values for column types", () => {
      // Arrange
      const stringColumn: ColumnDefinition = {
        id: "name",
        name: "name",
        type: "varchar(100)",
        nullable: false,
        isPrimaryKey: false,
        isAutoIncrement: false,
      };

      const uuidColumn: ColumnDefinition = {
        id: "uuid",
        name: "uuid",
        type: "uuid",
        nullable: false,
        isPrimaryKey: false,
        isAutoIncrement: false,
      };

      // Act
      const stringDefault = uuidGenerator.generateDefaultValue(stringColumn);
      const uuidDefault = uuidGenerator.generateDefaultValue(uuidColumn);

      // Assert
      expect(stringDefault).toBe("");
      expect(uuidDefault).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it("should generate current timestamp for datetime columns", () => {
      // Arrange
      const timestampColumn: ColumnDefinition = {
        id: "created_at",
        name: "created_at",
        type: "timestamp",
        nullable: false,
        isPrimaryKey: false,
        isAutoIncrement: false,
      };

      // Act
      const defaultValue = uuidGenerator.generateDefaultValue(timestampColumn);

      // Assert
      expect(new Date(defaultValue as string)).toBeInstanceOf(Date);
      expect(
        Math.abs(Date.now() - new Date(defaultValue as string).getTime()),
      ).toBeLessThan(1000);
    });
  });
});

describe("DataGrid React Component Integration", () => {
  it("should render table with correct structure", () => {
    // This will be implemented when we create the React component
    expect(true).toBe(true); // Placeholder
  });

  it("should handle cell editing interactions", () => {
    // This will be implemented when we create the React component
    expect(true).toBe(true); // Placeholder
  });

  it("should support keyboard navigation", () => {
    // This will be implemented when we create the React component
    expect(true).toBe(true); // Placeholder
  });

  it("should handle copy/paste operations", () => {
    // This will be implemented when we create the React component
    expect(true).toBe(true); // Placeholder
  });
});
