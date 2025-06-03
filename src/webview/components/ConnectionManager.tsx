import type React from "react"
import { useState } from "react"

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

export const ConnectionManager: React.FC = () => {
  const [connections, setConnections] = useState<ConnectionConfig[]>([])

  return (
    <div className="connection-manager">
      <h2>Database Connections</h2>
      <div className="connections-list">
        {connections.length === 0 ? (
          <p>No connections configured</p>
        ) : (
          connections.map((conn) => (
            <div key={conn.id} className="connection-item">
              <span>{conn.name}</span>
              <span>{conn.type}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}