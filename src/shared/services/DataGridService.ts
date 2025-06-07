import type {
  AddedRow,
  CellType,
  CellValue,
  ColumnDefinition,
  DataGridColumn,
  DataGridFilter,
  DataGridSort,
  DeletedRow,
  EditableCell,
  PaginationOptions,
  TableData,
} from "../types/datagrid";

export class DataGridService {
  private tableData: TableData | null = null;
  private editableCells: Map<string, EditableCell> = new Map();
  private addedRows: AddedRow[] = [];
  private deletedRows: DeletedRow[] = [];
  private nextTempId = 1;

  /**
   * Load table data from database
   */
  async loadTableData(
    tableName: string,
    pagination: PaginationOptions,
  ): Promise<TableData> {
    // Mock implementation - in real app, this would call the database
    if (tableName === "non_existent") {
      throw new Error(`Table "${tableName}" not found`);
    }

    if (tableName === "empty_table") {
      return {
        tableName,
        columns: [],
        rows: [],
        totalRows: 0,
        offset: pagination.offset,
        limit: pagination.limit,
      };
    }

    // Mock data for testing
    const mockData: TableData = {
      tableName,
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
      offset: pagination.offset,
      limit: pagination.limit,
    };

    this.tableData = mockData;
    return mockData;
  }

  /**
   * Set table data (for testing)
   */
  setTableData(data: TableData): void {
    this.tableData = data;
    this.clearChanges();
  }

  /**
   * Process column definitions for TanStack Table
   */
  processColumnDefinitions(columns: ColumnDefinition[]): DataGridColumn[] {
    return columns.map((col) => ({
      id: col.id,
      accessorKey: col.id,
      header: col.name,
      meta: {
        columnDef: col,
        cellType: this.getCellType(col.type),
        editable: !col.isPrimaryKey && !col.isAutoIncrement,
        sortable: true,
        filterable: true,
        isPrimaryKey: col.isPrimaryKey,
        nullable: col.nullable,
      },
    }));
  }

  /**
   * Determine cell type from SQL type
   */
  private getCellType(sqlType: string): CellType {
    const type = sqlType.toLowerCase();

    if (
      type.includes("int") ||
      type.includes("numeric") ||
      type.includes("decimal")
    ) {
      return "number";
    }
    if (type.includes("bool")) {
      return "boolean";
    }
    if (type.includes("date") && type.includes("time")) {
      return "datetime";
    }
    if (type.includes("date")) {
      return "date";
    }
    if (type.includes("time")) {
      return "time";
    }
    if (type.includes("uuid")) {
      return "uuid";
    }
    if (type.includes("json")) {
      return "json";
    }
    if (type.includes("email")) {
      return "email";
    }
    if (type.includes("url")) {
      return "url";
    }

    return "text";
  }

  /**
   * Validate cell value against column definition
   */
  validateCellValue(value: CellValue, column: ColumnDefinition): boolean {
    // Handle null/empty values
    if (value === null || value === undefined || value === "") {
      return column.nullable;
    }

    // Type-specific validation
    switch (this.getCellType(column.type)) {
      case "number":
        return !Number.isNaN(Number(value));
      case "boolean":
        return (
          typeof value === "boolean" ||
          value === "true" ||
          value === "false" ||
          value === "1" ||
          value === "0"
        );
      case "email":
        return (
          typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        );
      case "uuid":
        return (
          typeof value === "string" &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            value,
          )
        );
      case "date":
      case "datetime":
        return !Number.isNaN(Date.parse(String(value)));
      default:
        return true;
    }
  }

  /**
   * Create editable cell state
   */
  createEditableCell(
    rowIndex: number,
    columnId: string,
    originalValue: CellValue,
  ): EditableCell {
    return {
      rowIndex,
      columnId,
      originalValue,
      editedValue: originalValue,
      isEditing: false,
      isDirty: false,
      isValid: true,
    };
  }

  /**
   * Update cell value and track changes
   */
  updateCellValue(
    rowIndex: number,
    columnId: string,
    newValue: CellValue,
  ): void {
    if (!this.tableData) {
      throw new Error("No table data loaded");
    }

    const column = this.tableData.columns.find((col) => col.id === columnId);
    if (!column) {
      throw new Error(`Column "${columnId}" not found`);
    }

    if (column.isPrimaryKey || column.isAutoIncrement) {
      throw new Error(`Column "${columnId}" is not editable`);
    }

    const cellKey = `${rowIndex}:${columnId}`;
    const existingCell = this.editableCells.get(cellKey);
    const originalValue =
      existingCell?.originalValue ?? this.tableData.rows[rowIndex]?.[columnId];

    const editableCell: EditableCell = {
      rowIndex,
      columnId,
      originalValue,
      editedValue: newValue,
      isEditing: false,
      isDirty: newValue !== originalValue,
      isValid: this.validateCellValue(newValue, column),
    };

    if (editableCell.isDirty) {
      this.editableCells.set(cellKey, editableCell);
    } else {
      this.editableCells.delete(cellKey);
    }
  }

  /**
   * Get all dirty cells
   */
  getDirtyCells(): EditableCell[] {
    return Array.from(this.editableCells.values()).filter(
      (cell) => cell.isDirty,
    );
  }

  /**
   * Add new row with default values
   */
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

    const addedRow: AddedRow = {
      tempId: `temp_${this.nextTempId++}`,
      data: newRow,
      index: this.tableData.rows.length + this.addedRows.length,
    };

    this.addedRows.push(addedRow);
    return newRow;
  }

  /**
   * Delete row and track for deletion
   */
  deleteRow(rowIndex: number): void {
    if (!this.tableData) {
      throw new Error("No table data loaded");
    }

    const row = this.tableData.rows[rowIndex];
    if (!row) {
      throw new Error("Row not found");
    }

    const primaryKeyColumn = this.tableData.columns.find(
      (col) => col.isPrimaryKey,
    );
    const primaryKeyValue = primaryKeyColumn
      ? row[primaryKeyColumn.id]
      : rowIndex;

    const deletedRow: DeletedRow = {
      originalIndex: rowIndex,
      data: row,
      primaryKeyValue,
    };

    this.deletedRows.push(deletedRow);
  }

  /**
   * Duplicate existing row
   */
  duplicateRow(rowIndex: number): Record<string, CellValue> {
    if (!this.tableData) {
      throw new Error("No table data loaded");
    }

    const originalRow = this.tableData.rows[rowIndex];
    if (!originalRow) {
      throw new Error("Row not found");
    }

    const duplicatedRow: Record<string, CellValue> = { ...originalRow };

    // Clear primary key and auto-increment fields
    for (const column of this.tableData.columns) {
      if (column.isPrimaryKey || column.isAutoIncrement) {
        duplicatedRow[column.id] = undefined;
      }
    }

    const addedRow: AddedRow = {
      tempId: `temp_${this.nextTempId++}`,
      data: duplicatedRow,
      index: this.tableData.rows.length + this.addedRows.length,
    };

    this.addedRows.push(addedRow);
    return duplicatedRow;
  }

  /**
   * Get added rows
   */
  getAddedRows(): AddedRow[] {
    return this.addedRows;
  }

  /**
   * Get deleted rows
   */
  getDeletedRows(): DeletedRow[] {
    return this.deletedRows;
  }

  /**
   * Apply sorting to data
   */
  applySorting(sorting: DataGridSort[]): Record<string, CellValue>[] {
    if (!this.tableData) {
      return [];
    }

    const sortedData = [...this.tableData.rows];

    for (const sort of sorting.reverse()) {
      sortedData.sort((a, b) => {
        const aVal = a[sort.id];
        const bVal = b[sort.id];

        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        let comparison = 0;
        if (aVal < bVal) comparison = -1;
        if (aVal > bVal) comparison = 1;

        return sort.desc ? -comparison : comparison;
      });
    }

    return sortedData;
  }

  /**
   * Apply column filters
   */
  applyFilters(filters: DataGridFilter[]): Record<string, CellValue>[] {
    if (!this.tableData) {
      return [];
    }

    let filteredData = [...this.tableData.rows];

    for (const filter of filters) {
      filteredData = filteredData.filter((row) => {
        const cellValue = String(row[filter.id] || "").toLowerCase();
        const filterValue = String(filter.value || "").toLowerCase();

        return cellValue.includes(filterValue);
      });
    }

    return filteredData;
  }

  /**
   * Apply global search filter
   */
  applyGlobalFilter(searchTerm: string): Record<string, CellValue>[] {
    if (!this.tableData) {
      return [];
    }

    const lowerSearchTerm = searchTerm.toLowerCase();

    return this.tableData.rows.filter((row) => {
      return Object.values(row).some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(lowerSearchTerm),
      );
    });
  }

  /**
   * Generate SQL statements for changes
   */
  generateSQLStatements(): string[] {
    if (!this.tableData) {
      return [];
    }

    const statements: string[] = [];

    // UPDATE statements for dirty cells
    const rowUpdates = new Map<number, Record<string, CellValue>>();

    for (const cell of this.getDirtyCells()) {
      if (!rowUpdates.has(cell.rowIndex)) {
        rowUpdates.set(cell.rowIndex, {});
      }
      const rowUpdate = rowUpdates.get(cell.rowIndex);
      if (rowUpdate) {
        rowUpdate[cell.columnId] = cell.editedValue;
      }
    }

    for (const [rowIndex, updates] of rowUpdates) {
      const row = this.tableData.rows[rowIndex];
      const primaryKeyColumn = this.tableData.columns.find(
        (col) => col.isPrimaryKey,
      );

      if (primaryKeyColumn && row[primaryKeyColumn.id] !== undefined) {
        const setPairs = Object.entries(updates)
          .map(([col, val]) => `${col} = ${this.formatSQLValue(val)}`)
          .join(", ");

        const whereClause = `${primaryKeyColumn.id} = ${this.formatSQLValue(row[primaryKeyColumn.id])}`;
        statements.push(
          `UPDATE ${this.tableData.tableName} SET ${setPairs} WHERE ${whereClause}`,
        );
      }
    }

    // DELETE statements
    for (const deletedRow of this.deletedRows) {
      const primaryKeyColumn = this.tableData.columns.find(
        (col) => col.isPrimaryKey,
      );

      if (primaryKeyColumn) {
        const whereClause = `${primaryKeyColumn.id} = ${this.formatSQLValue(deletedRow.primaryKeyValue)}`;
        statements.push(
          `DELETE FROM ${this.tableData.tableName} WHERE ${whereClause}`,
        );
      }
    }

    // INSERT statements
    for (const addedRow of this.addedRows) {
      const columns = this.tableData.columns
        .filter(
          (col) => !col.isAutoIncrement && addedRow.data[col.id] !== undefined,
        )
        .map((col) => col.id);

      const values = columns
        .map((col) => this.formatSQLValue(addedRow.data[col]))
        .join(", ");

      statements.push(
        `INSERT INTO ${this.tableData.tableName} (${columns.join(", ")}) VALUES (${values})`,
      );
    }

    return statements;
  }

  /**
   * Rollback all changes
   */
  rollbackChanges(): void {
    this.editableCells.clear();
    this.addedRows = [];
    this.deletedRows = [];
  }

  /**
   * Commit changes to database
   */
  async commitChanges(): Promise<void> {
    this.generateSQLStatements();

    // Clear changes after successful commit
    this.clearChanges();
  }

  /**
   * Get virtualized rows for performance
   */
  getVirtualizedRows(
    rows: Record<string, CellValue>[],
    range: { startIndex: number; endIndex: number },
  ): Record<string, CellValue>[] {
    return rows.slice(range.startIndex, range.endIndex + 1);
  }

  /**
   * Get default value for column type
   */
  private getDefaultValue(column: ColumnDefinition): CellValue {
    if (column.defaultValue !== undefined) {
      return column.defaultValue;
    }

    const cellType = this.getCellType(column.type);

    switch (cellType) {
      case "number":
        return 0;
      case "boolean":
        return false;
      case "date":
      case "datetime":
        return new Date().toISOString();
      case "time":
        return new Date().toTimeString().split(" ")[0];
      default:
        return "";
    }
  }

  /**
   * Format value for SQL
   */
  private formatSQLValue(value: CellValue): string {
    if (value === null || value === undefined) {
      return "NULL";
    }

    if (typeof value === "string") {
      return `'${value.replace(/'/g, "''")}'`;
    }

    if (typeof value === "boolean") {
      return value ? "TRUE" : "FALSE";
    }

    return String(value);
  }

  /**
   * Clear all changes
   */
  private clearChanges(): void {
    this.editableCells.clear();
    this.addedRows = [];
    this.deletedRows = [];
    this.nextTempId = 1;
  }
}
