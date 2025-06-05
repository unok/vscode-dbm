import type React from "react"
import { useCallback, useEffect, useState } from "react"
import type {
  ToolbarCustomizationService,
  ToolbarItem,
  ToolbarLayout,
  ToolbarSection,
} from "../../shared/services/ToolbarCustomizationService"

interface ToolbarCustomizationProps {
  toolbarService: ToolbarCustomizationService
  onClose: () => void
}

interface DragItem {
  id: string
  type: "item"
  item: ToolbarItem
  sourceSection: string
}

export const ToolbarCustomization: React.FC<ToolbarCustomizationProps> = ({
  toolbarService,
  onClose,
}) => {
  const [layout, setLayout] = useState<ToolbarLayout>(toolbarService.getLayout())
  const [hiddenItems, setHiddenItems] = useState<ToolbarItem[]>(toolbarService.getHiddenItems())
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null)
  const [activeTab, setActiveTab] = useState<"layout" | "appearance" | "items">("layout")
  const [hasChanges, setHasChanges] = useState(false)

  const refreshData = useCallback(() => {
    setLayout(toolbarService.getLayout())
    setHiddenItems(toolbarService.getHiddenItems())
    setHasChanges(true)
  }, [toolbarService])

  const handleItemVisibilityToggle = useCallback(
    (itemId: string, isVisible: boolean) => {
      if (isVisible) {
        toolbarService.showItem(itemId)
      } else {
        toolbarService.removeItem(itemId)
      }
      refreshData()
    },
    [toolbarService, refreshData]
  )

  const handleSectionToggle = useCallback(
    (sectionId: string) => {
      toolbarService.toggleSection(sectionId)
      refreshData()
    },
    [toolbarService, refreshData]
  )

  const handleThemeChange = useCallback(
    (theme: ToolbarLayout["theme"]) => {
      toolbarService.updateTheme(theme)
      refreshData()
    },
    [toolbarService, refreshData]
  )

  const handleIconSizeChange = useCallback(
    (size: ToolbarLayout["iconSize"]) => {
      toolbarService.updateIconSize(size)
      refreshData()
    },
    [toolbarService, refreshData]
  )

  const handleToggleLabels = useCallback(() => {
    toolbarService.toggleLabels()
    refreshData()
  }, [toolbarService, refreshData])

  const handleResetToDefault = useCallback(() => {
    if (confirm("Are you sure you want to reset all toolbar customizations to default?")) {
      toolbarService.resetToDefault()
      refreshData()
    }
  }, [toolbarService, refreshData])

  const handleExportConfig = useCallback(() => {
    const config = toolbarService.exportConfiguration()
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "toolbar-config.json"
    link.click()
    URL.revokeObjectURL(url)
  }, [toolbarService])

  const handleImportConfig = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const config = JSON.parse(e.target?.result as string)
            toolbarService.importConfiguration(config)
            refreshData()
            alert("Configuration imported successfully!")
          } catch (error) {
            alert("Invalid configuration file")
          }
        }
        reader.readAsText(file)
      }
    },
    [toolbarService, refreshData]
  )

  // Drag and Drop handlers
  const handleDragStart = useCallback((item: ToolbarItem, sourceSection: string) => {
    const dragItem: DragItem = {
      id: item.id,
      type: "item",
      item,
      sourceSection,
    }
    setDraggedItem(dragItem)
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null)
  }, [])

  const handleDrop = useCallback(
    (targetSectionId: string, targetPosition?: number) => {
      if (!draggedItem) return

      if (targetPosition !== undefined) {
        toolbarService.reorderItem(draggedItem.id, targetPosition)
      }

      if (draggedItem.sourceSection !== targetSectionId) {
        toolbarService.moveItemToSection(draggedItem.id, targetSectionId)
      }

      refreshData()
      setDraggedItem(null)
    },
    [draggedItem, toolbarService, refreshData]
  )

  const renderItem = (item: ToolbarItem, sectionId: string) => (
    <div
      key={item.id}
      draggable
      onDragStart={() => handleDragStart(item, sectionId)}
      onDragEnd={handleDragEnd}
      className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded cursor-move hover:bg-gray-50"
    >
      <div className="flex items-center space-x-2">
        {item.icon && (
          <span className="w-4 h-4 text-gray-500" aria-label={item.icon}>
            📄
          </span>
        )}
        <span className="text-sm font-medium">{item.label}</span>
        {item.shortcut && (
          <span className="px-1 py-0.5 text-xs bg-gray-100 rounded">{item.shortcut}</span>
        )}
      </div>
      <div className="flex items-center space-x-1">
        <span className="text-xs text-gray-500 capitalize">{item.type}</span>
        <button
          type="button"
          onClick={() => handleItemVisibilityToggle(item.id, false)}
          className="text-red-600 hover:text-red-800"
          title="Hide item"
        >
          ✕
        </button>
      </div>
    </div>
  )

  const renderSection = (section: ToolbarSection) => (
    <div key={section.id} className="border border-gray-300 rounded-lg">
      <div className="flex items-center justify-between p-3 bg-gray-50 border-b">
        <h4 className="font-medium text-gray-900">{section.name}</h4>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">{section.items.length} items</span>
          {section.collapsible && (
            <button
              type="button"
              onClick={() => handleSectionToggle(section.id)}
              className="text-gray-600 hover:text-gray-800"
            >
              {section.collapsed ? "▶" : "▼"}
            </button>
          )}
        </div>
      </div>
      {!section.collapsed && (
        <div
          className="p-3 space-y-2 min-h-16"
          onDrop={(e) => {
            e.preventDefault()
            handleDrop(section.id)
          }}
          onDragOver={(e) => e.preventDefault()}
        >
          {section.items.length === 0 ? (
            <div className="text-center text-gray-500 py-4">
              Drop items here or no items in this section
            </div>
          ) : (
            section.items.map((item) => renderItem(item, section.id))
          )}
        </div>
      )}
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Customize Toolbar</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <nav className="flex space-x-8 px-6">
            {[
              { id: "layout", label: "Layout & Items" },
              { id: "appearance", label: "Appearance" },
              { id: "items", label: "Available Items" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "layout" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Toolbar Sections</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Drag and drop items between sections to customize your toolbar layout.
                </p>
                <div className="space-y-4">{layout.sections.map(renderSection)}</div>
              </div>
            </div>
          )}

          {activeTab === "appearance" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Theme</h3>
                <div className="flex space-x-4">
                  {(["compact", "standard", "expanded"] as const).map((theme) => (
                    <label key={theme} className="flex items-center">
                      <input
                        type="radio"
                        name="theme"
                        value={theme}
                        checked={layout.theme === theme}
                        onChange={() => handleThemeChange(theme)}
                        className="mr-2"
                      />
                      <span className="capitalize">{theme}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Icon Size</h3>
                <div className="flex space-x-4">
                  {(["small", "medium", "large"] as const).map((size) => (
                    <label key={size} className="flex items-center">
                      <input
                        type="radio"
                        name="iconSize"
                        value={size}
                        checked={layout.iconSize === size}
                        onChange={() => handleIconSizeChange(size)}
                        className="mr-2"
                      />
                      <span className="capitalize">{size}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Display Options</h3>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={layout.showLabels}
                    onChange={handleToggleLabels}
                    className="mr-2"
                  />
                  Show labels on toolbar items
                </label>
              </div>
            </div>
          )}

          {activeTab === "items" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Available Items</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Toggle visibility of toolbar items. Hidden items can be restored here.
                </p>
                
                {hiddenItems.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-medium text-gray-900 mb-2">Hidden Items</h4>
                    <div className="space-y-2">
                      {hiddenItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded"
                        >
                          <div className="flex items-center space-x-2">
                            {item.icon && (
                              <span className="w-4 h-4 text-gray-400" aria-label={item.icon}>
                                📄
                              </span>
                            )}
                            <span className="text-sm text-gray-700">{item.label}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleItemVisibilityToggle(item.id, true)}
                            className="text-green-600 hover:text-green-800"
                            title="Show item"
                          >
                            ⚡
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="font-medium text-gray-900 mb-2">All Items by Category</h4>
                  {layout.sections.map((section) => (
                    <div key={section.id} className="mb-4">
                      <h5 className="text-sm font-medium text-gray-700 mb-2">{section.name}</h5>
                      <div className="space-y-1">
                        {section.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded"
                          >
                            <div className="flex items-center space-x-2">
                              {item.icon && (
                                <span className="w-4 h-4 text-gray-500" aria-label={item.icon}>
                                  📄
                                </span>
                              )}
                              <span className="text-sm">{item.label}</span>
                              {item.tooltip && (
                                <span className="text-xs text-gray-500" title={item.tooltip}>
                                  ⓘ
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500 capitalize">{item.type}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={handleResetToDefault}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
            >
              Reset to Default
            </button>
            <button
              type="button"
              onClick={handleExportConfig}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
            >
              Export Config
            </button>
            <label className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 cursor-pointer">
              Import Config
              <input
                type="file"
                accept=".json"
                onChange={handleImportConfig}
                className="hidden"
              />
            </label>
          </div>
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={!hasChanges}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Apply Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}