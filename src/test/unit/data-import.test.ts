import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  DataImportService,
  type ImportOptions,
} from "../../shared/services/DataImportService";
import type { TableData } from "../../shared/types/datagrid";

describe("DataImportService", () => {
  let importService: DataImportService;
  let mockTableData: TableData;

  beforeEach(() => {
    importService = new DataImportService();
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
      rows: [],
      totalRows: 0,
      offset: 0,
      limit: 100,
    };
  });

  describe("CSV Import", () => {
    test("should import simple CSV with headers", async () => {
      const csvContent = `email,name,created_at
john@example.com,John Doe,2023-01-01T10:00:00Z
jane@example.com,Jane Smith,2023-01-02T11:00:00Z`;

      const mockFile = new File([csvContent], "users.csv", {
        type: "text/csv",
      });
      const options: ImportOptions = {
        format: "csv",
        hasHeaders: true,
        delimiter: ",",
        quote: '"',
        onConflict: "ignore",
      };

      const result = await importService.importData(
        mockFile,
        options,
        mockTableData,
      );

      expect(result.success).toBe(true);
      expect(result.rowsImported).toBe(2);
      expect(result.rowsSkipped).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(result.data?.rows).toHaveLength(2);
      expect(result.data?.rows[0].email).toBe("john@example.com");
      expect(result.data?.rows[1].name).toBe("Jane Smith");
    });

    test("should import CSV without headers", async () => {
      const csvContent = `john@example.com,John Doe,2023-01-01T10:00:00Z
jane@example.com,Jane Smith,2023-01-02T11:00:00Z`;

      const mockFile = new File([csvContent], "users.csv", {
        type: "text/csv",
      });
      const options: ImportOptions = {
        format: "csv",
        hasHeaders: false,
        delimiter: ",",
        onConflict: "ignore",
      };

      const result = await importService.importData(
        mockFile,
        options,
        mockTableData,
      );

      expect(result.success).toBe(true);
      expect(result.rowsImported).toBe(2);
    });

    test("should handle CSV with custom delimiter", async () => {
      const csvContent = `email;name;created_at
john@example.com;John Doe;2023-01-01T10:00:00Z
jane@example.com;Jane Smith;2023-01-02T11:00:00Z`;

      const mockFile = new File([csvContent], "users.csv", {
        type: "text/csv",
      });
      const options: ImportOptions = {
        format: "csv",
        hasHeaders: true,
        delimiter: ";",
        onConflict: "ignore",
      };

      const result = await importService.importData(
        mockFile,
        options,
        mockTableData,
      );

      expect(result.success).toBe(true);
      expect(result.rowsImported).toBe(2);
      expect(result.data?.rows[0].email).toBe("john@example.com");
    });

    test("should handle quoted CSV values", async () => {
      const csvContent = `email,name,created_at
"john@example.com","John ""Johnny"" Doe","2023-01-01T10:00:00Z"
"jane@example.com","Jane, Smith","2023-01-02T11:00:00Z"`;

      const mockFile = new File([csvContent], "users.csv", {
        type: "text/csv",
      });
      const options: ImportOptions = {
        format: "csv",
        hasHeaders: true,
        delimiter: ",",
        quote: '"',
        onConflict: "ignore",
      };

      const result = await importService.importData(
        mockFile,
        options,
        mockTableData,
      );

      expect(result.success).toBe(true);
      expect(result.data?.rows[0].name).toBe('John "Johnny" Doe');
      expect(result.data?.rows[1].name).toBe("Jane, Smith");
    });

    test("should handle empty CSV file", async () => {
      const mockFile = new File([""], "empty.csv", { type: "text/csv" });
      const options: ImportOptions = {
        format: "csv",
        hasHeaders: true,
        onConflict: "ignore",
      };

      await expect(
        importService.importData(mockFile, options, mockTableData),
      ).rejects.toThrow("Empty CSV file");
    });
  });

  describe("JSON Import", () => {
    test("should import JSON array", async () => {
      const jsonContent = JSON.stringify([
        {
          email: "john@example.com",
          name: "John Doe",
          created_at: "2023-01-01T10:00:00Z",
        },
        {
          email: "jane@example.com",
          name: "Jane Smith",
          created_at: "2023-01-02T11:00:00Z",
        },
      ]);

      const mockFile = new File([jsonContent], "users.json", {
        type: "application/json",
      });
      const options: ImportOptions = {
        format: "json",
        hasHeaders: false,
        onConflict: "ignore",
      };

      const result = await importService.importData(
        mockFile,
        options,
        mockTableData,
      );

      expect(result.success).toBe(true);
      expect(result.rowsImported).toBe(2);
      expect(result.data?.rows[0].email).toBe("john@example.com");
    });

    test("should import single JSON object", async () => {
      const jsonContent = JSON.stringify({
        email: "john@example.com",
        name: "John Doe",
        created_at: "2023-01-01T10:00:00Z",
      });

      const mockFile = new File([jsonContent], "user.json", {
        type: "application/json",
      });
      const options: ImportOptions = {
        format: "json",
        hasHeaders: false,
        onConflict: "ignore",
      };

      const result = await importService.importData(
        mockFile,
        options,
        mockTableData,
      );

      expect(result.success).toBe(true);
      expect(result.rowsImported).toBe(1);
      expect(result.data?.rows[0].email).toBe("john@example.com");
    });

    test("should handle invalid JSON", async () => {
      const mockFile = new File(["{ invalid json"], "invalid.json", {
        type: "application/json",
      });
      const options: ImportOptions = {
        format: "json",
        hasHeaders: false,
        onConflict: "ignore",
      };

      await expect(
        importService.importData(mockFile, options, mockTableData),
      ).rejects.toThrow("Invalid JSON");
    });
  });

  describe("SQL Import", () => {
    test("should import SQL INSERT statements", async () => {
      const sqlContent = `INSERT INTO users (email, name, created_at) VALUES ('john@example.com', 'John Doe', '2023-01-01T10:00:00Z');
INSERT INTO users (email, name, created_at) VALUES ('jane@example.com', 'Jane Smith', '2023-01-02T11:00:00Z');`;

      const mockFile = new File([sqlContent], "users.sql", {
        type: "text/sql",
      });
      const options: ImportOptions = {
        format: "sql",
        hasHeaders: false,
        onConflict: "ignore",
      };

      const result = await importService.importData(
        mockFile,
        options,
        mockTableData,
      );

      expect(result.success).toBe(true);
      expect(result.rowsImported).toBe(2);
      expect(result.data?.rows[0].email).toBe("john@example.com");
    });

    test("should handle SQL with NULL values", async () => {
      const sqlContent = `INSERT INTO users (email, name, created_at) VALUES ('john@example.com', NULL, '2023-01-01T10:00:00Z');`;

      const mockFile = new File([sqlContent], "users.sql", {
        type: "text/sql",
      });
      const options: ImportOptions = {
        format: "sql",
        hasHeaders: false,
        onConflict: "ignore",
      };

      const result = await importService.importData(
        mockFile,
        options,
        mockTableData,
      );

      expect(result.success).toBe(true);
      expect(result.data?.rows[0].name).toBeNull();
    });

    test("should handle SQL with no INSERT statements", async () => {
      const sqlContent = `CREATE TABLE test (id INT);
SELECT * FROM users;`;

      const mockFile = new File([sqlContent], "no-inserts.sql", {
        type: "text/sql",
      });
      const options: ImportOptions = {
        format: "sql",
        hasHeaders: false,
        onConflict: "ignore",
      };

      await expect(
        importService.importData(mockFile, options, mockTableData),
      ).rejects.toThrow("No valid INSERT statements found");
    });
  });

  describe("Data Validation", () => {
    test("should validate data types", async () => {
      const csvContent = `email,name,created_at
invalid-email,John Doe,2023-01-01T10:00:00Z
jane@example.com,Jane Smith,invalid-date`;

      const tableWithValidation: TableData = {
        ...mockTableData,
        columns: [
          ...mockTableData.columns.slice(0, -1),
          {
            id: "created_at",
            name: "created_at",
            type: "timestamp",
            nullable: false,
            isPrimaryKey: false,
            isAutoIncrement: false,
          },
        ],
      };

      const mockFile = new File([csvContent], "users.csv", {
        type: "text/csv",
      });
      const options: ImportOptions = {
        format: "csv",
        hasHeaders: true,
        onConflict: "ignore",
      };

      const result = await importService.importData(
        mockFile,
        options,
        tableWithValidation,
      );

      expect(result.rowsSkipped).toBe(2); // Both rows have validation errors
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test("should handle nullable columns", async () => {
      const csvContent = `email,name,created_at
john@example.com,,2023-01-01T10:00:00Z`;

      const mockFile = new File([csvContent], "users.csv", {
        type: "text/csv",
      });
      const options: ImportOptions = {
        format: "csv",
        hasHeaders: true,
        onConflict: "ignore",
      };

      const result = await importService.importData(
        mockFile,
        options,
        mockTableData,
      );

      expect(result.success).toBe(true);
      expect(result.data?.rows[0].name).toBeNull();
    });

    test("should validate non-nullable columns", async () => {
      const csvContent = `email,name,created_at
,John Doe,2023-01-01T10:00:00Z`;

      const mockFile = new File([csvContent], "users.csv", {
        type: "text/csv",
      });
      const options: ImportOptions = {
        format: "csv",
        hasHeaders: true,
        onConflict: "ignore",
      };

      const result = await importService.importData(
        mockFile,
        options,
        mockTableData,
      );

      expect(result.rowsSkipped).toBe(1);
      expect(result.errors[0].message).toContain("Null value not allowed");
    });
  });

  describe("Preview Import", () => {
    test("should generate import preview", async () => {
      const csvContent = `email,name,created_at
john@example.com,John Doe,2023-01-01T10:00:00Z
jane@example.com,Jane Smith,2023-01-02T11:00:00Z`;

      const mockFile = new File([csvContent], "users.csv", {
        type: "text/csv",
      });
      const options: ImportOptions = {
        format: "csv",
        hasHeaders: true,
        onConflict: "ignore",
      };

      const preview = await importService.previewImport(
        mockFile,
        options,
        mockTableData,
      );

      expect(preview.columns).toEqual(["email", "name", "created_at"]);
      expect(preview.rows).toHaveLength(2);
      expect(preview.totalRows).toBe(2);
      expect(preview.estimatedImportTime).toBeGreaterThan(0);
      expect(preview.conflicts).toHaveLength(1); // Missing 'id' column
    });

    test("should detect column mismatches in preview", async () => {
      const csvContent = `email,full_name,birth_date
john@example.com,John Doe,1990-01-01`;

      const mockFile = new File([csvContent], "users.csv", {
        type: "text/csv",
      });
      const options: ImportOptions = {
        format: "csv",
        hasHeaders: true,
        onConflict: "ignore",
      };

      const preview = await importService.previewImport(
        mockFile,
        options,
        mockTableData,
      );

      expect(preview.conflicts.length).toBeGreaterThan(0);
      expect(preview.conflicts.some((c) => c.type === "column_mismatch")).toBe(
        true,
      );
    });
  });

  describe("Import Progress", () => {
    test("should report import progress", async () => {
      const csvContent = Array.from(
        { length: 150 },
        (_, i) => `user${i}@example.com,User ${i},2023-01-01T10:00:00Z`,
      ).join("\n");
      const csvWithHeaders = `email,name,created_at\n${csvContent}`;

      const mockFile = new File([csvWithHeaders], "large.csv", {
        type: "text/csv",
      });
      const options: ImportOptions = {
        format: "csv",
        hasHeaders: true,
        onConflict: "ignore",
      };

      const progressUpdates: number[] = [];
      const onProgress = vi.fn((progress: number) => {
        progressUpdates.push(progress);
      });

      const result = await importService.importData(
        mockFile,
        options,
        mockTableData,
        onProgress,
      );

      expect(result.success).toBe(true);
      expect(result.rowsImported).toBe(150);
      expect(onProgress).toHaveBeenCalled();
      expect(progressUpdates.length).toBeGreaterThan(0);
    });
  });

  describe("Conflict Resolution", () => {
    test("should handle ignore conflict resolution", async () => {
      const csvContent = `email,name,created_at
,John Doe,2023-01-01T10:00:00Z
jane@example.com,Jane Smith,2023-01-02T11:00:00Z`;

      const mockFile = new File([csvContent], "users.csv", {
        type: "text/csv",
      });
      const options: ImportOptions = {
        format: "csv",
        hasHeaders: true,
        onConflict: "ignore",
      };

      const result = await importService.importData(
        mockFile,
        options,
        mockTableData,
      );

      expect(result.rowsImported).toBe(1); // Only valid row imported
      expect(result.rowsSkipped).toBe(1); // Invalid row skipped
    });

    test("should handle replace conflict resolution", async () => {
      const csvContent = `email,name,created_at
,John Doe,2023-01-01T10:00:00Z
jane@example.com,Jane Smith,2023-01-02T11:00:00Z`;

      const mockFile = new File([csvContent], "users.csv", {
        type: "text/csv",
      });
      const options: ImportOptions = {
        format: "csv",
        hasHeaders: true,
        onConflict: "replace",
      };

      const result = await importService.importData(
        mockFile,
        options,
        mockTableData,
      );

      expect(result.rowsImported).toBe(2); // Both rows imported despite errors
      expect(result.errors.length).toBeGreaterThan(0); // But errors are recorded
    });
  });

  describe("Data Type Parsing", () => {
    test("should parse integer values", async () => {
      const csvContent = `id,count
1,100
2,200`;

      const tableData: TableData = {
        tableName: "stats",
        columns: [
          {
            id: "id",
            name: "id",
            type: "integer",
            nullable: false,
            isPrimaryKey: true,
            isAutoIncrement: false,
          },
          {
            id: "count",
            name: "count",
            type: "integer",
            nullable: false,
            isPrimaryKey: false,
            isAutoIncrement: false,
          },
        ],
        rows: [],
        totalRows: 0,
        offset: 0,
        limit: 100,
      };

      const mockFile = new File([csvContent], "stats.csv", {
        type: "text/csv",
      });
      const options: ImportOptions = {
        format: "csv",
        hasHeaders: true,
        onConflict: "ignore",
      };

      const result = await importService.importData(
        mockFile,
        options,
        tableData,
      );

      expect(result.success).toBe(true);
      expect(typeof result.data?.rows[0].id).toBe("number");
      expect(typeof result.data?.rows[0].count).toBe("number");
    });

    test("should parse boolean values", async () => {
      const csvContent = `name,active
John,true
Jane,false`;

      const tableData: TableData = {
        tableName: "users",
        columns: [
          {
            id: "name",
            name: "name",
            type: "varchar(100)",
            nullable: false,
            isPrimaryKey: false,
            isAutoIncrement: false,
          },
          {
            id: "active",
            name: "active",
            type: "boolean",
            nullable: false,
            isPrimaryKey: false,
            isAutoIncrement: false,
          },
        ],
        rows: [],
        totalRows: 0,
        offset: 0,
        limit: 100,
      };

      const mockFile = new File([csvContent], "users.csv", {
        type: "text/csv",
      });
      const options: ImportOptions = {
        format: "csv",
        hasHeaders: true,
        onConflict: "ignore",
      };

      const result = await importService.importData(
        mockFile,
        options,
        tableData,
      );

      expect(result.success).toBe(true);
      expect(result.data?.rows[0].active).toBe(true);
      expect(result.data?.rows[1].active).toBe(false);
    });
  });

  describe("Error Handling", () => {
    test("should handle file read errors", async () => {
      const mockFile = {
        text: vi.fn().mockRejectedValue(new Error("File read error")),
      } as unknown as File;

      const options: ImportOptions = {
        format: "csv",
        hasHeaders: true,
        onConflict: "ignore",
      };

      const result = await importService.importData(
        mockFile,
        options,
        mockTableData,
      );

      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain("File read error");
    });

    test("should handle unsupported format", async () => {
      const mockFile = new File(["test"], "test.txt", { type: "text/plain" });
      const options = {
        format: "unsupported",
        hasHeaders: true,
        onConflict: "ignore",
      } as ImportOptions;

      const result = await importService.importData(
        mockFile,
        options,
        mockTableData,
      );

      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain("Unsupported import format");
    });
  });
});
