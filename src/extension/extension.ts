import * as vscode from "vscode"

export function activate(context: vscode.ExtensionContext) {
  console.log("DB DataGrid Manager extension is now active!")

  // データベース接続コマンド
  const openConnectionCommand = vscode.commands.registerCommand("vscode-dbm.openConnection", () => {
    vscode.window.showInformationMessage("データベース接続機能 - 実装予定")
    // 将来的にWebViewパネルを開く
  })

  // 新しいSQLクエリコマンド
  const newQueryCommand = vscode.commands.registerCommand("vscode-dbm.newQuery", () => {
    vscode.window.showInformationMessage("SQLクエリエディタ - 実装予定")
    // 将来的にSQLエディタを開く
  })

  context.subscriptions.push(openConnectionCommand, newQueryCommand)

  // コンテキストを設定（ビューの表示制御用）
  vscode.commands.executeCommand("setContext", "vscode-dbm:hasConnection", false)
}

export function deactivate() {
  console.log("DB DataGrid Manager extension is deactivated")
}
