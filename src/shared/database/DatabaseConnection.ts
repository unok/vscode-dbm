import type { ConnectionStatus, DatabaseConfig, QueryResult } from "../types"

export interface PoolOptions {
  min: number
  max: number
}

export abstract class DatabaseConnection {
  protected config: DatabaseConfig
  protected connected = false
  protected lastConnected?: Date
  protected poolSize = 0
  protected maxPoolSize = 0
  protected activeConnections = 0

  constructor(config: DatabaseConfig) {
    this.config = config
  }

  abstract connect(timeout?: number): Promise<void>
  abstract disconnect(): Promise<void>
  abstract query(sql: string, params?: unknown[]): Promise<QueryResult>

  isConnected(): boolean {
    return this.connected
  }

  getConnectionId(): string {
    return this.config.id
  }

  getType(): string {
    return this.config.type
  }

  getConnectionInfo(): DatabaseConfig {
    return { ...this.config }
  }

  getConnectionStatus(): ConnectionStatus {
    return {
      connected: this.connected,
      lastConnected: this.lastConnected,
    }
  }

  // プール管理メソッド
  createPool(options: PoolOptions): void {
    this.poolSize = options.min
    this.maxPoolSize = options.max
  }

  async getPoolConnection(): Promise<unknown> {
    if (this.activeConnections >= this.maxPoolSize) {
      throw new Error("Pool exhausted")
    }

    this.activeConnections++
    return { id: `pool-connection-${this.activeConnections}` }
  }

  async destroyPool(): Promise<void> {
    this.poolSize = 0
    this.maxPoolSize = 0
    this.activeConnections = 0
  }

  getPoolSize(): number {
    return this.poolSize
  }

  getMaxPoolSize(): number {
    return this.maxPoolSize
  }

  getActiveConnectionsCount(): number {
    return this.activeConnections
  }

  protected setConnected(connected: boolean): void {
    this.connected = connected
    if (connected) {
      this.lastConnected = new Date()
    }
  }

  protected async executeWithTimeout<T>(operation: () => Promise<T>, timeout: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error("Connection timeout"))
      }, timeout)

      operation()
        .then((result) => {
          clearTimeout(timeoutId)
          resolve(result)
        })
        .catch((error) => {
          clearTimeout(timeoutId)
          reject(error)
        })
    })
  }
}
