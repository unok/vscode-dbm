import type React from "react";
import { useEffect, useState } from "react";
import type { DatabaseConfig } from "../../shared/types";
import { useVSCodeAPI } from "../api/vscode";

const DatabaseExplorer: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [savedConnections, setSavedConnections] = useState<DatabaseConfig[]>(
    [],
  );
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
    } catch (error) {
      console.error("Connection failed:", error);
    }
  };

  useEffect(() => {
    // 保存された接続を取得
    vscodeApi.postMessage("getSavedConnections", {});

    // 保存された接続のレスポンスを処理
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === "savedConnections") {
        setSavedConnections(message.data.connections || []);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [vscodeApi]);

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
        <div className="flex-1 p-4">
          <div className="bg-vscode-editorWidget-background border border-vscode-panel-border rounded p-4">
            <h3 className="font-medium text-vscode-editor-foreground mb-3">
              📊 データベース構造
            </h3>
            <div className="space-y-2 text-sm text-vscode-descriptionForeground">
              <div>📁 テーブル (3)</div>
              <div className="ml-4">📄 users</div>
              <div className="ml-4">📄 products</div>
              <div className="ml-4">📄 orders</div>
              <div>👁️ ビュー (1)</div>
              <div className="ml-4">📄 user_orders</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatabaseExplorer;
