import path from "node:path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [
    react({
      // React 19 対応
      jsxRuntime: "automatic",
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@webview": path.resolve(__dirname, "./src/webview"),
      "@extension": path.resolve(__dirname, "./src/extension"),
    },
  },
  build: {
    outDir: "../../dist/webview",
    sourcemap: true,
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "src/webview/index.html"),
    },
  },
  root: "src/webview",
  server: {
    port: 5173,
    hmr: {
      port: 5173,
    },
  },
  define: {
    // グローバル変数定義（必要に応じて）
    __DEV__: JSON.stringify(process.env.NODE_ENV === "development"),
  },
  optimizeDeps: {
    include: ["react", "react-dom", "@tanstack/react-table", "uuid"],
  },
})
