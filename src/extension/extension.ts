import * as vscode from "vscode"
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

    // Additional commands for different views
    const openDataGridCommand = vscode.commands.registerCommand("vscode-dbm.openDataGrid", () => {
      createOrShow(context.extensionUri, "datagrid")
    })

    const openDashboardCommand = vscode.commands.registerCommand("vscode-dbm.openDashboard", () => {
      createOrShow(context.extensionUri, "dashboard")
    })

    const runQueryInTerminalCommand = vscode.commands.registerCommand(
      "vscode-dbm.runQueryInTerminal",
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

        await databaseService.executeQueryInTerminal(query.trim())
      }
    )

    context.subscriptions.push(
      openConnectionCommand,
      newQueryCommand,
      openDataGridCommand,
      openDashboardCommand,
      runQueryInTerminalCommand
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
