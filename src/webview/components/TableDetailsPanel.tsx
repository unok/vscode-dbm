import type React from "react";
import { useState } from "react";
import type { 
  TableMetadata, 
  ColumnMetadata, 
  IndexMetadata, 
  ConstraintMetadata 
} from "../../shared/types/schema";
import { Icon, IconNames } from "./Icon";

interface TableDetailsPanelProps {
  table: TableMetadata | null;
  onClose?: () => void;
  className?: string;
}

export const TableDetailsPanel: React.FC<TableDetailsPanelProps> = ({
  table,
  onClose,
  className = "",
}) => {
  const [activeTab, setActiveTab] = useState<"columns" | "indexes" | "constraints">("columns");

  if (!table) {
    return (
      <div className={`table-details-panel ${className}`}>
        <div className="p-4 text-center text-gray-500">
          テーブルを選択してください
        </div>
      </div>
    );
  }

  return (
    <div className={`table-details-panel ${className}`}>
      {/* Header */}
      <div className="table-details-header bg-vscode-editorWidget-background border-b border-vscode-panel-border p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Icon name={IconNames.TABLE} className="text-green-400" />
            <div>
              <h3 className="text-lg font-medium text-vscode-editor-foreground">
                {table.name}
              </h3>
              {table.schema && (
                <p className="text-sm text-vscode-descriptionForeground">
                  スキーマ: {table.schema}
                </p>
              )}
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-vscode-icon-foreground hover:text-vscode-editor-foreground"
              aria-label="詳細パネルを閉じる"
            >
              <Icon name={IconNames.CLOSE} />
            </button>
          )}
        </div>

        {/* Table Info */}
        <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-vscode-descriptionForeground">行数:</span>
            <span className="ml-2 text-vscode-editor-foreground">
              {table.rowCount?.toLocaleString() || "不明"}
            </span>
          </div>
          <div>
            <span className="text-vscode-descriptionForeground">カラム数:</span>
            <span className="ml-2 text-vscode-editor-foreground">
              {table.columns.length}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="table-details-tabs border-b border-vscode-panel-border">
        <div className="flex">
          <TabButton
            active={activeTab === "columns"}
            onClick={() => setActiveTab("columns")}
            count={table.columns.length}
          >
            カラム
          </TabButton>
          <TabButton
            active={activeTab === "indexes"}
            onClick={() => setActiveTab("indexes")}
            count={table.indexes?.length || 0}
          >
            インデックス
          </TabButton>
          <TabButton
            active={activeTab === "constraints"}
            onClick={() => setActiveTab("constraints")}
            count={table.constraints?.length || 0}
          >
            制約
          </TabButton>
        </div>
      </div>

      {/* Content */}
      <div className="table-details-content flex-1 overflow-auto">
        {activeTab === "columns" && <ColumnsTab columns={table.columns} />}
        {activeTab === "indexes" && <IndexesTab indexes={table.indexes || []} />}
        {activeTab === "constraints" && <ConstraintsTab constraints={table.constraints || []} />}
      </div>
    </div>
  );
};

// Tab Button Component
interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  count?: number;
  children: React.ReactNode;
}

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, count, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      active
        ? "border-vscode-focusBorder text-vscode-editor-foreground bg-vscode-tab-activeBackground"
        : "border-transparent text-vscode-descriptionForeground hover:text-vscode-editor-foreground hover:bg-vscode-list-hoverBackground"
    }`}
  >
    {children}
    {count !== undefined && (
      <span className="ml-1 text-xs opacity-70">({count})</span>
    )}
  </button>
);

// Columns Tab Component
interface ColumnsTabProps {
  columns: ColumnMetadata[];
}

const ColumnsTab: React.FC<ColumnsTabProps> = ({ columns }) => (
  <div className="p-4">
    <div className="space-y-3">
      {columns.map((column, index) => (
        <div
          key={column.name}
          className="column-item bg-vscode-editorWidget-background border border-vscode-panel-border rounded p-3"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <ColumnIcon />
              <span className="font-medium text-vscode-editor-foreground">
                {column.name}
              </span>
              {column.isPrimaryKey && <Badge color="blue">PK</Badge>}
              {column.isForeignKey && <Badge color="green">FK</Badge>}
              {column.isUnique && <Badge color="purple">UNIQUE</Badge>}
              {!column.nullable && <Badge color="red">NOT NULL</Badge>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-vscode-descriptionForeground">型:</span>
              <span className="ml-2 text-vscode-editor-foreground">
                {column.fullType || column.type}
              </span>
            </div>
            
            {column.defaultValue && (
              <div>
                <span className="text-vscode-descriptionForeground">デフォルト:</span>
                <span className="ml-2 text-vscode-editor-foreground font-mono text-xs">
                  {column.defaultValue}
                </span>
              </div>
            )}

            {column.characterMaximumLength && (
              <div>
                <span className="text-vscode-descriptionForeground">最大長:</span>
                <span className="ml-2 text-vscode-editor-foreground">
                  {column.characterMaximumLength}
                </span>
              </div>
            )}

            {column.numericPrecision && (
              <div>
                <span className="text-vscode-descriptionForeground">精度:</span>
                <span className="ml-2 text-vscode-editor-foreground">
                  {column.numericPrecision}
                  {column.numericScale && `,${column.numericScale}`}
                </span>
              </div>
            )}

            {column.constraintName && (
              <div>
                <span className="text-vscode-descriptionForeground">制約名:</span>
                <span className="ml-2 text-vscode-editor-foreground font-mono text-xs">
                  {column.constraintName}
                </span>
              </div>
            )}

            {column.foreignKeyTarget && (
              <div className="col-span-2">
                <span className="text-vscode-descriptionForeground">参照先:</span>
                <span className="ml-2 text-vscode-editor-foreground font-mono text-xs">
                  {column.foreignKeyTarget.table}.{column.foreignKeyTarget.column}
                </span>
              </div>
            )}

            {column.comment && (
              <div className="col-span-2">
                <span className="text-vscode-descriptionForeground">コメント:</span>
                <span className="ml-2 text-vscode-editor-foreground">
                  {column.comment}
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Indexes Tab Component
interface IndexesTabProps {
  indexes: IndexMetadata[];
}

const IndexesTab: React.FC<IndexesTabProps> = ({ indexes }) => (
  <div className="p-4">
    {indexes.length === 0 ? (
      <div className="text-center text-gray-500 py-8">
        インデックスが見つかりません
      </div>
    ) : (
      <div className="space-y-3">
        {indexes.map((index, i) => (
          <div
            key={index.name}
            className="index-item bg-vscode-editorWidget-background border border-vscode-panel-border rounded p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <IndexIcon />
                <span className="font-medium text-vscode-editor-foreground">
                  {index.name}
                </span>
                {index.isPrimary && <Badge color="blue">PRIMARY</Badge>}
                {index.isUnique && <Badge color="purple">UNIQUE</Badge>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-vscode-descriptionForeground">タイプ:</span>
                <span className="ml-2 text-vscode-editor-foreground uppercase">
                  {index.type}
                </span>
              </div>
              
              <div className="col-span-2">
                <span className="text-vscode-descriptionForeground">カラム:</span>
                <span className="ml-2 text-vscode-editor-foreground">
                  {index.columns.join(", ")}
                </span>
              </div>

              {index.size && (
                <div>
                  <span className="text-vscode-descriptionForeground">サイズ:</span>
                  <span className="ml-2 text-vscode-editor-foreground">
                    {(index.size / 1024).toFixed(1)} KB
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

// Constraints Tab Component
interface ConstraintsTabProps {
  constraints: ConstraintMetadata[];
}

const ConstraintsTab: React.FC<ConstraintsTabProps> = ({ constraints }) => (
  <div className="p-4">
    {constraints.length === 0 ? (
      <div className="text-center text-gray-500 py-8">
        制約が見つかりません
      </div>
    ) : (
      <div className="space-y-3">
        {constraints.map((constraint, i) => (
          <div
            key={constraint.name}
            className="constraint-item bg-vscode-editorWidget-background border border-vscode-panel-border rounded p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Icon name="lock" className="text-red-400" size="sm" />
                <span className="font-medium text-vscode-editor-foreground">
                  {constraint.name}
                </span>
                <Badge color={getConstraintColor(constraint.type)}>
                  {constraint.type.toUpperCase().replace("_", " ")}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 text-sm">
              <div>
                <span className="text-vscode-descriptionForeground">カラム:</span>
                <span className="ml-2 text-vscode-editor-foreground">
                  {constraint.columns.join(", ")}
                </span>
              </div>
              
              {constraint.referencedTable && (
                <div>
                  <span className="text-vscode-descriptionForeground">参照先:</span>
                  <span className="ml-2 text-vscode-editor-foreground">
                    {constraint.referencedTable}
                    {constraint.referencedColumns && 
                      ` (${constraint.referencedColumns.join(", ")})`
                    }
                  </span>
                </div>
              )}

              {constraint.definition && (
                <div>
                  <span className="text-vscode-descriptionForeground">定義:</span>
                  <span className="ml-2 text-vscode-editor-foreground font-mono text-xs">
                    {constraint.definition}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

// Badge Component
interface BadgeProps {
  color: "blue" | "green" | "purple" | "red" | "orange";
  children: React.ReactNode;
}

const Badge: React.FC<BadgeProps> = ({ color, children }) => {
  const colorClasses = {
    blue: "bg-blue-100 text-blue-800 border-blue-200",
    green: "bg-green-100 text-green-800 border-green-200",
    purple: "bg-purple-100 text-purple-800 border-purple-200",
    red: "bg-red-100 text-red-800 border-red-200",
    orange: "bg-orange-100 text-orange-800 border-orange-200",
  };

  return (
    <span className={`px-2 py-1 text-xs font-medium border rounded ${colorClasses[color]}`}>
      {children}
    </span>
  );
};

// Helper Functions
function getConstraintColor(type: string): "blue" | "green" | "purple" | "red" | "orange" {
  switch (type) {
    case "primary_key":
      return "blue";
    case "foreign_key":
      return "green";
    case "unique":
      return "purple";
    case "check":
      return "orange";
    case "not_null":
      return "red";
    default:
      return "blue";
  }
}

// Helper function to get the appropriate column badge icon
const getColumnBadgeIcon = (type: "pk" | "fk" | "unique" | "not_null") => {
  switch (type) {
    case "pk":
      return <Icon name="key" className="text-yellow-500" size="sm" />;
    case "fk":
      return <Icon name="link" className="text-blue-500" size="sm" />;
    case "unique":
      return <Icon name="star" className="text-purple-500" size="sm" />;
    case "not_null":
      return <Icon name="shield" className="text-green-500" size="sm" />;
    default:
      return null;
  }
};