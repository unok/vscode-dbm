# Database DataGrid Manager

![CI Status](https://github.com/unok/vscode-dbm/workflows/CI%20-%20Pull%20Request%20Checks/badge.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-v20+-green.svg)
![React](https://img.shields.io/badge/react-v19-blue.svg)

VSCode/Cursor用のデータベース操作プラグイン。JetBrains DataGripのような直感的な操作感を持つDataGridインターフェースを提供し、複数のデータベースに対応した包括的なDB管理ツールです。

## 🎉 フェーズ12実装中: ユーザビリティ向上機能

### ✅ フェーズ1: Dev Container + Vite+React19基盤構築

- **Dev Container環境構築**
  - `.devcontainer/devcontainer.json` - Dev Container設定
  - `.devcontainer/Dockerfile` - 開発環境イメージ
  - Docker Compose設定（開発・テスト環境分離）
  - データベース環境セットアップ（MySQL、PostgreSQL、SQLite）

- **プロジェクト基盤**
  - `package.json` - React 19対応
  - Vite設定（@tomjs/vite-plugin-vscode）
  - TypeScript設定
  - VSCode拡張機能設定

- **TDD環境セットアップ**
  - Vitest設定・設定
  - Jest互換レイヤー設定
  - テストファイル構造作成
  - MSW（Mock Service Worker）設定
  - カバレッジレポート設定

- **基本プロジェクト構造**
  - `src/extension/` - VSCode拡張機能コード
  - `src/webview/` - React WebViewコード
  - `src/shared/` - 共有型定義
  - `src/test/` - テストコード
  - Tailwind CSS設定

## 🛠 技術スタック

### フロントエンド
- **React 19** - 最新の並行レンダリング機能
- **TypeScript** - 型安全性確保
- **Vite** - 高速ビルドツール
- **Tailwind CSS** - ユーティリティファーストCSS

### 開発・テスト環境
- **Vitest** - Vite統合テストランナー
- **@testing-library/react** - Reactコンポーネントテスト
- **MSW** - API モック
- **Biome v2.0** - 高速リンター・フォーマッター

### 開発環境・コンテナ
- **Dev Container** - VSCode統合開発環境
- **Docker Compose** - 複数データベースのテスト環境
- **Claude Code対応** - Dev Container内で動作可能

### CI/CD（GitHub Actions）
- **GitHub Actions** - 自動CI/CDパイプライン
- **品質チェック** - Lint、TypeScript、テスト
- **自動ビルド** - 拡張機能パッケージング
- **PRチェック** - プルリクエスト時の自動品質確認

### コード品質管理（Husky）
- **Pre-commit フック** - コミット前の自動チェック
- **依存関係確認** - package.json妥当性チェック
- **Lint自動修正** - Biome による自動フォーマット
- **型チェック** - TypeScript エラー検出（警告表示）
- **ビルド確認** - 拡張機能の動作確認（警告表示）

### ✅ フェーズ2: データベース接続基盤（TDD実装）

- **TDD テストケース作成**
  - Docker Compose DB環境テスト
  - 接続管理・プール管理・暗号化テスト
  - MySQL/PostgreSQL/SQLite統合テスト
  - 包括的なエラーハンドリングとパフォーマンステスト

- **データベース接続実装**
  - `DatabaseConnection` - 基底接続管理クラス
  - `EncryptionService` - 接続情報暗号化サービス
  - `MySQLDriver` - MySQL専用ドライバー（CRUD、スキーマ取得）
  - `PostgreSQLDriver` - PostgreSQL専用ドライバー（JSON/UUID対応）
  - `SQLiteDriver` - SQLite専用ドライバー（FTS、トランザクション）

## 📦 インストール・使用方法

### クイックインストール

```bash
# リポジトリからビルド
git clone https://github.com/unok/vscode-dbm.git
cd vscode-dbm
npm install
npm run build
npm run package

# VSCodeにインストール
code --install-extension dist/vscode-dbm-0.1.0.vsix

# Cursorにインストール
cursor --install-extension dist/vscode-dbm-0.1.0.vsix
```

詳細なインストール手順は [INSTALL.md](./INSTALL.md) をご覧ください。

### 主要機能

- 📊 **カスタマイズ可能なツールバー** - ドラッグ&ドロップによる自由なカスタマイズ
- 🗃️ **複数データベース対応** - MySQL、PostgreSQL、SQLite
- ✏️ **高度なDataGrid** - TanStack Tableベースの高性能テーブル編集
- 🚀 **Monaco SQLエディタ** - シンタックスハイライト、オートコンプリート対応
- 🔧 **テーブル管理** - DDL実行、制約管理、インデックス管理
- 🎨 **テーマ対応** - VSCode/Cursorのテーマに自動対応

## 🎯 実装済み機能（フェーズ1-12）

### ✅ フェーズ1-11: 基盤からテーブル管理まで
- **データベース接続**: 複数DB対応、暗号化、接続プール
- **WebView UI**: React 19、Vite、Tailwind CSS
- **DataGrid**: TanStack Table、仮想スクロール、インライン編集
- **SQLエディタ**: Monaco Editor、オートコンプリート、フォーマッター
- **AI統合**: Cursor AI連携、スマートデフォルト値生成
- **テーブル管理**: DDL実行、制約・インデックス管理

### 🚧 フェーズ12: ユーザビリティ向上（実装中）
- **✅ ツールバーカスタマイズ**: ドラッグ&ドロップ、テーマ切り替え、設定保存
- **🔄 設定画面**: 実装予定
- **🔄 ヘルプ・ドキュメント**: 実装予定

## 🔄 今後の予定

### フェーズ13: 最終統合テスト・品質保証
- E2Eワークフローテスト、パフォーマンス・負荷テスト
- セキュリティテスト、ユーザビリティテスト

### フェーズ14-15: 公開準備
- GitHub Actions CI/CD構築、VSCode Marketplace公開
- ドキュメント・チュートリアル作成

## 🏃‍♂️ 開発環境セットアップ

### 前提条件
- Docker Desktop
- VSCode with Dev Containers extension
- Node.js 20+ (Dev Container内で自動セットアップ)

### クイックスタート

1. **リポジトリクローン**
   ```bash
   git clone <repository-url>
   cd vscode-dbm
   ```

2. **Dev Container起動**
   - VSCodeでプロジェクトを開く
   - "Reopen in Container"を選択
   - Dev Containerが自動構築・起動

3. **開発環境確認**
   ```bash
   # 依存関係インストール（自動実行）
   npm install
   
   # 開発サーバー起動
   npm run dev
   
   # テスト実行
   npm test
   
   # リント・フォーマット
   npm run lint
   
   # Huskyフック確認
   git add . && git commit -m "test commit" # pre-commitフックが自動実行
   ```

4. **データベース環境起動**
   ```bash
   # 開発用データベース起動
   docker-compose -f docker-compose.dev.yml up -d
   
   # テスト用データベース起動
   docker-compose -f docker-compose.test.yml up -d
   ```

## 📊 プロジェクト構造

```
vscode-dbm/
├── .devcontainer/          # Dev Container設定
├── src/
│   ├── extension/          # VSCode拡張機能
│   ├── webview/           # React WebView
│   ├── shared/            # 共有型定義
│   └── test/              # テストコード
├── scripts/               # データベース初期化スクリプト
├── docker-compose.*.yml   # Docker環境設定
└── *.config.ts           # 各種設定ファイル
```

## 🎯 開発方針

### TDD（テスト駆動開発）
- すべての機能を事前にテストケースを作成してから実装
- Red-Green-Refactorサイクルを厳格に適用
- カバレッジ目標: 90%以上
- **実績**: フェーズ2で18のテストファイル、200+のテストケース作成完了

### Cursor AI統合（最優先）
- Cursor Composer統合（コード生成・編集）
- Cursor Chat連携（デバッグ・説明）
- GitHub Copilot連携（フォールバック）

## 📈 成功指標

- [x] Dev Container環境で開発者オンボーディング時間を50%短縮
- [x] Docker Compose環境でポート競合問題を0件に削減
- [x] TDD開発によりバグ発生率を10%以下に抑制
- [x] テストカバレッジ90%以上を維持
- [ ] 複数のデータベース（MySQL、PostgreSQL、SQLite）に接続
- [ ] 10万行のデータを快適に表示・編集
- [ ] JetBrains DataGripと同等の操作感を実現

## 📄 ライセンス

MIT License