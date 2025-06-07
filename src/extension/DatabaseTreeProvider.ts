import * as vscode from "vscode"
import type { DatabaseConfig } from "../shared/types"
import { DatabaseService } from "./services/DatabaseService"

export class DatabaseTreeProvider implements vscode.TreeDataProvider<DatabaseTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<DatabaseTreeItem | undefined | null>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  private databaseService: DatabaseService
  private schemaCache: Map<string, SchemaInfo> = new Map()

  constructor() {
    this.databaseService = DatabaseService.getInstance()

    // DatabaseServiceからの更新を監視
    this.databaseService.addMessageListener("treeProvider", (message) => {
      if (message.type === "connectionStatus" || message.type === "activeConnections") {
        this.refresh()
      }
    })
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined)
  }

  getTreeItem(element: DatabaseTreeItem): vscode.TreeItem {
    return element
  }

  async getChildren(element?: DatabaseTreeItem): Promise<DatabaseTreeItem[]> {
    if (!element) {
      // ルートレベル: 保存された接続一覧
      const connections = this.databaseService.getSavedConnections()
      return connections.map((conn) => new ConnectionTreeItem(conn))
    }

    if (element instanceof ConnectionTreeItem) {
      // 接続の子要素: スキーマ情報
      return await this.getSchemaChildren(element.connection)
    }

    if (element instanceof SchemaFolderTreeItem) {
      // スキーマフォルダーの子要素: テーブル・ビュー一覧
      return element.children
    }

    return []
  }

  private async getSchemaChildren(connection: DatabaseConfig): Promise<DatabaseTreeItem[]> {
    try {
      // スキーマ情報をキャッシュから取得、なければデータベースから取得
      let schema = this.schemaCache.get(connection.id)

      if (!schema) {
        // アクティブ接続が存在するかチェック
        const activeConnection = this.databaseService.getConnection(connection.id)
        if (!activeConnection || !activeConnection.isConnected) {
          // 接続が必要な場合は一時的に接続
          const connectionData = {
            type: connection.type,
            host: connection.host,
            port: connection.port,
            database: connection.database,
            username: connection.username,
            password: connection.password,
            ssl: typeof connection.ssl === "boolean" ? connection.ssl : false,
          }
          const result = await this.databaseService.connect(connectionData, connection.id)
          if (!result.success) {
            // 接続できない場合は空のノードを表示
            return [
              new SchemaFolderTreeItem(
                "❌ 接続できません",
                vscode.TreeItemCollapsibleState.None,
                []
              ),
            ]
          }
        }

        // スキーマ情報を取得
        const tables = await this.databaseService.getTables(connection.id)
        schema = { tables: tables.map((t) => ({ name: t.name, type: t.type })) }
        this.schemaCache.set(connection.id, schema)
      }

      const children: DatabaseTreeItem[] = []

      // テーブルフォルダー
      const tableData = schema.tables?.filter((t) => t.type === "table") || []
      if (tableData.length > 0) {
        const tableItems = tableData.map((table) => new TableTreeItem(table.name, connection.id))

        children.push(
          new SchemaFolderTreeItem(
            `📊 テーブル (${tableData.length})`,
            vscode.TreeItemCollapsibleState.Expanded,
            tableItems
          )
        )
      }

      // ビューフォルダー
      const viewData = schema.tables?.filter((t) => t.type === "view") || []
      if (viewData.length > 0) {
        const viewItems = viewData.map((view) => new ViewTreeItem(view.name, connection.id))

        children.push(
          new SchemaFolderTreeItem(
            `👁️ ビュー (${viewData.length})`,
            vscode.TreeItemCollapsibleState.Collapsed,
            viewItems
          )
        )
      }

      if (children.length === 0) {
        return [
          new SchemaFolderTreeItem("📂 テーブルなし", vscode.TreeItemCollapsibleState.None, []),
        ]
      }

      return children
    } catch (error) {
      console.error("Error getting schema children:", error)
      return [new SchemaFolderTreeItem("❌ エラー", vscode.TreeItemCollapsibleState.None, [])]
    }
  }

  // スキーマキャッシュをクリア（接続情報変更時など）
  clearSchemaCache(connectionId?: string): void {
    if (connectionId) {
      this.schemaCache.delete(connectionId)
    } else {
      this.schemaCache.clear()
    }
    this._onDidChangeTreeData.fire(undefined)
  }
}

// ツリーアイテムの基底クラス
abstract class DatabaseTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState)
  }
}

// 接続アイテム
class ConnectionTreeItem extends DatabaseTreeItem {
  constructor(public readonly connection: DatabaseConfig) {
    super(connection.name, vscode.TreeItemCollapsibleState.Collapsed)

    // アイコンを設定
    this.iconPath = this.getConnectionIcon(connection.type)
    this.tooltip = `${connection.type.toUpperCase()} - ${connection.host || connection.database}`
    this.contextValue = "connection"
  }

  private getConnectionIcon(type: string): vscode.ThemeIcon {
    switch (type) {
      case "mysql":
        return new vscode.ThemeIcon("database")
      case "postgresql":
        return new vscode.ThemeIcon("database")
      case "sqlite":
        return new vscode.ThemeIcon("file-binary")
      default:
        return new vscode.ThemeIcon("database")
    }
  }
}

// スキーマフォルダーアイテム（テーブル、ビューなど）
class SchemaFolderTreeItem extends DatabaseTreeItem {
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly children: DatabaseTreeItem[]
  ) {
    super(label, collapsibleState)
    this.contextValue = "schemaFolder"
  }
}

// テーブルアイテム
class TableTreeItem extends DatabaseTreeItem {
  constructor(
    public readonly tableName: string,
    public readonly connectionId: string
  ) {
    super(tableName, vscode.TreeItemCollapsibleState.None)

    this.iconPath = new vscode.ThemeIcon("table")
    this.tooltip = `テーブル: ${tableName}`
    this.contextValue = "table"

    // クリック時のコマンドを設定
    this.command = {
      command: "vscode-dbm.selectFromTable",
      title: "SELECT FROM テーブル",
      arguments: [connectionId, tableName],
    }
  }
}

// ビューアイテム
class ViewTreeItem extends DatabaseTreeItem {
  constructor(
    public readonly viewName: string,
    public readonly connectionId: string
  ) {
    super(viewName, vscode.TreeItemCollapsibleState.None)

    this.iconPath = new vscode.ThemeIcon("eye")
    this.tooltip = `ビュー: ${viewName}`
    this.contextValue = "view"

    // クリック時のコマンドを設定
    this.command = {
      command: "vscode-dbm.selectFromTable",
      title: "SELECT FROM ビュー",
      arguments: [connectionId, viewName],
    }
  }
}

interface SchemaInfo {
  tables: Array<{ name: string; type: string }>
}
