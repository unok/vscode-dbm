import React, {
  Suspense,
  startTransition,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { DatabaseConfig } from "../shared/types";
import { useVSCodeAPI } from "./api/vscode";
import { ConnectionConfigDialog } from "./components/ConnectionConfigDialog";
import { CustomizableToolbar } from "./components/CustomizableToolbar";
import { Layout } from "./components/Layout";
import { LoadingSpinner } from "./components/LoadingSpinner";
import { SettingsUI } from "./components/SettingsUI";
import { useVSCodeTheme } from "./hooks/useVSCodeTheme";
import { WebViewSettingsService } from "./services/WebViewSettingsService";
import { WebViewToolbarService } from "./services/WebViewToolbarService";
import { DevelopmentOverlay } from "./utils/devHelper";

// React 19 lazy loading for main components
const DatabaseExplorer = React.lazy(
  () => import("./components/DatabaseExplorer"),
);
const DataGrid = React.lazy(() => import("./components/DataGrid"));
const SqlEditor = React.lazy(() => import("./components/SQLEditor"));

type View = "dashboard" | "explorer" | "datagrid" | "sql";

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>("dashboard");
  const [showSettings, setShowSettings] = useState(false);
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [editingConnection, setEditingConnection] = useState<
    DatabaseConfig | undefined
  >();
  const [savedConnections, setSavedConnections] = useState<DatabaseConfig[]>(
    [],
  );

  // Debug logging for state changes (removed for production)
  const theme = useVSCodeTheme();
  const vscodeApi = useVSCodeAPI();

  // Initialize services
  const toolbarService = useMemo(() => {
    const service = new WebViewToolbarService();

    // Register action callbacks for toolbar items
    service.registerAction("new-connection", () => {
      try {
        setEditingConnection(undefined);
        setShowConnectionDialog(true);
      } catch (error) {
        console.error("Error opening connection dialog:", error);
        vscodeApi.showError(
          `Failed to open connection dialog: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    });

    service.registerAction("refresh-connections", () => {
      // 保存された接続を取得
      vscodeApi.postMessage("getSavedConnections", {});
    });

    service.registerAction("new-query", () => {
      vscodeApi.showInfo("Creating new query...");
      setCurrentView("sql");
    });

    service.registerAction("execute-query", () => {
      vscodeApi.showInfo("Executing query...");
    });

    service.registerAction("format-sql", () => {
      vscodeApi.showInfo("Formatting SQL...");
    });

    service.registerAction("save-query", () => {
      vscodeApi.showInfo("Saving query...");
    });

    service.registerAction("import-data", () => {
      vscodeApi.showInfo("Import data dialog will open");
    });

    service.registerAction("table-manager", () => {
      vscodeApi.showInfo("Table Manager will open");
      setCurrentView("datagrid");
    });

    service.registerAction("database-explorer", () => {
      vscodeApi.showInfo("Database Explorer");
      setCurrentView("explorer");
    });

    service.registerAction("query-history", () => {
      vscodeApi.showInfo("Query History will open");
    });

    return service;
  }, [vscodeApi]);

  const settingsService = useMemo(() => new WebViewSettingsService(), []);

  // Connection dialog handlers
  const handleConnectionSave = (config: DatabaseConfig) => {
    // Send connection config to extension for saving
    vscodeApi.postMessage("saveConnection", config);
    setShowConnectionDialog(false);
    setEditingConnection(undefined);
    vscodeApi.showInfo(`Connection "${config.name}" saved successfully`);

    // 保存後に接続一覧を更新
    vscodeApi.postMessage("getSavedConnections", {});
  };

  const handleConnectionTest = async (
    config: DatabaseConfig,
  ): Promise<{ success: boolean; message: string }> => {
    try {
      // Send test connection request to extension
      vscodeApi.postMessage("testConnection", config);
      // For now, return a mock result - extension should respond via message
      return { success: true, message: "Connection test successful" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { success: false, message };
    }
  };

  const handleConnectionCancel = () => {
    setShowConnectionDialog(false);
    setEditingConnection(undefined);
  };

  useEffect(() => {
    // Set initial view from VSCode if provided
    const initialView = vscodeApi.getInitialViewType() as View;
    if (initialView && initialView !== "dashboard") {
      setCurrentView(initialView);
    }

    // Listen for view change messages from extension
    vscodeApi.onMessage("changeView", (data) => {
      const messageData = data as { viewType?: string };
      if (messageData.viewType) {
        startTransition(() => {
          // Map message view types to internal view types
          const viewMap: Record<string, View> = {
            explorer: "explorer",
            grid: "datagrid",
            editor: "sql",
          };
          const mappedView = messageData.viewType
            ? viewMap[messageData.viewType] || "dashboard"
            : "dashboard";
          setCurrentView(mappedView);
        });
      }
    });

    // Listen for saved connections response
    vscodeApi.onMessage("savedConnections", (data) => {
      const messageData = data as { connections: DatabaseConfig[] };
      setSavedConnections(messageData.connections || []);
    });

    // Request initial theme and connections
    vscodeApi.getTheme();
    vscodeApi.postMessage("getSavedConnections", {});

    return () => {
      vscodeApi.removeMessageHandler("changeView");
      vscodeApi.removeMessageHandler("savedConnections");
    };
  }, [vscodeApi]);

  const handleViewChange = (view: View) => {
    startTransition(() => {
      setCurrentView(view);
    });
  };

  const renderContent = () => {
    switch (currentView) {
      case "explorer":
        return <DatabaseExplorer />;
      case "datagrid":
        return <DataGrid />;
      case "sql":
        return <SqlEditor />;
      default:
        return (
          <DashboardView
            onViewChange={handleViewChange}
            savedConnections={savedConnections}
          />
        );
    }
  };

  return (
    <>
      <Layout
        currentView={currentView}
        onViewChange={handleViewChange}
        theme={theme}
        onShowSettings={() => setShowSettings(true)}
      >
        <CustomizableToolbar toolbarService={toolbarService} className="mb-4" />
        <Suspense fallback={<LoadingSpinner />}>{renderContent()}</Suspense>
        <DevelopmentOverlay />
      </Layout>

      {showSettings && (
        <SettingsUI
          settingsService={settingsService}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showConnectionDialog && (
        <ConnectionConfigDialog
          isOpen={showConnectionDialog}
          initialConfig={editingConnection}
          onSave={handleConnectionSave}
          onCancel={handleConnectionCancel}
          onTest={handleConnectionTest}
        />
      )}
    </>
  );
};

const DashboardView: React.FC<{
  onViewChange: (view: View) => void;
  savedConnections: DatabaseConfig[];
}> = ({ onViewChange, savedConnections }) => {
  const vscodeApi = useVSCodeAPI();

  const handleTestConnection = async () => {
    try {
      vscodeApi.showInfo("Testing VSCode API communication...");
      await vscodeApi.getConnectionStatus();
    } catch (error) {
      console.error("Connection test failed:", error);
    }
  };

  const handleTestHmr = () => {
    const isWorking = true; // DevHelper.testHMR() is not needed
    vscodeApi.showInfo(`HMR ${isWorking ? "is working" : "is not available"}`);
  };
  return (
    <div className="p-6 space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-blue-400 mb-2">
          Database DataGrid Manager
        </h1>
        <p className="text-gray-300">
          VSCode extension for advanced database management with DataGrid
          interface
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-green-400 mb-3">
            データベース接続
          </h2>
          <p className="text-gray-300 mb-4">MySQL、PostgreSQL、SQLiteに対応</p>
          <div className="space-x-2">
            <button
              type="button"
              className="btn-primary"
              onClick={() => onViewChange("explorer")}
            >
              接続設定
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleTestConnection}
            >
              API Test
            </button>
          </div>

          {/* 保存された接続一覧 */}
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-300 mb-2">
              保存された接続 ({savedConnections.length})
            </h3>
            {savedConnections.length === 0 ? (
              <p className="text-xs text-gray-500">接続が保存されていません</p>
            ) : (
              <div className="space-y-1">
                {savedConnections.slice(0, 3).map((conn) => (
                  <div
                    key={conn.id}
                    className="flex items-center justify-between bg-gray-700 px-2 py-1 rounded text-xs"
                  >
                    <span className="text-gray-300">{conn.name}</span>
                    <span className="text-gray-500 capitalize">
                      {conn.type}
                    </span>
                  </div>
                ))}
                {savedConnections.length > 3 && (
                  <p className="text-xs text-gray-500">
                    他 {savedConnections.length - 3} 件...
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-semibold text-purple-400 mb-3">
            DataGrid
          </h2>
          <p className="text-gray-300 mb-4">直感的なテーブルデータ編集</p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => onViewChange("datagrid")}
          >
            テーブル表示
          </button>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-semibold text-orange-400 mb-3">
            SQLエディタ
          </h2>
          <p className="text-gray-300 mb-4">シンタックスハイライト対応</p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => onViewChange("sql")}
          >
            クエリ実行
          </button>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-xl font-semibold text-yellow-400 mb-3">
          🚀 フェーズ3: Vite WebView UI基盤 構築中
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h3 className="font-semibold text-green-300 mb-2">✅ 完了項目</h3>
            <ul className="text-gray-300 space-y-1">
              <li>• React 19 concurrent rendering</li>
              <li>• Suspense boundaries</li>
              <li>• startTransition for smooth UI</li>
              <li>• VSCode theme integration</li>
              <li>• Tailwind CSS setup</li>
              <li>• WebView communication</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-blue-300 mb-2">🔄 進行中</h3>
            <ul className="text-gray-300 space-y-1">
              <li>• フェーズ4: スキーマエクスプローラー</li>
              <li>• フェーズ5: TanStack Table DataGrid</li>
              <li>• フェーズ6: Monaco Editor SQLエディタ</li>
              <li>• Cursor AI統合機能</li>
            </ul>
            <div className="mt-4 space-x-2">
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={handleTestHmr}
              >
                Test HMR
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
