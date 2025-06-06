import type React from "react"
import { useCallback, useEffect, useState } from "react"
import type {
  ToolbarGroup,
  ToolbarItem,
  WebViewToolbarService,
} from "../services/WebViewToolbarService"

interface CustomizableToolbarProps {
  toolbarService: WebViewToolbarService
  className?: string
}

export const CustomizableToolbar: React.FC<CustomizableToolbarProps> = ({
  toolbarService,
  className = "",
}) => {
  const [groups, setGroups] = useState<ToolbarGroup[]>(toolbarService.getVisibleGroups())

  // Refresh groups when service changes
  useEffect(() => {
    const refreshGroups = () => {
      setGroups(toolbarService.getVisibleGroups())
    }

    // Listen for layout changes
    const interval = setInterval(refreshGroups, 1000)
    return () => clearInterval(interval)
  }, [toolbarService])

  const handleItemClick = useCallback(
    (item: ToolbarItem) => {
      if (item.disabled) return

      try {
        toolbarService.executeAction(item.action)
      } catch (error) {
        console.error(`Failed to execute action ${item.id}:`, error)
      }
    },
    [toolbarService]
  )

  const renderToolbarItem = useCallback(
    (item: ToolbarItem) => {
      if (!item.visible) return null

      return (
        <button
          key={item.id}
          type='button'
          onClick={() => handleItemClick(item)}
          disabled={item.disabled}
          className={`
            flex items-center px-3 py-2 text-sm font-medium rounded transition-colors duration-200
            ${
              item.disabled
                ? "opacity-50 cursor-not-allowed text-gray-400"
                : "hover:bg-vscode-button-hoverBackground active:bg-vscode-button-background text-vscode-button-foreground"
            }
          `}
          title={item.tooltip || item.label}
          aria-label={item.label}
        >
          <span className='mr-2'>{item.icon}</span>
          <span>{item.label}</span>
        </button>
      )
    },
    [handleItemClick]
  )

  const renderGroup = useCallback(
    (group: ToolbarGroup) => {
      if (!group.visible) return null

      const visibleItems = group.items.filter((item) => item.visible)
      if (visibleItems.length === 0) return null

      return (
        <div
          key={group.id}
          className={`
            flex items-center space-x-1 px-2
            ${group.position === "left" ? "justify-start" : ""}
            ${group.position === "center" ? "justify-center" : ""}
            ${group.position === "right" ? "justify-end" : ""}
          `}
        >
          {visibleItems.map(renderToolbarItem)}
        </div>
      )
    },
    [renderToolbarItem]
  )

  const leftGroups = groups.filter((g) => g.position === "left")
  const centerGroups = groups.filter((g) => g.position === "center")
  const rightGroups = groups.filter((g) => g.position === "right")

  return (
    <div
      className={`
      flex items-center justify-between w-full p-2 
      bg-vscode-editorWidget-background border-b border-vscode-panel-border
      ${className}
    `}
    >
      {/* Left section */}
      <div className='flex items-center space-x-4'>{leftGroups.map(renderGroup)}</div>

      {/* Center section */}
      <div className='flex items-center space-x-4'>{centerGroups.map(renderGroup)}</div>

      {/* Right section */}
      <div className='flex items-center space-x-4'>{rightGroups.map(renderGroup)}</div>
    </div>
  )
}
