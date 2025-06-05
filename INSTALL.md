# Database DataGrid Manager - Installation Guide

VSCode/Cursor用データベース管理拡張機能のインストールガイドです。

## 目次

1. [事前準備](#事前準備)
2. [リポジトリからビルド](#リポジトリからビルド)
3. [VSCodeへのインストール](#vscodeへのインストール)
4. [Cursorへのインストール](#cursorへのインストール)
5. [開発環境セットアップ](#開発環境セットアップ)
6. [トラブルシューティング](#トラブルシューティング)

## 事前準備

### 必要なソフトウェア

- **Node.js**: v20以上
- **npm**: v10以上（Node.jsに含まれています）
- **Git**: 最新版
- **VSCode** または **Cursor**

### システム要件

- **Windows**: Windows 10/11
- **macOS**: macOS 10.15以上
- **Linux**: Ubuntu 18.04以上、またはその他のLinuxディストリビューション

## リポジトリからビルド

### 1. リポジトリのクローン

```bash
git clone https://github.com/unok/vscode-dbm.git
cd vscode-dbm
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 拡張機能のビルド

```bash
npm run build
```

### 4. パッケージの作成

```bash
npm run package
```

ビルドが成功すると、`dist/` ディレクトリに `.vsix` ファイルが生成されます。

## VSCodeへのインストール

### 方法1: コマンドラインから

```bash
code --install-extension dist/vscode-dbm-0.1.0.vsix
```

### 方法2: VSCode UIから

1. VSCodeを開く
2. 拡張機能ビュー (`Ctrl+Shift+X`) を開く
3. 「...」メニューをクリック
4. 「VSIXからのインストール...」を選択
5. `dist/vscode-dbm-0.1.0.vsix` ファイルを選択
6. インストール完了後、VSCodeを再起動

### 方法3: 開発モードで実行

```bash
# デバッグ版で起動
npm run dev

# 新しいVSCodeウィンドウが起動し、拡張機能が有効になります
```

## Cursorへのインストール

### 方法1: コマンドラインから

```bash
cursor --install-extension dist/vscode-dbm-0.1.0.vsix
```

### 方法2: Cursor UIから

1. Cursorを開く
2. 拡張機能ビュー (`Ctrl+Shift+X`) を開く
3. 「...」メニューをクリック
4. 「VSIXからのインストール...」を選択
5. `dist/vscode-dbm-0.1.0.vsix` ファイルを選択
6. インストール完了後、Cursorを再起動

### 方法3: 開発モードで実行

```bash
# デバッグ版で起動
npm run dev:cursor

# 新しいCursorウィンドウが起動し、拡張機能が有効になります
```

## 使用方法

### 基本的な使い方

1. **拡張機能の起動**
   - `Ctrl+Shift+P` でコマンドパレットを開く
   - `Database DataGrid Manager: Open` を選択

2. **データベース接続**
   - サイドパネルから「New Connection」をクリック
   - データベース情報を入力（MySQL、PostgreSQL、SQLite対応）
   - 接続テストを実行

3. **データ操作**
   - テーブル一覧からテーブルを選択
   - DataGridでデータを直感的に編集
   - SQLエディタで高度なクエリを実行

### 主要機能

- 📊 **カスタマイズ可能なツールバー**: ドラッグ&ドロップで自由にカスタマイズ
- 🗃️ **複数データベース対応**: MySQL、PostgreSQL、SQLite
- ✏️ **高度なDataGrid**: TanStack Tableベースの高性能テーブル編集
- 🚀 **Monaco SQLエディタ**: シンタックスハイライト、オートコンプリート対応
- 🔧 **テーブル管理**: DDL実行、制約管理、インデックス管理
- 🎨 **テーマ対応**: VSCode/Cursorのテーマに自動対応

## 開発環境セットアップ

開発に参加したい場合は、以下の手順で環境を構築してください。

### 1. Dev Container使用（推奨）

```bash
# Dev Containerで開発環境を起動
code .devcontainer
```

### 2. ローカル開発環境

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動
npm run dev

# テスト実行
npm test

# lint実行
npm run lint

# ビルド
npm run build
```

### 3. テスト環境

```bash
# Docker Composeでテスト用データベース起動
npm run test:setup

# 統合テスト実行
npm run test:integration

# E2Eテスト実行
npm run test:e2e
```

### 開発時のスクリプト

```bash
# 開発用（HMR対応）
npm run dev

# テスト（全種類）
npm test

# ビルド（本番用）
npm run build

# パッケージ作成
npm run package

# 品質チェック
npm run lint
npm run type-check
```

## トラブルシューティング

### よくある問題と解決法

#### 1. ビルドエラー

```bash
# Node.jsのバージョン確認
node --version  # v20以上が必要

# キャッシュクリア
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

#### 2. 拡張機能が認識されない

```bash
# VSCodeの開発者ツールでエラーを確認
# Help > Toggle Developer Tools > Console

# 拡張機能の再インストール
code --uninstall-extension publisher.extension-name
npm run package
code --install-extension dist/vscode-dbm-0.1.0.vsix
```

#### 3. データベース接続エラー

- **MySQL**: ポート3306が開いているか確認
- **PostgreSQL**: ポート5432が開いているか確認
- **SQLite**: ファイルパスとアクセス権限を確認

#### 4. パフォーマンス問題

```bash
# 開発者ツールでパフォーマンス確認
# View > Command Palette > Developer: Reload Window

# メモリ使用量確認
# View > Command Palette > Developer: Show Running Extensions
```

### ログの確認

#### VSCodeでのログ確認

1. `Ctrl+Shift+P` でコマンドパレットを開く
2. `Developer: Show Extension Host Log` を選択
3. 拡張機能のログを確認

#### Cursorでのログ確認

1. `Ctrl+Shift+P` でコマンドパレットを開く
2. `Developer: Show Extension Host Log` を選択
3. 拡張機能のログを確認

### サポート

問題が解決しない場合は、以下の情報と合わせてIssueを作成してください：

- OS種類とバージョン
- Node.jsバージョン
- VSCode/Cursorバージョン
- エラーメッセージの全文
- 再現手順

## 更新

### 手動更新

```bash
# 最新版を取得
git pull origin main

# 依存関係を更新
npm install

# 再ビルド
npm run build
npm run package

# 再インストール
code --install-extension dist/vscode-dbm-0.1.0.vsix --force
```

### 自動更新（将来予定）

将来のバージョンでは、VSCode Marketplaceからの自動更新に対応予定です。

---

**開発チーム**: このプロジェクトはTDD（テスト駆動開発）で開発され、包括的なテストカバレッジを維持しています。

**ライセンス**: MIT License

**貢献**: プルリクエストやIssueの報告を歓迎します！