import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import vscode from '@tomjs/vite-plugin-vscode';
import path from 'path';

export default defineConfig({
  plugins: [
    react({
      // React 19 対応
      jsxRuntime: 'automatic',
    }),
    vscode({
      recommended: true, // VSCode拡張用最適化
      template: {
        content: `<!DOCTYPE html>
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
</body>
</html>`,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@webview': path.resolve(__dirname, './src/webview'),
      '@extension': path.resolve(__dirname, './src/extension'),
    },
  },
  build: {
    outDir: 'dist/webview',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/webview/index.html'),
      },
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
      },
    },
    sourcemap: true,
  },
  server: {
    port: 5173,
    hmr: {
      port: 5173,
    },
  },
  define: {
    // グローバル変数定義（必要に応じて）
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@tanstack/react-table',
      'uuid',
    ],
  },
});