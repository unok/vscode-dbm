import type React from "react"
import { useState } from "react"
import type { ConnectionInfo } from "../../shared/types/schema"

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
  onSubmit: (data: ConnectionConfig) => void
  onCancel: () => void
}

export const ConnectionForm: React.FC<ConnectionFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
}) => {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.name && formData.database) {
      const completeFormData = formData as ConnectionConfig
      onSubmit({
        ...completeFormData,
        id: initialData?.id || `conn_${Date.now()}`,
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className='connection-form'>
      <div className='form-group'>
        <label htmlFor='name'>Connection Name</label>
        <input
          id='name'
          type='text'
          value={formData.name || ""}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      <div className='form-group'>
        <label htmlFor='type'>Database Type</label>
        <select
          id='type'
          value={formData.type || "mysql"}
          onChange={(e) =>
            setFormData({ ...formData, type: e.target.value as ConnectionConfig["type"] })
          }
        >
          <option value='mysql'>MySQL</option>
          <option value='postgresql'>PostgreSQL</option>
          <option value='sqlite'>SQLite</option>
        </select>
      </div>

      <div className='form-actions'>
        <button type='submit'>Save</button>
        <button type='button' onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
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
