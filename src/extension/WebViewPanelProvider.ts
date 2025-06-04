import * as path from "node:path"
import * as vscode from "vscode"
import type { BaseMessage, WebViewMessage } from "../shared/types/messages"

let currentPanel: vscode.WebviewPanel | undefined

export function createOrShow(extensionUri: vscode.Uri, viewType: "datagrid" | "sql" | "dashboard") {
  const column = vscode.window.activeTextEditor
    ? vscode.window.activeTextEditor.viewColumn
    : undefined

  // If we already have a panel, show it
  if (currentPanel) {
    currentPanel.reveal(column)

    // Update the panel for the new view type
    currentPanel.webview.postMessage({
      type: "changeView",
      data: { viewType },
    })
    return
  }

  // Otherwise, create a new panel
  const panel = vscode.window.createWebviewPanel(
    "dbManagerPanel",
    getTitleForViewType(viewType),
    column || vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [extensionUri],
    }
  )

  currentPanel = panel

  panel.webview.html = getHtmlForWebview(panel.webview, extensionUri, viewType)

  // Message handling
  panel.webview.onDidReceiveMessage((message) => {
    handleMessage(message, panel)
  })

  // Reset when the current panel is closed
  panel.onDidDispose(() => {
    currentPanel = undefined
  }, null)

  // Handle view type changes
  panel.onDidChangeViewState((e) => {
    if (e.webviewPanel.visible) {
      // Panel became visible
    }
  })
}

function getTitleForViewType(viewType: string): string {
  switch (viewType) {
    case "datagrid":
      return "DataGrid - DB Manager"
    case "sql":
      return "SQL Editor - DB Manager"
    case "dashboard":
      return "Dashboard - DB Manager"
    default:
      return "DB Manager"
  }
}

function getHtmlForWebview(webview: vscode.Webview, extensionUri: vscode.Uri, viewType: string) {
  const isDevelopment = process.env.NODE_ENV === "development"

  if (isDevelopment) {
    // Development mode: use Vite dev server
    return getDevHtml(viewType)
  }
  // Production mode: use built assets
  return getProdHtml(webview, extensionUri, viewType)
}

function getDevHtml(viewType: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Database DataGrid Manager</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
        }
        #root {
            width: 100vw;
            height: 100vh;
        }
    </style>
</head>
<body>
    <div id="root"></div>
    <script>
        window.initialViewType = "${viewType}";
        window.acquireVsCodeApi = window.acquireVsCodeApi || (() => ({
            postMessage: (msg) => console.log('VSCode API:', msg),
            getState: () => ({}),
            setState: (state) => {}
        }));
    </script>
    <script type="module" src="http://localhost:5173/src/webview/main.tsx"></script>
</body>
</html>`
}

function getProdHtml(webview: vscode.Webview, extensionUri: vscode.Uri, viewType: string) {
  const webviewPath = vscode.Uri.joinPath(extensionUri, "dist", "webview")
  const styleSrc = webview.asWebviewUri(vscode.Uri.joinPath(webviewPath, "assets", "index.css"))
  const scriptSrc = webview.asWebviewUri(vscode.Uri.joinPath(webviewPath, "assets", "index.js"))

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} https:; script-src ${webview.cspSource};">
    <title>Database DataGrid Manager</title>
    <link rel="stylesheet" href="${styleSrc}">
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
        }
        #root {
            width: 100vw;
            height: 100vh;
        }
    </style>
</head>
<body>
    <div id="root"></div>
    <script>
        window.initialViewType = "${viewType}";
        window.acquireVsCodeApi = window.acquireVsCodeApi || (() => ({
            postMessage: (msg) => console.log('VSCode API:', msg),
            getState: () => ({}),
            setState: (state) => {}
        }));
    </script>
    <script src="${scriptSrc}"></script>
</body>
</html>`
}

function handleMessage(message: WebViewMessage, panel: vscode.WebviewPanel) {
  switch (message.type) {
    case "getConnectionStatus":
      panel.webview.postMessage({
        type: "connectionStatus",
        data: { connected: false, databases: [] },
      })
      break

    case "openConnection":
      vscode.window.showInformationMessage(`Opening connection: ${message.data.type}`)
      panel.webview.postMessage({
        type: "connectionResult",
        data: { success: true, message: "Connection logic integration pending" },
      })
      break

    case "executeQuery":
      vscode.window.showInformationMessage(`Executing query: ${message.data.query}`)
      panel.webview.postMessage({
        type: "queryResult",
        data: { success: true, results: [], message: "Query execution pending" },
      })
      break

    case "showInfo":
      vscode.window.showInformationMessage(message.data.message)
      break

    case "showError":
      vscode.window.showErrorMessage(message.data.message)
      break
  }
}

export function postMessage(message: BaseMessage) {
  if (currentPanel) {
    currentPanel.webview.postMessage(message)
  }
}
