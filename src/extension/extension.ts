import * as vscode from "vscode"
import { DatabaseWebViewPanelProvider } from "./WebViewPanelProvider"
import { DatabaseWebViewProvider } from "./WebViewProvider"

export function activate(context: vscode.ExtensionContext) {
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
  }
}

export function deactivate() {}
