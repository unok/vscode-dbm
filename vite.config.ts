import path from "node:path";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vite";

// Custom plugin to remove type="module" from script tags
const removeModuleType = (): Plugin => {
  return {
    name: "remove-module-type",
    transformIndexHtml(html) {
      // Remove type="module" and crossorigin from script tags
      return html.replace(/<script type="module" crossorigin/g, "<script");
    },
  };
};

export default defineConfig({
  plugins: [
    react({
      // React 19 対応
      jsxRuntime: "automatic",
    }),
    removeModuleType(),
  ],
  // HTMLのベースパスを明示的に設定
  base: "./",
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
    target: "es2015", // 古いブラウザ対応
    rollupOptions: {
      input: path.resolve(__dirname, "src/webview/index.html"),
      // ネイティブモジュールとNode.js専用モジュールをexternalに設定
      external: [
        "better-sqlite3",
        "mysql2",
        "pg",
        "sqlite3",
        "node-gyp",
        "node-addon-api",
        "bindings",
        "prebuild-install",
        // Node.js Built-ins
        "fs",
        "path",
        "os",
        "crypto",
        "child_process",
        "cluster",
        "dgram",
        "dns",
        "net",
        "tls",
        "http",
        "https",
        "http2",
        "stream",
        "worker_threads",
        "vscode",
      ],
      output: {
        format: "iife", // VSCode WebView用にIIFE形式でビルド
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
        inlineDynamicImports: true, // 動的インポートをインライン化
        // WebViewでのパスを確実に解決するための設定
        manualChunks: undefined, // チャンク分割を無効化
      },
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
    DEV: JSON.stringify(process.env.NODE_ENV === "development"),
  },
  optimizeDeps: {
    include: ["react", "react-dom", "@tanstack/react-table", "uuid"],
  },
});
