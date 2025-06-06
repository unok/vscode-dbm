/**
 * WebView専用ツールバーカスタマイズサービス
 * Node.jsモジュールを使用しない、ブラウザ環境対応版
 */

export interface ToolbarItem {
  id: string
  label: string
  icon: string
  action: string
  position: "left" | "center" | "right"
  visible: boolean
  disabled?: boolean
  tooltip?: string
}

export interface ToolbarGroup {
  id: string
  label: string
  items: ToolbarItem[]
  position: "left" | "center" | "right"
  visible: boolean
}

export class WebViewToolbarService {
  private groups: ToolbarGroup[] = []
  private actionCallbacks = new Map<string, () => void>()

  private get vscodeApi() {
    // Use globally stored VSCode API if available
    return (window as unknown as { vscode?: { getState: () => unknown; setState: (state: unknown) => void; postMessage: (message: unknown) => void } }).vscode || null
  }

  constructor() {
    this.initializeDefaultToolbar()
    this.loadCustomizations()
  }

  private initializeDefaultToolbar(): void {
    this.groups = [
      {
        id: "connection",
        label: "Connection",
        position: "left",
        visible: true,
        items: [
          {
            id: "new-connection",
            label: "New Connection",
            icon: "$(plug)",
            action: "new-connection",
            position: "left",
            visible: true,
            tooltip: "Create new database connection",
          },
          {
            id: "refresh-connections",
            label: "Refresh",
            icon: "$(refresh)",
            action: "refresh-connections",
            position: "left",
            visible: true,
            tooltip: "Refresh all connections",
          },
        ],
      },
      {
        id: "query",
        label: "Query",
        position: "center",
        visible: true,
        items: [
          {
            id: "new-query",
            label: "New Query",
            icon: "$(file-code)",
            action: "new-query",
            position: "center",
            visible: true,
            tooltip: "Create new SQL query",
          },
          {
            id: "execute-query",
            label: "Execute",
            icon: "$(play)",
            action: "execute-query",
            position: "center",
            visible: true,
            tooltip: "Execute current query",
          },
          {
            id: "format-sql",
            label: "Format SQL",
            icon: "$(symbol-keyword)",
            action: "format-sql",
            position: "center",
            visible: true,
            tooltip: "Format SQL query",
          },
          {
            id: "save-query",
            label: "Save",
            icon: "$(save)",
            action: "save-query",
            position: "center",
            visible: true,
            tooltip: "Save current query",
          },
        ],
      },
      {
        id: "data",
        label: "Data",
        position: "right",
        visible: true,
        items: [
          {
            id: "import-data",
            label: "Import",
            icon: "$(cloud-upload)",
            action: "import-data",
            position: "right",
            visible: true,
            tooltip: "Import data from file",
          },
          {
            id: "table-manager",
            label: "Tables",
            icon: "$(table)",
            action: "table-manager",
            position: "right",
            visible: true,
            tooltip: "Manage database tables",
          },
          {
            id: "database-explorer",
            label: "Explorer",
            icon: "$(database)",
            action: "database-explorer",
            position: "right",
            visible: true,
            tooltip: "Browse database structure",
          },
          {
            id: "query-history",
            label: "History",
            icon: "$(history)",
            action: "query-history",
            position: "right",
            visible: true,
            tooltip: "View query history",
          },
        ],
      },
    ]
  }

  private loadCustomizations(): void {
    const savedState = this.vscodeApi?.getState() as { toolbar?: ToolbarGroup[] } | undefined
    if (savedState?.toolbar) {
      try {
        this.groups = savedState.toolbar
      } catch (error) {
        console.warn("Failed to load toolbar customizations:", error)
      }
    }
  }

  getGroups(): ToolbarGroup[] {
    return this.groups.map((group) => ({
      ...group,
      items: [...group.items],
    }))
  }

  getVisibleGroups(): ToolbarGroup[] {
    return this.getGroups().filter((group) => group.visible)
  }

  getGroupsByPosition(position: "left" | "center" | "right"): ToolbarGroup[] {
    return this.getVisibleGroups().filter((group) => group.position === position)
  }

  registerAction(actionId: string, callback: () => void): void {
    this.actionCallbacks.set(actionId, callback)
  }

  unregisterAction(actionId: string): void {
    this.actionCallbacks.delete(actionId)
  }

  executeAction(actionId: string): void {
    const callback = this.actionCallbacks.get(actionId)
    if (callback) {
      try {
        callback()
      } catch (error) {
        console.error(`Failed to execute action ${actionId}:`, error)
      }
    } else {
      console.warn(`No action registered for ${actionId}`)
    }
  }

  updateItemVisibility(itemId: string, visible: boolean): void {
    for (const group of this.groups) {
      const item = group.items.find((item) => item.id === itemId)
      if (item) {
        item.visible = visible
        this.saveCustomizations()
        break
      }
    }
  }

  updateGroupVisibility(groupId: string, visible: boolean): void {
    const group = this.groups.find((g) => g.id === groupId)
    if (group) {
      group.visible = visible
      this.saveCustomizations()
    }
  }

  moveItem(itemId: string, targetGroupId: string, targetPosition: number): void {
    // Find and remove item from current group
    let item: ToolbarItem | undefined
    for (const group of this.groups) {
      const index = group.items.findIndex((i) => i.id === itemId)
      if (index >= 0) {
        item = group.items.splice(index, 1)[0]
        break
      }
    }

    if (!item) return

    // Add to target group
    const targetGroup = this.groups.find((g) => g.id === targetGroupId)
    if (targetGroup) {
      targetGroup.items.splice(targetPosition, 0, item)
      this.saveCustomizations()
    }
  }

  addCustomItem(groupId: string, item: Omit<ToolbarItem, "id">): string {
    const id = `custom-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    const group = this.groups.find((g) => g.id === groupId)

    if (group) {
      group.items.push({
        ...item,
        id,
      })
      this.saveCustomizations()
    }

    return id
  }

  removeItem(itemId: string): void {
    for (const group of this.groups) {
      const index = group.items.findIndex((item) => item.id === itemId)
      if (index >= 0) {
        group.items.splice(index, 1)
        this.saveCustomizations()
        break
      }
    }
  }

  resetToDefault(): void {
    this.initializeDefaultToolbar()
    this.saveCustomizations()
  }

  exportCustomizations(): string {
    return JSON.stringify(this.groups, null, 2)
  }

  importCustomizations(jsonData: string): boolean {
    try {
      const imported = JSON.parse(jsonData)

      if (!Array.isArray(imported)) {
        throw new Error("Invalid toolbar data format")
      }

      // Basic validation
      for (const group of imported) {
        if (!group.id || !group.label || !Array.isArray(group.items)) {
          throw new Error("Invalid group format")
        }
      }

      this.groups = imported
      this.saveCustomizations()
      return true
    } catch (error) {
      console.error("Toolbar customization import failed:", error)
      return false
    }
  }

  private saveCustomizations(): void {
    const currentState = (this.vscodeApi?.getState() as Record<string, unknown>) || {}
    this.vscodeApi?.setState({
      ...currentState,
      toolbar: this.groups,
    })

    // Extension側にも通知
    this.vscodeApi?.postMessage({
      type: "toolbarUpdated",
      data: this.groups,
    })
  }
}
