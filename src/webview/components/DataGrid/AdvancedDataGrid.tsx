import {
  type CellContext,
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type React from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { AdvancedDataGridService } from "../../../shared/services/AdvancedDataGridService";
import type {
  BulkEditOperation,
  CellState,
  CellValue,
  ColumnDefinition,
  CursorAIDefaultOptions,
  EditableCell,
  RowState,
  TableData,
} from "../../../shared/types/datagrid";
import { AdvancedCellEditor } from "./AdvancedCellEditor";
import { BulkEditPanel } from "./BulkEditPanel";
import { ChangeTrackingPanel } from "./ChangeTrackingPanel";
import { CursorAIPanel } from "./CursorAIPanel";
import { VirtualScrollContainer } from "./VirtualScrollContainer";

// Note: Advanced table meta functionality can be implemented as needed

interface AdvancedDataGridProps {
  data: TableData;
  onDataChange?: (data: TableData) => void;
  enableVirtualScrolling?: boolean;
  enableBulkOperations?: boolean;
  enableCopyPaste?: boolean;
  enableAIIntegration?: boolean;
  containerHeight?: number;
  readOnly?: boolean;
}

export const AdvancedDataGrid: React.FC<AdvancedDataGridProps> = ({
  data,
  onDataChange,
  enableVirtualScrolling = false,
  enableBulkOperations = true,
  enableCopyPaste = true,
  enableAIIntegration = true,
  containerHeight = 600,
  readOnly = false,
}) => {
  const [service] = useState(() => new AdvancedDataGridService(data));
  const [tableData, setTableData] = useState<TableData>(data);
  const [selectedCells, setSelectedCells] = useState<
    Array<{ rowIndex: number; columnId: string }>
  >([]);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [activeCellEdits, setActiveCellEdits] = useState<EditableCell[]>([]);
  const [showBulkPanel, setShowBulkPanel] = useState(false);
  const [showChangeTracking, setShowChangeTracking] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Update service when data changes
  useEffect(() => {
    service.getChangeTracker().setInitialData(data);
    service.getValidationEngine().setSchema(data.columns);
    setTableData(data);
  }, [data, service]);

  // Track active edits
  useEffect(() => {
    const updateActiveCellEdits = () => {
      setActiveCellEdits(service.getActiveCellEdits());
    };

    // Poll for active edits updates (in real implementation, this would be event-driven)
    const interval = setInterval(updateActiveCellEdits, 100);
    return () => clearInterval(interval);
  }, [service]);

  // Set up virtual scrolling if enabled
  useEffect(() => {
    if (enableVirtualScrolling && containerHeight) {
      service.enableVirtualScrolling({
        enabled: true,
        containerHeight,
        itemHeight: 35, // Standard row height
        bufferSize: 10,
        overscan: 5,
      });
    }
  }, [enableVirtualScrolling, containerHeight, service]);

  // Cell state management
  const getCellState = useCallback(
    (rowIndex: number, columnId: string): CellState => {
      return service.getCellState(rowIndex, columnId);
    },
    [service],
  );

  const getRowState = useCallback(
    (rowIndex: number): RowState => {
      return service.getRowState(rowIndex);
    },
    [service],
  );

  // Editing operations
  const startEdit = useCallback(
    (rowIndex: number, columnId: string) => {
      if (readOnly) return;

      const result = service.startCellEdit(rowIndex, columnId);
      if (!result.success) {
        console.error("Failed to start edit:", result.error);
        return;
      }

      setActiveCellEdits(service.getActiveCellEdits());
    },
    [service, readOnly],
  );

  const commitEdit = useCallback(
    async (rowIndex: number, columnId: string, value: CellValue) => {
      const result = await service.commitCellEdit(rowIndex, columnId, value);

      if (!result.success) {
        console.error("Failed to commit edit:", result.error);
        return;
      }

      // Update table data
      startTransition(() => {
        const updatedData = service.getTableData();
        if (updatedData) {
          setTableData({ ...updatedData });
          onDataChange?.(updatedData);
        }
        setActiveCellEdits(service.getActiveCellEdits());
      });
    },
    [service, onDataChange],
  );

  const cancelEdit = useCallback(
    (rowIndex: number, columnId: string) => {
      const result = service.cancelCellEdit(rowIndex, columnId);
      if (!result.success) {
        console.error("Failed to cancel edit:", result.error);
        return;
      }

      setActiveCellEdits(service.getActiveCellEdits());
    },
    [service],
  );

  const updateData = useCallback(
    async (rowIndex: number, columnId: string, value: CellValue) => {
      await service.updateCellValue(rowIndex, columnId, value);
      setActiveCellEdits(service.getActiveCellEdits());
    },
    [service],
  );

  // Selection management
  const handleCellSelect = useCallback(
    (rowIndex: number, columnId: string, addToSelection = false) => {
      const cellRef = { rowIndex, columnId };

      if (addToSelection) {
        setSelectedCells((prev) => [...prev, cellRef]);
      } else {
        setSelectedCells([cellRef]);
      }
    },
    [],
  );

  const _handleRowSelect = useCallback(
    (rowIndex: number, addToSelection = false) => {
      if (addToSelection) {
        setSelectedRows((prev) => [...prev, rowIndex]);
      } else {
        setSelectedRows([rowIndex]);
      }
    },
    [],
  );

  // Copy/Paste operations
  const handleCopy = useCallback(async () => {
    if (!enableCopyPaste || selectedCells.length === 0) return;

    try {
      await service.copyToClipboard(selectedCells);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  }, [service, selectedCells, enableCopyPaste]);

  const handlePaste = useCallback(async () => {
    if (!enableCopyPaste || selectedCells.length === 0) return;

    const startCell = selectedCells[0];
    const result = await service.pasteFromClipboard(startCell);

    if (!result.success) {
      console.error("Paste failed:", result.error);
      return;
    }

    // Update table data
    startTransition(() => {
      const updatedData = service.getTableData();
      if (updatedData) {
        setTableData({ ...updatedData });
        onDataChange?.(updatedData);
      }
    });
  }, [service, selectedCells, enableCopyPaste, onDataChange]);

  // Bulk operations
  const handleBulkEdit = useCallback(
    async (operation: BulkEditOperation) => {
      const result = await service.executeBulkOperation(operation);

      if (!result.success) {
        console.error("Bulk operation failed:", result.error);
        return;
      }

      // Update table data
      startTransition(() => {
        const updatedData = service.getTableData();
        if (updatedData) {
          setTableData({ ...updatedData });
          onDataChange?.(updatedData);
        }
      });
    },
    [service, onDataChange],
  );

  // AI Integration
  const handleGenerateAiDefaults = useCallback(
    async (options: CursorAIDefaultOptions) => {
      const defaults = await service.generateAIDefaults(options);

      // Apply defaults to selected rows or all rows
      const targetRows =
        selectedRows.length > 0 ? selectedRows : [tableData.rows.length - 1];

      for (const rowIndex of targetRows) {
        for (const [columnId, value] of Object.entries(defaults)) {
          await commitEdit(rowIndex, columnId, value);
        }
      }
    },
    [service, selectedRows, tableData.rows.length, commitEdit],
  );

  // Create TanStack Table columns
  const columns = useMemo<ColumnDef<Record<string, CellValue>>[]>(() => {
    return tableData.columns.map((column: ColumnDefinition) => ({
      id: column.id,
      accessorKey: column.id,
      header: column.name,
      cell: ({
        row,
        column: tableColumn,
        getValue,
      }: CellContext<Record<string, CellValue>, unknown>) => {
        const rowIndex = row.index;
        const columnId = tableColumn.id || `col-${row.index}`;
        const value = getValue() as CellValue;
        const cellState = getCellState(rowIndex, columnId);
        const isEditing = activeCellEdits.some(
          (edit) => edit.rowIndex === rowIndex && edit.columnId === columnId,
        );

        if (isEditing) {
          const editableCell = activeCellEdits.find(
            (edit) => edit.rowIndex === rowIndex && edit.columnId === columnId,
          );
          if (!editableCell) return null;
          return (
            <AdvancedCellEditor
              cell={editableCell}
              column={column}
              onCommit={(newValue) => commitEdit(rowIndex, columnId, newValue)}
              onCancel={() => cancelEdit(rowIndex, columnId)}
              onChange={(newValue) => updateData(rowIndex, columnId, newValue)}
            />
          );
        }

        return (
          <div
            className={`cell ${cellState.isDirty ? "cell-dirty" : ""} ${cellState.isValid ? "" : "cell-invalid"}`}
            onClick={() => handleCellSelect(rowIndex, columnId)}
            onDoubleClick={() => startEdit(rowIndex, columnId)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleCellSelect(rowIndex, columnId);
              } else if (e.key === "F2" || e.key === " ") {
                e.preventDefault();
                startEdit(rowIndex, columnId);
              }
            }}
            tabIndex={0}
            role="gridcell"
          >
            {cellState.visualIndicator && (
              <div
                className={`visual-indicator ${cellState.visualIndicator}`}
              />
            )}
            {String(value || "")}
          </div>
        );
      },
      enableSorting: !column.isPrimaryKey,
      enableColumnFilter: true,
    }));
  }, [
    tableData.columns,
    getCellState,
    activeCellEdits,
    commitEdit,
    cancelEdit,
    updateData,
    handleCellSelect,
    startEdit,
  ]);

  // Table instance
  const table = useReactTable({
    data: tableData.rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    meta: {
      updateData,
      getCellState,
      getRowState,
      startEdit,
      commitEdit,
      cancelEdit,
    },
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "c":
            e.preventDefault();
            handleCopy();
            break;
          case "v":
            e.preventDefault();
            handlePaste();
            break;
          case "z":
            if (e.shiftKey) {
              // Redo (Ctrl+Shift+Z)
              // TODO: Implement redo
            } else {
              // Undo (Ctrl+Z)
              service.rollbackChanges();
              const updatedData = service.getTableData();
              if (updatedData) {
                setTableData({ ...updatedData });
                onDataChange?.(updatedData);
              }
            }
            break;
        }
      } else if (e.key === "Delete" && selectedRows.length > 0) {
        // Delete selected rows
        for (const rowIndex of selectedRows) {
          service.deleteRow(rowIndex);
        }
        const updatedData = service.getTableData();
        if (updatedData) {
          setTableData({ ...updatedData });
          onDataChange?.(updatedData);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleCopy, handlePaste, selectedRows, service, onDataChange]);

  const TableContent = () => (
    <div className="advanced-datagrid-container">
      {/* Toolbar */}
      <div className="datagrid-toolbar">
        <div className="toolbar-section">
          <button
            type="button"
            className="toolbar-button"
            onClick={() => setShowChangeTracking(!showChangeTracking)}
            title="Show Changes"
          >
            📊 Changes ({service.getChangeStatistics().totalChanges})
          </button>

          {enableBulkOperations && (
            <button
              type="button"
              className="toolbar-button"
              onClick={() => setShowBulkPanel(!showBulkPanel)}
              disabled={selectedRows.length === 0}
              title="Bulk Operations"
            >
              ⚡ Bulk Edit
            </button>
          )}

          {enableAIIntegration && (
            <button
              type="button"
              className="toolbar-button"
              onClick={() => setShowAiPanel(!showAiPanel)}
              title="AI Assistance"
            >
              🤖 AI Assistant
            </button>
          )}
        </div>

        <div className="toolbar-section">
          <span className="selection-info">
            {selectedCells.length > 0 &&
              `${selectedCells.length} cells selected`}
            {selectedRows.length > 0 && `${selectedRows.length} rows selected`}
          </span>
        </div>
      </div>

      {/* Panels */}
      {showChangeTracking && (
        <ChangeTrackingPanel
          changeTracker={service.getChangeTracker()}
          onClose={() => setShowChangeTracking(false)}
          onRollback={(type, _index?) => {
            if (type === "all") {
              service.rollbackChanges();
            }
            // Handle specific rollbacks
            const updatedData = service.getTableData();
            if (updatedData) {
              setTableData({ ...updatedData });
              onDataChange?.(updatedData);
            }
          }}
        />
      )}

      {showBulkPanel && enableBulkOperations && (
        <BulkEditPanel
          selectedRows={selectedRows}
          columns={tableData.columns}
          onExecute={handleBulkEdit}
          onClose={() => setShowBulkPanel(false)}
          service={service}
        />
      )}

      {showAiPanel && enableAIIntegration && (
        <CursorAIPanel
          columns={tableData.columns}
          existingData={tableData.rows}
          onGenerateDefaults={handleGenerateAiDefaults}
          onClose={() => setShowAiPanel(false)}
        />
      )}

      {/* Table */}
      <div className={`table-container ${isPending ? "loading" : ""}`}>
        <table className="advanced-datagrid-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                <th className="row-selector">
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRows(
                          tableData.rows.map((_, index) => index),
                        );
                      } else {
                        setSelectedRows([]);
                      }
                    }}
                    checked={selectedRows.length === tableData.rows.length}
                  />
                </th>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="column-header">
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                    {header.column.getCanSort() && (
                      <button
                        type="button"
                        className="sort-button"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {{
                          asc: " 🔼",
                          desc: " 🔽",
                        }[header.column.getIsSorted() as string] ?? " ↕️"}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const rowState = getRowState(row.index);
              return (
                <tr
                  key={row.id}
                  className={`
                    table-row
                    ${rowState.isNew ? "row-new" : ""}
                    ${rowState.isDeleted ? "row-deleted" : ""}
                    ${rowState.hasChanges ? "row-modified" : ""}
                    ${selectedRows.includes(row.index) ? "row-selected" : ""}
                  `}
                >
                  <td className="row-selector">
                    <input
                      type="checkbox"
                      checked={selectedRows.includes(row.index)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRows((prev) => [...prev, row.index]);
                        } else {
                          setSelectedRows((prev) =>
                            prev.filter((i) => i !== row.index),
                          );
                        }
                      }}
                    />
                  </td>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="table-cell">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="pagination-controls">
        <button
          type="button"
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
        >
          {"<<"}
        </button>
        <button
          type="button"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          {"<"}
        </button>
        <span>
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount()}
        </span>
        <button
          type="button"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          {">"}
        </button>
        <button
          type="button"
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          disabled={!table.getCanNextPage()}
        >
          {">>"}
        </button>
      </div>
    </div>
  );

  if (enableVirtualScrolling) {
    const virtualScrollManager = service.getVirtualScrollManager();
    if (!virtualScrollManager) {
      // Fallback to non-virtualized rendering if manager is not available
      return <TableContent />;
    }

    return (
      <VirtualScrollContainer
        manager={virtualScrollManager}
        totalItems={tableData.totalRows}
        containerHeight={containerHeight}
      >
        <TableContent />
      </VirtualScrollContainer>
    );
  }

  return <TableContent />;
};
