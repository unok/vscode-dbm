import type React from "react";
import { useEffect, useState } from "react";
import type { DatabaseConfig } from "../../shared/types";
import type { DatabaseSchema, TableMetadata, SchemaTreeNode } from "../../shared/types/schema";
import { useVSCodeAPI } from "../api/vscode";
import { SchemaTree } from "./SchemaTree";
import { TableDetailsPanel } from "./TableDetailsPanel";

const DatabaseExplorer: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [savedConnections, setSavedConnections] = useState<DatabaseConfig[]>([]);
  const [schema, setSchema] = useState<DatabaseSchema | null>(null);
  const [schemaTree, setSchemaTree] = useState<SchemaTreeNode[]>([]);
  const [selectedTable, setSelectedTable] = useState<TableMetadata | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);
  const vscodeApi = useVSCodeAPI();

  const handleConnect = async (connection: DatabaseConfig) => {
    try {
      vscodeApi.showInfo(`${connection.name} 接続中...`);
      // 実際の接続処理はExtension側で実行
      vscodeApi.postMessage("openConnection", {
        type: connection.type,
        host: connection.host,
        port: connection.port,
        database: connection.database,
        username: connection.username,
        password: connection.password,
        ssl: connection.ssl,
      });
      setIsConnected(true);
      // スキーマ取得をリクエスト
      vscodeApi.postMessage("getSchema", {});
    } catch (error) {
      console.error("Connection failed:", error);
    }
  };

  const handleNodeClick = (node: SchemaTreeNode) => {
    if (node.type === "table" && node.metadata) {
      const tableMetadata = node.metadata as TableMetadata;
      setSelectedTable(tableMetadata);
      setShowDetailsPanel(true);
      
      // より詳細な情報を取得
      vscodeApi.postMessage("getTableMetadataWithConstraints", {
        tableName: tableMetadata.name,
        schema: tableMetadata.schema,
      });
    }
  };

  const handleNodeExpand = (nodeId: string, expanded: boolean) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (expanded) {
        newSet.add(nodeId);
      } else {
        newSet.delete(nodeId);
      }
      return newSet;
    });
  };

  // スキーマからツリーノードを生成
  const buildSchemaTree = (schema: DatabaseSchema): SchemaTreeNode[] => {
    const nodes: SchemaTreeNode[] = [];

    // テーブルフォルダ
    if (schema.tables.length > 0) {
      const tablesNode: SchemaTreeNode = {
        id: "tables",
        label: `テーブル (${schema.tables.length})`,
        type: "tables",
        icon: "table",
        children: schema.tables.map(table => ({
          id: `table-${table.name}`,
          label: `${table.name} (${table.rowCount || 0} 行)`,
          type: "table",
          icon: "table",
          metadata: table,
          children: [{
            id: `table-${table.name}-columns`,
            label: `カラム (${table.columns.length})`,
            type: "columns",
            icon: "list",
            children: table.columns.map(column => ({
              id: `column-${table.name}-${column.name}`,
              label: `${column.name}: ${column.type}${column.isPrimaryKey ? " (PK)" : ""}${column.isForeignKey ? " (FK)" : ""}`,
              type: "column",
              icon: column.isPrimaryKey ? "key" : column.isForeignKey ? "link" : "field",
              metadata: column,
            })),
          }],
        })),
        isExpanded: true,
      };
      nodes.push(tablesNode);
    }

    // ビューフォルダ
    if (schema.views.length > 0) {
      const viewsNode: SchemaTreeNode = {
        id: "views",
        label: `ビュー (${schema.views.length})`,
        type: "views",
        icon: "eye",
        children: schema.views.map(view => ({
          id: `view-${view.name}`,
          label: view.name,
          type: "view",
          icon: "eye",
          metadata: view,
        })),
        isExpanded: false,
      };
      nodes.push(viewsNode);
    }

    return nodes;
  };

  useEffect(() => {
    // 保存された接続を取得
    vscodeApi.postMessage("getSavedConnections", {});

    // メッセージハンドラー
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case "savedConnections":
          setSavedConnections(message.data.connections || []);
          break;
        case "schema":
          setSchema(message.data);
          setSchemaTree(buildSchemaTree(message.data));
          // テーブルフォルダをデフォルトで展開
          setExpandedNodes(new Set(["tables"]));
          break;
        case "tableMetadataWithConstraints":
          // 詳細情報で既存のテーブル情報を更新
          if (selectedTable && message.data.name === selectedTable.name) {
            setSelectedTable(message.data);
          }
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [vscodeApi, selectedTable]);

  // スキーマが更新されたらツリーを再構築
  useEffect(() => {
    if (schema) {
      setSchemaTree(buildSchemaTree(schema));
    }
  }, [schema]);

  return (
    <div className="h-full flex flex-col bg-vscode-editor-background">
      <div className="p-4 border-b border-vscode-panel-border">
        <h2 className="text-lg font-semibold text-vscode-editor-foreground mb-4">
          データベースエクスプローラー
        </h2>

        {isConnected ? (
          <div className="text-center py-8">
            <div className="text-green-400 mb-2">✅ 接続完了</div>
            <p className="text-sm text-vscode-descriptionForeground">
              スキーマエクスプローラー機能は開発中です
            </p>
            <button
              type="button"
              onClick={() => setIsConnected(false)}
              className="mt-3 px-4 py-2 bg-vscode-button-background text-vscode-button-foreground rounded hover:bg-vscode-button-hoverBackground"
            >
              切断
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-vscode-descriptionForeground mb-3">
              保存された接続からデータベースに接続
            </p>

            {savedConnections.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-vscode-descriptionForeground mb-3">
                  接続が保存されていません
                </p>
                <p className="text-xs text-vscode-descriptionForeground">
                  「New Connection」ボタンから接続を追加してください
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {savedConnections.map((connection) => {
                  const getIcon = (type: string) => {
                    switch (type) {
                      case "mysql":
                        return "🐬";
                      case "postgresql":
                        return "🐘";
                      case "sqlite":
                        return "📁";
                      default:
                        return "🗄️";
                    }
                  };

                  const getDisplayInfo = (connection: DatabaseConfig) => {
                    if (connection.type === "sqlite") {
                      return connection.database;
                    }
                    return `${connection.host}:${connection.port}`;
                  };

                  return (
                    <button
                      key={connection.id}
                      type="button"
                      onClick={() => handleConnect(connection)}
                      className="flex items-center p-3 border border-vscode-input-border rounded hover:bg-vscode-list-hoverBackground"
                    >
                      <span className="mr-2">{getIcon(connection.type)}</span>
                      <div className="text-left flex-1">
                        <div className="font-medium text-vscode-editor-foreground">
                          {connection.name}
                        </div>
                        <div className="text-xs text-vscode-descriptionForeground">
                          {connection.type.toUpperCase()} -{" "}
                          {getDisplayInfo(connection)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {isConnected && (
        <div className="flex-1 flex">
          {/* スキーマツリー */}
          <div className="w-1/2 border-r border-vscode-panel-border">
            <div className="h-full overflow-auto">
              {schemaTree.length > 0 ? (
                <SchemaTree
                  nodes={schemaTree}
                  onNodeClick={handleNodeClick}
                  expandedNodeIds={expandedNodes}
                  onNodeExpand={handleNodeExpand}
                  className="p-2"
                />
              ) : (
                <div className="p-4 text-center text-vscode-descriptionForeground">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-vscode-focusBorder mx-auto mb-3"></div>
                  スキーマを読み込み中...
                </div>
              )}
            </div>
          </div>

          {/* テーブル詳細パネル */}
          <div className="w-1/2">
            <TableDetailsPanel
              table={selectedTable}
              className="h-full"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default DatabaseExplorer;
