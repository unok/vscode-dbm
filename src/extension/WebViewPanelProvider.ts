import * as path from "node:path"
import * as vscode from "vscode"
import type { BaseMessage, WebViewMessage } from "../shared/types/messages"
import { WebViewResourceManager } from "./webviewHelper"

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
  // WebViewResourceManagerを使用してHTMLを生成
  const resourceManager = new WebViewResourceManager(webview, extensionUri)
  return resourceManager.getHtmlContent(viewType)
}

// Unused but kept for potential future use
// function getDevHtml(_viewType: string) {
//   return `<!DOCTYPE html>
// <html lang="en">
// <head>
//     <meta charset="UTF-8">
//     <meta name="viewport" content="width=device-width, initial-scale=1.0">
//     <title>Database DataGrid Manager</title>
//     <style>
//         body {
//             margin: 0;
//             padding: 0;
//             background-color: var(--vscode-editor-background);
//             color: var(--vscode-editor-foreground);
//             font-family: var(--vscode-font-family);
//             font-size: var(--vscode-font-size);
//         }
//         #root {
//             width: 100vw;
//             height: 100vh;
//         }
//     </style>
// </head>
// <body>
//     <div id="root"></div>
//     <script>
//         window.initialViewType = "${_viewType}";
//         window.acquireVsCodeApi = window.acquireVsCodeApi || (() => ({
//             postMessage: (msg) => console.log('VSCode API:', msg),
//             getState: () => ({}),
//             setState: (state) => {}
//         }));
//     </script>
//     <script type="module" src="http://localhost:5173/src/webview/main.tsx"></script>
// </body>
// </html>`
// }

// Helper function to generate nonce for CSP - currently unused but kept for future use
// function getNonce() {
//   let text = ""
//   const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
//   for (let i = 0; i < 32; i++) {
//     text += possible.charAt(Math.floor(Math.random() * possible.length))
//   }
//   return text
// }

// Unused but kept for potential future use
// function getProdHtml(webview: vscode.Webview, extensionUri: vscode.Uri, _viewType: string) {
//   // Find the actual JS file dynamically
//   const webviewPath = vscode.Uri.joinPath(extensionUri, "dist", "webview")
//   const assetsPath = vscode.Uri.joinPath(webviewPath, "assets")

//   let jsFileName = "index-C_gadd4f.js" // fallback
//   try {
//     const fs = require("node:fs")
//     const files = fs.readdirSync(assetsPath.fsPath)
//     const jsFile = files.find((file: string) => file.startsWith("index-") && file.endsWith(".js"))
//     if (jsFile) {
//       jsFileName = jsFile
//     }
//   } catch (error) {
//     console.error("[WebViewPanel] Failed to read assets directory:", error)
//   }

//   // Generate URLs
//   const nonce = getNonce()
//   const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(assetsPath, jsFileName))

//   return `<!DOCTYPE html>
// <html lang="en">
// <head>
//     <meta charset="UTF-8">
//     <meta name="viewport" content="width=device-width, initial-scale=1.0">
//     <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} https: data:; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; connect-src ${webview.cspSource} https: ws:;">
//     <title>Database DataGrid Manager</title>
//     <style>
//         body {
//             margin: 0;
//             padding: 0;
//             background-color: var(--vscode-editor-background);
//             color: var(--vscode-editor-foreground);
//             font-family: var(--vscode-font-family);
//             font-size: var(--vscode-font-size);
//             overflow: hidden;
//         }
//         #root {
//             width: 100vw;
//             height: 100vh;
//             display: flex;
//             flex-direction: column;
//         }
//         /* VSCode theme variables */
//         :root {
//             --vscode-primary: var(--vscode-button-background);
//             --vscode-primary-hover: var(--vscode-button-hoverBackground);
//             --vscode-secondary: var(--vscode-button-secondaryBackground);
//             --vscode-border: var(--vscode-panel-border);
//             --vscode-input-bg: var(--vscode-input-background);
//             --vscode-input-border: var(--vscode-input-border);
//         }
//     </style>
// </head>
// <body>
//     <div id="root"></div>
//     <script nonce="${nonce}">
//         window.initialViewType = "${_viewType}";
//         window.acquireVsCodeApi = window.acquireVsCodeApi || (() => ({
//             postMessage: (msg) => console.log('VSCode API:', msg),
//             getState: () => ({}),
//             setState: (state) => {}
//         }));

//         // Ensure DOM is loaded before React app
//         if (document.readyState === 'loading') {
//             document.addEventListener('DOMContentLoaded', function() {
//                 console.log('[WebViewPanel] DOM loaded, root element exists:', !!document.getElementById('root'));
//             });
//         } else {
//             console.log('[WebViewPanel] DOM already loaded, root element exists:', !!document.getElementById('root'));
//         }
//     </script>
//     <script nonce="${nonce}" src="${scriptUri}" defer></script>
// </body>
// </html>`
// }

// Unused but kept for potential future use
// function getFallbackHtml(webview: vscode.Webview, extensionUri: vscode.Uri, _viewType: string) {
//   const nonce = getNonce()
//   const webviewPath = vscode.Uri.joinPath(extensionUri, "dist", "webview")

//   // Try to find the actual built files
//   const fs = require("node:fs")
//   const assetsPath = vscode.Uri.joinPath(webviewPath, "assets")
//   let scriptSrc = ""
//   let styleSrc = ""

//   try {
//     const files = fs.readdirSync(assetsPath.fsPath)
//     const jsFile = files.find((f: string) => f.startsWith("index-") && f.endsWith(".js"))
//     const cssFile = files.find((f: string) => f.startsWith("index-") && f.endsWith(".css"))

//     if (jsFile) {
//       scriptSrc = webview.asWebviewUri(vscode.Uri.joinPath(assetsPath, jsFile)).toString()
//     }
//     if (cssFile) {
//       styleSrc = webview.asWebviewUri(vscode.Uri.joinPath(assetsPath, cssFile)).toString()
//     }
//   } catch (error) {
//     console.error("Failed to find assets:", error)
//   }

//   return `<!DOCTYPE html>
// <html lang="en">
// <head>
//     <meta charset="UTF-8">
//     <meta name="viewport" content="width=device-width, initial-scale=1.0">
//     <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} https: data:; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; connect-src ${webview.cspSource} https: ws:;">
//     <title>Database DataGrid Manager</title>
//     <style>
//         body {
//             margin: 0;
//             padding: 0;
//             background-color: var(--vscode-editor-background);
//             color: var(--vscode-editor-foreground);
//             font-family: var(--vscode-font-family);
//             font-size: var(--vscode-font-size);
//             display: flex;
//             align-items: center;
//             justify-content: center;
//             height: 100vh;
//         }
//         .error-message {
//             text-align: center;
//             color: var(--vscode-errorForeground);
//         }
//     </style>
// </head>
// <body>
//     <div class="error-message">
//         <h2>Database Manager (DBM)</h2>
//         <p>WebView is loading...</p>
//         <p>If this message persists, please check the extension logs.</p>
//     </div>
//     <script nonce="${nonce}">
//         window.initialViewType = "${_viewType}";
//         window.acquireVsCodeApi = window.acquireVsCodeApi || (() => ({
//             postMessage: (msg) => console.log('VSCode API:', msg),
//             getState: () => ({}),
//             setState: (state) => {}
//         }));
//     </script>
//     ${scriptSrc ? `<script nonce="${nonce}" src="${scriptSrc}"></script>` : ""}
//     ${styleSrc ? `<link rel="stylesheet" href="${styleSrc}">` : ""}
// </body>
// </html>`
// }

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
