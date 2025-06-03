import path from "node:path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: "automatic",
    }),
  ],
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/test/integration-setup.ts"],
    include: ["src/test/integration/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: ["node_modules", "dist", ".idea", ".git", ".cache"],
    testTimeout: 30000, // 統合テストは長めのタイムアウト
    hookTimeout: 15000,
    teardownTimeout: 15000,
    isolate: true,
    pool: "forks", // 統合テストはプロセス分離
    poolOptions: {
      forks: {
        singleFork: true, // データベース接続の競合を避ける
      },
    },
    retry: 2, // 統合テストは不安定になりがちなのでリトライ
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@webview": path.resolve(__dirname, "./src/webview"),
      "@extension": path.resolve(__dirname, "./src/extension"),
      "@shared": path.resolve(__dirname, "./src/shared"),
    },
  },
  define: {
    __DEV__: JSON.stringify(true),
  },
})
