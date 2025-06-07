import type {
  BulkEditOperation,
  BulkOperationPreview,
  BulkOperationResult,
  CellEditResult,
  CellState,
  CellValue,
  ChangeRecord,
  ChangeStatistics,
  ColumnDefinition,
  CopyPasteData,
  CursorAIDefaultOptions,
  EditableCell,
  PasteOptions,
  PasteResult,
  PerformanceMetrics,
  RowState,
  TableData,
  ValidationContext,
  ValidationResult,
  VirtualScrollConfig,
} from "../types/datagrid";
import { CellValidationEngine } from "../utils/CellValidationEngine";
import { CursorAIIntegration } from "../utils/CursorAIIntegration";
import { DataChangeTracker } from "../utils/DataChangeTracker";
import { VirtualScrollManager } from "../utils/VirtualScrollManager";

export class AdvancedDataGridService {
  private tableData: TableData | null = null;
  private changeTracker: DataChangeTracker;
  private validationEngine: CellValidationEngine;
  private virtualScrollManager: VirtualScrollManager | null = null;
  private aiIntegration: CursorAIIntegration;
  private activeCellEdits: Map<string, EditableCell> = new Map();
  private validationCache: Map<string, ValidationResult> = new Map();
  private performanceCallbacks: Array<(metric: PerformanceMetrics) => void> =
    [];
  private validationCallbacks: Array<(result: ValidationResult) => void> = [];
  private dataLoader:
    | ((offset: number, limit: number) => Promise<TableData>)
    | null = null;

  constructor(initialData?: TableData) {
    this.tableData = initialData || null;
    this.changeTracker = new DataChangeTracker();
    this.validationEngine = new CellValidationEngine();
    this.aiIntegration = new CursorAIIntegration();

    if (initialData) {
      this.changeTracker.setInitialData(initialData);
      this.validationEngine.setSchema(initialData.columns);
    }
  }

  /**
   * Advanced Inline Editing
   */
  startCellEdit(rowIndex: number, columnId: string): CellEditResult {
    if (!this.tableData) {
      return { success: false, error: "No table data loaded" };
    }

    const column = this.tableData.columns.find((col) => col.id === columnId);
    if (!column) {
      return { success: false, error: `Column "${columnId}" not found` };
    }

    if (column.isPrimaryKey) {
      return { success: false, error: "Primary key columns cannot be edited" };
    }

    if (column.isAutoIncrement) {
      return {
        success: false,
        error: "Auto-increment columns cannot be edited",
      };
    }

    const cellKey = `${rowIndex}:${columnId}`;
    if (this.activeCellEdits.has(cellKey)) {
      return { success: false, error: "Cell is already being edited" };
    }

    const currentValue = this.getCellValue(rowIndex, columnId);
    const cellState: EditableCell = {
      rowIndex,
      columnId,
      originalValue: currentValue,
      editedValue: currentValue,
      isEditing: true,
      isDirty: false,
      isValid: true,
    };

    this.activeCellEdits.set(cellKey, cellState);

    return {
      success: true,
      cellState,
    };
  }

  async updateCellValue(
    rowIndex: number,
    columnId: string,
    newValue: CellValue,
  ): Promise<void> {
    const cellKey = `${rowIndex}:${columnId}`;
    const cellState = this.activeCellEdits.get(cellKey);

    if (!cellState) {
      throw new Error("Cell is not in edit mode");
    }

    cellState.editedValue = newValue;
    cellState.isDirty = newValue !== cellState.originalValue;

    // Debounced validation
    this.debouncedValidation(rowIndex, columnId, newValue);
  }

  async validateCellValue(
    rowIndex: number,
    columnId: string,
    value: CellValue,
  ): Promise<ValidationResult> {
    const cacheKey = `${columnId}:${String(value)}`;

    // Check cache first
    if (this.validationCache.has(cacheKey)) {
      const cached = this.validationCache.get(cacheKey);
      return cached ?? { isValid: false, errors: ["Cache error"] };
    }

    if (!this.tableData) {
      return { isValid: false, errors: ["No table data loaded"] };
    }

    const column = this.tableData.columns.find((col) => col.id === columnId);
    if (!column) {
      return { isValid: false, errors: [`Column "${columnId}" not found`] };
    }

    const validationContext: ValidationContext = {
      row: this.tableData.rows[rowIndex],
      rowIndex,
      columnId,
      value,
    };

    const result = await this.validationEngine.validateValue(
      value,
      column,
      validationContext,
    );

    // Cache result
    this.validationCache.set(cacheKey, result);

    return result;
  }

  async commitCellEdit(
    rowIndex: number,
    columnId: string,
    newValue: CellValue,
  ): Promise<CellEditResult> {
    const cellKey = `${rowIndex}:${columnId}`;
    const cellState = this.activeCellEdits.get(cellKey);

    if (!cellState) {
      return { success: false, error: "Cell is not in edit mode" };
    }

    // Validate before committing
    const validation = await this.validateCellValue(
      rowIndex,
      columnId,
      newValue,
    );
    if (!validation.isValid) {
      return {
        success: false,
        error: "Validation failed",
        validationErrors: validation.errors,
      };
    }

    // Update the actual data
    if (this.tableData?.rows[rowIndex]) {
      this.tableData.rows[rowIndex][columnId] = newValue;
    }

    // Track the change
    this.changeTracker.recordCellChange(
      rowIndex,
      columnId,
      cellState.originalValue,
      newValue,
    );

    // Remove from active edits
    this.activeCellEdits.delete(cellKey);

    return { success: true };
  }

  cancelCellEdit(rowIndex: number, columnId: string): CellEditResult {
    const cellKey = `${rowIndex}:${columnId}`;

    if (!this.activeCellEdits.has(cellKey)) {
      return { success: false, error: "Cell is not in edit mode" };
    }

    this.activeCellEdits.delete(cellKey);
    return { success: true };
  }

  getActiveCellEdits(): EditableCell[] {
    return Array.from(this.activeCellEdits.values());
  }

  /**
   * Data Change Tracking
   */
  getChangeRecord(): ChangeRecord {
    return this.changeTracker.getChangeRecord();
  }

  getChangeStatistics(): ChangeStatistics {
    return this.changeTracker.getStatistics();
  }

  rollbackChanges(): void {
    this.changeTracker.rollbackAll();
    this.activeCellEdits.clear();
    this.validationCache.clear();

    if (this.tableData) {
      this.tableData = this.changeTracker.getOriginalData();
    }
  }

  rollbackCellChange(rowIndex: number, columnId: string): void {
    this.changeTracker.rollbackCellChange(rowIndex, columnId);

    // Update current data
    if (this.tableData?.rows[rowIndex]) {
      const originalValue = this.changeTracker.getOriginalCellValue(
        rowIndex,
        columnId,
      );
      this.tableData.rows[rowIndex][columnId] = originalValue;
    }
  }

  /**
   * Visual Change Indicators
   */
  getCellState(rowIndex: number, columnId: string): CellState {
    const cellKey = `${rowIndex}:${columnId}`;
    const activeEdit = this.activeCellEdits.get(cellKey);
    const change = this.changeTracker.getCellChange(rowIndex, columnId);

    return {
      isEditing: !!activeEdit,
      isDirty: !!change,
      isValid: !activeEdit || activeEdit.isValid,
      changeType: change ? "modified" : undefined,
      visualIndicator: change ? "dirty-cell" : undefined,
      originalValue: change?.originalValue,
      editedValue: this.getCellValue(rowIndex, columnId),
    };
  }

  getRowState(rowIndex: number): RowState {
    const isNew = this.changeTracker.isNewRow(rowIndex);
    const isDeleted = this.changeTracker.isDeletedRow(rowIndex);
    const hasChanges = this.changeTracker.hasRowChanges(rowIndex);

    return {
      isNew,
      isDeleted,
      hasChanges,
      visualIndicator: isNew
        ? "new-row"
        : isDeleted
          ? "deleted-row"
          : undefined,
    };
  }

  setCustomIndicator(
    rowIndex: number,
    columnId: string,
    indicator: string,
    message?: string,
  ): void {
    // Store custom indicators for cells
    const cellKey = `${rowIndex}:${columnId}`;
    // TODO: Implementation would store custom indicators
    console.debug(
      `Setting indicator for ${cellKey}: ${indicator}${message ? ` - ${message}` : ""}`,
    );
  }

  /**
   * Bulk Edit Operations
   */
  async executeBulkOperation(
    operation: BulkEditOperation,
  ): Promise<BulkOperationResult> {
    const startTime = performance.now();
    let affectedRows = 0;
    const validationErrors: string[] = [];

    try {
      switch (operation.type) {
        case "update":
          affectedRows = await this.executeBulkUpdate(operation);
          break;
        case "delete":
          affectedRows = await this.executeBulkDelete(operation);
          break;
        default:
          return {
            success: false,
            error: "Unknown operation type",
            affectedRows: 0,
          };
      }

      const endTime = performance.now();
      this.notifyPerformanceMetric({
        operation: "bulk_edit",
        duration: endTime - startTime,
        rowsAffected: affectedRows,
      });

      return { success: true, affectedRows };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        validationErrors,
        affectedRows,
      };
    }
  }

  private async executeBulkUpdate(
    operation: BulkEditOperation,
  ): Promise<number> {
    if (!this.tableData || !operation.columnId) {
      throw new Error("Invalid operation parameters");
    }

    const column = this.tableData.columns.find(
      (col) => col.id === operation.columnId,
    );
    if (!column) {
      throw new Error(`Column "${operation.columnId}" not found`);
    }

    let affectedRows = 0;

    for (const rowIndex of operation.rowIndices) {
      const row = this.tableData.rows[rowIndex];
      if (!row) continue;

      // Apply condition if specified
      if (operation.condition && !operation.condition(row)) {
        continue;
      }

      // Calculate new value
      let newValue: CellValue;
      if (operation.valueFunction) {
        newValue = operation.valueFunction(row, rowIndex);
      } else {
        newValue = operation.value;
      }

      // Validate new value
      const validation = await this.validateCellValue(
        rowIndex,
        operation.columnId,
        newValue,
      );
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
      }

      // Apply the change
      const originalValue = row[operation.columnId];
      row[operation.columnId] = newValue;

      // Track the change
      this.changeTracker.recordCellChange(
        rowIndex,
        operation.columnId,
        originalValue,
        newValue,
      );

      affectedRows++;
    }

    return affectedRows;
  }

  private async executeBulkDelete(
    operation: BulkEditOperation,
  ): Promise<number> {
    for (const rowIndex of operation.rowIndices) {
      this.deleteRow(rowIndex);
    }
    return operation.rowIndices.length;
  }

  previewBulkOperation(operation: BulkEditOperation): BulkOperationPreview {
    if (!this.tableData) {
      return { willAffect: 0, changes: [] };
    }

    const changes = [];
    let willAffect = 0;

    for (const rowIndex of operation.rowIndices) {
      const row = this.tableData.rows[rowIndex];
      if (!row) continue;

      if (operation.condition && !operation.condition(row)) {
        continue;
      }

      if (operation.type === "update" && operation.columnId) {
        let newValue: CellValue;
        if (operation.valueFunction) {
          newValue = operation.valueFunction(row, rowIndex);
        } else {
          newValue = operation.value;
        }

        changes.push({
          rowIndex,
          columnId: operation.columnId,
          currentValue: row[operation.columnId],
          newValue,
        });
      }

      willAffect++;
    }

    return { willAffect, changes };
  }

  /**
   * Copy and Paste Functionality
   */
  copyCells(
    cellRefs: Array<{ rowIndex: number; columnId: string }>,
  ): CopyPasteData {
    if (!this.tableData) {
      throw new Error("No table data loaded");
    }

    if (cellRefs.length === 1) {
      // Single cell
      const { rowIndex, columnId } = cellRefs[0];
      const value = this.getCellValue(rowIndex, columnId);

      return {
        type: "single-cell",
        data: [[value]],
        metadata: { columns: [columnId], rows: 1 },
      };
    }

    // Determine if it's a range or scattered cells
    const data = [];
    const columns = [...new Set(cellRefs.map((ref) => ref.columnId))];
    const rows = [...new Set(cellRefs.map((ref) => ref.rowIndex))];

    for (const rowIndex of rows) {
      const rowData = [];
      for (const columnId of columns) {
        const value = this.getCellValue(rowIndex, columnId);
        rowData.push(value);
      }
      data.push(rowData);
    }

    return {
      type: "range",
      data,
      metadata: { columns, rows: rows.length },
    };
  }

  copyRows(rowIndices: number[]): CopyPasteData {
    if (!this.tableData) {
      throw new Error("No table data loaded");
    }

    const data = rowIndices.map((rowIndex) => {
      const row = this.tableData?.rows[rowIndex];
      if (!row || !this.tableData?.columns) {
        return [];
      }
      return this.tableData.columns.map((col) => row[col.id]);
    });

    return {
      type: "rows",
      data,
      metadata: {
        columns: this.tableData.columns.map((col) => col.id),
        rows: rowIndices.length,
      },
    };
  }

  async pasteCells(
    copyData: CopyPasteData,
    startCell: { rowIndex: number; columnId: string },
    options?: PasteOptions,
  ): Promise<PasteResult> {
    if (!this.tableData) {
      return {
        success: false,
        error: "No table data loaded",
        affectedCells: 0,
      };
    }

    const validationErrors: string[] = [];
    let affectedCells = 0;

    try {
      const startColumnIndex = this.tableData.columns.findIndex(
        (col) => col.id === startCell.columnId,
      );
      if (startColumnIndex === -1) {
        return {
          success: false,
          error: "Start column not found",
          affectedCells: 0,
        };
      }

      for (
        let dataRowIndex = 0;
        dataRowIndex < copyData.data.length;
        dataRowIndex++
      ) {
        const targetRowIndex = startCell.rowIndex + dataRowIndex;

        // Ensure target row exists
        if (targetRowIndex >= this.tableData.rows.length) {
          if (options?.autoExpandRows) {
            // Add new rows as needed
            while (this.tableData.rows.length <= targetRowIndex) {
              this.addNewRow();
            }
          } else {
            break;
          }
        }

        const dataRow = copyData.data[dataRowIndex];
        for (
          let dataColIndex = 0;
          dataColIndex < dataRow.length;
          dataColIndex++
        ) {
          const targetColumnIndex = startColumnIndex + dataColIndex;

          if (targetColumnIndex >= this.tableData.columns.length) {
            break; // Can't expand columns
          }

          const targetColumn = this.tableData.columns[targetColumnIndex];
          const newValue = dataRow[dataColIndex];

          // Validate the value
          const validation = await this.validateCellValue(
            targetRowIndex,
            targetColumn.id,
            newValue,
          );
          if (!validation.isValid) {
            validationErrors.push(...validation.errors);
            if (!options?.skipValidationErrors) {
              return {
                success: false,
                error: "Validation failed",
                validationErrors,
                affectedCells,
              };
            }
            continue;
          }

          // Apply the change
          const originalValue = this.getCellValue(
            targetRowIndex,
            targetColumn.id,
          );
          this.tableData.rows[targetRowIndex][targetColumn.id] = newValue;

          // Track the change
          this.changeTracker.recordCellChange(
            targetRowIndex,
            targetColumn.id,
            originalValue,
            newValue,
          );

          affectedCells++;
        }
      }

      return { success: true, affectedCells, validationErrors };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        affectedCells,
      };
    }
  }

  async copyToClipboard(
    cellRefs: Array<{ rowIndex: number; columnId: string }>,
  ): Promise<void> {
    const copyData = this.copyCells(cellRefs);
    const textData = copyData.data.map((row) => row.join("\t")).join("\n");

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(textData);
    }
  }

  async pasteFromClipboard(startCell: {
    rowIndex: number;
    columnId: string;
  }): Promise<PasteResult> {
    if (!navigator.clipboard) {
      return {
        success: false,
        error: "Clipboard API not available",
        affectedCells: 0,
      };
    }

    try {
      const textData = await navigator.clipboard.readText();
      const rows = textData.split("\n").map((row) => row.split("\t"));

      const copyData: CopyPasteData = {
        type:
          rows.length === 1 && rows[0].length === 1 ? "single-cell" : "range",
        data: rows,
        metadata: { columns: [], rows: rows.length },
      };

      return this.pasteCells(copyData, startCell);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to read clipboard",
        affectedCells: 0,
      };
    }
  }

  /**
   * Virtual Scrolling
   */
  enableVirtualScrolling(config: VirtualScrollConfig): VirtualScrollManager {
    this.virtualScrollManager = new VirtualScrollManager(config);

    if (this.tableData) {
      this.virtualScrollManager.setTotalItems(this.tableData.totalRows);
    }

    return this.virtualScrollManager;
  }

  getVirtualScrollManager(): VirtualScrollManager | null {
    return this.virtualScrollManager;
  }

  /**
   * Performance Optimization
   */
  private debouncedValidation = this.debounce(
    async (rowIndex: number, columnId: string, value: CellValue) => {
      const validation = await this.validateCellValue(
        rowIndex,
        columnId,
        value,
      );

      for (const callback of this.validationCallbacks) {
        callback({
          rowIndex,
          columnId,
          value,
          isValid: validation.isValid,
          errors: validation.errors,
        });
      }
    },
    250,
  ) as (rowIndex: number, columnId: string, value: CellValue) => Promise<void>;

  private debounce<T extends (...args: never[]) => unknown>(
    func: T,
    wait: number,
  ): T {
    let timeout: NodeJS.Timeout;
    return ((...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    }) as T;
  }

  onValidationChange(callback: (result: ValidationResult) => void): void {
    this.validationCallbacks.push(callback);
  }

  onPerformanceMetric(callback: (metric: PerformanceMetrics) => void): void {
    this.performanceCallbacks.push(callback);
  }

  private notifyPerformanceMetric(metric: PerformanceMetrics): void {
    for (const callback of this.performanceCallbacks) {
      callback(metric);
    }
  }

  getChangeTracker(): DataChangeTracker {
    return this.changeTracker;
  }

  getValidationEngine(): CellValidationEngine {
    return this.validationEngine;
  }

  /**
   * Lazy Loading
   */
  setDataLoader(
    loader: (offset: number, limit: number) => Promise<TableData>,
  ): void {
    this.dataLoader = loader;
  }

  async loadData(offset: number, limit: number): Promise<void> {
    if (!this.dataLoader) {
      throw new Error("No data loader configured");
    }

    const data = await this.dataLoader(offset, limit);

    if (this.tableData) {
      // Append or update existing data
      this.tableData.rows = [...this.tableData.rows, ...data.rows];
      this.tableData.totalRows = data.totalRows;
    } else {
      this.tableData = {
        tableName: "loaded_data",
        columns: [],
        rows: data.rows,
        totalRows: data.totalRows,
        offset,
        limit,
      };
    }
  }

  getTotalRows(): number {
    return this.tableData?.totalRows || 0;
  }

  /**
   * Cursor AI Integration
   */
  async generateAIDefaults(
    options: CursorAIDefaultOptions,
  ): Promise<Record<string, CellValue>> {
    return this.aiIntegration.generateDefaults(options);
  }

  /**
   * Utility Methods
   */
  getCellValue(rowIndex: number, columnId: string): CellValue {
    if (!this.tableData || !this.tableData.rows[rowIndex]) {
      return null;
    }
    return this.tableData.rows[rowIndex][columnId];
  }

  getTableData(): TableData | null {
    return this.tableData;
  }

  addNewRow(): Record<string, CellValue> {
    if (!this.tableData) {
      throw new Error("No table data loaded");
    }

    const newRow: Record<string, CellValue> = {};

    for (const column of this.tableData.columns) {
      if (column.isAutoIncrement || column.isPrimaryKey) {
        newRow[column.id] = undefined;
      } else if (column.nullable) {
        newRow[column.id] = null;
      } else {
        newRow[column.id] = this.getDefaultValue(column);
      }
    }

    this.tableData.rows.push(newRow);
    this.changeTracker.recordRowAddition(
      this.tableData.rows.length - 1,
      newRow,
    );

    return newRow;
  }

  deleteRow(rowIndex: number): void {
    if (!this.tableData || !this.tableData.rows[rowIndex]) {
      throw new Error("Row not found");
    }

    const row = this.tableData.rows[rowIndex];
    this.changeTracker.recordRowDeletion(rowIndex, row);
  }

  private getDefaultValue(column: ColumnDefinition): CellValue {
    if (column.defaultValue !== undefined) {
      return column.defaultValue;
    }

    const type = column.type.toLowerCase();

    if (
      type.includes("int") ||
      type.includes("numeric") ||
      type.includes("decimal")
    ) {
      return 0;
    }
    if (type.includes("bool")) {
      return false;
    }
    if (type.includes("date") || type.includes("time")) {
      return new Date().toISOString();
    }

    return "";
  }
}
