import * as vscode from "vscode"
import { DatabaseWebViewProvider } from "./WebViewProvider"
import { DatabaseWebViewPanelProvider } from "./WebViewPanelProvider"

export function activate(context: vscode.ExtensionContext) {
  console.log("DB DataGrid Manager extension is now active!")

  // WebView provider for sidebar
  const webViewProvider = new DatabaseWebViewProvider(context.extensionUri)
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(DatabaseWebViewProvider.viewType, webViewProvider)
  )

  // Commands
  const openConnectionCommand = vscode.commands.registerCommand("vscode-dbm.openConnection", () => {
    DatabaseWebViewPanelProvider.createOrShow(context.extensionUri, "dashboard")
  })

  const newQueryCommand = vscode.commands.registerCommand("vscode-dbm.newQuery", () => {
    DatabaseWebViewPanelProvider.createOrShow(context.extensionUri, "sql")
  })

  // Additional commands for different views
  const openDataGridCommand = vscode.commands.registerCommand("vscode-dbm.openDataGrid", () => {
    DatabaseWebViewPanelProvider.createOrShow(context.extensionUri, "datagrid")
  })

  const openDashboardCommand = vscode.commands.registerCommand("vscode-dbm.openDashboard", () => {
    DatabaseWebViewPanelProvider.createOrShow(context.extensionUri, "dashboard")
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
    console.log("Running in development mode - Vite dev server expected on port 5173")
  }
}

export function deactivate() {
  console.log("DB DataGrid Manager extension is deactivated")
}
