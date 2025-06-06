#!/usr/bin/env node

/**
 * ネイティブモジュール検出スクリプト
 * VSCode拡張機能でネイティブモジュールが誤って含まれていないかチェック
 */

const fs = require("node:fs")
const path = require("node:path")

// VSCode拡張機能で問題となるネイティブモジュール一覧
const NATIVE_MODULES = [
  "better-sqlite3",
  "mysql2",
  "pg",
  "sqlite3",
  "node-gyp",
  "node-addon-api",
  "bindings",
  "prebuild-install",
]

// フロントエンド（WebView）で使用禁止のバックエンド専用モジュール
const BACKEND_ONLY_MODULES = [
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
]

function checkDistDirectory() {
  const distDir = path.join(__dirname, "../dist")

  if (!fs.existsSync(distDir)) {
    return true
  }

  const issues = []

  // WebView用ディストリビューションをチェック
  const webviewDist = path.join(distDir, "webview")
  if (fs.existsSync(webviewDist)) {
    checkDirectory(webviewDist, "WebView", issues)
  }

  // Extension用ディストリビューションをチェック
  const extensionDist = path.join(distDir, "extension")
  if (fs.existsSync(extensionDist)) {
    checkDirectory(extensionDist, "Extension", issues, true)
  }

  if (issues.length > 0) {
    console.error("\\n❌ ネイティブモジュール/バックエンド専用モジュールの問題が検出されました:")
    for (const issue of issues) {
      console.error(`   ${issue}`)
    }
    console.error("\\n🔧 修正方法:")
    console.error("   1. WebView側でネイティブモジュールを直接使用しないでください")
    console.error("   2. VSCode Extension API経由でバックエンド機能にアクセスしてください")
    console.error("   3. vite.config.tsでexternal設定を確認してください")
    return false
  }
  return true
}

function checkDirectory(dir, context, issues, allowNative = false) {
  if (!fs.existsSync(dir)) return

  const files = fs.readdirSync(dir, { recursive: true })

  for (const file of files) {
    const filePath = path.join(dir, file)

    if (typeof file !== "string") continue

    try {
      const stat = fs.lstatSync(filePath)

      if (stat.isFile() && (file.endsWith(".js") || file.endsWith(".mjs"))) {
        const content = fs.readFileSync(filePath, "utf-8")

        // ネイティブモジュールチェック
        if (!allowNative) {
          for (const module of NATIVE_MODULES) {
            const patterns = [
              `require("${module}")`,
              `require('${module}')`,
              `import.*from.*["']${module}["']`,
              `import.*["']${module}["']`,
            ]

            for (const pattern of patterns) {
              const regex = new RegExp(pattern, "g")
              if (regex.test(content)) {
                issues.push(
                  `${context}: ${file} - ネイティブモジュール '${module}' が検出されました`
                )
              }
            }
          }
        }

        // WebViewでのバックエンド専用モジュールチェック
        if (context === "WebView") {
          for (const module of BACKEND_ONLY_MODULES) {
            const patterns = [
              `require\\\\(["']${module}["']\\\\)`,
              `import.*from.*["']${module}["']`,
              `import.*["']${module}["']`,
            ]

            for (const pattern of patterns) {
              const regex = new RegExp(pattern, "g")
              if (regex.test(content)) {
                issues.push(
                  `${context}: ${file} - バックエンド専用モジュール '${module}' が検出されました`
                )
              }
            }
          }
        }
      }
    } catch (_error) {
      console.warn(`⚠️  ファイル読み込みエラー: ${filePath}`)
    }
  }
}

function checkPackageJson() {
  const packagePath = path.join(__dirname, "../package.json")
  const pkg = JSON.parse(fs.readFileSync(packagePath, "utf-8"))

  const issues = []

  // dependencies の ネイティブモジュールチェック
  if (pkg.dependencies) {
    for (const module of NATIVE_MODULES) {
      if (pkg.dependencies[module]) {
        issues.push(`dependencies に ネイティブモジュール '${module}' が含まれています`)
      }
    }
  }

  if (issues.length > 0) {
    console.warn("\\n⚠️  package.json の問題:")
    for (const issue of issues) {
      console.warn(`   ${issue}`)
    }
    console.warn(
      "   → これらのモジュールはExtension側でのみ使用し、WebView側では使用しないでください"
    )
  } else {
    // Settings are valid
  }
}

function checkViteConfig() {
  const viteConfigPath = path.join(__dirname, "../vite.config.ts")

  if (!fs.existsSync(viteConfigPath)) {
    console.warn("⚠️  vite.config.ts が見つかりません")
    return
  }

  const content = fs.readFileSync(viteConfigPath, "utf-8")

  // external設定の確認
  const hasExternal = content.includes("external") || content.includes("rollupOptions")

  if (hasExternal) {
    // External configuration found
  } else {
    console.warn("⚠️  vite.config.ts で external 設定が見つかりません")
    console.warn("   → ネイティブモジュールを external 設定に追加することを推奨します")
  }
}

checkPackageJson()
checkViteConfig()
const result = checkDistDirectory()

if (result) {
  process.exit(0)
} else {
  console.error("❌ チェック失敗 - 修正が必要です")
  process.exit(1)
}
