import { beforeEach, describe, expect, test, vi } from "vitest"
import { AdvancedDataGridService } from "../../shared/services/AdvancedDataGridService"
import type {
  BulkEditOperation,
  CellValue,
  ChangeRecord,
  ColumnDefinition,
  CopyPasteData,
  CursorAIDefaultOptions,
  TableData,
  ValidationResult,
  VirtualScrollConfig,
} from "../../shared/types/datagrid"
import { CellValidationEngine } from "../../shared/utils/CellValidationEngine"
import { CursorAIIntegration } from "../../shared/utils/CursorAIIntegration"
import { DataChangeTracker } from "../../shared/utils/DataChangeTracker"
import { VirtualScrollManager } from "../../shared/utils/VirtualScrollManager"

describe("AdvancedDataGridService", () => {
  let advancedDataGrid: AdvancedDataGridService
  let mockTableData: TableData

  beforeEach(() => {
    mockTableData = {
      tableName: "test_table",
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
          id: "age",
          name: "age",
          type: "integer",
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
          defaultValue: "CURRENT_TIMESTAMP",
        },
      ],
      rows: [
        {
          id: 1,
          email: "john@example.com",
          name: "John Doe",
          age: 30,
          created_at: "2023-01-01T10:00:00Z",
        },
        {
          id: 2,
          email: "jane@example.com",
          name: "Jane Smith",
          age: 25,
          created_at: "2023-01-02T11:00:00Z",
        },
        {
          id: 3,
          email: "bob@example.com",
          name: "Bob Johnson",
          age: 35,
          created_at: "2023-01-03T12:00:00Z",
        },
      ],
      totalRows: 3,
      offset: 0,
      limit: 50,
    }

    advancedDataGrid = new AdvancedDataGridService(mockTableData)
  })

  describe("Advanced Inline Editing", () => {
    test("should enable inline editing for editable cells", () => {
      const result = advancedDataGrid.startCellEdit(0, "email")

      expect(result.success).toBe(true)
      expect(result.cellState).toBeDefined()
      expect(result.cellState?.isEditing).toBe(true)
      expect(result.cellState?.originalValue).toBe("john@example.com")
    })

    test("should prevent editing of primary key columns", () => {
      const result = advancedDataGrid.startCellEdit(0, "id")

      expect(result.success).toBe(false)
      expect(result.error).toContain("Primary key columns cannot be edited")
    })

    test("should prevent editing of auto-increment columns", () => {
      const result = advancedDataGrid.startCellEdit(0, "id")

      expect(result.success).toBe(false)
      expect(result.error).toContain("Auto-increment columns cannot be edited")
    })

    test("should validate cell values during editing", async () => {
      advancedDataGrid.startCellEdit(0, "email")

      const validationResult = await advancedDataGrid.validateCellValue(0, "email", "invalid-email")

      expect(validationResult.isValid).toBe(false)
      expect(validationResult.errors).toContain("Invalid email format")
    })

    test("should support real-time validation", async () => {
      advancedDataGrid.startCellEdit(0, "email")

      const validationSpy = vi.fn()
      advancedDataGrid.onValidationChange(validationSpy)

      await advancedDataGrid.updateCellValue(0, "email", "test@")

      expect(validationSpy).toHaveBeenCalledWith({
        rowIndex: 0,
        columnId: "email",
        value: "test@",
        isValid: false,
        errors: ["Invalid email format"],
      })
    })

    test("should commit valid cell changes", async () => {
      advancedDataGrid.startCellEdit(0, "email")

      const result = await advancedDataGrid.commitCellEdit(0, "email", "newemail@example.com")

      expect(result.success).toBe(true)
      expect(advancedDataGrid.getCellValue(0, "email")).toBe("newemail@example.com")
    })

    test("should reject invalid cell changes", async () => {
      advancedDataGrid.startCellEdit(0, "email")

      const result = await advancedDataGrid.commitCellEdit(0, "email", "invalid-email")

      expect(result.success).toBe(false)
      expect(result.validationErrors).toContain("Invalid email format")
      expect(advancedDataGrid.getCellValue(0, "email")).toBe("john@example.com") // Original value
    })

    test("should support canceling cell edits", () => {
      advancedDataGrid.startCellEdit(0, "email")
      advancedDataGrid.updateCellValue(0, "email", "temp@example.com")

      const result = advancedDataGrid.cancelCellEdit(0, "email")

      expect(result.success).toBe(true)
      expect(advancedDataGrid.getCellValue(0, "email")).toBe("john@example.com") // Original value
    })

    test("should handle concurrent cell editing", () => {
      const result1 = advancedDataGrid.startCellEdit(0, "email")
      const result2 = advancedDataGrid.startCellEdit(1, "name")

      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)
      expect(advancedDataGrid.getActiveCellEdits()).toHaveLength(2)
    })

    test("should prevent editing same cell multiple times", () => {
      advancedDataGrid.startCellEdit(0, "email")
      const result = advancedDataGrid.startCellEdit(0, "email")

      expect(result.success).toBe(false)
      expect(result.error).toContain("Cell is already being edited")
    })
  })

  describe("Data Change Tracking", () => {
    test("should track cell value changes", async () => {
      advancedDataGrid.startCellEdit(0, "email")
      await advancedDataGrid.commitCellEdit(0, "email", "newemail@example.com")

      const changes = advancedDataGrid.getChangeRecord()

      expect(changes.modifiedCells).toHaveLength(1)
      expect(changes.modifiedCells[0]).toEqual({
        rowIndex: 0,
        columnId: "email",
        originalValue: "john@example.com",
        newValue: "newemail@example.com",
        timestamp: expect.any(Date),
      })
    })

    test("should track multiple changes in same row", async () => {
      advancedDataGrid.startCellEdit(0, "email")
      await advancedDataGrid.commitCellEdit(0, "email", "newemail@example.com")

      advancedDataGrid.startCellEdit(0, "name")
      await advancedDataGrid.commitCellEdit(0, "name", "John Updated")

      const changes = advancedDataGrid.getChangeRecord()

      expect(changes.modifiedCells).toHaveLength(2)
      expect(changes.affectedRows.has(0)).toBe(true)
    })

    test("should track row additions", () => {
      const newRow = advancedDataGrid.addNewRow()
      const changes = advancedDataGrid.getChangeRecord()

      expect(changes.addedRows).toHaveLength(1)
      expect(changes.addedRows[0].tempId).toBeDefined()
      expect(changes.addedRows[0].data).toEqual(newRow)
    })

    test("should track row deletions", () => {
      advancedDataGrid.deleteRow(1)
      const changes = advancedDataGrid.getChangeRecord()

      expect(changes.deletedRows).toHaveLength(1)
      expect(changes.deletedRows[0].originalIndex).toBe(1)
      expect(changes.deletedRows[0].data.email).toBe("jane@example.com")
    })

    test("should calculate change statistics", async () => {
      // Make some changes
      advancedDataGrid.startCellEdit(0, "email")
      await advancedDataGrid.commitCellEdit(0, "email", "new@example.com")
      advancedDataGrid.addNewRow()
      advancedDataGrid.deleteRow(2)

      const stats = advancedDataGrid.getChangeStatistics()

      expect(stats.totalChanges).toBe(3)
      expect(stats.modifiedCells).toBe(1)
      expect(stats.addedRows).toBe(1)
      expect(stats.deletedRows).toBe(1)
      expect(stats.affectedRows).toBe(3)
    })

    test("should provide change rollback functionality", async () => {
      const originalData = advancedDataGrid.getTableData()

      // Make changes
      advancedDataGrid.startCellEdit(0, "email")
      await advancedDataGrid.commitCellEdit(0, "email", "new@example.com")
      advancedDataGrid.addNewRow()

      // Rollback
      advancedDataGrid.rollbackChanges()

      const currentData = advancedDataGrid.getTableData()
      expect(currentData).toEqual(originalData)
      expect(advancedDataGrid.getChangeRecord().totalChanges).toBe(0)
    })

    test("should support partial rollback", async () => {
      advancedDataGrid.startCellEdit(0, "email")
      await advancedDataGrid.commitCellEdit(0, "email", "new@example.com")

      advancedDataGrid.startCellEdit(1, "name")
      await advancedDataGrid.commitCellEdit(1, "name", "Jane Updated")

      // Rollback specific change
      advancedDataGrid.rollbackCellChange(0, "email")

      expect(advancedDataGrid.getCellValue(0, "email")).toBe("john@example.com")
      expect(advancedDataGrid.getCellValue(1, "name")).toBe("Jane Updated")
    })
  })

  describe("Visual Change Indicators", () => {
    test("should mark modified cells", async () => {
      advancedDataGrid.startCellEdit(0, "email")
      await advancedDataGrid.commitCellEdit(0, "email", "new@example.com")

      const cellState = advancedDataGrid.getCellState(0, "email")

      expect(cellState.isDirty).toBe(true)
      expect(cellState.changeType).toBe("modified")
      expect(cellState.visualIndicator).toBe("dirty-cell")
    })

    test("should mark new rows", () => {
      const newRowIndex = advancedDataGrid.addNewRow()
      const rowState = advancedDataGrid.getRowState(newRowIndex)

      expect(rowState.isNew).toBe(true)
      expect(rowState.visualIndicator).toBe("new-row")
    })

    test("should mark deleted rows", () => {
      advancedDataGrid.deleteRow(1)
      const rowState = advancedDataGrid.getRowState(1)

      expect(rowState.isDeleted).toBe(true)
      expect(rowState.visualIndicator).toBe("deleted-row")
    })

    test("should support custom visual indicators", async () => {
      advancedDataGrid.setCustomIndicator(0, "email", "warning", "This field needs attention")

      const cellState = advancedDataGrid.getCellState(0, "email")

      expect(cellState.customIndicator).toBe("warning")
      expect(cellState.customMessage).toBe("This field needs attention")
    })

    test("should clear indicators on rollback", async () => {
      advancedDataGrid.startCellEdit(0, "email")
      await advancedDataGrid.commitCellEdit(0, "email", "new@example.com")

      advancedDataGrid.rollbackCellChange(0, "email")

      const cellState = advancedDataGrid.getCellState(0, "email")
      expect(cellState.isDirty).toBe(false)
      expect(cellState.visualIndicator).toBeUndefined()
    })
  })

  describe("Bulk Edit Operations", () => {
    test("should perform bulk update on selected cells", async () => {
      const bulkOperation: BulkEditOperation = {
        type: "update",
        columnId: "age",
        value: 40,
        rowIndices: [0, 1, 2],
      }

      const result = await advancedDataGrid.executeBulkOperation(bulkOperation)

      expect(result.success).toBe(true)
      expect(result.affectedRows).toBe(3)
      expect(advancedDataGrid.getCellValue(0, "age")).toBe(40)
      expect(advancedDataGrid.getCellValue(1, "age")).toBe(40)
      expect(advancedDataGrid.getCellValue(2, "age")).toBe(40)
    })

    test("should perform bulk delete on selected rows", async () => {
      const bulkOperation: BulkEditOperation = {
        type: "delete",
        rowIndices: [0, 2],
      }

      const result = await advancedDataGrid.executeBulkOperation(bulkOperation)

      expect(result.success).toBe(true)
      expect(result.affectedRows).toBe(2)

      const changes = advancedDataGrid.getChangeRecord()
      expect(changes.deletedRows).toHaveLength(2)
    })

    test("should validate bulk operations", async () => {
      const bulkOperation: BulkEditOperation = {
        type: "update",
        columnId: "email",
        value: "invalid-email",
        rowIndices: [0, 1],
      }

      const result = await advancedDataGrid.executeBulkOperation(bulkOperation)

      expect(result.success).toBe(false)
      expect(result.validationErrors).toContain("Invalid email format")
      expect(result.affectedRows).toBe(0)
    })

    test("should support conditional bulk operations", async () => {
      const bulkOperation: BulkEditOperation = {
        type: "update",
        columnId: "name",
        value: "Senior Member",
        rowIndices: [0, 1, 2],
        condition: (row) => (row.age as number) >= 30,
      }

      const result = await advancedDataGrid.executeBulkOperation(bulkOperation)

      expect(result.success).toBe(true)
      expect(result.affectedRows).toBe(2) // Only rows where age >= 30
      expect(advancedDataGrid.getCellValue(0, "name")).toBe("Senior Member") // age 30
      expect(advancedDataGrid.getCellValue(1, "name")).toBe("Jane Smith") // age 25, unchanged
      expect(advancedDataGrid.getCellValue(2, "name")).toBe("Senior Member") // age 35
    })

    test("should support bulk operations with custom functions", async () => {
      const bulkOperation: BulkEditOperation = {
        type: "update",
        columnId: "age",
        valueFunction: (row, _index) => (row.age as number) + 1,
        rowIndices: [0, 1, 2],
      }

      const result = await advancedDataGrid.executeBulkOperation(bulkOperation)

      expect(result.success).toBe(true)
      expect(advancedDataGrid.getCellValue(0, "age")).toBe(31) // 30 + 1
      expect(advancedDataGrid.getCellValue(1, "age")).toBe(26) // 25 + 1
      expect(advancedDataGrid.getCellValue(2, "age")).toBe(36) // 35 + 1
    })

    test("should provide bulk operation preview", () => {
      const bulkOperation: BulkEditOperation = {
        type: "update",
        columnId: "age",
        value: 50,
        rowIndices: [0, 1],
      }

      const preview = advancedDataGrid.previewBulkOperation(bulkOperation)

      expect(preview.willAffect).toBe(2)
      expect(preview.changes).toHaveLength(2)
      expect(preview.changes[0]).toEqual({
        rowIndex: 0,
        columnId: "age",
        currentValue: 30,
        newValue: 50,
      })
    })
  })

  describe("Copy and Paste Functionality", () => {
    test("should copy single cell", () => {
      const copyData = advancedDataGrid.copyCells([{ rowIndex: 0, columnId: "email" }])

      expect(copyData.type).toBe("single-cell")
      expect(copyData.data).toEqual([["john@example.com"]])
      expect(copyData.metadata.columns).toEqual(["email"])
      expect(copyData.metadata.rows).toBe(1)
    })

    test("should copy multiple cells", () => {
      const cellRefs = [
        { rowIndex: 0, columnId: "email" },
        { rowIndex: 0, columnId: "name" },
        { rowIndex: 1, columnId: "email" },
        { rowIndex: 1, columnId: "name" },
      ]

      const copyData = advancedDataGrid.copyCells(cellRefs)

      expect(copyData.type).toBe("range")
      expect(copyData.data).toEqual([
        ["john@example.com", "John Doe"],
        ["jane@example.com", "Jane Smith"],
      ])
    })

    test("should copy entire rows", () => {
      const copyData = advancedDataGrid.copyRows([0, 1])

      expect(copyData.type).toBe("rows")
      expect(copyData.data).toHaveLength(2)
      expect(copyData.data[0]).toEqual([
        1,
        "john@example.com",
        "John Doe",
        30,
        "2023-01-01T10:00:00Z",
      ])
    })

    test("should paste single cell", async () => {
      const copyData: CopyPasteData = {
        type: "single-cell",
        data: [["newemail@example.com"]],
        metadata: { columns: ["email"], rows: 1 },
      }

      const result = await advancedDataGrid.pasteCells(copyData, { rowIndex: 1, columnId: "email" })

      expect(result.success).toBe(true)
      expect(result.affectedCells).toBe(1)
      expect(advancedDataGrid.getCellValue(1, "email")).toBe("newemail@example.com")
    })

    test("should paste range with auto-expansion", async () => {
      const copyData: CopyPasteData = {
        type: "range",
        data: [
          ["new1@example.com", "New Name 1"],
          ["new2@example.com", "New Name 2"],
        ],
        metadata: { columns: ["email", "name"], rows: 2 },
      }

      const result = await advancedDataGrid.pasteCells(copyData, { rowIndex: 1, columnId: "email" })

      expect(result.success).toBe(true)
      expect(result.affectedCells).toBe(4)
      expect(advancedDataGrid.getCellValue(1, "email")).toBe("new1@example.com")
      expect(advancedDataGrid.getCellValue(1, "name")).toBe("New Name 1")
      expect(advancedDataGrid.getCellValue(2, "email")).toBe("new2@example.com")
      expect(advancedDataGrid.getCellValue(2, "name")).toBe("New Name 2")
    })

    test("should validate pasted data", async () => {
      const copyData: CopyPasteData = {
        type: "single-cell",
        data: [["invalid-email"]],
        metadata: { columns: ["email"], rows: 1 },
      }

      const result = await advancedDataGrid.pasteCells(copyData, { rowIndex: 0, columnId: "email" })

      expect(result.success).toBe(false)
      expect(result.validationErrors).toContain("Invalid email format")
      expect(result.affectedCells).toBe(0)
    })

    test("should support paste with conflict resolution", async () => {
      const copyData: CopyPasteData = {
        type: "single-cell",
        data: [["conflict@example.com"]],
        metadata: { columns: ["email"], rows: 1 },
      }

      const result = await advancedDataGrid.pasteCells(
        copyData,
        { rowIndex: 0, columnId: "email" },
        { conflictResolution: "overwrite" }
      )

      expect(result.success).toBe(true)
      expect(advancedDataGrid.getCellValue(0, "email")).toBe("conflict@example.com")
    })

    test("should support clipboard integration", async () => {
      const mockClipboard = {
        writeText: vi.fn(),
        readText: vi.fn().mockResolvedValue("clip@example.com"),
      }

      // Mock clipboard API
      Object.defineProperty(navigator, "clipboard", {
        value: mockClipboard,
        writable: true,
      })

      // Copy to clipboard
      await advancedDataGrid.copyToClipboard([{ rowIndex: 0, columnId: "email" }])
      expect(mockClipboard.writeText).toHaveBeenCalledWith("john@example.com")

      // Paste from clipboard
      const result = await advancedDataGrid.pasteFromClipboard({ rowIndex: 1, columnId: "email" })
      expect(result.success).toBe(true)
      expect(advancedDataGrid.getCellValue(1, "email")).toBe("clip@example.com")
    })
  })

  describe("Virtual Scrolling", () => {
    test("should initialize virtual scrolling", () => {
      const config: VirtualScrollConfig = {
        enabled: true,
        itemHeight: 40,
        containerHeight: 400,
        bufferSize: 5,
        overscan: 3,
      }

      const virtualManager = advancedDataGrid.enableVirtualScrolling(config)

      expect(virtualManager.isEnabled()).toBe(true)
      expect(virtualManager.getVisibleRange()).toBeDefined()
    })

    test("should calculate visible items correctly", () => {
      const config: VirtualScrollConfig = {
        enabled: true,
        itemHeight: 40,
        containerHeight: 400,
        bufferSize: 5,
        overscan: 2,
      }

      const virtualManager = advancedDataGrid.enableVirtualScrolling(config)
      virtualManager.setScrollTop(0)

      const visibleRange = virtualManager.getVisibleRange()

      expect(visibleRange.start).toBe(0)
      expect(visibleRange.end).toBeLessThanOrEqual(12) // 400/40 + overscan
      expect(visibleRange.visibleStart).toBe(0)
      expect(visibleRange.visibleEnd).toBeLessThanOrEqual(10) // 400/40
    })

    test("should handle scrolling updates", () => {
      const config: VirtualScrollConfig = {
        enabled: true,
        itemHeight: 40,
        containerHeight: 400,
        bufferSize: 5,
        overscan: 2,
      }

      const virtualManager = advancedDataGrid.enableVirtualScrolling(config)

      // Scroll down
      virtualManager.setScrollTop(200) // 5 items down
      const visibleRange = virtualManager.getVisibleRange()

      expect(visibleRange.start).toBeGreaterThan(0)
      expect(visibleRange.visibleStart).toBeGreaterThanOrEqual(5)
    })

    test("should optimize performance for large datasets", () => {
      // Create large dataset
      const largeData = generateLargeDataset(10000)
      const largeDataGrid = new AdvancedDataGridService(largeData)

      const config: VirtualScrollConfig = {
        enabled: true,
        itemHeight: 40,
        containerHeight: 400,
        bufferSize: 10,
        overscan: 5,
      }

      const virtualManager = largeDataGrid.enableVirtualScrolling(config)

      // Should only render visible items + buffer
      const visibleRange = virtualManager.getVisibleRange()
      const renderedItems = visibleRange.end - visibleRange.start

      expect(renderedItems).toBeLessThan(50) // Much less than 10000 items
      expect(virtualManager.getTotalHeight()).toBe(10000 * 40) // Total height calculated correctly
    })

    test("should support dynamic item heights", () => {
      const config: VirtualScrollConfig = {
        enabled: true,
        itemHeight: (index) => (index % 2 === 0 ? 40 : 60), // Alternating heights
        containerHeight: 400,
        bufferSize: 5,
        overscan: 2,
      }

      const virtualManager = advancedDataGrid.enableVirtualScrolling(config)

      expect(virtualManager.getItemHeight(0)).toBe(40)
      expect(virtualManager.getItemHeight(1)).toBe(60)
      expect(virtualManager.getTotalHeight()).toBeGreaterThan(0)
    })
  })

  describe("Performance Optimization", () => {
    test("should debounce rapid cell changes", async () => {
      const validationSpy = vi.fn()
      advancedDataGrid.onValidationChange(validationSpy)
      advancedDataGrid.startCellEdit(0, "email")

      // Rapid changes
      advancedDataGrid.updateCellValue(0, "email", "a")
      advancedDataGrid.updateCellValue(0, "email", "ab")
      advancedDataGrid.updateCellValue(0, "email", "abc@test.com")

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 300))

      // Should only validate the final value
      expect(validationSpy).toHaveBeenCalledTimes(1)
      expect(validationSpy).toHaveBeenLastCalledWith({
        rowIndex: 0,
        columnId: "email",
        value: "abc@test.com",
        isValid: true,
        errors: [],
      })
    })

    test("should cache validation results", async () => {
      const validationSpy = vi.spyOn(advancedDataGrid, "validateCellValue")

      // First validation
      await advancedDataGrid.validateCellValue(0, "email", "test@example.com")
      expect(validationSpy).toHaveBeenCalledTimes(1)

      // Second validation with same value should use cache
      await advancedDataGrid.validateCellValue(0, "email", "test@example.com")
      expect(validationSpy).toHaveBeenCalledTimes(1) // No additional call
    })

    test("should optimize bulk operations", async () => {
      const performanceSpy = vi.fn()
      advancedDataGrid.onPerformanceMetric(performanceSpy)

      const bulkOperation: BulkEditOperation = {
        type: "update",
        columnId: "age",
        value: 25,
        rowIndices: Array.from({ length: 1000 }, (_, i) => i),
      }

      const start = performance.now()
      await advancedDataGrid.executeBulkOperation(bulkOperation)
      const end = performance.now()

      expect(end - start).toBeLessThan(100) // Should complete in under 100ms
      expect(performanceSpy).toHaveBeenCalled()
    })

    test("should use efficient change tracking", async () => {
      const changeTracker = advancedDataGrid.getChangeTracker()

      // Make many changes
      for (let i = 0; i < 100; i++) {
        await advancedDataGrid.updateCellValue(0, "age", 20 + i)
      }

      // Should efficiently track only the final change
      const changes = changeTracker.getOptimizedChanges()
      expect(changes.modifiedCells).toHaveLength(1)
      expect(changes.modifiedCells[0].newValue).toBe(119) // 20 + 99
    })

    test("should support lazy loading of large datasets", async () => {
      const lazyDataGrid = new AdvancedDataGridService()

      const loadDataSpy = vi.fn().mockImplementation(async (offset, limit) => {
        return {
          rows: Array.from({ length: limit }, (_, i) => ({
            id: offset + i,
            email: `user${offset + i}@example.com`,
            name: `User ${offset + i}`,
          })),
          totalRows: 100000,
          hasMore: offset + limit < 100000,
        }
      })

      lazyDataGrid.setDataLoader(loadDataSpy)

      // Load first page
      await lazyDataGrid.loadData(0, 50)
      expect(loadDataSpy).toHaveBeenCalledWith(0, 50)

      // Load second page
      await lazyDataGrid.loadData(50, 50)
      expect(loadDataSpy).toHaveBeenCalledWith(50, 50)

      expect(lazyDataGrid.getTotalRows()).toBe(100000)
    })
  })

  describe("Cursor AI Integration", () => {
    test("should generate smart default values", async () => {
      const aiIntegration = new CursorAIIntegration()
      const mockAIResponse = {
        suggestions: [
          { column: "email", value: "user@company.com", confidence: 0.8 },
          { column: "name", value: "John Smith", confidence: 0.7 },
        ],
      }

      vi.spyOn(aiIntegration, "generateDefaults").mockResolvedValue(mockAIResponse)

      const options: CursorAIDefaultOptions = {
        context: "Adding new employee record",
        existingData: mockTableData.rows,
        columns: mockTableData.columns,
      }

      const defaults = await advancedDataGrid.generateAIDefaults(options)

      expect(defaults.email).toBe("user@company.com")
      expect(defaults.name).toBe("John Smith")
    })

    test("should learn from existing data patterns", async () => {
      const aiIntegration = new CursorAIIntegration()

      // Analyze patterns in existing data
      const patterns = await aiIntegration.analyzeDataPatterns(
        mockTableData.rows,
        mockTableData.columns
      )

      expect(patterns.emailPattern).toMatch(/.*@example\.com/)
      expect(patterns.namePattern).toMatch(/[A-Za-z]+ [A-Za-z]+/)
      expect(patterns.ageRange).toEqual({ min: 25, max: 35 })
    })

    test("should provide contextual suggestions", async () => {
      const aiIntegration = new CursorAIIntegration()

      advancedDataGrid.startCellEdit(0, "email")

      const suggestions = await aiIntegration.getContextualSuggestions(
        "john.doe",
        "email",
        mockTableData.rows
      )

      expect(suggestions).toContain("john.doe@example.com")
      expect(suggestions).toContain("john.doe@company.com")
    })

    test("should support AI-powered data validation", async () => {
      const aiIntegration = new CursorAIIntegration()

      const aiValidation = await aiIntegration.validateDataQuality({
        rowIndex: 0,
        data: { email: "test@test.com", name: "Test User", age: 150 },
      })

      expect(aiValidation.issues).toContain("Age value seems unrealistic")
      expect(aiValidation.confidence).toBeGreaterThan(0.5)
    })

    test("should provide intelligent auto-completion", async () => {
      const aiIntegration = new CursorAIIntegration()

      advancedDataGrid.startCellEdit(0, "name")

      const completions = await aiIntegration.getAutoCompletions("Jo", "name", mockTableData.rows)

      expect(completions).toContain("John")
      expect(completions).toContain("Johnson")
    })

    test("should support AI-powered data transformation", async () => {
      const aiIntegration = new CursorAIIntegration()

      const transformation = await aiIntegration.suggestTransformation({
        sourceColumn: "name",
        targetColumn: "initials",
        sampleData: ["John Doe", "Jane Smith", "Bob Johnson"],
      })

      expect(transformation.function).toBeDefined()
      expect(transformation.preview).toEqual(["J.D.", "J.S.", "B.J."])
    })
  })
})

// Helper functions
function generateLargeDataset(size: number): TableData {
  return {
    tableName: "large_test_table",
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
        id: "data",
        name: "data",
        type: "varchar(100)",
        nullable: true,
        isPrimaryKey: false,
        isAutoIncrement: false,
      },
    ],
    rows: Array.from({ length: size }, (_, i) => ({
      id: i + 1,
      data: `Data item ${i + 1}`,
    })),
    totalRows: size,
    offset: 0,
    limit: size,
  }
}
