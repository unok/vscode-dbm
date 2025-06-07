import * as vscode from "vscode";
import {
  type DatabaseProxy,
  type DatabaseProxyConfig,
  DatabaseProxyFactory,
} from "../../shared/database/DatabaseProxy";
import type { DatabaseConfig } from "../../shared/types";
import type {
  BaseMessage,
  ConnectionStatusMessage,
  DatabaseInfo,
  ExecuteQueryMessage,
  OpenConnectionMessage,
} from "../../shared/types/messages";

/**
 * データベース接続とクエリ実行を管理する中央サービス
 * サイドバーとパネルの両方から利用可能
 */
interface ActiveConnection {
  id: string;
  name: string;
  type: string;
  proxy: DatabaseProxy;
  config: DatabaseConfig;
  isConnected: boolean;
  connectedAt: Date;
}

export class DatabaseService {
  private static instance: DatabaseService | undefined;
  private activeConnections: Map<string, ActiveConnection> = new Map();
  private listeners: Map<string, (message: BaseMessage) => void> = new Map();
  private savedConnections: DatabaseConfig[] = [];
  private extensionContext?: vscode.ExtensionContext;

  private constructor() {}

  /**
   * シングルトンインスタンスを取得
   */
  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * VSCode Extension Contextを設定
   */
  setExtensionContext(context: vscode.ExtensionContext): void {
    this.extensionContext = context;
  }

  /**
   * メッセージリスナーを登録
   */
  addMessageListener(id: string, callback: (message: BaseMessage) => void) {
    this.listeners.set(id, callback);
  }

  /**
   * メッセージリスナーを削除
   */
  removeMessageListener(id: string) {
    this.listeners.delete(id);
  }

  /**
   * 全てのリスナーにメッセージを送信
   */
  private broadcastMessage(message: BaseMessage) {
    for (const callback of this.listeners.values()) {
      callback(message);
    }
  }

  /**
   * アクティブ接続一覧の更新をブロードキャスト
   */
  private broadcastActiveConnections() {
    this.broadcastMessage({
      type: "activeConnections",
      data: {
        connections: this.getActiveConnections(),
      },
    });
  }

  /**
   * 接続状態を取得
   */
  getConnectionStatus(): ConnectionStatusMessage["data"] {
    const databases: DatabaseInfo[] = [];

    // アクティブな接続から情報を構築
    for (const connection of this.activeConnections.values()) {
      if (connection.isConnected) {
        databases.push({
          name: connection.config.database || connection.name,
          type: connection.config.type,
          tables: [], // 実際のテーブル一覧は別途取得
          views: [],
        });
      }
    }

    // 最初にアクティブな接続を代表として返す（後で改善）
    const firstActiveConnection = Array.from(
      this.activeConnections.values(),
    ).find((conn) => conn.isConnected);

    return {
      connected:
        this.activeConnections.size > 0 &&
        Array.from(this.activeConnections.values()).some((c) => c.isConnected),
      databases,
      activeConnection: firstActiveConnection
        ? {
            id: firstActiveConnection.id,
            name: firstActiveConnection.name,
            type: firstActiveConnection.config.type,
            host: firstActiveConnection.config.host || "",
            port: firstActiveConnection.config.port || 0,
            database: firstActiveConnection.config.database || "",
            username: firstActiveConnection.config.username || "",
            isConnected: firstActiveConnection.isConnected,
          }
        : undefined,
    };
  }

  /**
   * すべてのアクティブ接続を取得
   */
  getActiveConnections(): ActiveConnection[] {
    return Array.from(this.activeConnections.values());
  }

  /**
   * 特定の接続を取得
   */
  getConnection(connectionId: string): ActiveConnection | undefined {
    return this.activeConnections.get(connectionId);
  }

  /**
   * データベースに接続（複数接続対応）
   */
  async connect(
    data: Partial<OpenConnectionMessage["data"]>,
    connectionId?: string,
  ): Promise<{ success: boolean; message: string; connectionId?: string }> {
    try {
      // 接続IDを生成（指定されていない場合）
      const finalConnectionId =
        connectionId ||
        `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // 既存の同じIDの接続があれば切断
      const existingConnection = this.activeConnections.get(finalConnectionId);
      if (existingConnection) {
        await existingConnection.proxy.disconnect();
        this.activeConnections.delete(finalConnectionId);
      }

      // 設定を環境変数、VSCode設定、ユーザー入力の順で取得
      // ワークスペースが開かれていない場合でも安全にアクセス
      let vscodeConfig: vscode.WorkspaceConfiguration;
      try {
        vscodeConfig = vscode.workspace.getConfiguration("vscode-dbm");
      } catch (error) {
        console.warn(
          "Could not access workspace configuration, using defaults:",
          error,
        );
        // 空の設定オブジェクトを作成
        vscodeConfig = {
          get: () => undefined,
          has: () => false,
          inspect: () => undefined,
          update: () => Promise.resolve(),
        } as vscode.WorkspaceConfiguration;
      }

      const dbType =
        data.type === "postgresql"
          ? "postgresql"
          : data.type === "sqlite"
            ? "sqlite"
            : "mysql";

      // ユーザーが指定した値または環境変数のみを使用（デフォルト値なし）
      const getStringConfigValue = (
        userValue: unknown,
        envVar: string | undefined,
        configKey: string,
      ): string | undefined => {
        if (userValue !== undefined && userValue !== null && userValue !== "") {
          return String(userValue);
        }
        if (envVar && process.env[envVar]) {
          return process.env[envVar];
        }
        try {
          const configValue = vscodeConfig.get(configKey);
          if (
            configValue !== undefined &&
            configValue !== null &&
            configValue !== ""
          ) {
            return String(configValue);
          }
        } catch (configError) {
          // VSCode設定アクセスエラーは無視
          console.warn(
            `Failed to access VSCode config for ${configKey}:`,
            configError,
          );
        }
        return undefined;
      };

      const getNumberConfigValue = (
        userValue: unknown,
        envVar: string | undefined,
        configKey: string,
      ): number | undefined => {
        if (userValue !== undefined && userValue !== null && userValue !== "") {
          return Number(userValue);
        }
        if (envVar && process.env[envVar]) {
          return Number(process.env[envVar]);
        }
        try {
          const configValue = vscodeConfig.get(configKey);
          if (
            configValue !== undefined &&
            configValue !== null &&
            configValue !== ""
          ) {
            return Number(configValue);
          }
        } catch (configError) {
          // VSCode設定アクセスエラーは無視
          console.warn(
            `Failed to access VSCode config for ${configKey}:`,
            configError,
          );
        }
        return undefined;
      };

      const defaultConfigs = {
        mysql: {
          host:
            getStringConfigValue(data.host, "MYSQL_HOST", "mysql.host") ||
            "localhost",
          port:
            getNumberConfigValue(data.port, "MYSQL_PORT", "mysql.port") || 3306,
          database: getStringConfigValue(
            data.database,
            "MYSQL_DATABASE",
            "mysql.database",
          ),
          username: getStringConfigValue(
            data.username,
            "MYSQL_USER",
            "mysql.username",
          ),
          password: getStringConfigValue(
            data.password,
            "MYSQL_PASSWORD",
            "mysql.password",
          ),
        },
        postgresql: {
          host:
            getStringConfigValue(
              data.host,
              "POSTGRES_HOST",
              "postgresql.host",
            ) || "localhost",
          port:
            getNumberConfigValue(
              data.port,
              "POSTGRES_PORT",
              "postgresql.port",
            ) || 5432,
          database: getStringConfigValue(
            data.database,
            "POSTGRES_DB",
            "postgresql.database",
          ),
          username: getStringConfigValue(
            data.username,
            "POSTGRES_USER",
            "postgresql.username",
          ),
          password: getStringConfigValue(
            data.password,
            "POSTGRES_PASSWORD",
            "postgresql.password",
          ),
        },
        sqlite: {
          database:
            getStringConfigValue(
              data.database,
              "SQLITE_DATABASE",
              "sqlite.database",
            ) || ":memory:",
        },
      };

      // 必須フィールドのバリデーション
      if (dbType !== "sqlite") {
        if (!defaultConfigs[dbType].database) {
          throw new Error(`データベース名が指定されていません (${dbType})`);
        }
        if (!defaultConfigs[dbType].username) {
          throw new Error(`ユーザー名が指定されていません (${dbType})`);
        }
      } else if (
        !defaultConfigs.sqlite.database ||
        defaultConfigs.sqlite.database === ":memory:"
      ) {
        // SQLiteの場合、データベースパスが必要
        if (!data.database) {
          throw new Error("SQLiteデータベースのパスが指定されていません");
        }
      }

      // データベースタイプに応じて接続
      let config: DatabaseProxyConfig;
      switch (dbType) {
        case "mysql": {
          const mysqlConfig = defaultConfigs.mysql;
          config = {
            type: "mysql",
            host: mysqlConfig.host,
            port: mysqlConfig.port,
            database: mysqlConfig.database || "",
            username: mysqlConfig.username || "",
            password: mysqlConfig.password || "",
          };
          // connectionType property removed - using connection objects instead
          break;
        }
        case "postgresql": {
          const pgConfig = defaultConfigs.postgresql;
          config = {
            type: "postgresql",
            host: pgConfig.host,
            port: pgConfig.port,
            database: pgConfig.database || "",
            username: pgConfig.username || "",
            password: pgConfig.password || "",
          };
          // connectionType property removed - using connection objects instead
          break;
        }
        case "sqlite": {
          const sqliteConfig = defaultConfigs.sqlite;
          config = {
            type: "sqlite",
            host: "",
            port: 0,
            database: sqliteConfig.database,
            username: "",
            password: "",
          };
          // connectionType property removed - using connection objects instead
          break;
        }
        default:
          throw new Error(`Unsupported database type: ${dbType}`);
      }

      try {
        const proxy = DatabaseProxyFactory.create(config);

        const connected = await proxy.connect();

        if (connected) {
          // アクティブ接続として保存
          const activeConnection: ActiveConnection = {
            id: finalConnectionId,
            name:
              (data as { name?: string }).name ||
              `${dbType.toUpperCase()} Connection`,
            type: config.type,
            proxy: proxy,
            config: config as DatabaseConfig,
            isConnected: true,
            connectedAt: new Date(),
          };

          this.activeConnections.set(finalConnectionId, activeConnection);

          const connectionType = `${dbType.toUpperCase()} (${config.host}:${config.port})`;
          vscode.window.showInformationMessage(`${connectionType} 接続成功`);

          this.broadcastMessage({
            type: "connectionStatus",
            data: this.getConnectionStatus(),
          });

          // アクティブ接続一覧も更新
          this.broadcastActiveConnections();

          return {
            success: true,
            message: `${connectionType} に接続しました`,
            connectionId: finalConnectionId,
          };
        }

        throw new Error(
          "データベース接続に失敗しました - connect()がfalseを返しました",
        );
      } catch (proxyError) {
        console.error(`DatabaseProxy error for ${dbType}:`, proxyError);
        throw proxyError;
      }
    } catch (error) {
      console.error("Database connection failed:", error);

      // より詳細なエラー情報を提供
      let detailedError = "不明なエラー";
      if (error instanceof Error) {
        detailedError = error.message;

        // 一般的な接続エラーの原因を提示
        if (error.message.includes("ECONNREFUSED")) {
          detailedError +=
            "\n\n考えられる原因：\n- データベースサーバーが起動していない\n- ホスト名またはポートが間違っている";
        } else if (
          error.message.includes("authentication failed") ||
          error.message.includes("Access denied")
        ) {
          detailedError +=
            "\n\n考えられる原因：\n- ユーザー名またはパスワードが間違っている\n- データベースユーザーに接続権限がない";
        } else if (error.message.includes("does not exist")) {
          detailedError +=
            "\n\n考えられる原因：\n- 指定されたデータベース名が存在しない";
        }
      }

      vscode.window.showErrorMessage(
        `${data.type || "データベース"}接続エラー: ${detailedError}`,
      );
      return { success: false, message: detailedError };
    }
  }

  /**
   * データベースから切断（特定の接続または全て）
   */
  async disconnect(connectionId?: string): Promise<void> {
    if (connectionId) {
      // 特定の接続を切断
      const connection = this.activeConnections.get(connectionId);
      if (connection) {
        await connection.proxy.disconnect();
        this.activeConnections.delete(connectionId);
        vscode.window.showInformationMessage(
          `${connection.name} を切断しました`,
        );
      }
    } else {
      // 全ての接続を切断
      for (const connection of this.activeConnections.values()) {
        await connection.proxy.disconnect();
      }
      this.activeConnections.clear();
    }

    this.broadcastMessage({
      type: "connectionStatus",
      data: this.getConnectionStatus(),
    });

    // アクティブ接続一覧も更新
    this.broadcastActiveConnections();
  }

  /**
   * クエリを下部パネルで実行して結果を表示（WebViewパネル）
   */
  async executeQueryInOutput(
    query: string,
    connectionId?: string,
  ): Promise<void> {
    // 接続IDが指定されていない場合は最初のアクティブ接続を使用
    const targetConnectionId =
      connectionId || Array.from(this.activeConnections.keys())[0];
    const connection = this.activeConnections.get(targetConnectionId);

    if (!connection || !connection.isConnected) {
      const message = connectionId
        ? `指定された接続 (${connectionId}) が見つからないか、切断されています`
        : "データベースに接続されていません";

      vscode.window.showWarningMessage(message);
      return;
    }

    try {
      const startTime = Date.now();
      const result = await connection.proxy.query(query);
      const executionTime = Date.now() - startTime;

      // ResultsPanelに結果を表示
      const { ResultsPanel } = await import("../ResultsPanel");
      const resultsPanel = ResultsPanel.getInstance(
        this.extensionContext?.extensionUri || vscode.Uri.file(""),
      );

      if (result.success) {
        vscode.window.showInformationMessage(
          `クエリ実行成功: ${result.rowCount}行取得 (${executionTime}ms) - ${connection.name}`,
        );

        await resultsPanel.showResults({
          query,
          connectionName: connection.name,
          success: true,
          results: result.rows || [],
          rowCount: result.rowCount || 0,
          executionTime,
        });
      } else {
        throw new Error(result.error || "クエリ実行に失敗しました");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラー";
      vscode.window.showErrorMessage(`クエリエラー: ${errorMessage}`);

      // エラーもResultsPanelに表示
      const { ResultsPanel } = await import("../ResultsPanel");
      const resultsPanel = ResultsPanel.getInstance(
        this.extensionContext?.extensionUri || vscode.Uri.file(""),
      );
      await resultsPanel.showResults({
        query,
        connectionName: connection?.name || "Unknown",
        success: false,
        error: errorMessage,
      });
    }
  }

  /**
   * クエリを実行してResultsPanelに表示（指定された接続で）
   */
  async executeQueryWithResults(
    query: string,
    connectionId?: string,
  ): Promise<void> {
    const targetConnectionId =
      connectionId || Array.from(this.activeConnections.keys())[0];
    const connection = this.activeConnections.get(targetConnectionId);

    if (!connection || !connection.isConnected) {
      const message = connectionId
        ? `指定された接続 (${connectionId}) が見つからないか、切断されています`
        : "データベースに接続されていません";

      vscode.window.showWarningMessage(message);
      return;
    }

    try {
      const startTime = Date.now();
      const result = await connection.proxy.query(query);
      const executionTime = Date.now() - startTime;

      if (result.success) {
        vscode.window.showInformationMessage(
          `クエリ実行成功: ${result.rowCount}行取得 (${executionTime}ms) - ${connection.name}`,
        );

        // ResultsPanelに結果を表示
        const { ResultsPanel } = await import("../ResultsPanel");
        const resultsPanel = ResultsPanel.getInstance(
          this.extensionContext?.extensionUri || vscode.Uri.file(""),
        );
        await resultsPanel.showResults({
          query,
          connectionName: connection.name,
          success: true,
          results: result.rows || [],
          rowCount: result.rowCount || 0,
          executionTime,
        });
      } else {
        throw new Error(result.error || "クエリ実行に失敗しました");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラー";
      vscode.window.showErrorMessage(`クエリエラー: ${errorMessage}`);

      // エラーもResultsPanelに表示
      const { ResultsPanel } = await import("../ResultsPanel");
      const resultsPanel = ResultsPanel.getInstance(
        this.extensionContext?.extensionUri || vscode.Uri.file(""),
      );
      await resultsPanel.showResults({
        query,
        connectionName: connection?.name || "Unknown",
        success: false,
        error: errorMessage,
      });
    }
  }

  /**
   * クエリを実行（指定された接続で）
   */
  async executeQuery(
    data: ExecuteQueryMessage["data"],
    connectionId?: string,
  ): Promise<void> {
    // 接続IDが指定されていない場合は最初のアクティブ接続を使用
    const targetConnectionId =
      connectionId || Array.from(this.activeConnections.keys())[0];
    const connection = this.activeConnections.get(targetConnectionId);

    if (!connection || !connection.isConnected) {
      const message = connectionId
        ? `指定された接続 (${connectionId}) が見つからないか、切断されています`
        : "データベースに接続されていません";

      vscode.window.showWarningMessage(message);

      this.broadcastMessage({
        type: "queryResult",
        data: {
          success: false,
          results: [],
          message: message,
        },
      });
      return;
    }

    try {
      const query = data.query || "SELECT * FROM users LIMIT 10";
      const result = await connection.proxy.query(query);

      if (result.success) {
        vscode.window.showInformationMessage(
          `クエリ実行成功: ${result.rowCount}行取得 (${result.executionTime}ms) - ${connection.name}`,
        );

        this.broadcastMessage({
          type: "queryResult",
          data: {
            success: true,
            results: result.rows || [],
            rowCount: result.rowCount || 0,
            executionTime: result.executionTime || 0,
            message: `${result.rowCount}行を取得しました (${connection.name})`,
          },
        });
      } else {
        throw new Error(result.error || "クエリ実行に失敗しました");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラー";
      vscode.window.showErrorMessage(`クエリエラー: ${errorMessage}`);

      this.broadcastMessage({
        type: "queryResult",
        data: {
          success: false,
          results: [],
          message: errorMessage,
        },
      });
    }
  }

  /**
   * テーブル一覧を取得（指定された接続から）
   */
  async getTables(
    connectionId?: string,
  ): Promise<{ name: string; type: string }[]> {
    const targetConnectionId =
      connectionId || Array.from(this.activeConnections.keys())[0];
    const connection = this.activeConnections.get(targetConnectionId);

    if (!connection || !connection.isConnected) {
      return [];
    }
    return await connection.proxy.getTables();
  }

  /**
   * 接続設定を保存
   */
  async saveConnection(config: DatabaseConfig): Promise<void> {
    const existingIndex = this.savedConnections.findIndex(
      (c) => c.id === config.id,
    );
    if (existingIndex >= 0) {
      this.savedConnections[existingIndex] = config;
    } else {
      this.savedConnections.push(config);
    }

    // Save to extension context if available
    if (this.extensionContext) {
      await this.extensionContext.globalState.update(
        "vscode-dbm.connections",
        this.savedConnections,
      );
    }
  }

  /**
   * 保存された接続設定を取得
   */
  getSavedConnections(): DatabaseConfig[] {
    return [...this.savedConnections];
  }

  /**
   * 接続設定を読み込み
   */
  async loadConnections(): Promise<void> {
    if (this.extensionContext) {
      const connections =
        (this.extensionContext.globalState.get(
          "vscode-dbm.connections",
        ) as DatabaseConfig[]) || [];
      this.savedConnections = connections;
    }
  }

  /**
   * クリーンアップ
   */
  async cleanup(): Promise<void> {
    await this.disconnect(); // 全ての接続を切断
    this.listeners.clear();
  }
}
