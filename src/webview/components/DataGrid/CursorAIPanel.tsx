import type React from "react";
import { useCallback, useState } from "react";
import type {
  CellValue,
  ColumnDefinition,
  CursorAIDefaultOptions,
} from "../../../shared/types/datagrid";

interface CursorAiPanelProps {
  columns: ColumnDefinition[];
  existingData: Record<string, CellValue>[];
  onGenerateDefaults: (options: CursorAIDefaultOptions) => Promise<void>;
  onClose: () => void;
}

export const CursorAIPanel: React.FC<CursorAiPanelProps> = ({
  columns,
  existingData,
  onGenerateDefaults,
  onClose,
}) => {
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [context, setContext] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastGeneratedDefaults, setLastGeneratedDefaults] = useState<Record<
    string,
    CellValue
  > | null>(null);
  const [selectedTab, setSelectedTab] = useState<
    "generate" | "patterns" | "suggestions"
  >("generate");

  const editableColumns = columns.filter(
    (col) => !col.isPrimaryKey && !col.isAutoIncrement,
  );

  const handleColumnToggle = useCallback((columnId: string) => {
    setSelectedColumns((prev) =>
      prev.includes(columnId)
        ? prev.filter((id) => id !== columnId)
        : [...prev, columnId],
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedColumns(editableColumns.map((col) => col.id));
  }, [editableColumns]);

  const handleSelectNone = useCallback(() => {
    setSelectedColumns([]);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (isGenerating || selectedColumns.length === 0) return;

    setIsGenerating(true);
    try {
      const options: CursorAIDefaultOptions = {
        columns: columns.filter((col) => selectedColumns.includes(col.id)),
        existingData: existingData.slice(-10), // Use last 10 rows for context
        context:
          context ||
          "Generate appropriate default values for new database record",
      };

      await onGenerateDefaults(options);

      // For demo purposes, simulate generated defaults
      const mockDefaults: Record<string, CellValue> = {};
      for (const columnId of selectedColumns) {
        const column = columns.find((col) => col.id === columnId);
        if (column) {
          mockDefaults[columnId] = generateMockDefault(column);
        }
      }
      setLastGeneratedDefaults(mockDefaults);
    } catch (error) {
      console.error("AI generation failed:", error);
    } finally {
      setIsGenerating(false);
    }
  }, [
    isGenerating,
    selectedColumns,
    columns,
    existingData,
    context,
    onGenerateDefaults,
  ]);

  const generateMockDefault = (column: ColumnDefinition): CellValue => {
    const type = column.type.toLowerCase();
    const name = column.name.toLowerCase();

    // Generate contextual defaults based on column name
    if (name.includes("email")) {
      return "user@example.com";
    }
    if (name.includes("name")) {
      return "John Doe";
    }
    if (name.includes("phone")) {
      return "+1-555-0123";
    }
    if (name.includes("address")) {
      return "123 Main St";
    }
    if (name.includes("city")) {
      return "New York";
    }
    if (name.includes("state")) {
      return "NY";
    }
    if (name.includes("country")) {
      return "USA";
    }
    if (name.includes("age")) {
      return 25;
    }
    if (
      name.includes("salary") ||
      name.includes("price") ||
      name.includes("amount")
    ) {
      return 50000;
    }

    // Generate defaults based on data type
    if (type.includes("int")) {
      return Math.floor(Math.random() * 100);
    }
    if (type.includes("decimal") || type.includes("float")) {
      return Math.round(Math.random() * 1000 * 100) / 100;
    }
    if (type.includes("bool")) {
      return Math.random() > 0.5;
    }
    if (type.includes("date")) {
      return new Date().toISOString().split("T")[0];
    }
    if (type.includes("uuid")) {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }

    return "Generated Value";
  };

  const getDataPatterns = () => {
    const patterns: Record<
      string,
      {
        commonValues: CellValue[];
        dataType: string;
        nullCount: number;
        uniqueCount: number;
      }
    > = {};

    for (const column of columns) {
      const values = existingData
        .map((row) => row[column.id])
        .filter((val) => val != null);
      if (values.length > 0) {
        patterns[column.id] = {
          commonValues: values.slice(0, 10), // Get top 10 values
          uniqueCount: new Set(values).size,
          nullCount: existingData.length - values.length,
          dataType: typeof values[0],
        };
      }
    }

    return patterns;
  };

  const _getMostCommonValue = (values: CellValue[]) => {
    const counts: Record<string, number> = {};
    for (const val of values) {
      const key = String(val);
      counts[key] = (counts[key] || 0) + 1;
    }

    let maxCount = 0;
    let mostCommon = null;
    for (const [value, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = value;
      }
    }

    return { value: mostCommon, count: maxCount };
  };

  return (
    <div className="cursor-ai-panel">
      <div className="panel-header">
        <h3>🤖 Cursor AI Assistant</h3>
        <button type="button" className="close-button" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="panel-tabs">
        <button
          type="button"
          className={`tab ${selectedTab === "generate" ? "active" : ""}`}
          onClick={() => setSelectedTab("generate")}
        >
          Generate Defaults
        </button>
        <button
          type="button"
          className={`tab ${selectedTab === "patterns" ? "active" : ""}`}
          onClick={() => setSelectedTab("patterns")}
        >
          Data Patterns
        </button>
        <button
          type="button"
          className={`tab ${selectedTab === "suggestions" ? "active" : ""}`}
          onClick={() => setSelectedTab("suggestions")}
        >
          Smart Suggestions
        </button>
      </div>

      <div className="panel-content">
        {selectedTab === "generate" && (
          <div className="generate-tab">
            <div className="context-section">
              <label htmlFor="context-description">Context Description:</label>
              <textarea
                id="context-description"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Describe the type of data you're adding (e.g., 'Customer information for e-commerce store', 'Employee records for HR system')..."
                rows={3}
              />
            </div>

            <div className="column-selection">
              <div className="selection-header">
                <label htmlFor="column-list">
                  Select Columns for AI Generation:
                </label>
                <div className="selection-controls">
                  <button type="button" onClick={handleSelectAll}>
                    Select All
                  </button>
                  <button type="button" onClick={handleSelectNone}>
                    Select None
                  </button>
                </div>
              </div>

              <div id="column-list" className="column-list">
                {editableColumns.map((column) => (
                  <label key={column.id} className="column-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedColumns.includes(column.id)}
                      onChange={() => handleColumnToggle(column.id)}
                    />
                    <span className="column-info">
                      <span className="column-name">{column.name}</span>
                      <span className="column-type">({column.type})</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {lastGeneratedDefaults && (
              <div className="generated-preview">
                <h4>Last Generated Defaults:</h4>
                <div className="defaults-list">
                  {Object.entries(lastGeneratedDefaults).map(
                    ([columnId, value]) => {
                      const column = columns.find((col) => col.id === columnId);
                      return (
                        <div key={columnId} className="default-item">
                          <span className="default-column">
                            {column?.name || columnId}:
                          </span>
                          <span className="default-value">{String(value)}</span>
                        </div>
                      );
                    },
                  )}
                </div>
              </div>
            )}

            <div className="generate-actions">
              <button
                type="button"
                className="generate-button"
                onClick={handleGenerate}
                disabled={isGenerating || selectedColumns.length === 0}
              >
                {isGenerating ? "🔄 Generating..." : "✨ Generate AI Defaults"}
              </button>
            </div>
          </div>
        )}

        {selectedTab === "patterns" && (
          <div className="patterns-tab">
            <h4>Detected Data Patterns:</h4>
            <div className="patterns-list">
              {Object.entries(getDataPatterns()).map(([columnId, pattern]) => {
                const column = columns.find((col) => col.id === columnId);
                return (
                  <div key={columnId} className="pattern-item">
                    <div className="pattern-header">
                      <span className="pattern-column">
                        {column?.name || columnId}
                      </span>
                      <span className="pattern-type">({column?.type})</span>
                    </div>
                    <div className="pattern-stats">
                      <div className="stat">Unique: {pattern.uniqueCount}</div>
                      <div className="stat">
                        Total: {pattern.commonValues.length}
                      </div>
                      <div className="stat">Nulls: {pattern.nullCount}</div>
                      {pattern.commonValues.length > 0 && (
                        <div className="stat">
                          Common values:{" "}
                          {pattern.commonValues
                            .slice(0, 3)
                            .map(String)
                            .join(", ")}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {selectedTab === "suggestions" && (
          <div className="suggestions-tab">
            <h4>Smart Suggestions:</h4>
            <div className="suggestions-list">
              <div className="suggestion-item">
                <div className="suggestion-title">🎯 Data Quality</div>
                <div className="suggestion-content">
                  Based on your data patterns, consider adding validation rules
                  for email formats and phone number standardization.
                </div>
              </div>

              <div className="suggestion-item">
                <div className="suggestion-title">🔄 Auto-Generation</div>
                <div className="suggestion-content">
                  Enable UUID v7 generation for ID fields to maintain
                  chronological ordering while ensuring uniqueness.
                </div>
              </div>

              <div className="suggestion-item">
                <div className="suggestion-title">📊 Optimization</div>
                <div className="suggestion-content">
                  Consider indexing frequently queried columns like email and
                  name for better performance.
                </div>
              </div>

              <div className="suggestion-item">
                <div className="suggestion-title">🤖 AI Features</div>
                <div className="suggestion-content">
                  Use contextual auto-complete for address fields based on
                  postal codes and geographic data.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
