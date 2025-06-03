import type React from "react"
import { useCallback, useMemo, useState } from "react"
import type { SchemaNodeType, SchemaTreeNode } from "../../shared/types/schema"

interface SchemaTreeProps {
  nodes: SchemaTreeNode[]
  onNodeClick?: (node: SchemaTreeNode) => void
  onNodeDoubleClick?: (node: SchemaTreeNode) => void
  onNodeContextMenu?: (node: SchemaTreeNode, event: React.MouseEvent) => void
  selectedNodeId?: string
  expandedNodeIds?: Set<string>
  onNodeExpand?: (nodeId: string, expanded: boolean) => void
  className?: string
}

export const SchemaTree: React.FC<SchemaTreeProps> = ({
  nodes,
  onNodeClick,
  onNodeDoubleClick,
  onNodeContextMenu,
  selectedNodeId,
  expandedNodeIds = new Set(),
  onNodeExpand,
  className = "",
}) => {
  const [localExpandedIds, setLocalExpandedIds] = useState<Set<string>>(new Set())

  const actualExpandedIds = expandedNodeIds.size > 0 ? expandedNodeIds : localExpandedIds

  const handleNodeExpand = useCallback(
    (nodeId: string, expanded: boolean) => {
      if (onNodeExpand) {
        onNodeExpand(nodeId, expanded)
      } else {
        setLocalExpandedIds((prev) => {
          const newSet = new Set(prev)
          if (expanded) {
            newSet.add(nodeId)
          } else {
            newSet.delete(nodeId)
          }
          return newSet
        })
      }
    },
    [onNodeExpand]
  )

  const handleNodeClick = useCallback(
    (node: SchemaTreeNode, event: React.MouseEvent) => {
      event.stopPropagation()
      onNodeClick?.(node)
    },
    [onNodeClick]
  )

  const handleNodeDoubleClick = useCallback(
    (node: SchemaTreeNode, event: React.MouseEvent) => {
      event.stopPropagation()
      onNodeDoubleClick?.(node)
    },
    [onNodeDoubleClick]
  )

  const handleContextMenu = useCallback(
    (node: SchemaTreeNode, event: React.MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      onNodeContextMenu?.(node, event)
    },
    [onNodeContextMenu]
  )

  return (
    <div className={`schema-tree ${className}`}>
      {nodes.map((node) => (
        <SchemaTreeNode
          key={node.id}
          node={node}
          level={0}
          isExpanded={actualExpandedIds.has(node.id)}
          isSelected={selectedNodeId === node.id}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          onNodeContextMenu={handleContextMenu}
          onExpand={handleNodeExpand}
        />
      ))}
    </div>
  )
}

interface SchemaTreeNodeProps {
  node: SchemaTreeNode
  level: number
  isExpanded: boolean
  isSelected: boolean
  onNodeClick: (node: SchemaTreeNode, event: React.MouseEvent) => void
  onNodeDoubleClick: (node: SchemaTreeNode, event: React.MouseEvent) => void
  onNodeContextMenu: (node: SchemaTreeNode, event: React.MouseEvent) => void
  onExpand: (nodeId: string, expanded: boolean) => void
}

const SchemaTreeNode: React.FC<SchemaTreeNodeProps> = ({
  node,
  level,
  isExpanded,
  isSelected,
  onNodeClick,
  onNodeDoubleClick,
  onNodeContextMenu,
  onExpand,
}) => {
  const hasChildren = node.children && node.children.length > 0
  const indentWidth = level * 16

  const handleToggleExpand = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation()
      if (hasChildren) {
        onExpand(node.id, !isExpanded)
      }
    },
    [hasChildren, node.id, isExpanded, onExpand]
  )

  const nodeIcon = useMemo(() => getNodeIcon(node.type, node.icon), [node.type, node.icon])
  const nodeClass = useMemo(() => getNodeClass(node.type, isSelected), [node.type, isSelected])

  return (
    <div className='schema-tree-node'>
      <div
        className={`schema-tree-item ${nodeClass}`}
        style={{ paddingLeft: `${indentWidth + 8}px` }}
        onClick={(e) => onNodeClick(node, e)}
        onDoubleClick={(e) => onNodeDoubleClick(node, e)}
        onContextMenu={(e) => onNodeContextMenu(node, e)}
      >
        <div className='schema-tree-item-content'>
          {hasChildren && (
            <button
              className={`schema-tree-expand-button ${isExpanded ? "expanded" : ""}`}
              onClick={handleToggleExpand}
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              <ChevronIcon expanded={isExpanded} />
            </button>
          )}

          <div className='schema-tree-icon'>{nodeIcon}</div>

          <span className='schema-tree-label'>{node.label}</span>

          {node.isLoading && (
            <div className='schema-tree-loading'>
              <LoadingSpinner size='small' />
            </div>
          )}
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className='schema-tree-children'>
          {node.children!.map((childNode) => (
            <SchemaTreeNode
              key={childNode.id}
              node={childNode}
              level={level + 1}
              isExpanded={false} // Child expansion state managed separately
              isSelected={false} // Only top-level selection for now
              onNodeClick={onNodeClick}
              onNodeDoubleClick={onNodeDoubleClick}
              onNodeContextMenu={onNodeContextMenu}
              onExpand={onExpand}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Helper components
const ChevronIcon: React.FC<{ expanded: boolean }> = ({ expanded }) => (
  <svg
    className={`w-3 h-3 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
    fill='currentColor'
    viewBox='0 0 20 20'
  >
    <path
      fillRule='evenodd'
      d='M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z'
      clipRule='evenodd'
    />
  </svg>
)

const LoadingSpinner: React.FC<{ size?: "small" | "medium" | "large" }> = ({ size = "medium" }) => {
  const sizeClass = {
    small: "w-3 h-3",
    medium: "w-4 h-4",
    large: "w-6 h-6",
  }[size]

  return (
    <div
      className={`animate-spin rounded-full border-2 border-gray-300 border-t-blue-400 ${sizeClass}`}
    />
  )
}

// Helper functions
function getNodeIcon(type: SchemaNodeType, customIcon?: string): React.ReactNode {
  if (customIcon) {
    return <span className='schema-icon'>{customIcon}</span>
  }

  const iconMap: Record<SchemaNodeType, React.ReactNode> = {
    database: <DatabaseIcon />,
    schema: <SchemaIcon />,
    tables: <FolderIcon />,
    table: <TableIcon />,
    views: <FolderIcon />,
    view: <ViewIcon />,
    columns: <FolderIcon />,
    column: <ColumnIcon />,
    indexes: <FolderIcon />,
    index: <IndexIcon />,
    constraints: <FolderIcon />,
    constraint: <ConstraintIcon />,
    functions: <FolderIcon />,
    function: <FunctionIcon />,
    triggers: <FolderIcon />,
    trigger: <TriggerIcon />,
  }

  return iconMap[type] || <GenericIcon />
}

function getNodeClass(type: SchemaNodeType, isSelected: boolean): string {
  const baseClass = "cursor-pointer hover:bg-gray-700 transition-colors duration-150"
  const selectedClass = isSelected ? "bg-blue-600 text-white" : ""
  const typeClass = `schema-node-${type}`

  return `${baseClass} ${selectedClass} ${typeClass}`.trim()
}

// Icon components
const DatabaseIcon: React.FC = () => (
  <svg className='w-4 h-4 text-blue-400' fill='currentColor' viewBox='0 0 20 20'>
    <path d='M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z' />
  </svg>
)

const SchemaIcon: React.FC = () => (
  <svg className='w-4 h-4 text-purple-400' fill='currentColor' viewBox='0 0 20 20'>
    <path
      fillRule='evenodd'
      d='M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z'
      clipRule='evenodd'
    />
  </svg>
)

const FolderIcon: React.FC = () => (
  <svg className='w-4 h-4 text-yellow-400' fill='currentColor' viewBox='0 0 20 20'>
    <path d='M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z' />
  </svg>
)

const TableIcon: React.FC = () => (
  <svg className='w-4 h-4 text-green-400' fill='currentColor' viewBox='0 0 20 20'>
    <path
      fillRule='evenodd'
      d='M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V8zm0 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2z'
      clipRule='evenodd'
    />
  </svg>
)

const ViewIcon: React.FC = () => (
  <svg className='w-4 h-4 text-indigo-400' fill='currentColor' viewBox='0 0 20 20'>
    <path d='M10 12a2 2 0 100-4 2 2 0 000 4z' />
    <path
      fillRule='evenodd'
      d='M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z'
      clipRule='evenodd'
    />
  </svg>
)

const ColumnIcon: React.FC = () => (
  <svg className='w-4 h-4 text-gray-400' fill='currentColor' viewBox='0 0 20 20'>
    <path
      fillRule='evenodd'
      d='M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 01-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4z'
      clipRule='evenodd'
    />
    <path
      fillRule='evenodd'
      d='M17 16a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 011.414-1.414L15 13.586V12a1 1 0 012 0v4z'
      clipRule='evenodd'
    />
  </svg>
)

const IndexIcon: React.FC = () => (
  <svg className='w-4 h-4 text-orange-400' fill='currentColor' viewBox='0 0 20 20'>
    <path
      fillRule='evenodd'
      d='M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
      clipRule='evenodd'
    />
  </svg>
)

const ConstraintIcon: React.FC = () => (
  <svg className='w-4 h-4 text-red-400' fill='currentColor' viewBox='0 0 20 20'>
    <path
      fillRule='evenodd'
      d='M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z'
      clipRule='evenodd'
    />
  </svg>
)

const FunctionIcon: React.FC = () => (
  <svg className='w-4 h-4 text-cyan-400' fill='currentColor' viewBox='0 0 20 20'>
    <path
      fillRule='evenodd'
      d='M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z'
      clipRule='evenodd'
    />
  </svg>
)

const TriggerIcon: React.FC = () => (
  <svg className='w-4 h-4 text-pink-400' fill='currentColor' viewBox='0 0 20 20'>
    <path
      fillRule='evenodd'
      d='M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z'
      clipRule='evenodd'
    />
  </svg>
)

const GenericIcon: React.FC = () => (
  <svg className='w-4 h-4 text-gray-400' fill='currentColor' viewBox='0 0 20 20'>
    <path
      fillRule='evenodd'
      d='M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm2 6a2 2 0 104 0 2 2 0 00-4 0zm6 0a2 2 0 104 0 2 2 0 00-4 0z'
      clipRule='evenodd'
    />
  </svg>
)
