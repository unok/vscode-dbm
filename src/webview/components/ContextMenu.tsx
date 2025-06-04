import type React from "react"
import { useEffect, useRef } from "react"
import type { SchemaTreeNode } from "../../shared/types/schema"

interface ContextMenuProps {
  node: SchemaTreeNode
  x: number
  y: number
  onClose: () => void
  onAction: (action: string) => void
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ node, x, y, onClose, onAction }) => {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [onClose])

  const menuItems = getMenuItemsForNodeType(node.type)

  return (
    <div
      ref={menuRef}
      className='context-menu'
      style={{
        position: "fixed",
        left: x,
        top: y,
        zIndex: 1000,
      }}
    >
      <div className='context-menu-content bg-gray-800 border border-gray-600 rounded-md shadow-lg py-1 min-w-48'>
        {menuItems.map((item, index) =>
          item.type === "separator" ? (
            <div
              key={`separator-${item.label || "sep"}-${index}`}
              className='context-menu-separator border-t border-gray-600 my-1'
            />
          ) : (
            <button
              type='button'
              key={item.id || `item-${index}`}
              className={`context-menu-item w-full text-left px-3 py-2 text-sm hover:bg-gray-700 transition-colors ${
                item.disabled ? "text-gray-500 cursor-not-allowed" : "text-gray-200"
              }`}
              onClick={() => {
                if (!item.disabled && item.action) {
                  onAction(item.action)
                }
              }}
              disabled={item.disabled}
            >
              <div className='flex items-center gap-2'>
                {item.icon && (
                  <span className='context-menu-icon w-4 h-4 flex items-center justify-center'>
                    {item.icon}
                  </span>
                )}
                <span className='flex-1'>{item.label}</span>
                {item.shortcut && (
                  <span className='context-menu-shortcut text-xs text-gray-400'>
                    {item.shortcut}
                  </span>
                )}
              </div>
            </button>
          )
        )}
      </div>
    </div>
  )
}

interface MenuItem {
  id?: string
  type: "item" | "separator"
  label?: string
  action?: string
  icon?: React.ReactNode
  shortcut?: string
  disabled?: boolean
}

function getMenuItemsForNodeType(nodeType: string): MenuItem[] {
  switch (nodeType) {
    case "table":
      return [
        {
          type: "item",
          label: "View Data",
          action: "view-data",
          icon: <TableIcon />,
          shortcut: "Enter",
        },
        {
          type: "item",
          label: "Edit Data",
          action: "edit-data",
          icon: <EditIcon />,
        },
        { type: "separator" },
        {
          type: "item",
          label: "Create SQL Query",
          action: "create-query",
          icon: <SQLIcon />,
        },
        {
          type: "item",
          label: "Export Data",
          action: "export-data",
          icon: <ExportIcon />,
        },
        { type: "separator" },
        {
          type: "item",
          label: "Show Table Info",
          action: "show-info",
          icon: <InfoIcon />,
        },
        {
          type: "item",
          label: "Refresh",
          action: "refresh",
          icon: <RefreshIcon />,
          shortcut: "F5",
        },
        { type: "separator" },
        {
          type: "item",
          label: "Drop Table",
          action: "drop-table",
          icon: <DeleteIcon />,
        },
      ]

    case "view":
      return [
        {
          type: "item",
          label: "View Data",
          action: "view-data",
          icon: <TableIcon />,
        },
        {
          type: "item",
          label: "Show Definition",
          action: "show-definition",
          icon: <CodeIcon />,
        },
        { type: "separator" },
        {
          type: "item",
          label: "Create SQL Query",
          action: "create-query",
          icon: <SQLIcon />,
        },
        {
          type: "item",
          label: "Export Data",
          action: "export-data",
          icon: <ExportIcon />,
        },
        { type: "separator" },
        {
          type: "item",
          label: "Refresh",
          action: "refresh",
          icon: <RefreshIcon />,
        },
        {
          type: "item",
          label: "Drop View",
          action: "drop-view",
          icon: <DeleteIcon />,
        },
      ]

    case "column":
      return [
        {
          type: "item",
          label: "Copy Column Name",
          action: "copy-name",
          icon: <CopyIcon />,
        },
        {
          type: "item",
          label: "Filter by this Column",
          action: "filter-column",
          icon: <FilterIcon />,
        },
        {
          type: "item",
          label: "Sort by this Column",
          action: "sort-column",
          icon: <SortIcon />,
        },
        { type: "separator" },
        {
          type: "item",
          label: "Show Column Info",
          action: "show-column-info",
          icon: <InfoIcon />,
        },
      ]

    case "tables":
    case "views":
      return [
        {
          type: "item",
          label: "Refresh",
          action: "refresh",
          icon: <RefreshIcon />,
        },
        {
          type: "item",
          label: "Collapse All",
          action: "collapse-all",
          icon: <CollapseIcon />,
        },
        {
          type: "item",
          label: "Expand All",
          action: "expand-all",
          icon: <ExpandIcon />,
        },
      ]

    case "database":
      return [
        {
          type: "item",
          label: "Refresh Schema",
          action: "refresh-schema",
          icon: <RefreshIcon />,
        },
        {
          type: "item",
          label: "New Query",
          action: "new-query",
          icon: <SQLIcon />,
        },
        { type: "separator" },
        {
          type: "item",
          label: "Export Schema",
          action: "export-schema",
          icon: <ExportIcon />,
        },
        {
          type: "item",
          label: "Database Info",
          action: "database-info",
          icon: <InfoIcon />,
        },
        { type: "separator" },
        {
          type: "item",
          label: "Disconnect",
          action: "disconnect",
          icon: <DisconnectIcon />,
        },
      ]

    default:
      return [
        {
          type: "item",
          label: "Refresh",
          action: "refresh",
          icon: <RefreshIcon />,
        },
      ]
  }
}

// Icon components
const TableIcon: React.FC = () => (
  <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20' aria-hidden='true'>
    <path
      fillRule='evenodd'
      d='M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V8zm0 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2z'
      clipRule='evenodd'
    />
  </svg>
)

const EditIcon: React.FC = () => (
  <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20' aria-hidden='true'>
    <path d='M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z' />
  </svg>
)

const SQLIcon: React.FC = () => (
  <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20' aria-hidden='true'>
    <path
      fillRule='evenodd'
      d='M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z'
      clipRule='evenodd'
    />
  </svg>
)

const ExportIcon: React.FC = () => (
  <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20' aria-hidden='true'>
    <path
      fillRule='evenodd'
      d='M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z'
      clipRule='evenodd'
    />
  </svg>
)

const InfoIcon: React.FC = () => (
  <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20' aria-hidden='true'>
    <path
      fillRule='evenodd'
      d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z'
      clipRule='evenodd'
    />
  </svg>
)

const RefreshIcon: React.FC = () => (
  <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20' aria-hidden='true'>
    <path
      fillRule='evenodd'
      d='M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z'
      clipRule='evenodd'
    />
  </svg>
)

const DeleteIcon: React.FC = () => (
  <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20' aria-hidden='true'>
    <path
      fillRule='evenodd'
      d='M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z'
      clipRule='evenodd'
    />
  </svg>
)

const CodeIcon: React.FC = () => (
  <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20' aria-hidden='true'>
    <path
      fillRule='evenodd'
      d='M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z'
      clipRule='evenodd'
    />
  </svg>
)

const CopyIcon: React.FC = () => (
  <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20' aria-hidden='true'>
    <path d='M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z' />
    <path d='M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z' />
  </svg>
)

const FilterIcon: React.FC = () => (
  <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20' aria-hidden='true'>
    <path
      fillRule='evenodd'
      d='M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z'
      clipRule='evenodd'
    />
  </svg>
)

const SortIcon: React.FC = () => (
  <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20' aria-hidden='true'>
    <path d='M3 3a1 1 0 000 2h11a1 1 0 100-2H3zM3 7a1 1 0 000 2h7a1 1 0 100-2H3zM3 11a1 1 0 100 2h4a1 1 0 100-2H3zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z' />
  </svg>
)

const CollapseIcon: React.FC = () => (
  <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20' aria-hidden='true'>
    <path
      fillRule='evenodd'
      d='M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L10 4.414 6.707 7.707a1 1 0 01-1.414 0z'
      clipRule='evenodd'
    />
  </svg>
)

const ExpandIcon: React.FC = () => (
  <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20' aria-hidden='true'>
    <path
      fillRule='evenodd'
      d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z'
      clipRule='evenodd'
    />
  </svg>
)

const DisconnectIcon: React.FC = () => (
  <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20' aria-hidden='true'>
    <path
      fillRule='evenodd'
      d='M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z'
      clipRule='evenodd'
    />
  </svg>
)
