import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { DatabaseMetadataService } from "../../shared/services/DatabaseMetadataService"
import type {
  ConnectionInfo,
  DatabaseSchema,
  SchemaSearchOptions,
  SchemaTreeNode,
} from "../../shared/types/schema"
import { useVSCodeAPI } from "../api/vscode"
import type { ConnectionResult } from "../api/vscode"
import { type ConnectionConfig, ConnectionForm, ConnectionManager } from "./ConnectionManager"
import { ContextMenu } from "./ContextMenu"
import { SchemaTree } from "./SchemaTree"
import { SearchBar } from "./SearchBar"

const DatabaseExplorer: React.FC = () => {
  // State management
  const [connections, setConnections] = useState<ConnectionInfo[]>([])
  const [activeConnectionId, setActiveConnectionId] = useState<string>()
  const [schema, setSchema] = useState<DatabaseSchema | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConnectionForm, setShowConnectionForm] = useState(false)
  const [editingConnection, setEditingConnection] = useState<ConnectionInfo | undefined>()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedNodeId, setSelectedNodeId] = useState<string>()
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set(["tables"]))
  const [contextMenu, setContextMenu] = useState<{
    node: SchemaTreeNode
    x: number
    y: number
  } | null>(null)

  const vscodeApi = useVSCodeAPI()
  const metadataService = useMemo(() => new DatabaseMetadataService(), [])

  // Load initial data
  useEffect(() => {
    // Mock connections for development
    const mockConnections: ConnectionInfo[] = [
      {
        id: "1",
        name: "Local MySQL",
        type: "mysql",
        host: "localhost",
        port: 3306,
        database: "test_db",
        username: "root",
        isConnected: false,
      },
      {
        id: "2",
        name: "PostgreSQL Dev",
        type: "postgresql",
        host: "localhost",
        port: 5432,
        database: "dev_db",
        username: "postgres",
        isConnected: false,
      },
    ]
    setConnections(mockConnections)

    // Request connection status from extension
    vscodeApi.getConnectionStatus()
  }, [vscodeApi])

  // Create tree nodes from schema
  const treeNodes = useMemo(() => {
    if (!schema) return []

    const nodes = metadataService.schemaToTree(schema)

    // Apply search filter if query exists
    if (searchQuery.trim()) {
      const searchOptions: SchemaSearchOptions = {
        query: searchQuery,
        types: ["table", "view", "column"],
        caseSensitive: false,
        useRegex: false,
      }
      const searchResults = metadataService.searchSchema(schema, searchOptions)

      // Filter tree to show only matching nodes
      // This is a simplified implementation - could be enhanced
      return nodes
        .filter((node) =>
          node.children?.some((child) =>
            searchResults.some((result) => result.node.id === child.id)
          )
        )
        .map((node) => ({
          ...node,
          children: node.children?.filter((child) =>
            searchResults.some((result) => result.node.id === child.id)
          ),
        }))
    }

    return nodes
  }, [schema, searchQuery, metadataService])

  // Connection handlers
  const handleConnectionSelect = useCallback(
    async (connectionId: string) => {
      if (activeConnectionId === connectionId) return

      setIsLoading(true)
      setError(null)

      try {
        const connection = connections.find((c) => c.id === connectionId)
        if (!connection) throw new Error("Connection not found")

        // Send connection request to extension
        vscodeApi.showInfo(`Connecting to ${connection.name}...`)
        const result: ConnectionResult = await vscodeApi.openConnection({
          type: connection.type,
          host: connection.host,
          port: connection.port,
          database: connection.database,
          username: connection.username,
          password: "", // Will be prompted by extension
        })

        if (result.success) {
          setActiveConnectionId(connectionId)
          // Mock schema for now - will be replaced with real data from extension
          const mockSchema: DatabaseSchema = {
            tables: [
              {
                name: "users",
                type: "table" as const,
                columns: [
                  {
                    name: "id",
                    type: "int",
                    nullable: false,
                    isPrimaryKey: true,
                    isForeignKey: false,
                    isUnique: true,
                    isAutoIncrement: true,
                  },
                  {
                    name: "email",
                    type: "varchar(255)",
                    nullable: false,
                    isPrimaryKey: false,
                    isForeignKey: false,
                    isUnique: true,
                    isAutoIncrement: false,
                  },
                  {
                    name: "name",
                    type: "varchar(100)",
                    nullable: true,
                    isPrimaryKey: false,
                    isForeignKey: false,
                    isUnique: false,
                    isAutoIncrement: false,
                  },
                ],
                rowCount: 1250,
              },
              {
                name: "posts",
                type: "table" as const,
                columns: [
                  {
                    name: "id",
                    type: "int",
                    nullable: false,
                    isPrimaryKey: true,
                    isForeignKey: false,
                    isUnique: true,
                    isAutoIncrement: true,
                  },
                  {
                    name: "user_id",
                    type: "int",
                    nullable: false,
                    isPrimaryKey: false,
                    isForeignKey: true,
                    isUnique: false,
                    isAutoIncrement: false,
                    foreignKeyTarget: {
                      table: "users",
                      column: "id",
                    },
                  },
                  {
                    name: "title",
                    type: "varchar(255)",
                    nullable: false,
                    isPrimaryKey: false,
                    isForeignKey: false,
                    isUnique: false,
                    isAutoIncrement: false,
                  },
                  {
                    name: "content",
                    type: "text",
                    nullable: true,
                    isPrimaryKey: false,
                    isForeignKey: false,
                    isUnique: false,
                    isAutoIncrement: false,
                  },
                ],
                rowCount: 5420,
              },
            ],
            views: [
              {
                name: "user_posts",
                schema: "public",
                definition: "SELECT u.name, p.title FROM users u JOIN posts p ON u.id = p.user_id",
                columns: [],
              },
            ],
          }
          setSchema(mockSchema)
          vscodeApi.showInfo(`Connected to ${connection.name}`)
        } else {
          throw new Error(result.error || "Connection failed")
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error"
        setError(errorMessage)
        vscodeApi.showError(`Connection failed: ${errorMessage}`)
      } finally {
        setIsLoading(false)
      }
    },
    [activeConnectionId, connections, vscodeApi]
  )

  const handleConnectionCreate = useCallback(() => {
    setEditingConnection(undefined)
    setShowConnectionForm(true)
  }, [])

  const handleConnectionEdit = useCallback(
    (connectionId: string) => {
      const connection = connections.find((c) => c.id === connectionId)
      setEditingConnection(connection)
      setShowConnectionForm(true)
    },
    [connections]
  )

  const handleConnectionDelete = useCallback(
    (connectionId: string) => {
      setConnections((prev) => prev.filter((c) => c.id !== connectionId))
      if (activeConnectionId === connectionId) {
        setActiveConnectionId(undefined)
        setSchema(null)
      }
    },
    [activeConnectionId]
  )

  const handleConnectionTest = useCallback(
    async (connectionId: string) => {
      const connection = connections.find((c) => c.id === connectionId)
      if (!connection) return

      try {
        vscodeApi.showInfo(`Testing connection to ${connection.name}...`)
        // This would test the connection without actually connecting
        await new Promise((resolve) => setTimeout(resolve, 1000)) // Simulate test
        vscodeApi.showInfo("Connection test successful!")
      } catch (error) {
        vscodeApi.showError(`Connection test failed: ${error}`)
      }
    },
    [connections, vscodeApi]
  )

  const handleConnectionSave = useCallback(
    (connectionData: ConnectionConfig) => {
      if (editingConnection) {
        // Update existing connection
        const updatedConnection: ConnectionInfo = {
          ...editingConnection,
          ...connectionData,
          isConnected: editingConnection.isConnected,
          lastConnected: editingConnection.lastConnected,
        }
        setConnections((prev) =>
          prev.map((c) => (c.id === editingConnection.id ? updatedConnection : c))
        )
      } else {
        // Create new connection
        const newConnection: ConnectionInfo = {
          ...connectionData,
          isConnected: false,
        }
        setConnections((prev) => [...prev, newConnection])
      }
      setShowConnectionForm(false)
      setEditingConnection(undefined)
    },
    [editingConnection]
  )

  // Tree handlers
  const handleNodeClick = useCallback((node: SchemaTreeNode) => {
    setSelectedNodeId(node.id)
  }, [])

  const handleNodeDoubleClick = useCallback(
    (node: SchemaTreeNode) => {
      if (node.type === "table") {
        // Open table in DataGrid
        vscodeApi.showInfo(`Opening table ${node.label} in DataGrid...`)
      }
    },
    [vscodeApi]
  )

  const handleNodeContextMenu = useCallback((node: SchemaTreeNode, event: React.MouseEvent) => {
    setContextMenu({
      node,
      x: event.clientX,
      y: event.clientY,
    })
  }, [])

  const handleNodeExpand = useCallback((nodeId: string, expanded: boolean) => {
    setExpandedNodeIds((prev) => {
      const newSet = new Set(prev)
      if (expanded) {
        newSet.add(nodeId)
      } else {
        newSet.delete(nodeId)
      }
      return newSet
    })
  }, [])

  const handleRefreshSchema = useCallback(async () => {
    if (!activeConnectionId) return

    setIsLoading(true)
    try {
      // In real implementation, this would refresh from the database
      vscodeApi.showInfo("Refreshing schema...")
      await new Promise((resolve) => setTimeout(resolve, 1000))
      vscodeApi.showInfo("Schema refreshed")
    } catch (error) {
      vscodeApi.showError(`Failed to refresh schema: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }, [activeConnectionId, vscodeApi])

  return (
    <div className='database-explorer h-full flex flex-col'>
      {/* Header */}
      <div className='database-explorer-header p-4 border-b border-gray-700'>
        <div className='flex items-center justify-between mb-4'>
          <h2 className='text-xl font-bold text-green-400'>Database Explorer</h2>
          {activeConnectionId && (
            <button
              onClick={handleRefreshSchema}
              disabled={isLoading}
              className='btn-secondary text-xs px-3 py-1'
              title='Refresh schema'
            >
              {isLoading ? "Refreshing..." : "Refresh"}
            </button>
          )}
        </div>

        {/* Search */}
        {activeConnectionId && (
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder='Search tables, views, columns...'
          />
        )}
      </div>

      {/* Content */}
      <div className='database-explorer-content flex-1 overflow-hidden'>
        <div className='h-full overflow-y-auto'>
          <div className='p-4'>
            {/* Connection Manager */}
            <ConnectionManager
              connections={connections}
              activeConnectionId={activeConnectionId}
              onConnectionSelect={handleConnectionSelect}
              onConnectionCreate={handleConnectionCreate}
              onConnectionEdit={handleConnectionEdit}
              onConnectionDelete={handleConnectionDelete}
              onConnectionTest={handleConnectionTest}
            />

            {/* Error Display */}
            {error && (
              <div className='error-message p-3 mb-4 bg-red-900 bg-opacity-20 border border-red-600 rounded text-red-400 text-sm'>
                {error}
              </div>
            )}

            {/* Schema Tree */}
            {activeConnectionId && (
              <div className='schema-section'>
                <div className='schema-header mb-2'>
                  <h3 className='text-sm font-semibold text-gray-300'>
                    Database Schema
                    {schema && (
                      <span className='text-gray-400 font-normal ml-2'>
                        ({schema.tables.length} tables, {schema.views.length} views)
                      </span>
                    )}
                  </h3>
                </div>

                {isLoading ? (
                  <div className='loading-state p-8 text-center'>
                    <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-2' />
                    <p className='text-gray-400 text-sm'>Loading schema...</p>
                  </div>
                ) : schema ? (
                  <SchemaTree
                    nodes={treeNodes}
                    selectedNodeId={selectedNodeId}
                    expandedNodeIds={expandedNodeIds}
                    onNodeClick={handleNodeClick}
                    onNodeDoubleClick={handleNodeDoubleClick}
                    onNodeContextMenu={handleNodeContextMenu}
                    onNodeExpand={handleNodeExpand}
                    className='schema-tree-container'
                  />
                ) : (
                  <div className='empty-state p-8 text-center'>
                    <p className='text-gray-400 text-sm'>
                      Connect to a database to view its schema
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showConnectionForm && (
        <ConnectionForm
          initialData={editingConnection}
          onSubmit={handleConnectionSave}
          onCancel={() => {
            setShowConnectionForm(false)
            setEditingConnection(undefined)
          }}
        />
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          node={contextMenu.node}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onAction={(_action) => {
            setContextMenu(null)
          }}
        />
      )}
    </div>
  )
}

export default DatabaseExplorer
