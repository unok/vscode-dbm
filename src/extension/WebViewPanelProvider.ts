import * as vscode from "vscode";
import type { BaseMessage, WebViewMessage } from "../shared/types/messages";
import { DatabaseService } from "./services/DatabaseService";

let currentPanel: vscode.WebviewPanel | undefined;
const databaseService = DatabaseService.getInstance();

export function createOrShow(
  extensionUri: vscode.Uri,
  viewType: "datagrid" | "sql" | "dashboard",
) {
  const column = vscode.window.activeTextEditor
    ? vscode.window.activeTextEditor.viewColumn
    : undefined;

  // If we already have a panel, show it
  if (currentPanel) {
    currentPanel.reveal(column);

    // Update the panel for the new view type
    currentPanel.webview.postMessage({
      type: "changeView",
      data: { viewType },
    });
    return;
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
    },
  );

  currentPanel = panel;

  panel.webview.html = getHtmlForWebview(panel.webview, extensionUri, viewType);

  // Register message listener for database service
  const panelId = `panel-${Date.now()}`;
  databaseService.addMessageListener(panelId, (message) => {
    panel.webview.postMessage(message);
  });

  // Message handling
  panel.webview.onDidReceiveMessage((message) => {
    handleMessage(message, panel);
  });

  // Reset when the current panel is closed
  panel.onDidDispose(() => {
    databaseService.removeMessageListener(panelId);
    currentPanel = undefined;
  }, null);

  // Handle view type changes
  panel.onDidChangeViewState((e) => {
    if (e.webviewPanel.visible) {
      // Panel became visible
    }
  });
}

function getTitleForViewType(viewType: string): string {
  switch (viewType) {
    case "datagrid":
      return "DataGrid - DB Manager";
    case "sql":
      return "SQL Editor - DB Manager";
    case "dashboard":
      return "Dashboard - DB Manager";
    default:
      return "DB Manager";
  }
}

function getHtmlForWebview(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  viewType: string,
) {
  // Try to use built assets first
  return getProdHtml(webview, extensionUri, viewType);
}

function getProdHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  viewType: string,
) {
  // Find the actual JS file dynamically
  const webviewPath = vscode.Uri.joinPath(extensionUri, "dist", "webview");
  const assetsPath = vscode.Uri.joinPath(webviewPath, "assets");

  // Read JS filename from index.html (most reliable method)
  let jsFileName: string;
  try {
    const fs = require("node:fs");
    const indexPath = vscode.Uri.joinPath(webviewPath, "index.html");
    const indexContent = fs.readFileSync(indexPath.fsPath, "utf-8");
    const scriptMatch = indexContent.match(
      /src="\.\/assets\/(index-[^"]+\.js)"/,
    );

    if (scriptMatch) {
      jsFileName = scriptMatch[1];
    } else {
      throw new Error("No script tag found in index.html");
    }
  } catch (error) {
    console.error("[WebViewPanel] Failed to read index.html:", error);
    throw new Error("Could not determine JavaScript bundle filename");
  }

  // Generate URLs
  const nonce = getNonce();
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(assetsPath, jsFileName),
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} https: data:; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; connect-src ${webview.cspSource} https: ws:;">
    <title>Database DataGrid Manager</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            overflow: hidden;
        }
        #root {
            width: 100vw;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        /* VSCode theme variables */
        :root {
            --vscode-primary: var(--vscode-button-background);
            --vscode-primary-hover: var(--vscode-button-hoverBackground);
            --vscode-secondary: var(--vscode-button-secondaryBackground);
            --vscode-border: var(--vscode-panel-border);
            --vscode-input-bg: var(--vscode-input-background);
            --vscode-input-border: var(--vscode-input-border);
        }
    </style>
</head>
<body>
    <div id="root"></div>
    <script nonce="${nonce}">
        window.initialViewType = "${viewType}";
        // Store VSCode API globally to prevent multiple acquisitions
        if (!window.vscode && window.acquireVsCodeApi) {
            window.vscode = acquireVsCodeApi();
        }
        
        // Ensure DOM is loaded before React app
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                console.log('[WebViewPanel] DOM loaded, root element exists:', !!document.getElementById('root'));
            });
        } else {
            console.log('[WebViewPanel] DOM already loaded, root element exists:', !!document.getElementById('root'));
        }
    </script>
    <script nonce="${nonce}" src="${scriptUri}" defer></script>
</body>
</html>`;
}

// Helper function to generate nonce for CSP
function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

async function handleMessage(
  message: WebViewMessage,
  panel: vscode.WebviewPanel,
) {
  switch (message.type) {
    case "getConnectionStatus": {
      const status = databaseService.getConnectionStatus();
      panel.webview.postMessage({
        type: "connectionStatus",
        data: status,
      });
      break;
    }

    case "openConnection": {
      const result = await databaseService.connect(message.data);
      panel.webview.postMessage({
        type: "connectionResult",
        data: result,
      });
      break;
    }

    case "executeQuery":
      await databaseService.executeQuery(message.data);
      break;

    case "showInfo":
      vscode.window.showInformationMessage(message.data.message);
      break;

    case "showError":
      vscode.window.showErrorMessage(message.data.message);
      break;

    case "saveConnection": {
      try {
        // Save connection using DatabaseService
        await databaseService.saveConnection(message.data);
        vscode.window.showInformationMessage(
          `Connection "${message.data.name}" saved successfully`,
        );

        panel.webview.postMessage({
          type: "connectionSaved",
          data: { success: true, connection: message.data },
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Save connection error:", error);
        vscode.window.showErrorMessage(
          `Failed to save connection: ${errorMessage}`,
        );
        panel.webview.postMessage({
          type: "connectionSaved",
          data: { success: false, error: errorMessage },
        });
      }
      break;
    }

    case "testConnection": {
      try {
        // Test the connection using database service
        // Convert DatabaseConfig to compatible format
        const data = message.data;
        const connectionData = {
          type: data.type,
          host: data.host || "",
          port: data.port || 0,
          database: data.database,
          username: data.username || "",
          password: data.password || "",
          ssl: typeof data.ssl === "boolean" ? data.ssl : false,
        };
        const result = await databaseService.connect(connectionData);
        panel.webview.postMessage({
          type: "connectionTestResult",
          data: result,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        panel.webview.postMessage({
          type: "connectionTestResult",
          data: { success: false, message: errorMessage },
        });
      }
      break;
    }

    case "getSavedConnections": {
      const connections = databaseService.getSavedConnections();
      panel.webview.postMessage({
        type: "savedConnections",
        data: { connections },
      });
      break;
    }
  }
}

export function postMessage(message: BaseMessage) {
  if (currentPanel) {
    currentPanel.webview.postMessage(message);
  }
}
