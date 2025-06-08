import type React from "react";
import { useCallback, useMemo, useState } from "react";
import type { SchemaNodeType, SchemaTreeNode } from "../../shared/types/schema";
import { Icon, IconNames } from "./Icon";

interface SchemaTreeProps {
  nodes: SchemaTreeNode[];
  onNodeClick?: (node: SchemaTreeNode) => void;
  onNodeDoubleClick?: (node: SchemaTreeNode) => void;
  onNodeContextMenu?: (node: SchemaTreeNode, event: React.MouseEvent) => void;
  selectedNodeId?: string;
  expandedNodeIds?: Set<string>;
  onNodeExpand?: (nodeId: string, expanded: boolean) => void;
  className?: string;
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
  const [localExpandedIds, setLocalExpandedIds] = useState<Set<string>>(
    new Set(),
  );

  const actualExpandedIds =
    expandedNodeIds.size > 0 ? expandedNodeIds : localExpandedIds;

  const handleNodeExpand = useCallback(
    (nodeId: string, expanded: boolean) => {
      if (onNodeExpand) {
        onNodeExpand(nodeId, expanded);
      } else {
        setLocalExpandedIds((prev) => {
          const newSet = new Set(prev);
          if (expanded) {
            newSet.add(nodeId);
          } else {
            newSet.delete(nodeId);
          }
          return newSet;
        });
      }
    },
    [onNodeExpand],
  );

  const handleNodeClick = useCallback(
    (node: SchemaTreeNode, event: React.MouseEvent) => {
      event.stopPropagation();
      onNodeClick?.(node);
    },
    [onNodeClick],
  );

  const handleNodeDoubleClick = useCallback(
    (node: SchemaTreeNode, event: React.MouseEvent) => {
      event.stopPropagation();
      onNodeDoubleClick?.(node);
    },
    [onNodeDoubleClick],
  );

  const handleContextMenu = useCallback(
    (node: SchemaTreeNode, event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      onNodeContextMenu?.(node, event);
    },
    [onNodeContextMenu],
  );

  return (
    <div className={`schema-tree ${className}`}>
      {nodes.map((node) => (
        <SchemaTreeNodeComponent
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
  );
};

interface SchemaTreeNodeProps {
  node: SchemaTreeNode;
  level: number;
  isExpanded: boolean;
  isSelected: boolean;
  onNodeClick: (node: SchemaTreeNode, event: React.MouseEvent) => void;
  onNodeDoubleClick: (node: SchemaTreeNode, event: React.MouseEvent) => void;
  onNodeContextMenu: (node: SchemaTreeNode, event: React.MouseEvent) => void;
  onExpand: (nodeId: string, expanded: boolean) => void;
}

const SchemaTreeNodeComponent: React.FC<SchemaTreeNodeProps> = ({
  node,
  level,
  isExpanded,
  isSelected,
  onNodeClick,
  onNodeDoubleClick,
  onNodeContextMenu,
  onExpand,
}) => {
  const hasChildren = node.children && node.children.length > 0;
  const indentWidth = level * 16;

  const handleToggleExpand = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      if (hasChildren) {
        onExpand(node.id, !isExpanded);
      }
    },
    [hasChildren, node.id, isExpanded, onExpand],
  );

  const nodeIcon = useMemo(
    () => getNodeIcon(node.type, node.icon),
    [node.type, node.icon],
  );
  const nodeClass = useMemo(
    () => getNodeClass(node.type, isSelected),
    [node.type, isSelected],
  );

  return (
    <div className="schema-tree-node">
      <div
        className={`schema-tree-item ${nodeClass}`}
        style={{ paddingLeft: `${indentWidth + 8}px` }}
        onClick={(e) => onNodeClick(node, e)}
        onDoubleClick={(e) => onNodeDoubleClick(node, e)}
        onContextMenu={(e) => onNodeContextMenu(node, e)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onNodeClick(node, e as unknown as React.MouseEvent);
          } else if (e.key === " ") {
            e.preventDefault();
            onNodeDoubleClick(node, e as unknown as React.MouseEvent);
          }
        }}
        role="treeitem"
        tabIndex={0}
      >
        <div className="schema-tree-item-content">
          {hasChildren && (
            <button
              type="button"
              className={`schema-tree-expand-button ${isExpanded ? "expanded" : ""}`}
              onClick={handleToggleExpand}
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              <ChevronIcon expanded={isExpanded} />
            </button>
          )}

          <div className="schema-tree-icon">{nodeIcon}</div>

          <span className="schema-tree-label">{node.label}</span>

          {node.isLoading && (
            <div className="schema-tree-loading">
              <LoadingSpinner size="small" />
            </div>
          )}
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="schema-tree-children">
          {node.children?.map((childNode) => (
            <SchemaTreeNodeComponent
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
  );
};

// Helper components
const ChevronIcon: React.FC<{ expanded: boolean }> = ({ expanded }) => (
  <Icon
    name={expanded ? IconNames.CHEVRON_DOWN : IconNames.CHEVRON_RIGHT}
    className="transition-transform duration-200"
    size="sm"
  />
);

const LoadingSpinner: React.FC<{ size?: "small" | "medium" | "large" }> = ({
  size = "medium",
}) => {
  const sizeClass = {
    small: "w-3 h-3",
    medium: "w-4 h-4",
    large: "w-6 h-6",
  }[size];

  return (
    <div
      className={`animate-spin rounded-full border-2 border-gray-300 border-t-blue-400 ${sizeClass}`}
    />
  );
};

// Helper functions
function getNodeIcon(
  type: SchemaNodeType,
  customIcon?: string,
): React.ReactNode {
  if (customIcon) {
    return <span className="schema-icon">{customIcon}</span>;
  }

  const iconMap: Record<SchemaNodeType, React.ReactNode> = {
    database: <Icon name={IconNames.DATABASE} className="text-blue-400" size="sm" />,
    schema: <Icon name={IconNames.FOLDER} className="text-purple-400" size="sm" />,
    tables: <Icon name={IconNames.FOLDER} className="text-yellow-400" size="sm" />,
    table: <Icon name={IconNames.TABLE} className="text-green-400" size="sm" />,
    views: <Icon name={IconNames.FOLDER} className="text-yellow-400" size="sm" />,
    view: <Icon name="eye" className="text-indigo-400" size="sm" />,
    columns: <Icon name={IconNames.FOLDER} className="text-yellow-400" size="sm" />,
    column: <Icon name={IconNames.COLUMN} className="text-gray-400" size="sm" />,
    indexes: <Icon name={IconNames.FOLDER} className="text-yellow-400" size="sm" />,
    index: <Icon name="key" className="text-orange-400" size="sm" />,
    constraints: <Icon name={IconNames.FOLDER} className="text-yellow-400" size="sm" />,
    constraint: <Icon name="lock" className="text-red-400" size="sm" />,
    functions: <Icon name={IconNames.FOLDER} className="text-yellow-400" size="sm" />,
    function: <Icon name={IconNames.SYMBOL_FUNCTION} className="text-cyan-400" size="sm" />,
    triggers: <Icon name={IconNames.FOLDER} className="text-yellow-400" size="sm" />,
    trigger: <Icon name="zap" className="text-pink-400" size="sm" />,
  };

  return iconMap[type] || <Icon name={IconNames.FILE} className="text-gray-400" size="sm" />;
}

function getNodeClass(type: SchemaNodeType, isSelected: boolean): string {
  const baseClass =
    "cursor-pointer hover:bg-gray-700 transition-colors duration-150";
  const selectedClass = isSelected ? "bg-blue-600 text-white" : "";
  const typeClass = `schema-node-${type}`;

  return `${baseClass} ${selectedClass} ${typeClass}`.trim();
}

