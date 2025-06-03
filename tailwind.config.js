/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/webview/**/*.{js,ts,jsx,tsx}", "./src/webview/index.html"],
  theme: {
    extend: {
      colors: {
        // VSCode テーマカラーの定義
        "vscode-bg": "var(--vscode-editor-background)",
        "vscode-fg": "var(--vscode-editor-foreground)",
        "vscode-border": "var(--vscode-widget-border)",
        "vscode-selection": "var(--vscode-editor-selectionBackground)",
        "vscode-highlight": "var(--vscode-editor-selectionHighlightBackground)",
      },
      fontFamily: {
        vscode: ["var(--vscode-font-family)", "monospace"],
      },
      fontSize: {
        vscode: "var(--vscode-font-size)",
      },
    },
  },
  plugins: [],
  darkMode: "class",
}
