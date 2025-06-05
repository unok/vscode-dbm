import type React from "react"
import { useCallback, useEffect, useState } from "react"
import type {
  ToolbarCustomizationService,
  ToolbarItem,
  ToolbarLayout,
  ToolbarSection,
} from "../../shared/services/ToolbarCustomizationService"
import { ToolbarCustomization } from "./ToolbarCustomization"

interface CustomizableToolbarProps {
  toolbarService: ToolbarCustomizationService
  className?: string
}

interface DropdownState {
  [itemId: string]: boolean
}

export const CustomizableToolbar: React.FC<CustomizableToolbarProps> = ({
  toolbarService,
  className = "",
}) => {
  const [layout, setLayout] = useState<ToolbarLayout>(toolbarService.getLayout())
  const [showCustomization, setShowCustomization] = useState(false)
  const [dropdownStates, setDropdownStates] = useState<DropdownState>({})

  // Refresh layout when service changes
  useEffect(() => {
    const refreshLayout = () => {
      setLayout(toolbarService.getLayout())
    }

    // Listen for layout changes (in a real implementation, this would be an event)
    const interval = setInterval(refreshLayout, 1000)
    return () => clearInterval(interval)
  }, [toolbarService])

  const handleItemClick = useCallback(
    async (item: ToolbarItem) => {
      if (item.disabled) return
      
      if (item.action) {
        try {
          const result = item.action()
          if (result instanceof Promise) {
            await result
          }
        } catch (error) {
          console.error(`Failed to execute action ${item.id}:`, error)
        }
      }
    },
    []
  )

  const toggleDropdown = useCallback((itemId: string) => {
    setDropdownStates((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }))
  }, [])

  const closeDropdown = useCallback((itemId: string) => {
    setDropdownStates((prev) => ({
      ...prev,
      [itemId]: false,
    }))
  }, [])

  const renderToolbarItem = useCallback(
    (item: ToolbarItem) => {
      if (item.type === "separator") {
        return (
          <div
            key={item.id}
            className="w-px h-6 bg-gray-300 mx-1"
            aria-hidden="true"
          />
        )
      }

      if (item.type === "search") {
        return (
          <div key={item.id} className="flex items-center">
            <input
              type="text"
              placeholder={item.label}
              className="px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              title={item.tooltip}
            />
          </div>
        )
      }

      const baseClasses = `
        flex items-center px-3 py-2 text-sm font-medium rounded transition-colors duration-200
        ${item.disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-100 active:bg-gray-200"}
        ${layout.theme === "compact" ? "px-2 py-1" : ""}
        ${layout.theme === "expanded" ? "px-4 py-3" : ""}
      `

      const iconSize = {
        small: "w-3 h-3",
        medium: "w-4 h-4", 
        large: "w-5 h-5",
      }[layout.iconSize]

      if (item.type === "dropdown") {
        const isOpen = dropdownStates[item.id] || false

        return (
          <div key={item.id} className="relative">
            <button
              type="button"
              onClick={() => toggleDropdown(item.id)}
              disabled={item.disabled}
              className={baseClasses}
              title={item.tooltip}
              aria-expanded={isOpen}
              aria-haspopup="true"
            >
              {item.icon && (
                <span className={`${iconSize} mr-2 text-gray-600`} aria-label={item.icon}>
                  📄
                </span>
              )}
              {layout.showLabels && <span>{item.label}</span>}
              <span className="ml-1 text-xs text-gray-500">▼</span>
            </button>

            {isOpen && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      // Handle CSV export
                      closeDropdown(item.id)
                    }}
                    className="block w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-100"
                  >
                    Export as CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // Handle JSON export
                      closeDropdown(item.id)
                    }}
                    className="block w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-100"
                  >
                    Export as JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // Handle SQL export
                      closeDropdown(item.id)
                    }}
                    className="block w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-100"
                  >
                    Export as SQL
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      }

      return (
        <button
          key={item.id}
          type="button"
          onClick={() => handleItemClick(item)}
          disabled={item.disabled}
          className={baseClasses}
          title={item.tooltip}
        >
          {item.icon && (
            <span className={`${iconSize} mr-2 text-gray-600`} aria-label={item.icon}>
              📄
            </span>
          )}
          {layout.showLabels && <span>{item.label}</span>}
          {item.shortcut && !layout.showLabels && (
            <span className="ml-1 text-xs text-gray-400">{item.shortcut}</span>
          )}
        </button>
      )
    },
    [layout, dropdownStates, handleItemClick, toggleDropdown, closeDropdown]
  )

  const renderSection = useCallback(
    (section: ToolbarSection) => {
      if (section.collapsed || section.items.length === 0) {
        return null
      }

      return (
        <div key={section.id} className="flex items-center space-x-1">
          {section.items.map(renderToolbarItem)}
          <div className="w-px h-6 bg-gray-300 mx-2" aria-hidden="true" />
        </div>
      )
    },
    [renderToolbarItem]
  )

  const themeClasses = {
    compact: "py-1 px-2",
    standard: "py-2 px-4",
    expanded: "py-3 px-6",
  }

  return (
    <>
      <div
        className={`
          bg-white border-b border-gray-200 flex items-center justify-between
          ${themeClasses[layout.theme]}
          ${className}
        `}
      >
        <div className="flex items-center space-x-2 overflow-x-auto">
          {layout.sections.map(renderSection)}
        </div>

        <div className="flex items-center space-x-2 ml-4">
          <button
            type="button"
            onClick={() => setShowCustomization(true)}
            className="flex items-center px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
            title="Customize toolbar"
          >
            <span className="w-3 h-3 mr-1" aria-label="settings">
              ⚙️
            </span>
            Customize
          </button>
        </div>
      </div>

      {/* Dropdown backdrop to close dropdowns when clicking outside */}
      {Object.values(dropdownStates).some(Boolean) && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setDropdownStates({})}
          aria-hidden="true"
        />
      )}

      {showCustomization && (
        <ToolbarCustomization
          toolbarService={toolbarService}
          onClose={() => setShowCustomization(false)}
        />
      )}
    </>
  )
}