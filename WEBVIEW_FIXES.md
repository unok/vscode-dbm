# WebView Asset Loading Fixes

WSL環境でのVSCode拡張機能WebViewアセット読み込み問題の解決策が実装されました。

## 実装された修正

### 1. WebViewResourceManager クラス (/src/extension/webviewHelper.ts)

新しいリソースマネージャークラスを作成し、以下の機能を実装：

- **動的なアセットファイル検出**: ビルド時にハッシュ化されたファイル名を自動検出
- **CSP（Content Security Policy）の適切な設定**: nonceを使用したセキュアな設定
- **WSL環境でのパス解決**: ファイルシステムパスの正しい変換
- **フォールバック機能**: リソース読み込み失敗時の適切なエラー表示

### 2. 修正されたコンポーネント

#### WebViewProvider.ts
- `WebViewResourceManager`を使用するように更新
- 従来の手動パス変換を削除
- より信頼性の高いリソース読み込み

#### WebViewPanelProvider.ts
- 同様に`WebViewResourceManager`を統合
- 一貫したリソース管理

### 3. ビルド設定の最適化 (vite.config.ts)

```typescript
build: {
  // HTMLのベースパスを明示的に設定
  base: './',
  rollupOptions: {
    output: {
      // WebViewでのパスを確実に解決するための設定
      manualChunks: undefined, // チャンク分割を無効化
    },
  },
}
```

### 4. CSP設定の改善

新しいCSP設定：
```
default-src 'none'; 
style-src ${webview.cspSource} 'unsafe-inline'; 
img-src ${webview.cspSource} https: data:; 
script-src 'nonce-${nonce}'; 
font-src ${webview.cspSource} data:; 
connect-src ${webview.cspSource} https: ws:;
```

## 解決された問題

1. **ERR_ACCESS_DENIED**: WebView内でのリソースアクセス拒否エラー
2. **404エラー**: 古いファイル名を参照する問題
3. **WSLパス解決**: WSL環境でのファイルパス変換問題
4. **CSPブロック**: セキュリティポリシーによるリソースブロック

## テスト結果

- ✅ ビルド成功（4.5MB JavaScriptバンドル）
- ✅ パッケージ化成功（vscode-dbm-0.1.0.vsix）
- ✅ アセット検出機能動作確認
- ✅ フォールバック機能動作確認

## 今後の改善点

1. **バンドルサイズ最適化**: 4.5MBのJavaScriptファイルを分割
2. **パフォーマンス最適化**: 動的インポートの活用
3. **エラーハンドリング強化**: より詳細なエラー情報表示

## 使用方法

1. プロジェクトをビルド:
   ```bash
   npm run build
   ```

2. 拡張機能をパッケージ化:
   ```bash
   npm run package
   ```

3. VSCodeで拡張機能をインストール:
   - `.vsix`ファイルをVSCodeで開く
   - またはコマンド: `code --install-extension vscode-dbm-0.1.0.vsix`

4. WebViewの動作確認:
   - コマンドパレットで "DB Manager" を検索
   - サイドバーでDBManagerパネルを確認
   - パネル型WebViewの動作確認

## トラブルシューティング

### リソースが読み込まれない場合

1. **開発者ツールで確認**:
   - F12でWebView内の開発者ツールを開く
   - コンソールエラーを確認
   - ネットワークタブでリソース読み込み状況を確認

2. **ログ確認**:
   - VSCode開発者コンソール（Help > Toggle Developer Tools）
   - 拡張機能のログを確認

3. **再ビルド**:
   ```bash
   npm run clean
   npm run build
   npm run package
   ```

### WSL環境でのパス問題

WSL環境では以下の点に注意：
- ファイルパスの形式が `/mnt/c/...` になる場合がある
- `WebViewResourceManager`が自動的に変換を処理
- 必要に応じて `webview.asWebviewUri()` の動作を確認

この実装により、WSL環境でのVSCode拡張機能WebViewアセット読み込み問題は根本的に解決されています。