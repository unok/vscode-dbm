import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * ToolbarCustomizationService - ツールバーカスタマイズ機能
 * フェーズ12: ユーザビリティ向上機能のTDD実装
 */

interface ToolbarItem {
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

interface ToolbarSection {
  id: string
  name: string
  items: ToolbarItem[]
  collapsible: boolean
  collapsed: boolean
}

interface ToolbarLayout {
  sections: ToolbarSection[]
  theme: "compact" | "standard" | "expanded"
  showLabels: boolean
  iconSize: "small" | "medium" | "large"
}

interface ToolbarCustomizationSettings {
  layout: ToolbarLayout
  userCustomizations: {
    hiddenItems: string[]
    reorderedItems: Array<{ id: string; position: number }>
    customItems: ToolbarItem[]
  }
}

class ToolbarCustomizationService {
  private layout: ToolbarLayout
  private settings: ToolbarCustomizationSettings
  private defaultItems: ToolbarItem[] = []

  constructor() {
    this.layout = this.getDefaultLayout()
    this.settings = this.loadSettings()
    this.loadDefaultItems()
  }

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
      ],
      theme: "standard",
      showLabels: true,
      iconSize: "medium",
    }
  }

  loadDefaultItems(): void {
    this.defaultItems = [
      {
        id: "new-connection",
        type: "button",
        label: "New Connection",
        icon: "plug",
        action: () => this.newConnection(),
        visible: true,
        position: 1,
        category: "database",
        tooltip: "Create new database connection",
        shortcut: "Ctrl+N",
      },
      {
        id: "new-query",
        type: "button",
        label: "New Query",
        icon: "file-code",
        action: () => this.newQuery(),
        visible: true,
        position: 2,
        category: "editor",
        tooltip: "Create new SQL query",
        shortcut: "Ctrl+Shift+N",
      },
      {
        id: "execute-query",
        type: "button",
        label: "Execute",
        icon: "play",
        action: () => this.executeQuery(),
        visible: true,
        position: 3,
        category: "editor",
        tooltip: "Execute current query",
        shortcut: "F5",
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
        id: "export-data",
        type: "dropdown",
        label: "Export",
        icon: "export",
        visible: true,
        position: 5,
        category: "data",
        tooltip: "Export data in various formats",
      },
      {
        id: "import-data",
        type: "button",
        label: "Import",
        icon: "import",
        action: () => this.importData(),
        visible: true,
        position: 6,
        category: "data",
        tooltip: "Import data from file",
      },
    ]

    this.applyItemsToLayout()
  }

  applyItemsToLayout(): void {
    // Reset sections
    for (const section of this.layout.sections) {
      section.items = []
    }

    // Group items by category
    for (const item of this.defaultItems) {
      if (!item.visible) continue

      const section = this.layout.sections.find((s) => s.id === item.category)
      if (section) {
        section.items.push(item)
      }
    }

    // Sort items by position within each section
    for (const section of this.layout.sections) {
      section.items.sort((a, b) => a.position - b.position)
    }
  }

  addCustomItem(item: ToolbarItem): void {
    this.defaultItems.push(item)
    this.settings.userCustomizations.customItems.push(item)
    this.applyItemsToLayout()
    this.saveSettings()
  }

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

  showItem(itemId: string): void {
    const item = this.defaultItems.find((i) => i.id === itemId)
    if (item) {
      item.visible = true
      this.settings.userCustomizations.hiddenItems = this.settings.userCustomizations.hiddenItems.filter(
        (id) => id !== itemId
      )
      this.applyItemsToLayout()
      this.saveSettings()
    }
  }

  reorderItem(itemId: string, newPosition: number): void {
    const item = this.defaultItems.find((i) => i.id === itemId)
    if (item) {
      item.position = newPosition
      
      // Update or add to reordered items
      const existingReorder = this.settings.userCustomizations.reorderedItems.find((r) => r.id === itemId)
      if (existingReorder) {
        existingReorder.position = newPosition
      } else {
        this.settings.userCustomizations.reorderedItems.push({ id: itemId, position: newPosition })
      }

      this.applyItemsToLayout()
      this.saveSettings()
    }
  }

  moveItemToSection(itemId: string, targetSectionId: string): void {
    const item = this.defaultItems.find((i) => i.id === itemId)
    if (item) {
      item.category = targetSectionId as ToolbarItem["category"]
      this.applyItemsToLayout()
      this.saveSettings()
    }
  }

  toggleSection(sectionId: string): void {
    const section = this.layout.sections.find((s) => s.id === sectionId)
    if (section && section.collapsible) {
      section.collapsed = !section.collapsed
      this.saveSettings()
    }
  }

  updateTheme(theme: ToolbarLayout["theme"]): void {
    this.layout.theme = theme
    this.saveSettings()
  }

  updateIconSize(size: ToolbarLayout["iconSize"]): void {
    this.layout.iconSize = size
    this.saveSettings()
  }

  toggleLabels(): void {
    this.layout.showLabels = !this.layout.showLabels
    this.saveSettings()
  }

  getLayout(): ToolbarLayout {
    return { ...this.layout }
  }

  getAvailableItems(): ToolbarItem[] {
    return [...this.defaultItems]
  }

  getHiddenItems(): ToolbarItem[] {
    return this.defaultItems.filter((item) => !item.visible)
  }

  resetToDefault(): void {
    this.layout = this.getDefaultLayout()
    this.settings.userCustomizations = {
      hiddenItems: [],
      reorderedItems: [],
      customItems: [],
    }
    this.loadDefaultItems()
    this.saveSettings()
  }

  exportConfiguration(): ToolbarCustomizationSettings {
    return { ...this.settings }
  }

  importConfiguration(config: ToolbarCustomizationSettings): void {
    this.settings = config
    this.layout = config.layout
    this.loadDefaultItems()
    this.applyUserCustomizations()
    this.saveSettings()
  }

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
    this.defaultItems.push(...this.settings.userCustomizations.customItems)

    this.applyItemsToLayout()
  }

  private loadSettings(): ToolbarCustomizationSettings {
    try {
      const stored = localStorage.getItem("db-extension-toolbar")
      if (stored) {
        return JSON.parse(stored)
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

  private saveSettings(): void {
    try {
      this.settings.layout = this.layout
      localStorage.setItem("db-extension-toolbar", JSON.stringify(this.settings))
    } catch (error) {
      console.warn("Failed to save toolbar settings:", error)
    }
  }

  // Action implementations (to be connected to actual functionality)
  private newConnection(): void {
    // Implementation delegated to main application
  }

  private newQuery(): void {
    // Implementation delegated to main application
  }

  private executeQuery(): void {
    // Implementation delegated to main application
  }

  private importData(): void {
    // Implementation delegated to main application
  }
}

describe("ToolbarCustomizationService", () => {
  let toolbarService: ToolbarCustomizationService
  let mockLocalStorage: { getItem: vi.Mock; setItem: vi.Mock; removeItem: vi.Mock }

  beforeEach(() => {
    // Mock localStorage
    mockLocalStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    }
    
    Object.defineProperty(window, "localStorage", {
      value: mockLocalStorage,
      writable: true,
    })

    toolbarService = new ToolbarCustomizationService()
  })

  describe("Default Layout", () => {
    it("should create default layout with standard sections", () => {
      const layout = toolbarService.getLayout()

      expect(layout.sections).toHaveLength(3)
      expect(layout.sections.map((s) => s.id)).toEqual(["database", "editor", "data"])
      expect(layout.theme).toBe("standard")
      expect(layout.showLabels).toBe(true)
      expect(layout.iconSize).toBe("medium")
    })

    it("should populate sections with default items", () => {
      const layout = toolbarService.getLayout()
      const databaseSection = layout.sections.find((s) => s.id === "database")
      const editorSection = layout.sections.find((s) => s.id === "editor")
      const dataSection = layout.sections.find((s) => s.id === "data")

      expect(databaseSection?.items).toHaveLength(1) // new-connection
      expect(editorSection?.items).toHaveLength(3) // new-query, execute-query, separator
      expect(dataSection?.items).toHaveLength(2) // export-data, import-data
    })

    it("should sort items by position within sections", () => {
      const layout = toolbarService.getLayout()
      const editorSection = layout.sections.find((s) => s.id === "editor")

      expect(editorSection?.items[0].id).toBe("new-query") // position 2
      expect(editorSection?.items[1].id).toBe("execute-query") // position 3
      expect(editorSection?.items[2].id).toBe("separator-1") // position 4
    })
  })

  describe("Item Management", () => {
    it("should add custom item", () => {
      const customItem: ToolbarItem = {
        id: "custom-tool",
        type: "button",
        label: "Custom Tool",
        icon: "tools",
        visible: true,
        position: 10,
        category: "database",
        tooltip: "Custom functionality",
      }

      toolbarService.addCustomItem(customItem)

      const layout = toolbarService.getLayout()
      const databaseSection = layout.sections.find((s) => s.id === "database")
      expect(databaseSection?.items.some((item) => item.id === "custom-tool")).toBe(true)
    })

    it("should hide item", () => {
      toolbarService.removeItem("new-query")

      const layout = toolbarService.getLayout()
      const editorSection = layout.sections.find((s) => s.id === "editor")
      expect(editorSection?.items.some((item) => item.id === "new-query")).toBe(false)

      const hiddenItems = toolbarService.getHiddenItems()
      expect(hiddenItems.some((item) => item.id === "new-query")).toBe(true)
    })

    it("should show hidden item", () => {
      toolbarService.removeItem("new-query")
      toolbarService.showItem("new-query")

      const layout = toolbarService.getLayout()
      const editorSection = layout.sections.find((s) => s.id === "editor")
      expect(editorSection?.items.some((item) => item.id === "new-query")).toBe(true)

      const hiddenItems = toolbarService.getHiddenItems()
      expect(hiddenItems.some((item) => item.id === "new-query")).toBe(false)
    })

    it("should reorder item within section", () => {
      toolbarService.reorderItem("execute-query", 1)

      const layout = toolbarService.getLayout()
      const editorSection = layout.sections.find((s) => s.id === "editor")
      
      // execute-query should now be first (position 1)
      expect(editorSection?.items[0].id).toBe("execute-query")
    })

    it("should move item between sections", () => {
      toolbarService.moveItemToSection("new-query", "data")

      const layout = toolbarService.getLayout()
      const editorSection = layout.sections.find((s) => s.id === "editor")
      const dataSection = layout.sections.find((s) => s.id === "data")

      expect(editorSection?.items.some((item) => item.id === "new-query")).toBe(false)
      expect(dataSection?.items.some((item) => item.id === "new-query")).toBe(true)
    })
  })

  describe("Section Management", () => {
    it("should toggle section collapse state", () => {
      const layout = toolbarService.getLayout()
      const section = layout.sections[0]
      const initialState = section.collapsed

      toolbarService.toggleSection(section.id)

      const updatedLayout = toolbarService.getLayout()
      const updatedSection = updatedLayout.sections.find((s) => s.id === section.id)
      expect(updatedSection?.collapsed).toBe(!initialState)
    })

    it("should not toggle non-collapsible section", () => {
      const layout = toolbarService.getLayout()
      layout.sections[0].collapsible = false
      const initialState = layout.sections[0].collapsed

      toolbarService.toggleSection(layout.sections[0].id)

      const updatedLayout = toolbarService.getLayout()
      expect(updatedLayout.sections[0].collapsed).toBe(initialState)
    })
  })

  describe("Theme and Appearance", () => {
    it("should update toolbar theme", () => {
      toolbarService.updateTheme("compact")

      const layout = toolbarService.getLayout()
      expect(layout.theme).toBe("compact")
    })

    it("should update icon size", () => {
      toolbarService.updateIconSize("large")

      const layout = toolbarService.getLayout()
      expect(layout.iconSize).toBe("large")
    })

    it("should toggle label visibility", () => {
      const layout = toolbarService.getLayout()
      const initialState = layout.showLabels

      toolbarService.toggleLabels()

      const updatedLayout = toolbarService.getLayout()
      expect(updatedLayout.showLabels).toBe(!initialState)
    })
  })

  describe("Configuration Management", () => {
    it("should reset to default configuration", () => {
      // Make some changes
      toolbarService.removeItem("new-query")
      toolbarService.updateTheme("compact")
      toolbarService.updateIconSize("large")

      // Reset
      toolbarService.resetToDefault()

      const layout = toolbarService.getLayout()
      expect(layout.theme).toBe("standard")
      expect(layout.iconSize).toBe("medium")
      
      const editorSection = layout.sections.find((s) => s.id === "editor")
      expect(editorSection?.items.some((item) => item.id === "new-query")).toBe(true)
    })

    it("should export current configuration", () => {
      toolbarService.removeItem("new-query")
      toolbarService.updateTheme("compact")

      const config = toolbarService.exportConfiguration()

      expect(config.layout.theme).toBe("compact")
      expect(config.userCustomizations.hiddenItems).toContain("new-query")
    })

    it("should import configuration", () => {
      const config: ToolbarCustomizationSettings = {
        layout: {
          sections: [],
          theme: "expanded",
          showLabels: false,
          iconSize: "small",
        },
        userCustomizations: {
          hiddenItems: ["execute-query"],
          reorderedItems: [{ id: "new-query", position: 1 }],
          customItems: [],
        },
      }

      toolbarService.importConfiguration(config)

      const layout = toolbarService.getLayout()
      expect(layout.theme).toBe("expanded")
      expect(layout.showLabels).toBe(false)
      expect(layout.iconSize).toBe("small")
    })
  })

  describe("Persistence", () => {
    it("should save settings to localStorage", () => {
      toolbarService.updateTheme("compact")

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        "db-extension-toolbar",
        expect.stringContaining('"theme":"compact"')
      )
    })

    it("should load settings from localStorage", () => {
      const savedSettings = {
        layout: {
          sections: [],
          theme: "expanded",
          showLabels: false,
          iconSize: "large",
        },
        userCustomizations: {
          hiddenItems: ["new-query"],
          reorderedItems: [],
          customItems: [],
        },
      }

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedSettings))

      const newService = new ToolbarCustomizationService()
      const layout = newService.getLayout()

      expect(layout.theme).toBe("expanded")
      expect(layout.showLabels).toBe(false)
      expect(layout.iconSize).toBe("large")
    })

    it("should handle corrupted localStorage gracefully", () => {
      mockLocalStorage.getItem.mockReturnValue("invalid-json")

      expect(() => new ToolbarCustomizationService()).not.toThrow()
    })
  })

  describe("Available Items", () => {
    it("should return all available items", () => {
      const items = toolbarService.getAvailableItems()

      expect(items).toHaveLength(6) // 5 default items + 1 separator
      expect(items.some((item) => item.id === "new-connection")).toBe(true)
      expect(items.some((item) => item.id === "execute-query")).toBe(true)
    })

    it("should return hidden items separately", () => {
      toolbarService.removeItem("new-query")
      toolbarService.removeItem("export-data")

      const hiddenItems = toolbarService.getHiddenItems()
      expect(hiddenItems).toHaveLength(2)
      expect(hiddenItems.map((item) => item.id)).toEqual(["new-query", "export-data"])
    })
  })
})