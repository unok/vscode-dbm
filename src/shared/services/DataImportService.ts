import type { CellValue, ColumnDefinition, TableData } from "../types/datagrid";
import type { ImportOptions, ValidationResult } from "../types/sql";

export interface ImportResult {
  success: boolean;
  rowsImported: number;
  rowsSkipped: number;
  errors: ImportError[];
  warnings: string[];
  data?: TableData;
}

export interface ImportError {
  row: number;
  column?: string;
  message: string;
  severity: "error" | "warning";
}

export interface ImportPreview {
  columns: string[];
  rows: Record<string, CellValue>[];
  totalRows: number;
  estimatedImportTime: number;
  conflicts: ConflictInfo[];
}

export interface ConflictInfo {
  type: "column_mismatch" | "data_type_mismatch" | "constraint_violation";
  message: string;
  suggestions: string[];
}

export class DataImportService {
  private readonly maxPreviewRows = 100;
  private readonly chunkSize = 1000;

  /**
   * Preview import data before actual import
   */
  async previewImport(
    file: File,
    options: ImportOptions,
    targetTable?: TableData,
  ): Promise<ImportPreview> {
    try {
      const rawData = await this.parseFile(file, options);
      const preview = this.generatePreview(rawData, targetTable);

      return preview;
    } catch (error) {
      throw new Error(
        `Failed to preview import: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Import data into table
   */
  async importData(
    file: File,
    options: ImportOptions,
    targetTable: TableData,
    onProgress?: (progress: number) => void,
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      rowsImported: 0,
      rowsSkipped: 0,
      errors: [],
      warnings: [],
    };

    try {
      const rawData = await this.parseFile(file, options);
      const validatedData = await this.validateAndTransformData(
        rawData,
        targetTable,
        options,
        onProgress,
      );

      result.data = validatedData.data;
      result.rowsImported = validatedData.rowsImported;
      result.rowsSkipped = validatedData.rowsSkipped;
      result.errors = validatedData.errors;
      result.warnings = validatedData.warnings;
      result.success = validatedData.errors.length === 0;

      return result;
    } catch (error) {
      result.errors.push({
        row: 0,
        message: `Import failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        severity: "error",
      });
      return result;
    }
  }

  /**
   * Parse file based on format
   */
  private async parseFile(
    file: File,
    options: ImportOptions,
  ): Promise<Record<string, CellValue>[]> {
    const text = await file.text();

    switch (options.format) {
      case "csv":
        return this.parseCSV(text, options);
      case "json":
        return this.parseJSON(text);
      case "sql":
        return this.parseSQL(text);
      default:
        throw new Error(`Unsupported import format: ${options.format}`);
    }
  }

  /**
   * Parse CSV data
   */
  private parseCSV(
    text: string,
    options: ImportOptions,
  ): Record<string, CellValue>[] {
    const delimiter = options.delimiter || ",";
    const quote = options.quote || '"';
    const lines = text.split("\n").filter((line) => line.trim());

    if (lines.length === 0) {
      throw new Error("Empty CSV file");
    }

    let headers: string[];
    let dataStartIndex = 0;

    if (options.hasHeaders) {
      headers = this.parseCSVLine(lines[0], delimiter, quote);
      dataStartIndex = 1;
    } else {
      // Generate column names
      const firstRow = this.parseCSVLine(lines[0], delimiter, quote);
      headers = firstRow.map((_, index) => `column_${index + 1}`);
    }

    const rows: Record<string, CellValue>[] = [];

    for (let i = dataStartIndex; i < lines.length; i++) {
      try {
        const values = this.parseCSVLine(lines[i], delimiter, quote);
        const row: Record<string, CellValue> = {};

        for (let j = 0; j < Math.max(headers.length, values.length); j++) {
          const header = headers[j] || `column_${j + 1}`;
          const value = values[j] || null;
          row[header] = this.parseValue(value || "");
        }

        rows.push(row);
      } catch (error) {
        throw new Error(
          `Error parsing CSV line ${i + 1}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }

    return rows;
  }

  /**
   * Parse single CSV line
   */
  private parseCSVLine(
    line: string,
    delimiter: string,
    quote: string,
  ): string[] {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === quote) {
        if (inQuotes && nextChar === quote) {
          // Escaped quote
          current += quote;
          i += 2;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === delimiter && !inQuotes) {
        values.push(current);
        current = "";
        i++;
      } else {
        current += char;
        i++;
      }
    }

    values.push(current);
    return values;
  }

  /**
   * Parse JSON data
   */
  private parseJSON(
    text: string,
  ): Record<string, CellValue>[] {
    try {
      const data = JSON.parse(text);

      if (Array.isArray(data)) {
        return data.map((item, index) => {
          if (typeof item === "object" && item !== null) {
            return item as Record<string, CellValue>;
          }
          throw new Error(`Invalid JSON object at index ${index}`);
        });
      }

      if (typeof data === "object" && data !== null) {
        // Single object, wrap in array
        return [data as Record<string, CellValue>];
      }

      throw new Error("JSON must be an array of objects or a single object");
    } catch (error) {
      throw new Error(
        `Invalid JSON: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Parse SQL INSERT statements
   */
  private parseSQL(
    text: string,
  ): Record<string, CellValue>[] {
    const insertRegex =
      /INSERT\s+INTO\s+(?:`?)(\w+)(?:`?)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/gi;
    const rows: Record<string, CellValue>[] = [];
    let match: RegExpExecArray | null;

    match = insertRegex.exec(text);
    while (match !== null) {
      try {
        const columnsStr = match[2];
        const valuesStr = match[3];

        const columns = columnsStr
          .split(",")
          .map((col) => col.trim().replace(/[`'"]/g, ""));
        const values = this.parseValuesList(valuesStr);

        if (columns.length !== values.length) {
          throw new Error("Column count mismatch with values count");
        }

        const row: Record<string, CellValue> = {};
        for (let i = 0; i < columns.length; i++) {
          row[columns[i]] = values[i];
        }

        rows.push(row);
        match = insertRegex.exec(text);
      } catch (error) {
        throw new Error(
          `Error parsing SQL statement: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }

    if (rows.length === 0) {
      throw new Error("No valid INSERT statements found in SQL file");
    }

    return rows;
  }

  /**
   * Parse SQL VALUES list
   */
  private parseValuesList(valuesStr: string): CellValue[] {
    const values: CellValue[] = [];
    let current = "";
    let inQuotes = false;
    let quoteChar = "";

    for (let i = 0; i < valuesStr.length; i++) {
      const char = valuesStr[i];
      const nextChar = valuesStr[i + 1];

      if ((char === "'" || char === '"') && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuotes) {
        if (nextChar === quoteChar) {
          // Escaped quote
          current += char;
          i++;
        } else {
          inQuotes = false;
          quoteChar = "";
        }
      } else if (char === "," && !inQuotes) {
        values.push(this.parseValue(current.trim()));
        current = "";
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      values.push(this.parseValue(current.trim()));
    }

    return values;
  }

  /**
   * Parse individual value
   */
  private parseValue(value: string): CellValue {
    if (!value || value.toLowerCase() === "null") {
      return null;
    }

    // Remove quotes
    if (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))
    ) {
      return value.slice(1, -1);
    }

    // Try to parse as number
    if (/^-?\d+$/.test(value)) {
      return Number.parseInt(value, 10);
    }

    if (/^-?\d*\.\d+$/.test(value)) {
      return Number.parseFloat(value);
    }

    // Try to parse as boolean
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;

    return value;
  }

  /**
   * Generate preview of import data
   */
  private generatePreview(
    rawData: Record<string, CellValue>[],
    targetTable: TableData | undefined,
  ): ImportPreview {
    const previewRows = rawData.slice(0, this.maxPreviewRows);
    const allColumns = new Set<string>();

    // Collect all column names
    for (const row of rawData) {
      for (const col of Object.keys(row)) {
        allColumns.add(col);
      }
    }

    const columns = Array.from(allColumns);
    const conflicts: ConflictInfo[] = [];

    // Check for conflicts with target table
    if (targetTable) {
      const targetColumns = targetTable.columns.map((col) => col.name);

      // Check for missing columns
      const missingColumns = columns.filter(
        (col) => !targetColumns.includes(col),
      );
      if (missingColumns.length > 0) {
        conflicts.push({
          type: "column_mismatch",
          message: `Columns not found in target table: ${missingColumns.join(", ")}`,
          suggestions: [
            "Add missing columns to target table",
            "Map columns during import",
          ],
        });
      }

      // Check for extra columns in target
      const extraColumns = targetColumns.filter(
        (col) => !columns.includes(col),
      );
      if (extraColumns.length > 0) {
        conflicts.push({
          type: "column_mismatch",
          message: `Target table has additional columns: ${extraColumns.join(", ")}`,
          suggestions: [
            "Use default values for missing columns",
            "Include all columns in import data",
          ],
        });
      }
    }

    return {
      columns,
      rows: previewRows,
      totalRows: rawData.length,
      estimatedImportTime: Math.ceil(rawData.length / this.chunkSize) * 1000, // ms
      conflicts,
    };
  }

  /**
   * Validate and transform data for target table
   */
  private async validateAndTransformData(
    rawData: Record<string, CellValue>[],
    targetTable: TableData,
    options: ImportOptions,
    onProgress?: (progress: number) => void,
  ): Promise<{
    data: TableData;
    rowsImported: number;
    rowsSkipped: number;
    errors: ImportError[];
    warnings: string[];
  }> {
    const errors: ImportError[] = [];
    const warnings: string[] = [];
    const transformedRows: Record<string, CellValue>[] = [];

    let rowsImported = 0;
    let rowsSkipped = 0;

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const transformedRow: Record<string, CellValue> = {};
      let hasErrors = false;

      // Process each column in target table
      for (const column of targetTable.columns) {
        const value = row[column.name];
        const validation = this.validateCellValue(value, column);

        if (!validation.isValid) {
          hasErrors = true;
          errors.push({
            row: i + 1,
            column: column.name,
            message: validation.errors.join(", "),
            severity: "error",
          });
        }

        if (validation.warnings.length > 0) {
          warnings.push(
            `Row ${i + 1}, Column ${column.name}: ${validation.warnings.join(", ")}`,
          );
        }

        transformedRow[column.name] = this.transformValue(value, column);
      }

      if (hasErrors && options.onConflict === "ignore") {
        rowsSkipped++;
      } else if (!hasErrors || options.onConflict === "replace") {
        transformedRows.push(transformedRow);
        rowsImported++;
      }

      // Report progress
      if (onProgress && i % 100 === 0) {
        onProgress((i / rawData.length) * 100);
      }
    }

    const resultData: TableData = {
      ...targetTable,
      rows: transformedRows,
      totalRows: transformedRows.length,
    };

    return {
      data: resultData,
      rowsImported,
      rowsSkipped,
      errors,
      warnings,
    };
  }

  /**
   * Validate cell value against column definition
   */
  private validateCellValue(
    value: CellValue,
    column: ColumnDefinition,
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check nullable
    if (value === null || value === undefined || value === "") {
      if (!column.nullable) {
        errors.push(`Null value not allowed for column ${column.name}`);
      }
      return { isValid: errors.length === 0, errors, warnings };
    }

    // Type-specific validation
    const type = column.type.toLowerCase();

    if (type.includes("int")) {
      if (typeof value !== "number" || !Number.isInteger(value)) {
        errors.push(`Invalid integer value: ${value}`);
      }
    } else if (type.includes("decimal") || type.includes("float")) {
      if (typeof value !== "number" || Number.isNaN(value)) {
        errors.push(`Invalid numeric value: ${value}`);
      }
    } else if (type.includes("bool")) {
      if (typeof value !== "boolean") {
        errors.push(`Invalid boolean value: ${value}`);
      }
    } else if (type.includes("date")) {
      if (typeof value === "string") {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
          errors.push(`Invalid date value: ${value}`);
        }
      } else {
        errors.push(`Date value must be a string: ${value}`);
      }
    }

    // Length validation
    if (
      typeof value === "string" &&
      column.maxLength &&
      value.length > column.maxLength
    ) {
      errors.push(`Value too long (${value.length} > ${column.maxLength})`);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Transform value to match column type
   */
  private transformValue(
    value: CellValue,
    column: ColumnDefinition,
  ): CellValue {
    if (value === null || value === undefined || value === "") {
      return column.nullable ? null : column.defaultValue || "";
    }

    const type = column.type.toLowerCase();

    try {
      if (type.includes("int")) {
        return typeof value === "number"
          ? Math.floor(value)
          : Number.parseInt(String(value), 10);
      }
      if (type.includes("decimal") || type.includes("float")) {
        return typeof value === "number"
          ? value
          : Number.parseFloat(String(value));
      }
      if (type.includes("bool")) {
        if (typeof value === "boolean") return value;
        const str = String(value).toLowerCase();
        return ["true", "1", "yes", "on"].includes(str);
      }
      if (type.includes("date")) {
        return typeof value === "string" ? value : String(value);
      }
    } catch {
      // Return original value if transformation fails
    }

    return value;
  }
}
