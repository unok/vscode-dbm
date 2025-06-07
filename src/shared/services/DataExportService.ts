import type { CellValue, TableData } from "../types/datagrid";
import type { ExportOptions } from "../types/sql";

export interface ExportResult {
  success: boolean;
  format: string;
  data: string;
  fileName: string;
  rowsExported: number;
  size: number;
  error?: string;
}

export interface ExportProgress {
  currentRow: number;
  totalRows: number;
  percentage: number;
  estimatedTimeRemaining: number;
}

export class DataExportService {
  private readonly chunkSize = 1000;

  /**
   * Export table data in specified format
   */
  async exportData(
    tableData: TableData,
    options: ExportOptions,
    onProgress?: (progress: ExportProgress) => void,
  ): Promise<ExportResult> {
    try {
      let exportedData = "";
      let fileName = options.fileName || `${tableData.tableName}_export`;

      switch (options.format) {
        case "csv":
          exportedData = await this.exportToCSV(tableData, options, onProgress);
          fileName += ".csv";
          break;
        case "json":
          exportedData = await this.exportToJSON(
            tableData,
            onProgress,
          );
          fileName += ".json";
          break;
        case "sql":
          exportedData = await this.exportToSQL(tableData, options, onProgress);
          fileName += ".sql";
          break;
        case "xml":
          exportedData = await this.exportToXML(tableData, options, onProgress);
          fileName += ".xml";
          break;
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }

      const size = new Blob([exportedData]).size;

      return {
        success: true,
        format: options.format,
        data: exportedData,
        fileName,
        rowsExported: tableData.rows.length,
        size,
      };
    } catch (error) {
      return {
        success: false,
        format: options.format,
        data: "",
        fileName: "",
        rowsExported: 0,
        size: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Export to CSV format
   */
  private async exportToCSV(
    tableData: TableData,
    options: ExportOptions,
    onProgress?: (progress: ExportProgress) => void,
  ): Promise<string> {
    const delimiter = options.delimiter || ",";
    const quote = options.quote || '"';
    const escapeChar = options.escape || '"';
    const lines: string[] = [];

    // Add headers if requested
    if (options.includeHeaders) {
      const headers = tableData.columns.map((col) =>
        this.escapeCSVValue(col.name, quote, escapeChar, delimiter),
      );
      lines.push(headers.join(delimiter));
    }

    // Process data in chunks for better performance
    for (let i = 0; i < tableData.rows.length; i += this.chunkSize) {
      const chunk = tableData.rows.slice(i, i + this.chunkSize);

      for (const row of chunk) {
        const values = tableData.columns.map((col) => {
          const value = row[col.id];
          return this.escapeCSVValue(
            this.formatValue(value),
            quote,
            escapeChar,
            delimiter,
          );
        });
        lines.push(values.join(delimiter));
      }

      // Report progress
      if (onProgress) {
        const progress = Math.min(i + this.chunkSize, tableData.rows.length);
        onProgress({
          currentRow: progress,
          totalRows: tableData.rows.length,
          percentage: (progress / tableData.rows.length) * 100,
          estimatedTimeRemaining: 0, // TODO: Calculate based on elapsed time
        });
      }
    }

    return lines.join("\n");
  }

  /**
   * Export to JSON format
   */
  private async exportToJSON(
    tableData: TableData,
    /* options: ExportOptions - reserved for future JSON export options */
    onProgress?: (progress: ExportProgress) => void,
  ): Promise<string> {
    const result: Record<string, CellValue>[] = [];

    // Process data in chunks
    for (let i = 0; i < tableData.rows.length; i += this.chunkSize) {
      const chunk = tableData.rows.slice(i, i + this.chunkSize);

      for (const row of chunk) {
        const jsonRow: Record<string, CellValue> = {};

        for (const column of tableData.columns) {
          const value = row[column.id];
          jsonRow[column.name] = this.formatValueForJSON(value);
        }

        result.push(jsonRow);
      }

      // Report progress
      if (onProgress) {
        const progress = Math.min(i + this.chunkSize, tableData.rows.length);
        onProgress({
          currentRow: progress,
          totalRows: tableData.rows.length,
          percentage: (progress / tableData.rows.length) * 100,
          estimatedTimeRemaining: 0,
        });
      }
    }

    return JSON.stringify(result, null, 2);
  }

  /**
   * Export to SQL INSERT statements
   */
  private async exportToSQL(
    tableData: TableData,
    options: ExportOptions,
    onProgress?: (progress: ExportProgress) => void,
  ): Promise<string> {
    const statements: string[] = [];
    const tableName = tableData.tableName;
    const columnNames = tableData.columns.map((col) => col.name);

    // Add table creation statement (optional)
    if (options.includeHeaders) {
      statements.push(this.generateCreateTableStatement(tableData));
      statements.push("");
    }

    // Process data in chunks
    for (let i = 0; i < tableData.rows.length; i += this.chunkSize) {
      const chunk = tableData.rows.slice(i, i + this.chunkSize);

      for (const row of chunk) {
        const values = tableData.columns.map((col) => {
          const value = row[col.id];
          return this.formatValueForSQL(value);
        });

        const statement = `INSERT INTO ${tableName} (${columnNames.join(", ")}) VALUES (${values.join(", ")});`;
        statements.push(statement);
      }

      // Report progress
      if (onProgress) {
        const progress = Math.min(i + this.chunkSize, tableData.rows.length);
        onProgress({
          currentRow: progress,
          totalRows: tableData.rows.length,
          percentage: (progress / tableData.rows.length) * 100,
          estimatedTimeRemaining: 0,
        });
      }
    }

    return statements.join("\n");
  }

  /**
   * Export to XML format
   */
  private async exportToXML(
    tableData: TableData,
    options: ExportOptions,
    onProgress?: (progress: ExportProgress) => void,
  ): Promise<string> {
    const lines: string[] = [];

    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push(`<table name="${this.escapeXMLValue(tableData.tableName)}">`);

    // Add schema information if headers included
    if (options.includeHeaders) {
      lines.push("  <schema>");
      for (const column of tableData.columns) {
        lines.push(
          `    <column name="${this.escapeXMLValue(column.name)}" type="${this.escapeXMLValue(column.type)}" nullable="${column.nullable}" />`,
        );
      }
      lines.push("  </schema>");
    }

    lines.push("  <data>");

    // Process data in chunks
    for (let i = 0; i < tableData.rows.length; i += this.chunkSize) {
      const chunk = tableData.rows.slice(i, i + this.chunkSize);

      for (const row of chunk) {
        lines.push("    <row>");

        for (const column of tableData.columns) {
          const value = row[column.id];
          const formattedValue = this.escapeXMLValue(this.formatValue(value));
          lines.push(
            `      <${column.name}>${formattedValue}</${column.name}>`,
          );
        }

        lines.push("    </row>");
      }

      // Report progress
      if (onProgress) {
        const progress = Math.min(i + this.chunkSize, tableData.rows.length);
        onProgress({
          currentRow: progress,
          totalRows: tableData.rows.length,
          percentage: (progress / tableData.rows.length) * 100,
          estimatedTimeRemaining: 0,
        });
      }
    }

    lines.push("  </data>");
    lines.push("</table>");

    return lines.join("\n");
  }

  /**
   * Escape CSV value
   */
  private escapeCSVValue(
    value: string,
    quote: string,
    escapeString: string,
    delimiter: string,
  ): string {
    if (!value) return "";

    const needsQuotes =
      value.includes(delimiter) ||
      value.includes(quote) ||
      value.includes("\n") ||
      value.includes("\r");

    if (needsQuotes) {
      const escapedValue = value.replace(
        new RegExp(quote, "g"),
        escapeString + quote,
      );
      return quote + escapedValue + quote;
    }

    return value;
  }

  /**
   * Escape XML value
   */
  private escapeXMLValue(value: string): string {
    if (!value) return "";

    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  /**
   * Format value for display
   */
  private formatValue(value: CellValue): string {
    if (value === null || value === undefined) {
      return "";
    }

    if (typeof value === "boolean") {
      return value ? "true" : "false";
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    return String(value);
  }

  /**
   * Format value for JSON export
   */
  private formatValueForJSON(value: CellValue): CellValue {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === "string" && value.trim() === "") {
      return null;
    }

    return value;
  }

  /**
   * Format value for SQL export
   */
  private formatValueForSQL(value: CellValue): string {
    if (value === null || value === undefined) {
      return "NULL";
    }

    if (typeof value === "string") {
      const escaped = value.replace(/'/g, "''");
      return `'${escaped}'`;
    }

    if (typeof value === "boolean") {
      return value ? "TRUE" : "FALSE";
    }

    if (value instanceof Date) {
      return `'${value.toISOString()}'`;
    }

    return String(value);
  }

  /**
   * Generate CREATE TABLE statement
   */
  private generateCreateTableStatement(tableData: TableData): string {
    const columns = tableData.columns.map((col) => {
      let columnDef = `${col.name} ${col.type}`;

      if (!col.nullable) {
        columnDef += " NOT NULL";
      }

      if (col.isPrimaryKey) {
        columnDef += " PRIMARY KEY";
      }

      if (col.isAutoIncrement) {
        columnDef += " AUTO_INCREMENT";
      }

      if (col.defaultValue !== undefined) {
        columnDef += ` DEFAULT ${this.formatValueForSQL(col.defaultValue)}`;
      }

      return columnDef;
    });

    return `CREATE TABLE ${tableData.tableName} (\n  ${columns.join(",\n  ")}\n);`;
  }

  /**
   * Download exported data as file
   */
  downloadFile(result: ExportResult): void {
    const blob = new Blob([result.data], {
      type: this.getMimeType(result.format),
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = result.fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Get MIME type for format
   */
  private getMimeType(format: string): string {
    const mimeTypes = {
      csv: "text/csv",
      json: "application/json",
      sql: "application/sql",
      xml: "application/xml",
    };

    return mimeTypes[format as keyof typeof mimeTypes] || "text/plain";
  }

  /**
   * Estimate export size
   */
  estimateExportSize(tableData: TableData, format: string): number {
    const avgRowSize = this.calculateAverageRowSize(tableData);
    const headerSize =
      format === "csv" && tableData.columns
        ? tableData.columns
            .map((col) => col.name.length)
            .reduce((a, b) => a + b, 0)
        : 0;

    const baseSize = tableData.rows.length * avgRowSize + headerSize;

    // Format-specific multipliers
    const multipliers = {
      csv: 1.0,
      json: 1.5,
      sql: 2.0,
      xml: 3.0,
    };

    return Math.ceil(
      baseSize * (multipliers[format as keyof typeof multipliers] || 1.0),
    );
  }

  /**
   * Calculate average row size
   */
  private calculateAverageRowSize(tableData: TableData): number {
    if (tableData.rows.length === 0) return 0;

    const sampleSize = Math.min(100, tableData.rows.length);
    let totalSize = 0;

    for (let i = 0; i < sampleSize; i++) {
      const row = tableData.rows[i];
      const rowSize = Object.values(row).reduce((size: number, value) => {
        const valueLength = value ? String(value).length : 0;
        return size + valueLength;
      }, 0);
      totalSize += rowSize;
    }

    return totalSize / sampleSize;
  }
}
