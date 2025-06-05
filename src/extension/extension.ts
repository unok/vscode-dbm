import * as vscode from "vscode"
import { createOrShow } from "./WebViewPanelProvider"
import { DatabaseWebViewProvider } from "./WebViewProvider"

export function activate(context: vscode.ExtensionContext) {
  try {
    // WebView provider for sidebar
    const webViewProvider = new DatabaseWebViewProvider(context.extensionUri)
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

    context.subscriptions.push(
      openConnectionCommand,
      newQueryCommand,
      openDataGridCommand,
      openDashboardCommand
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

export function deactivate() {
  // Cleanup code can be added here
}
