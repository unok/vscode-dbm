import type React from "react"
import { useEffect, useState } from "react"
import type { ConnectionInfo } from "../../shared/types/schema"
import { vscodeApi } from "../api/vscode"

export interface ConnectionConfig {
  id: string
  name: string
  type: "mysql" | "postgresql" | "sqlite"
  host: string
  port: number
  database: string
  username: string
  password: string
}

export interface ConnectionFormProps {
  initialData?: Partial<ConnectionConfig>
  onSubmit?: (data: ConnectionConfig) => void
  onCancel: () => void
}

export const ConnectionForm: React.FC<ConnectionFormProps> = ({ initialData, onCancel }) => {
  const [formData, setFormData] = useState<Partial<ConnectionConfig>>(
    initialData || {
      name: "",
      type: "mysql",
      host: "localhost",
      port: 3306,
      database: "",
      username: "",
      password: "",
    }
  )
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  useEffect(() => {
    // Listen for connection results
    const handleMessage = (event: MessageEvent) => {
      const message = event.data
      if (message.type === "connectionResult") {
        setIsConnecting(false)
        if (message.data.success) {
          setConnectionError(null)
          // Connection successful - close modal or update UI
        } else {
          setConnectionError(message.data.message || "接続に失敗しました")
        }
      }
    }

    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [])

  // Update default port when database type changes
  const handleTypeChange = (type: ConnectionConfig["type"]) => {
    const defaultPorts = {
      mysql: 3306,
      postgresql: 5432,
      sqlite: 0,
    }
    setFormData({
      ...formData,
      type,
      port: type !== "sqlite" ? defaultPorts[type] : 0,
    })
  }

  const isFormValid = (data: Partial<ConnectionConfig>): data is ConnectionConfig => {
    if (!data.name || !data.type) return false
    if (data.type === "sqlite") {
      return !!(data.database && data.name)
    }
    return !!(data.host && data.port && data.database && data.username && data.name)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isFormValid(formData)) {
      setIsConnecting(true)
      setConnectionError(null)

      // Send connection request to VSCode extension
      const validData = formData as ConnectionConfig
      vscodeApi.postMessage("openConnection", {
        type: validData.type,
        host: validData.host,
        port: validData.port,
        database: validData.database,
        username: validData.username,
        password: validData.password,
        ssl: false,
      })
    }
  }

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
      <div className='bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6'>
        <h2 className='text-xl font-bold mb-4 text-white'>
          {initialData ? "Edit Connection" : "New Connection"}
        </h2>

        <form onSubmit={handleSubmit} className='space-y-4'>
          {/* Connection Name */}
          <div>
            <label htmlFor='name' className='block text-sm font-medium text-gray-300 mb-1'>
              Connection Name *
            </label>
            <input
              id='name'
              type='text'
              value={formData.name || ""}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className='w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
              placeholder='My Database'
              required
            />
          </div>

          {/* Database Type */}
          <div>
            <label htmlFor='type' className='block text-sm font-medium text-gray-300 mb-1'>
              Database Type *
            </label>
            <select
              id='type'
              value={formData.type || "mysql"}
              onChange={(e) => handleTypeChange(e.target.value as ConnectionConfig["type"])}
              className='w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value='mysql'>MySQL</option>
              <option value='postgresql'>PostgreSQL</option>
              <option value='sqlite'>SQLite</option>
            </select>
          </div>

          {/* Host and Port (not for SQLite) */}
          {formData.type !== "sqlite" && (
            <>
              <div className='grid grid-cols-3 gap-4'>
                <div className='col-span-2'>
                  <label htmlFor='host' className='block text-sm font-medium text-gray-300 mb-1'>
                    Host *
                  </label>
                  <input
                    id='host'
                    type='text'
                    value={formData.host || ""}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    className='w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
                    placeholder='localhost'
                    required
                  />
                </div>
                <div>
                  <label htmlFor='port' className='block text-sm font-medium text-gray-300 mb-1'>
                    Port *
                  </label>
                  <input
                    id='port'
                    type='number'
                    value={formData.port || 3306}
                    onChange={(e) =>
                      setFormData({ ...formData, port: Number.parseInt(e.target.value, 10) })
                    }
                    className='w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
                    required
                  />
                </div>
              </div>

              {/* Username */}
              <div>
                <label htmlFor='username' className='block text-sm font-medium text-gray-300 mb-1'>
                  Username *
                </label>
                <input
                  id='username'
                  type='text'
                  value={formData.username || ""}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className='w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='root'
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label htmlFor='password' className='block text-sm font-medium text-gray-300 mb-1'>
                  Password
                </label>
                <input
                  id='password'
                  type='password'
                  value={formData.password || ""}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className='w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='••••••••'
                />
              </div>
            </>
          )}

          {/* Database */}
          <div>
            <label htmlFor='database' className='block text-sm font-medium text-gray-300 mb-1'>
              {formData.type === "sqlite" ? "Database Path" : "Database Name"} *
            </label>
            <input
              id='database'
              type='text'
              value={formData.database || ""}
              onChange={(e) => setFormData({ ...formData, database: e.target.value })}
              className='w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
              placeholder={formData.type === "sqlite" ? "/path/to/database.db" : "mydatabase"}
              required
            />
          </div>

          {/* Connection Error Display */}
          {connectionError && (
            <div className='p-3 bg-red-900/50 border border-red-700 rounded-md'>
              <p className='text-red-300 text-sm'>{connectionError}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className='flex justify-end gap-2 pt-4'>
            <button
              type='button'
              onClick={onCancel}
              disabled={isConnecting}
              className='px-4 py-2 border border-gray-600 rounded-md text-gray-300 hover:bg-gray-700 disabled:bg-gray-700 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-500'
            >
              Cancel
            </button>
            <button
              type='submit'
              disabled={isConnecting || !isFormValid(formData)}
              className='px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              {isConnecting ? "接続中..." : "Connect"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export interface ConnectionManagerProps {
  connections: ConnectionInfo[]
  activeConnectionId?: string
  onConnectionSelect: (connectionId: string) => Promise<void>
  onConnectionCreate: () => void
  onConnectionEdit: (connectionId: string) => void
  onConnectionDelete: (connectionId: string) => void
  onConnectionTest: (connectionId: string) => Promise<void>
}

export const ConnectionManager: React.FC<ConnectionManagerProps> = ({
  connections,
  activeConnectionId,
  onConnectionSelect,
  onConnectionCreate,
  onConnectionEdit,
  onConnectionDelete,
  onConnectionTest,
}) => {
  return (
    <div className='connection-manager'>
      <div className='flex justify-between items-center mb-4'>
        <h2>Database Connections</h2>
        <button
          type='button'
          onClick={onConnectionCreate}
          className='px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600'
        >
          New Connection
        </button>
      </div>
      <div className='connections-list'>
        {connections.length === 0 ? (
          <p>No connections configured</p>
        ) : (
          connections.map((conn) => (
            <button
              type='button'
              key={conn.id}
              className={`connection-item p-3 border rounded mb-2 cursor-pointer text-left w-full ${
                activeConnectionId === conn.id ? "bg-blue-100 border-blue-500" : "hover:bg-gray-50"
              }`}
              onClick={() => onConnectionSelect(conn.id)}
            >
              <div className='flex justify-between items-center'>
                <div>
                  <span className='font-medium'>{conn.name}</span>
                  <span className='ml-2 text-sm text-gray-500'>{conn.type}</span>
                </div>
                <div className='flex gap-2'>
                  <button
                    type='button'
                    onClick={(e) => {
                      e.stopPropagation()
                      onConnectionTest(conn.id)
                    }}
                    className='px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600'
                  >
                    Test
                  </button>
                  <button
                    type='button'
                    onClick={(e) => {
                      e.stopPropagation()
                      onConnectionEdit(conn.id)
                    }}
                    className='px-2 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600'
                  >
                    Edit
                  </button>
                  <button
                    type='button'
                    onClick={(e) => {
                      e.stopPropagation()
                      onConnectionDelete(conn.id)
                    }}
                    className='px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600'
                  >
                    Delete
                  </button>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
