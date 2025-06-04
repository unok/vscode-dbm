interface ShortcutDefinition {
  id: string
  key: string
  modifiers: string[]
  action: () => void | Promise<void>
  description: string
  category: "editor" | "navigation" | "data" | "general"
  enabled: boolean
  scope?: "global" | "editor" | "datagrid"
}

interface ShortcutCategory {
  name: string
  shortcuts: ShortcutDefinition[]
}

export interface KeyboardEvent {
  key: string
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  metaKey: boolean
  preventDefault: () => void
  stopPropagation: () => void
}

export interface ShortcutSettings {
  [key: string]: {
    enabled: boolean
    customKey?: string
    customModifiers?: string[]
  }
}

/**
 * KeyboardShortcutService - 統一されたショートカットキー管理
 * フェーズ12: ユーザビリティ向上機能
 */
export class KeyboardShortcutService {
  private shortcuts: Map<string, ShortcutDefinition> = new Map()
  private settings: ShortcutSettings = {}
  private isListening = false

  constructor() {
    this.loadDefaultShortcuts()
    this.loadSettings()
  }

  /**
   * ショートカットを登録
   */
  registerShortcut(shortcut: ShortcutDefinition): void {
    const key = this.generateKey(shortcut.key, shortcut.modifiers)
    this.shortcuts.set(key, shortcut)

    // 設定から有効/無効状態を復元
    if (this.settings[shortcut.id]) {
      shortcut.enabled = this.settings[shortcut.id].enabled

      // カスタムキーバインドを適用
      if (this.settings[shortcut.id].customKey) {
        const customKey = this.settings[shortcut.id].customKey
        if (customKey) {
          shortcut.key = customKey
          shortcut.modifiers = this.settings[shortcut.id].customModifiers || []
        }
      }
    }
  }

  /**
   * ショートカットを削除
   */
  unregisterShortcut(id: string): void {
    for (const [key, shortcut] of this.shortcuts) {
      if (shortcut.id === id) {
        this.shortcuts.delete(key)
        break
      }
    }
  }

  /**
   * キーイベントを処理
   */
  handleKeyEvent(event: KeyboardEvent, scope = "global"): boolean {
    const modifiers = this.extractModifiers(event)
    const key = this.generateKey(event.key, modifiers)
    const shortcut = this.shortcuts.get(key)

    if (shortcut?.enabled && this.isInScope(shortcut, scope)) {
      event.preventDefault()
      event.stopPropagation()

      try {
        const result = shortcut.action()
        if (result instanceof Promise) {
          result.catch((error) => {
            console.error(`Shortcut action failed for ${shortcut.id}:`, error)
          })
        }
      } catch (error) {
        console.error(`Shortcut action failed for ${shortcut.id}:`, error)
      }

      return true
    }

    return false
  }

  /**
   * カテゴリ別ショートカット一覧を取得
   */
  getShortcutsByCategory(): ShortcutCategory[] {
    const categories: Map<string, ShortcutDefinition[]> = new Map()

    for (const shortcut of this.shortcuts.values()) {
      if (!categories.has(shortcut.category)) {
        categories.set(shortcut.category, [])
      }
      categories.get(shortcut.category)?.push(shortcut)
    }

    return Array.from(categories.entries()).map(([name, shortcuts]) => ({
      name,
      shortcuts: shortcuts.sort((a, b) => a.description.localeCompare(b.description)),
    }))
  }

  /**
   * ショートカットを有効化
   */
  enableShortcut(id: string): void {
    this.setShortcutEnabled(id, true)
  }

  /**
   * ショートカットを無効化
   */
  disableShortcut(id: string): void {
    this.setShortcutEnabled(id, false)
  }

  /**
   * ショートカットキーをカスタマイズ
   */
  customizeShortcut(id: string, key: string, modifiers: string[]): boolean {
    const shortcut = this.findShortcutById(id)
    if (!shortcut) return false

    // 競合チェック
    const newKey = this.generateKey(key, modifiers)
    if (this.shortcuts.has(newKey) && this.shortcuts.get(newKey)?.id !== id) {
      return false // 競合あり
    }

    // 古いキーバインドを削除
    const oldKey = this.generateKey(shortcut.key, shortcut.modifiers)
    this.shortcuts.delete(oldKey)

    // 新しいキーバインドを設定
    shortcut.key = key
    shortcut.modifiers = modifiers
    this.shortcuts.set(newKey, shortcut)

    // 設定を保存
    this.settings[id] = {
      ...this.settings[id],
      customKey: key,
      customModifiers: modifiers,
    }
    this.saveSettings()

    return true
  }

  /**
   * ショートカットをデフォルトに戻す
   */
  resetShortcut(id: string): void {
    const shortcut = this.findShortcutById(id)
    if (!shortcut) return

    // カスタム設定をクリア
    if (this.settings[id]) {
      this.settings[id].customKey = undefined
      this.settings[id].customModifiers = undefined
    }

    // デフォルトのショートカットを再読み込み
    this.loadDefaultShortcuts()
    this.saveSettings()
  }

  /**
   * グローバルキーリスナーを開始
   */
  startListening(): void {
    if (this.isListening) return

    document.addEventListener("keydown", this.globalKeyHandler)
    this.isListening = true
  }

  /**
   * グローバルキーリスナーを停止
   */
  stopListening(): void {
    if (!this.isListening) return

    document.removeEventListener("keydown", this.globalKeyHandler)
    this.isListening = false
  }

  /**
   * ショートカット設定をエクスポート
   */
  exportSettings(): ShortcutSettings {
    return { ...this.settings }
  }

  /**
   * ショートカット設定をインポート
   */
  importSettings(settings: ShortcutSettings): void {
    this.settings = { ...settings }
    this.saveSettings()
    this.applySettings()
  }

  private globalKeyHandler = (event: Event): void => {
    const keyEvent = event as unknown as KeyboardEvent
    this.handleKeyEvent(keyEvent, "global")
  }

  private extractModifiers(event: KeyboardEvent): string[] {
    const modifiers: string[] = []
    if (event.ctrlKey || event.metaKey) modifiers.push("Ctrl")
    if (event.shiftKey) modifiers.push("Shift")
    if (event.altKey) modifiers.push("Alt")
    return modifiers
  }

  private generateKey(key: string, modifiers: string[]): string {
    const sortedModifiers = [...modifiers].sort()
    return [...sortedModifiers, key].join("+")
  }

  private isInScope(shortcut: ShortcutDefinition, currentScope: string): boolean {
    if (!shortcut.scope || shortcut.scope === "global") return true
    return shortcut.scope === currentScope
  }

  private setShortcutEnabled(id: string, enabled: boolean): void {
    const shortcut = this.findShortcutById(id)
    if (shortcut) {
      shortcut.enabled = enabled

      if (this.settings[id]) {
        this.settings[id].enabled = enabled
      } else {
        this.settings[id] = { enabled }
      }

      this.saveSettings()
    }
  }

  private findShortcutById(id: string): ShortcutDefinition | undefined {
    for (const shortcut of this.shortcuts.values()) {
      if (shortcut.id === id) {
        return shortcut
      }
    }
    return undefined
  }

  private loadDefaultShortcuts(): void {
    const defaultShortcuts: ShortcutDefinition[] = [
      // エディタ系
      {
        id: "execute-query",
        key: "F5",
        modifiers: [],
        action: () => this.executeQuery(),
        description: "Execute Query",
        category: "editor",
        enabled: true,
        scope: "editor",
      },
      {
        id: "new-query",
        key: "N",
        modifiers: ["Ctrl"],
        action: () => this.newQuery(),
        description: "New Query",
        category: "editor",
        enabled: true,
      },
      {
        id: "save-query",
        key: "S",
        modifiers: ["Ctrl"],
        action: () => this.saveQuery(),
        description: "Save Query",
        category: "editor",
        enabled: true,
        scope: "editor",
      },
      {
        id: "format-sql",
        key: "F",
        modifiers: ["Ctrl", "Shift"],
        action: () => this.formatSQL(),
        description: "Format SQL",
        category: "editor",
        enabled: true,
        scope: "editor",
      },

      // ナビゲーション系
      {
        id: "refresh-schema",
        key: "F5",
        modifiers: ["Ctrl"],
        action: () => this.refreshSchema(),
        description: "Refresh Schema",
        category: "navigation",
        enabled: true,
      },
      {
        id: "focus-explorer",
        key: "E",
        modifiers: ["Ctrl", "Shift"],
        action: () => this.focusExplorer(),
        description: "Focus Database Explorer",
        category: "navigation",
        enabled: true,
      },
      {
        id: "focus-editor",
        key: "D",
        modifiers: ["Ctrl", "Shift"],
        action: () => this.focusEditor(),
        description: "Focus SQL Editor",
        category: "navigation",
        enabled: true,
      },

      // データ操作系
      {
        id: "export-data",
        key: "E",
        modifiers: ["Ctrl"],
        action: () => this.exportData(),
        description: "Export Data",
        category: "data",
        enabled: true,
        scope: "datagrid",
      },
      {
        id: "import-data",
        key: "I",
        modifiers: ["Ctrl"],
        action: () => this.importData(),
        description: "Import Data",
        category: "data",
        enabled: true,
      },
      {
        id: "add-row",
        key: "Insert",
        modifiers: [],
        action: () => this.addRow(),
        description: "Add New Row",
        category: "data",
        enabled: true,
        scope: "datagrid",
      },
      {
        id: "delete-row",
        key: "Delete",
        modifiers: ["Ctrl"],
        action: () => this.deleteRow(),
        description: "Delete Selected Row",
        category: "data",
        enabled: true,
        scope: "datagrid",
      },

      // 一般機能
      {
        id: "show-settings",
        key: ",",
        modifiers: ["Ctrl"],
        action: () => this.showSettings(),
        description: "Open Settings",
        category: "general",
        enabled: true,
      },
      {
        id: "show-help",
        key: "F1",
        modifiers: [],
        action: () => this.showHelp(),
        description: "Show Help",
        category: "general",
        enabled: true,
      },
      {
        id: "show-shortcuts",
        key: "/",
        modifiers: ["Ctrl"],
        action: () => this.showShortcuts(),
        description: "Show Keyboard Shortcuts",
        category: "general",
        enabled: true,
      },
    ]

    for (const shortcut of defaultShortcuts) {
      this.registerShortcut(shortcut)
    }
  }

  private loadSettings(): void {
    try {
      const stored = localStorage.getItem("db-extension-shortcuts")
      if (stored) {
        this.settings = JSON.parse(stored)
      }
    } catch (error) {
      console.warn("Failed to load shortcut settings:", error)
      this.settings = {}
    }
  }

  private saveSettings(): void {
    try {
      localStorage.setItem("db-extension-shortcuts", JSON.stringify(this.settings))
    } catch (error) {
      console.warn("Failed to save shortcut settings:", error)
    }
  }

  private applySettings(): void {
    for (const shortcut of this.shortcuts.values()) {
      if (this.settings[shortcut.id]) {
        shortcut.enabled = this.settings[shortcut.id].enabled
      }
    }
  }

  // アクション実装（実際の機能は各コンポーネントで実装される）
  private executeQuery(): void {
    // Implementation delegated to components
  }

  private newQuery(): void {
    // Implementation delegated to components
  }

  private saveQuery(): void {
    // Implementation delegated to components
  }

  private formatSQL(): void {
    // Implementation delegated to components
  }

  private refreshSchema(): void {
    // Implementation delegated to components
  }

  private focusExplorer(): void {
    // Implementation delegated to components
  }

  private focusEditor(): void {
    // Implementation delegated to components
  }

  private exportData(): void {
    // Implementation delegated to components
  }

  private importData(): void {
    // Implementation delegated to components
  }

  private addRow(): void {
    // Implementation delegated to components
  }

  private deleteRow(): void {
    // Implementation delegated to components
  }

  private showSettings(): void {
    // Implementation delegated to components
  }

  private showHelp(): void {
    // Implementation delegated to components
  }

  private showShortcuts(): void {
    // Implementation delegated to components
  }
}
