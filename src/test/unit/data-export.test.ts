import { beforeEach, describe, expect, test, vi } from "vitest"
import { DataExportService, type ExportResult } from "../../shared/services/DataExportService"
import type { TableData } from "../../shared/types/datagrid"
import type { ExportOptions } from "../../shared/types/sql"

describe("DataExportService", () => {
  let exportService: DataExportService
  let mockTableData: TableData

  beforeEach(() => {
    exportService = new DataExportService()
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
          id: "active",
          name: "active",
          type: "boolean",
          nullable: false,
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
          active: true,
          created_at: "2023-01-01T10:00:00Z",
        },
        {
          id: 2,
          email: "jane@example.com",
          name: "Jane Smith",
          active: false,
          created_at: "2023-01-02T11:00:00Z",
        },
        {
          id: 3,
          email: "bob@example.com",
          name: null,
          active: true,
          created_at: "2023-01-03T12:00:00Z",
        },
      ],
      totalRows: 3,
      offset: 0,
      limit: 100,
    }
  })

  describe("CSV Export", () => {
    test("should export to CSV with headers", async () => {
      const options: ExportOptions = {
        format: "csv",
        includeHeaders: true,
        delimiter: ",",
        quote: '"',
        fileName: "users_export",
      }

      const result = await exportService.exportData(mockTableData, options)

      expect(result.success).toBe(true)
      expect(result.format).toBe("csv")
      expect(result.fileName).toBe("users_export.csv")
      expect(result.rowsExported).toBe(3)

      const csvData = result.data as string
      const lines = csvData.split("\n")

      expect(lines[0]).toBe("id,email,name,active,created_at")
      expect(lines[1]).toBe("1,john@example.com,John Doe,true,2023-01-01T10:00:00Z")
      expect(lines[2]).toBe("2,jane@example.com,Jane Smith,false,2023-01-02T11:00:00Z")
      expect(lines[3]).toBe("3,bob@example.com,,true,2023-01-03T12:00:00Z")
    })

    test("should export to CSV without headers", async () => {
      const options: ExportOptions = {
        format: "csv",
        includeHeaders: false,
        delimiter: ",",
        quote: '"',
      }

      const result = await exportService.exportData(mockTableData, options)

      expect(result.success).toBe(true)

      const csvData = result.data as string
      const lines = csvData.split("\n")

      expect(lines[0]).toBe("1,john@example.com,John Doe,true,2023-01-01T10:00:00Z")
      expect(lines.length).toBe(3) // No header line
    })

    test("should handle custom CSV delimiter", async () => {
      const options: ExportOptions = {
        format: "csv",
        includeHeaders: true,
        delimiter: ";",
        quote: '"',
      }

      const result = await exportService.exportData(mockTableData, options)

      expect(result.success).toBe(true)

      const csvData = result.data as string
      const lines = csvData.split("\n")

      expect(lines[0]).toBe("id;email;name;active;created_at")
      expect(lines[1]).toBe("1;john@example.com;John Doe;true;2023-01-01T10:00:00Z")
    })

    test("should escape CSV values containing delimiter", async () => {
      const tableWithCommas: TableData = {
        ...mockTableData,
        rows: [
          {
            id: 1,
            email: "john@example.com",
            name: "Doe, John",
            active: true,
            created_at: "2023-01-01T10:00:00Z",
          },
        ],
      }

      const options: ExportOptions = {
        format: "csv",
        includeHeaders: false,
        delimiter: ",",
        quote: '"',
      }

      const result = await exportService.exportData(tableWithCommas, options)

      expect(result.success).toBe(true)

      const csvData = result.data as string
      expect(csvData).toContain('"Doe, John"')
    })

    test("should escape CSV values containing quotes", async () => {
      const tableWithQuotes: TableData = {
        ...mockTableData,
        rows: [
          {
            id: 1,
            email: "john@example.com",
            name: 'John "Johnny" Doe',
            active: true,
            created_at: "2023-01-01T10:00:00Z",
          },
        ],
      }

      const options: ExportOptions = {
        format: "csv",
        includeHeaders: false,
        delimiter: ",",
        quote: '"',
      }

      const result = await exportService.exportData(tableWithQuotes, options)

      expect(result.success).toBe(true)

      const csvData = result.data as string
      expect(csvData).toContain('"John ""Johnny"" Doe"')
    })
  })

  describe("JSON Export", () => {
    test("should export to JSON format", async () => {
      const options: ExportOptions = {
        format: "json",
        includeHeaders: true,
      }

      const result = await exportService.exportData(mockTableData, options)

      expect(result.success).toBe(true)
      expect(result.format).toBe("json")
      expect(result.fileName).toBe("users_export.json")

      const jsonData = JSON.parse(result.data as string)
      expect(Array.isArray(jsonData)).toBe(true)
      expect(jsonData).toHaveLength(3)
      expect(jsonData[0]).toEqual({
        id: 1,
        email: "john@example.com",
        name: "John Doe",
        active: true,
        created_at: "2023-01-01T10:00:00Z",
      })
      expect(jsonData[2].name).toBeNull() // Null value preserved
    })

    test("should handle empty data in JSON export", async () => {
      const emptyTableData: TableData = {
        ...mockTableData,
        rows: [],
      }

      const options: ExportOptions = {
        format: "json",
        includeHeaders: true,
      }

      const result = await exportService.exportData(emptyTableData, options)

      expect(result.success).toBe(true)
      expect(result.rowsExported).toBe(0)

      const jsonData = JSON.parse(result.data as string)
      expect(Array.isArray(jsonData)).toBe(true)
      expect(jsonData).toHaveLength(0)
    })
  })

  describe("SQL Export", () => {
    test("should export to SQL INSERT statements", async () => {
      const options: ExportOptions = {
        format: "sql",
        includeHeaders: false,
      }

      const result = await exportService.exportData(mockTableData, options)

      expect(result.success).toBe(true)
      expect(result.format).toBe("sql")
      expect(result.fileName).toBe("users_export.sql")

      const sqlData = result.data as string
      const statements = sqlData.split("\n").filter((line) => line.trim())

      expect(statements[0]).toBe(
        "INSERT INTO users (id, email, name, active, created_at) VALUES (1, 'john@example.com', 'John Doe', TRUE, '2023-01-01T10:00:00Z');"
      )
      expect(statements[1]).toBe(
        "INSERT INTO users (id, email, name, active, created_at) VALUES (2, 'jane@example.com', 'Jane Smith', FALSE, '2023-01-02T11:00:00Z');"
      )
      expect(statements[2]).toBe(
        "INSERT INTO users (id, email, name, active, created_at) VALUES (3, 'bob@example.com', NULL, TRUE, '2023-01-03T12:00:00Z');"
      )
    })

    test("should export to SQL with CREATE TABLE statement", async () => {
      const options: ExportOptions = {
        format: "sql",
        includeHeaders: true,
      }

      const result = await exportService.exportData(mockTableData, options)

      expect(result.success).toBe(true)

      const sqlData = result.data as string
      expect(sqlData).toContain("CREATE TABLE users")
      expect(sqlData).toContain("id integer NOT NULL PRIMARY KEY AUTO_INCREMENT")
      expect(sqlData).toContain("email varchar(255) NOT NULL")
      expect(sqlData).toContain("INSERT INTO users")
    })

    test("should escape SQL string values", async () => {
      const tableWithQuotes: TableData = {
        ...mockTableData,
        rows: [
          {
            id: 1,
            email: "john@example.com",
            name: "John's Data",
            active: true,
            created_at: "2023-01-01T10:00:00Z",
          },
        ],
      }

      const options: ExportOptions = {
        format: "sql",
        includeHeaders: false,
      }

      const result = await exportService.exportData(tableWithQuotes, options)

      expect(result.success).toBe(true)

      const sqlData = result.data as string
      expect(sqlData).toContain("'John''s Data'") // Escaped single quote
    })
  })

  describe("XML Export", () => {
    test("should export to XML format", async () => {
      const options: ExportOptions = {
        format: "xml",
        includeHeaders: true,
      }

      const result = await exportService.exportData(mockTableData, options)

      expect(result.success).toBe(true)
      expect(result.format).toBe("xml")
      expect(result.fileName).toBe("users_export.xml")

      const xmlData = result.data as string
      expect(xmlData).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(xmlData).toContain('<table name="users">')
      expect(xmlData).toContain("<schema>")
      expect(xmlData).toContain('<column name="id" type="integer" nullable="false" />')
      expect(xmlData).toContain("<data>")
      expect(xmlData).toContain("<row>")
      expect(xmlData).toContain("<id>1</id>")
      expect(xmlData).toContain("<email>john@example.com</email>")
    })

    test("should export to XML without schema", async () => {
      const options: ExportOptions = {
        format: "xml",
        includeHeaders: false,
      }

      const result = await exportService.exportData(mockTableData, options)

      expect(result.success).toBe(true)

      const xmlData = result.data as string
      expect(xmlData).not.toContain("<schema>")
      expect(xmlData).toContain("<data>")
    })

    test("should escape XML special characters", async () => {
      const tableWithXMLChars: TableData = {
        ...mockTableData,
        rows: [
          {
            id: 1,
            email: "john@example.com",
            name: "John & Jane <test>",
            active: true,
            created_at: "2023-01-01T10:00:00Z",
          },
        ],
      }

      const options: ExportOptions = {
        format: "xml",
        includeHeaders: false,
      }

      const result = await exportService.exportData(tableWithXMLChars, options)

      expect(result.success).toBe(true)

      const xmlData = result.data as string
      expect(xmlData).toContain("John &amp; Jane &lt;test&gt;")
    })
  })

  describe("Export Progress", () => {
    test("should report export progress for large datasets", async () => {
      const largeDataset: TableData = {
        ...mockTableData,
        rows: Array.from({ length: 2500 }, (_, i) => ({
          id: i + 1,
          email: `user${i}@example.com`,
          name: `User ${i}`,
          active: i % 2 === 0,
          created_at: "2023-01-01T10:00:00Z",
        })),
      }

      const options: ExportOptions = {
        format: "csv",
        includeHeaders: true,
      }

      const progressUpdates: any[] = []
      const onProgress = vi.fn((progress) => {
        progressUpdates.push(progress)
      })

      const result = await exportService.exportData(largeDataset, options, onProgress)

      expect(result.success).toBe(true)
      expect(result.rowsExported).toBe(2500)
      expect(onProgress).toHaveBeenCalled()
      expect(progressUpdates.length).toBeGreaterThan(0)
      expect(progressUpdates[progressUpdates.length - 1].percentage).toBeCloseTo(100, 0)
    })
  })

  describe("File Operations", () => {
    test("should calculate export size correctly", () => {
      const estimatedSize = exportService.estimateExportSize(mockTableData, "csv")

      expect(estimatedSize).toBeGreaterThan(0)
      expect(typeof estimatedSize).toBe("number")
    })

    test("should estimate different sizes for different formats", () => {
      const csvSize = exportService.estimateExportSize(mockTableData, "csv")
      const jsonSize = exportService.estimateExportSize(mockTableData, "json")
      const sqlSize = exportService.estimateExportSize(mockTableData, "sql")
      const xmlSize = exportService.estimateExportSize(mockTableData, "xml")

      expect(csvSize).toBeLessThan(jsonSize)
      expect(jsonSize).toBeLessThan(sqlSize)
      expect(sqlSize).toBeLessThan(xmlSize)
    })

    test("should provide download functionality", () => {
      // Mock DOM elements
      const mockLink = {
        href: "",
        download: "",
        click: vi.fn(),
      } as any

      const createElementSpy = vi.spyOn(document, "createElement").mockReturnValue(mockLink)
      const createObjectURLSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test-url")
      const revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})

      const result: ExportResult = {
        success: true,
        format: "csv",
        data: "test,data\n1,value",
        fileName: "test.csv",
        rowsExported: 1,
        size: 100,
      }

      exportService.downloadFile(result)

      expect(createElementSpy).toHaveBeenCalledWith("a")
      expect(createObjectURLSpy).toHaveBeenCalled()
      expect(mockLink.download).toBe("test.csv")
      expect(mockLink.click).toHaveBeenCalled()
      expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:test-url")

      createElementSpy.mockRestore()
      createObjectURLSpy.mockRestore()
      revokeObjectURLSpy.mockRestore()
    })
  })

  describe("Error Handling", () => {
    test("should handle unsupported export format", async () => {
      const options: ExportOptions = {
        format: "unsupported" as any,
        includeHeaders: true,
      }

      const result = await exportService.exportData(mockTableData, options)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Unsupported export format")
    })

    test("should handle empty table data", async () => {
      const emptyTableData: TableData = {
        tableName: "empty",
        columns: [],
        rows: [],
        totalRows: 0,
        offset: 0,
        limit: 100,
      }

      const options: ExportOptions = {
        format: "csv",
        includeHeaders: true,
      }

      const result = await exportService.exportData(emptyTableData, options)

      expect(result.success).toBe(true)
      expect(result.rowsExported).toBe(0)
      expect(result.data).toBe("") // Empty CSV
    })

    test("should handle large data without memory issues", async () => {
      const veryLargeDataset: TableData = {
        ...mockTableData,
        rows: Array.from({ length: 10000 }, (_, i) => ({
          id: i + 1,
          email: `user${i}@example.com`,
          name: `User ${i}`,
          active: i % 2 === 0,
          created_at: "2023-01-01T10:00:00Z",
        })),
      }

      const options: ExportOptions = {
        format: "json",
        includeHeaders: true,
      }

      const result = await exportService.exportData(veryLargeDataset, options)

      expect(result.success).toBe(true)
      expect(result.rowsExported).toBe(10000)
      expect(result.size).toBeGreaterThan(0)
    })
  })

  describe("Data Type Handling", () => {
    test("should handle various data types in export", async () => {
      const mixedDataTable: TableData = {
        tableName: "mixed_data",
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
            id: "price",
            name: "price",
            type: "decimal(10,2)",
            nullable: true,
            isPrimaryKey: false,
            isAutoIncrement: false,
          },
          {
            id: "is_valid",
            name: "is_valid",
            type: "boolean",
            nullable: false,
            isPrimaryKey: false,
            isAutoIncrement: false,
          },
          {
            id: "data",
            name: "data",
            type: "json",
            nullable: true,
            isPrimaryKey: false,
            isAutoIncrement: false,
          },
          {
            id: "created",
            name: "created",
            type: "datetime",
            nullable: false,
            isPrimaryKey: false,
            isAutoIncrement: false,
          },
        ],
        rows: [
          {
            id: 1,
            price: 99.99,
            is_valid: true,
            data: { key: "value" },
            created: new Date("2023-01-01T10:00:00Z"),
          },
          {
            id: 2,
            price: null,
            is_valid: false,
            data: null,
            created: new Date("2023-01-02T11:00:00Z"),
          },
        ],
        totalRows: 2,
        offset: 0,
        limit: 100,
      }

      const options: ExportOptions = {
        format: "json",
        includeHeaders: true,
      }

      const result = await exportService.exportData(mixedDataTable, options)

      expect(result.success).toBe(true)

      const jsonData = JSON.parse(result.data as string)
      expect(jsonData[0].price).toBe(99.99)
      expect(jsonData[0].is_valid).toBe(true)
      expect(jsonData[1].price).toBeNull()
      expect(jsonData[1].data).toBeNull()
    })
  })
})
