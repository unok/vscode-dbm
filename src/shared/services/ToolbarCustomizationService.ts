/**
 * ToolbarCustomizationService - ツールバーカスタマイズ管理
 * フェーズ12: ユーザビリティ向上機能
 */

export interface ToolbarItem {
  id: string
  type: "button" | "separator" | "dropdown" | "search"
  label: string
  icon?: string
  action?: () => void | Promise<void>
  visible: boolean
  position: number
  category: "database" | "editor" | "data" | "navigation"
  tooltip?: string
  shortcut?: string
  disabled?: boolean
}

export interface ToolbarSection {
  id: string
  name: string
  items: ToolbarItem[]
  collapsible: boolean
  collapsed: boolean
}

export interface ToolbarLayout {
  sections: ToolbarSection[]
  theme: "compact" | "standard" | "expanded"
  showLabels: boolean
  iconSize: "small" | "medium" | "large"
}

export interface ToolbarCustomizationSettings {
  layout: ToolbarLayout
  userCustomizations: {
    hiddenItems: string[]
    reorderedItems: Array<{ id: string; position: number }>
    customItems: ToolbarItem[]
  }
}

export class ToolbarCustomizationService {
  private layout: ToolbarLayout
  private settings: ToolbarCustomizationSettings
  private defaultItems: ToolbarItem[] = []
  private actionCallbacks: Map<string, () => void | Promise<void>> = new Map()

  constructor() {
    this.layout = this.getDefaultLayout()
    this.settings = this.loadSettings()
    this.loadDefaultItems()
    this.applyUserCustomizations()
  }

  /**
   * デフォルトレイアウトを取得
   */
  getDefaultLayout(): ToolbarLayout {
    return {
      sections: [
        {
          id: "database",
          name: "Database",
          items: [],
          collapsible: true,
          collapsed: false,
        },
        {
          id: "editor",
          name: "Editor",
          items: [],
          collapsible: true,
          collapsed: false,
        },
        {
          id: "data",
          name: "Data",
          items: [],
          collapsible: true,
          collapsed: false,
        },
        {
          id: "navigation",
          name: "Navigation",
          items: [],
          collapsible: true,
          collapsed: false,
        },
      ],
      theme: "standard",
      showLabels: true,
      iconSize: "medium",
    }
  }

  /**
   * デフォルトアイテムを読み込み
   */
  loadDefaultItems(): void {
    this.defaultItems = [
      {
        id: "new-connection",
        type: "button",
        label: "New Connection",
        icon: "plug",
        action: () => this.executeAction("new-connection"),
        visible: true,
        position: 1,
        category: "database",
        tooltip: "Create new database connection",
        shortcut: "Ctrl+Shift+C",
      },
      {
        id: "refresh-connections",
        type: "button",
        label: "Refresh",
        icon: "refresh",
        action: () => this.executeAction("refresh-connections"),
        visible: true,
        position: 2,
        category: "database",
        tooltip: "Refresh database connections",
        shortcut: "F5",
      },
      {
        id: "new-query",
        type: "button",
        label: "New Query",
        icon: "file-code",
        action: () => this.executeAction("new-query"),
        visible: true,
        position: 1,
        category: "editor",
        tooltip: "Create new SQL query",
        shortcut: "Ctrl+N",
      },
      {
        id: "execute-query",
        type: "button",
        label: "Execute",
        icon: "play",
        action: () => this.executeAction("execute-query"),
        visible: true,
        position: 2,
        category: "editor",
        tooltip: "Execute current query",
        shortcut: "F5",
      },
      {
        id: "format-sql",
        type: "button",
        label: "Format",
        icon: "code",
        action: () => this.executeAction("format-sql"),
        visible: true,
        position: 3,
        category: "editor",
        tooltip: "Format SQL code",
        shortcut: "Ctrl+Shift+F",
      },
      {
        id: "separator-1",
        type: "separator",
        label: "",
        visible: true,
        position: 4,
        category: "editor",
      },
      {
        id: "save-query",
        type: "button",
        label: "Save",
        icon: "save",
        action: () => this.executeAction("save-query"),
        visible: true,
        position: 5,
        category: "editor",
        tooltip: "Save current query",
        shortcut: "Ctrl+S",
      },
      {
        id: "export-data",
        type: "dropdown",
        label: "Export",
        icon: "export",
        visible: true,
        position: 1,
        category: "data",
        tooltip: "Export data in various formats",
      },
      {
        id: "import-data",
        type: "button",
        label: "Import",
        icon: "import",
        action: () => this.executeAction("import-data"),
        visible: true,
        position: 2,
        category: "data",
        tooltip: "Import data from file",
        shortcut: "Ctrl+I",
      },
      {
        id: "table-manager",
        type: "button",
        label: "Table Manager",
        icon: "table",
        action: () => this.executeAction("table-manager"),
        visible: true,
        position: 3,
        category: "data",
        tooltip: "Manage database tables",
      },
      {
        id: "database-explorer",
        type: "button",
        label: "Explorer",
        icon: "folder-library",
        action: () => this.executeAction("database-explorer"),
        visible: true,
        position: 1,
        category: "navigation",
        tooltip: "Browse database structure",
      },
      {
        id: "query-history",
        type: "button",
        label: "History",
        icon: "history",
        action: () => this.executeAction("query-history"),
        visible: true,
        position: 2,
        category: "navigation",
        tooltip: "View query history",
      },
      {
        id: "search-global",
        type: "search",
        label: "Search",
        icon: "search",
        visible: true,
        position: 3,
        category: "navigation",
        tooltip: "Global search across databases",
        shortcut: "Ctrl+Shift+P",
      },
    ]

    this.applyItemsToLayout()
  }

  /**
   * アイテムをレイアウトに適用
   */
  applyItemsToLayout(): void {
    // Reset sections
    for (const section of this.layout.sections) {
      section.items = []
    }

    // Group visible items by category
    for (const item of this.defaultItems) {
      if (!item.visible) continue

      const section = this.layout.sections.find((s) => s.id === item.category)
      if (section) {
        // Preserve the action function reference
        section.items.push({
          ...item,
          action: item.action, // Explicitly preserve the action function
        })
      }
    }

    // Sort items by position within each section
    for (const section of this.layout.sections) {
      section.items.sort((a, b) => a.position - b.position)
    }
  }

  /**
   * アクションコールバックを登録
   */
  registerAction(actionId: string, callback: () => void | Promise<void>): void {
    this.actionCallbacks.set(actionId, callback)
  }

  /**
   * アクションコールバックを削除
   */
  unregisterAction(actionId: string): void {
    this.actionCallbacks.delete(actionId)
  }

  /**
   * アクションを実行
   */
  private async executeAction(actionId: string): Promise<void> {
    const callback = this.actionCallbacks.get(actionId)
    if (callback) {
      try {
        const result = callback()
        if (result instanceof Promise) {
          await result
        }
      } catch (error) {
        console.error(`Failed to execute action ${actionId}:`, error)
      }
    } else {
      console.warn(`No action registered for ${actionId}`)
    }
  }

  /**
   * カスタムアイテムを追加
   */
  addCustomItem(item: ToolbarItem): void {
    // Ensure unique ID
    if (this.defaultItems.some((existing) => existing.id === item.id)) {
      throw new Error(`Item with ID ${item.id} already exists`)
    }

    this.defaultItems.push(item)
    this.settings.userCustomizations.customItems.push(item)
    this.applyItemsToLayout()
    this.saveSettings()
  }

  /**
   * アイテムを非表示にする
   */
  removeItem(itemId: string): void {
    const item = this.defaultItems.find((i) => i.id === itemId)
    if (item) {
      item.visible = false
      if (!this.settings.userCustomizations.hiddenItems.includes(itemId)) {
        this.settings.userCustomizations.hiddenItems.push(itemId)
      }
      this.applyItemsToLayout()
      this.saveSettings()
    }
  }

  /**
   * 非表示アイテムを表示する
   */
  showItem(itemId: string): void {
    const item = this.defaultItems.find((i) => i.id === itemId)
    if (item) {
      item.visible = true
      this.settings.userCustomizations.hiddenItems =
        this.settings.userCustomizations.hiddenItems.filter((id) => id !== itemId)
      this.applyItemsToLayout()
      this.saveSettings()
    }
  }

  /**
   * アイテムの順序を変更
   */
  reorderItem(itemId: string, newPosition: number): void {
    const item = this.defaultItems.find((i) => i.id === itemId)
    if (item) {
      item.position = newPosition

      // Update or add to reordered items
      const existingReorder = this.settings.userCustomizations.reorderedItems.find(
        (r) => r.id === itemId
      )
      if (existingReorder) {
        existingReorder.position = newPosition
      } else {
        this.settings.userCustomizations.reorderedItems.push({ id: itemId, position: newPosition })
      }

      this.applyItemsToLayout()
      this.saveSettings()
    }
  }

  /**
   * アイテムを別のセクションに移動
   */
  moveItemToSection(itemId: string, targetSectionId: string): void {
    const item = this.defaultItems.find((i) => i.id === itemId)
    const targetSection = this.layout.sections.find((s) => s.id === targetSectionId)

    if (item && targetSection) {
      item.category = targetSectionId as ToolbarItem["category"]
      this.applyItemsToLayout()
      this.saveSettings()
    }
  }

  /**
   * セクションの折りたたみ状態を切り替え
   */
  toggleSection(sectionId: string): void {
    const section = this.layout.sections.find((s) => s.id === sectionId)
    if (section?.collapsible) {
      section.collapsed = !section.collapsed
      this.saveSettings()
    }
  }

  /**
   * テーマを更新
   */
  updateTheme(theme: ToolbarLayout["theme"]): void {
    this.layout.theme = theme
    this.saveSettings()
  }

  /**
   * アイコンサイズを更新
   */
  updateIconSize(size: ToolbarLayout["iconSize"]): void {
    this.layout.iconSize = size
    this.saveSettings()
  }

  /**
   * ラベル表示を切り替え
   */
  toggleLabels(): void {
    this.layout.showLabels = !this.layout.showLabels
    this.saveSettings()
  }

  /**
   * 現在のレイアウトを取得
   */
  getLayout(): ToolbarLayout {
    // Deep clone but preserve functions for actions
    const cloned = JSON.parse(JSON.stringify(this.layout))

    // Restore action functions from defaultItems
    for (const section of cloned.sections) {
      for (const item of section.items) {
        const originalItem = this.defaultItems.find((orig) => orig.id === item.id)
        if (originalItem?.action) {
          item.action = originalItem.action
        }
      }
    }

    return cloned
  }

  /**
   * 利用可能なすべてのアイテムを取得
   */
  getAvailableItems(): ToolbarItem[] {
    return [...this.defaultItems]
  }

  /**
   * 非表示のアイテムを取得
   */
  getHiddenItems(): ToolbarItem[] {
    return this.defaultItems.filter((item) => !item.visible)
  }

  /**
   * セクション内のアイテム数を取得
   */
  getSectionItemCount(sectionId: string): number {
    const section = this.layout.sections.find((s) => s.id === sectionId)
    return section ? section.items.length : 0
  }

  /**
   * アイテムのバリデーション
   */
  validateItem(item: ToolbarItem): string[] {
    const errors: string[] = []

    if (!item.id || item.id.trim().length === 0) {
      errors.push("Item ID is required")
    }

    if (!item.label || item.label.trim().length === 0) {
      errors.push("Item label is required")
    }

    if (!["button", "separator", "dropdown", "search"].includes(item.type)) {
      errors.push("Invalid item type")
    }

    if (!["database", "editor", "data", "navigation"].includes(item.category)) {
      errors.push("Invalid item category")
    }

    if (item.position < 0) {
      errors.push("Position must be non-negative")
    }

    return errors
  }

  /**
   * デフォルト設定にリセット
   */
  resetToDefault(): void {
    this.layout = this.getDefaultLayout()
    this.settings = {
      layout: this.layout,
      userCustomizations: {
        hiddenItems: [],
        reorderedItems: [],
        customItems: [],
      },
    }
    this.loadDefaultItems()
    this.saveSettings()
  }

  /**
   * 設定をエクスポート
   */
  exportConfiguration(): ToolbarCustomizationSettings {
    return JSON.parse(JSON.stringify(this.settings))
  }

  /**
   * 設定をインポート
   */
  importConfiguration(config: ToolbarCustomizationSettings): void {
    // Validate configuration
    if (!config.layout || !config.userCustomizations) {
      throw new Error("Invalid configuration format")
    }

    this.settings = JSON.parse(JSON.stringify(config))
    this.layout = this.settings.layout
    this.loadDefaultItems()
    this.applyUserCustomizations()
    this.saveSettings()
  }

  /**
   * ユーザーカスタマイズを適用
   */
  private applyUserCustomizations(): void {
    // Apply hidden items
    for (const hiddenId of this.settings.userCustomizations.hiddenItems) {
      const item = this.defaultItems.find((i) => i.id === hiddenId)
      if (item) {
        item.visible = false
      }
    }

    // Apply reordered items
    for (const reorder of this.settings.userCustomizations.reorderedItems) {
      const item = this.defaultItems.find((i) => i.id === reorder.id)
      if (item) {
        item.position = reorder.position
      }
    }

    // Add custom items
    for (const customItem of this.settings.userCustomizations.customItems) {
      if (!this.defaultItems.some((item) => item.id === customItem.id)) {
        this.defaultItems.push({ ...customItem })
      }
    }

    this.applyItemsToLayout()
  }

  /**
   * 設定を読み込み
   */
  private loadSettings(): ToolbarCustomizationSettings {
    try {
      const stored = localStorage.getItem("db-extension-toolbar")
      if (stored) {
        const parsed = JSON.parse(stored)
        // Ensure structure is valid
        if (parsed.layout && parsed.userCustomizations) {
          return parsed
        }
      }
    } catch (error) {
      console.warn("Failed to load toolbar settings:", error)
    }

    return {
      layout: this.getDefaultLayout(),
      userCustomizations: {
        hiddenItems: [],
        reorderedItems: [],
        customItems: [],
      },
    }
  }

  /**
   * 設定を保存
   */
  private saveSettings(): void {
    try {
      this.settings.layout = this.layout
      localStorage.setItem("db-extension-toolbar", JSON.stringify(this.settings))
    } catch (error) {
      console.warn("Failed to save toolbar settings:", error)
    }
  }
}
