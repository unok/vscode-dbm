import type React from "react";
import { useState } from "react";
import type { TableDefinition } from "../../../shared/types/table-management";

interface TablePreviewProps {
  tableDefinition: TableDefinition;
  generatedSQL: string;
  isGenerating: boolean;
  onRegenerate: () => void;
}

export const TablePreview: React.FC<TablePreviewProps> = ({
  tableDefinition,
  generatedSQL,
  isGenerating,
  onRegenerate,
}) => {
  const [activeTab, setActiveTab] = useState<"summary" | "sql">("summary");

  const primaryKeyColumns = tableDefinition.columns.filter(
    (col) => col.isPrimaryKey,
  );
  const foreignKeyConstraints =
    tableDefinition.constraints?.filter((c) => c.type === "FOREIGN_KEY") || [];
  const uniqueConstraints =
    tableDefinition.constraints?.filter((c) => c.type === "UNIQUE") || [];
  const checkConstraints =
    tableDefinition.constraints?.filter((c) => c.type === "CHECK") || [];
  const uniqueIndexes =
    tableDefinition.indexes?.filter((idx) => idx.unique) || [];
  const regularIndexes =
    tableDefinition.indexes?.filter((idx) => !idx.unique) || [];

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Could show a toast notification here
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Preview</h3>
        <div className="flex space-x-1 mt-2">
          <button
            type="button"
            onClick={() => setActiveTab("summary")}
            className={`px-3 py-1 text-sm rounded ${
              activeTab === "summary"
                ? "bg-blue-100 text-blue-700"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Summary
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("sql")}
            className={`px-3 py-1 text-sm rounded ${
              activeTab === "sql"
                ? "bg-blue-100 text-blue-700"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            SQL
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "summary" && (
          <div className="space-y-4">
            {/* Table Info */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">
                Table Information
              </h4>
              <div className="text-sm text-gray-600 space-y-1">
                <div>
                  <span className="font-medium">Name:</span>{" "}
                  {tableDefinition.name || "Untitled"}
                </div>
                <div>
                  <span className="font-medium">Schema:</span>{" "}
                  {tableDefinition.schema}
                </div>
                {tableDefinition.comment && (
                  <div>
                    <span className="font-medium">Comment:</span>{" "}
                    {tableDefinition.comment}
                  </div>
                )}
              </div>
            </div>

            {/* Columns Summary */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">
                Columns ({tableDefinition.columns.length})
              </h4>
              {tableDefinition.columns.length === 0 ? (
                <p className="text-sm text-gray-500">No columns defined</p>
              ) : (
                <div className="space-y-2">
                  {tableDefinition.columns.map((column) => (
                    <div
                      key={column.name}
                      className="text-xs bg-gray-50 p-2 rounded"
                    >
                      <div className="font-medium text-gray-900">
                        {column.name}
                        {column.isPrimaryKey && (
                          <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            PK
                          </span>
                        )}
                        {column.autoIncrement && (
                          <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            AI
                          </span>
                        )}
                      </div>
                      <div className="text-gray-600 mt-1">
                        {column.dataType}
                        {!column.nullable && " NOT NULL"}
                        {column.defaultValue &&
                          ` DEFAULT ${column.defaultValue}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Primary Keys */}
            {primaryKeyColumns.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">
                  Primary Key
                </h4>
                <div className="text-sm text-gray-600">
                  {primaryKeyColumns.map((col) => col.name).join(", ")}
                </div>
              </div>
            )}

            {/* Foreign Keys */}
            {foreignKeyConstraints.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">
                  Foreign Keys ({foreignKeyConstraints.length})
                </h4>
                <div className="space-y-2">
                  {foreignKeyConstraints.map((fk) => (
                    <div
                      key={fk.name}
                      className="text-xs bg-gray-50 p-2 rounded"
                    >
                      <div className="font-medium text-gray-900">{fk.name}</div>
                      <div className="text-gray-600">
                        {fk.columns?.join(", ")} → {fk.referencedTable}(
                        {fk.referencedColumns?.join(", ")})
                      </div>
                      <div className="text-gray-500">
                        ON DELETE {fk.onDelete} ON UPDATE {fk.onUpdate}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unique Constraints */}
            {uniqueConstraints.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">
                  Unique Constraints ({uniqueConstraints.length})
                </h4>
                <div className="space-y-1">
                  {uniqueConstraints.map((uc) => (
                    <div
                      key={uc.name}
                      className="text-xs bg-gray-50 p-2 rounded"
                    >
                      <div className="font-medium text-gray-900">{uc.name}</div>
                      <div className="text-gray-600">
                        {uc.columns?.join(", ")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Check Constraints */}
            {checkConstraints.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">
                  Check Constraints ({checkConstraints.length})
                </h4>
                <div className="space-y-1">
                  {checkConstraints.map((cc) => (
                    <div
                      key={cc.name}
                      className="text-xs bg-gray-50 p-2 rounded"
                    >
                      <div className="font-medium text-gray-900">{cc.name}</div>
                      <div className="text-gray-600 font-mono">
                        {cc.checkExpression}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Indexes */}
            {(uniqueIndexes.length > 0 || regularIndexes.length > 0) && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">
                  Indexes ({uniqueIndexes.length + regularIndexes.length})
                </h4>
                <div className="space-y-2">
                  {uniqueIndexes.map((idx) => (
                    <div
                      key={idx.name}
                      className="text-xs bg-gray-50 p-2 rounded"
                    >
                      <div className="font-medium text-gray-900">
                        {idx.name}
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          UNIQUE
                        </span>
                      </div>
                      <div className="text-gray-600">
                        {idx.columns.join(", ")}
                      </div>
                      {idx.where && (
                        <div className="text-gray-500 font-mono">
                          WHERE {idx.where}
                        </div>
                      )}
                    </div>
                  ))}
                  {regularIndexes.map((idx) => (
                    <div
                      key={idx.name}
                      className="text-xs bg-gray-50 p-2 rounded"
                    >
                      <div className="font-medium text-gray-900">
                        {idx.name}
                      </div>
                      <div className="text-gray-600">
                        {idx.columns.join(", ")}
                      </div>
                      {idx.where && (
                        <div className="text-gray-500 font-mono">
                          WHERE {idx.where}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "sql" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-medium text-gray-900">
                Generated SQL
              </h4>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={onRegenerate}
                  disabled={isGenerating}
                  className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                >
                  {isGenerating ? "Generating..." : "Regenerate"}
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(generatedSQL)}
                  className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
                >
                  Copy
                </button>
              </div>
            </div>

            {isGenerating ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                <span className="ml-2 text-sm text-gray-600">
                  Generating SQL...
                </span>
              </div>
            ) : generatedSQL ? (
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                <pre className="text-sm font-mono whitespace-pre-wrap">
                  {generatedSQL}
                </pre>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">
                  {tableDefinition.name && tableDefinition.columns.length > 0
                    ? "Click 'Regenerate' to generate SQL"
                    : "Add table name and columns to generate SQL"}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
