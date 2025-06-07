import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: "automatic",
    }),
  ],
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/test/e2e-setup.ts"],
    include: ["src/test/e2e/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: ["node_modules", "dist", ".idea", ".git", ".cache"],
    testTimeout: 60000, // E2Eテストは最長のタイムアウト
    hookTimeout: 30000,
    teardownTimeout: 30000,
    isolate: true,
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true, // E2Eテストは完全にシーケンシャル実行
      },
    },
    retry: 1, // E2Eテストのリトライは最小限
    reporter: ["verbose", "json"],
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
    DEV: JSON.stringify(true),
  },
});
