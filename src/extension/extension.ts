import * as vscode from "vscode"
import { DatabaseTreeProvider } from "./DatabaseTreeProvider"
import { createOrShow } from "./WebViewPanelProvider"
import { DatabaseWebViewProvider } from "./WebViewProvider"
import { DatabaseService } from "./services/DatabaseService"

let webViewProvider: DatabaseWebViewProvider | undefined

export async function activate(context: vscode.ExtensionContext) {
  try {
    // Initialize database service with extension context
    const databaseService = DatabaseService.getInstance()
    databaseService.setExtensionContext(context)

    // Load saved connections
    await databaseService.loadConnections()

    // TreeData provider for database connections
    const treeProvider = new DatabaseTreeProvider()
    context.subscriptions.push(
      vscode.window.createTreeView("dbManager.connections", {
        treeDataProvider: treeProvider,
        showCollapseAll: true,
      })
    )

    // WebView provider for sidebar
    webViewProvider = new DatabaseWebViewProvider(context.extensionUri)
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(DatabaseWebViewProvider.viewType, webViewProvider)
    )

    // Commands
    const openConnectionCommand = vscode.commands.registerCommand(
      "vscode-dbm.openConnection",
      () => {
        createOrShow(context.extensionUri, "dashboard")
      }
    )

    const newQueryCommand = vscode.commands.registerCommand("vscode-dbm.newQuery", () => {
      createOrShow(context.extensionUri, "sql")
    })

    // TreeDataProvider commands
    const selectFromTableCommand = vscode.commands.registerCommand(
      "vscode-dbm.selectFromTable",
      async (_connectionId: string, tableName: string) => {
        // SQLエディタでSELECT文を生成
        const sql = `SELECT * FROM ${tableName} LIMIT 100;`
        const document = await vscode.workspace.openTextDocument({
          content: sql,
          language: "sql",
        })
        await vscode.window.showTextDocument(document)
      }
    )

    const refreshConnectionsCommand = vscode.commands.registerCommand(
      "vscode-dbm.refreshConnections",
      () => {
        treeProvider.refresh()
      }
    )

    const addConnectionCommand = vscode.commands.registerCommand("vscode-dbm.addConnection", () => {
      createOrShow(context.extensionUri, "dashboard")
    })

    const runQueryCommand = vscode.commands.registerCommand("vscode-dbm.runQuery", async () => {
      const editor = vscode.window.activeTextEditor
      if (!editor) {
        vscode.window.showWarningMessage("アクティブなエディタがありません")
        return
      }

      const query = editor.selection.isEmpty
        ? editor.document.getText()
        : editor.document.getText(editor.selection)

      if (!query.trim()) {
        vscode.window.showWarningMessage("実行するクエリが選択されていません")
        return
      }

      // 接続がない場合は接続選択を促す
      const activeConnections = databaseService.getActiveConnections()
      const savedConnections = databaseService.getSavedConnections()

      if (activeConnections.length === 0 && savedConnections.length === 0) {
        vscode.window.showWarningMessage(
          "データベース接続が設定されていません。接続を追加してください。"
        )
        return
      }

      let connectionId: string | undefined

      // アクティブ接続がある場合はそれを使用、ない場合は保存済み接続から選択
      if (activeConnections.length > 0) {
        if (activeConnections.length === 1) {
          connectionId = activeConnections[0].id
        } else {
          // 複数のアクティブ接続がある場合は選択させる
          const options = activeConnections.map((conn) => ({
            label: conn.name,
            description: `${conn.type.toUpperCase()} - ${conn.config.host || conn.config.database}`,
            connectionId: conn.id,
          }))

          const selected = await vscode.window.showQuickPick(options, {
            placeHolder: "クエリを実行する接続を選択してください",
          })

          if (!selected) return
          connectionId = selected.connectionId
        }
      } else {
        // 保存済み接続から選択して一時的に接続
        const options = savedConnections.map((conn) => ({
          label: conn.name,
          description: `${conn.type.toUpperCase()} - ${conn.host || conn.database}`,
          connectionId: conn.id,
        }))

        const selected = await vscode.window.showQuickPick(options, {
          placeHolder: "接続を選択してください（自動的に接続されます）",
        })

        if (!selected) return

        // 選択された接続で自動接続
        const selectedConfig = savedConnections.find((c) => c.id === selected.connectionId)
        if (selectedConfig) {
          const connectionData = {
            type: selectedConfig.type,
            host: selectedConfig.host,
            port: selectedConfig.port,
            database: selectedConfig.database,
            username: selectedConfig.username,
            password: selectedConfig.password,
            ssl: typeof selectedConfig.ssl === "boolean" ? selectedConfig.ssl : false,
          }
          const result = await databaseService.connect(connectionData, selectedConfig.id)
          if (!result.success) {
            vscode.window.showErrorMessage(`接続に失敗しました: ${result.message}`)
            return
          }
          connectionId = selectedConfig.id
        }
      }

      await databaseService.executeQueryWithResults(query.trim(), connectionId)
    })

    // クエリをパネルで実行するコマンド
    const runQueryInPanelCommand = vscode.commands.registerCommand(
      "vscode-dbm.runQueryInPanel",
      async () => {
        const editor = vscode.window.activeTextEditor
        if (!editor) {
          vscode.window.showWarningMessage("アクティブなエディタがありません")
          return
        }

        const query = editor.selection.isEmpty
          ? editor.document.getText()
          : editor.document.getText(editor.selection)

        if (!query.trim()) {
          vscode.window.showWarningMessage("実行するクエリが選択されていません")
          return
        }

        // 接続がない場合は接続選択を促す
        const activeConnections = databaseService.getActiveConnections()
        const savedConnections = databaseService.getSavedConnections()

        if (activeConnections.length === 0 && savedConnections.length === 0) {
          vscode.window.showWarningMessage(
            "データベース接続が設定されていません。接続を追加してください。"
          )
          return
        }

        let connectionId: string | undefined

        // アクティブ接続がある場合はそれを使用、ない場合は保存済み接続から選択
        if (activeConnections.length > 0) {
          if (activeConnections.length === 1) {
            connectionId = activeConnections[0].id
          } else {
            // 複数のアクティブ接続がある場合は選択させる
            const options = activeConnections.map((conn) => ({
              label: conn.name,
              description: `${conn.type.toUpperCase()} - ${conn.config.host || conn.config.database}`,
              connectionId: conn.id,
            }))

            const selected = await vscode.window.showQuickPick(options, {
              placeHolder: "クエリを実行する接続を選択してください",
            })

            if (!selected) return
            connectionId = selected.connectionId
          }
        } else {
          // 保存済み接続から選択して一時的に接続
          const options = savedConnections.map((conn) => ({
            label: conn.name,
            description: `${conn.type.toUpperCase()} - ${conn.host || conn.database}`,
            connectionId: conn.id,
          }))

          const selected = await vscode.window.showQuickPick(options, {
            placeHolder: "接続を選択してください（自動的に接続されます）",
          })

          if (!selected) return

          // 選択された接続で自動接続
          const selectedConfig = savedConnections.find((c) => c.id === selected.connectionId)
          if (selectedConfig) {
            const connectionData = {
              type: selectedConfig.type,
              host: selectedConfig.host,
              port: selectedConfig.port,
              database: selectedConfig.database,
              username: selectedConfig.username,
              password: selectedConfig.password,
              ssl: typeof selectedConfig.ssl === "boolean" ? selectedConfig.ssl : false,
            }
            const result = await databaseService.connect(connectionData, selectedConfig.id)
            if (!result.success) {
              vscode.window.showErrorMessage(`接続に失敗しました: ${result.message}`)
              return
            }
            connectionId = selectedConfig.id
          }
        }

        await databaseService.executeQueryWithResults(query.trim(), connectionId)
      }
    )

    // Open new SQL file with SQL language support and connection context
    const newSQLFileCommand = vscode.commands.registerCommand("vscode-dbm.newSQLFile", async () => {
      const savedConnections = databaseService.getSavedConnections()
      let content = "-- SQL Query\n"

      // 接続が設定されている場合は、コメントに接続情報を追加
      if (savedConnections.length > 0) {
        const options = savedConnections.map((conn) => ({
          label: conn.name,
          description: `${conn.type.toUpperCase()} - ${conn.host || conn.database}`,
          connectionId: conn.id,
        }))

        const selected = await vscode.window.showQuickPick(options, {
          placeHolder: "SQLファイルで使用する接続を選択してください（省略可能）",
        })

        if (selected) {
          const selectedConfig = savedConnections.find((c) => c.id === selected.connectionId)
          if (selectedConfig) {
            content = `-- SQL Query for ${selectedConfig.name} (${selectedConfig.type.toUpperCase()})\n-- Host: ${selectedConfig.host || selectedConfig.database}\n-- Press Ctrl+Shift+E to execute in Output panel\n-- Press Ctrl+Shift+R to execute in Results panel\n\n`
          }
        }
      }

      const document = await vscode.workspace.openTextDocument({
        content,
        language: "sql",
      })
      await vscode.window.showTextDocument(document)
    })

    context.subscriptions.push(
      openConnectionCommand,
      newQueryCommand,
      selectFromTableCommand,
      refreshConnectionsCommand,
      addConnectionCommand,
      runQueryCommand,
      runQueryInPanelCommand,
      newSQLFileCommand
    )

    // Context setup
    vscode.commands.executeCommand("setContext", "vscode-dbm:hasConnection", false)

    // Development mode detection
    if (process.env.NODE_ENV === "development") {
      // Development-specific initialization can be added here
    }
  } catch (error) {
    console.error("Failed to activate Database Manager (DBM) extension:", error)
    vscode.window.showErrorMessage(
      `Database Manager の初期化に失敗しました: ${error instanceof Error ? error.message : String(error)}`
    )
    throw error
  }
}

export async function deactivate() {
  // Cleanup database connections
  const databaseService = DatabaseService.getInstance()
  await databaseService.cleanup()

  if (webViewProvider) {
    await webViewProvider.cleanup()
  }
}
