import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"
import type { DatabaseConfig } from "../types"

export class EncryptionService {
  private readonly algorithm = "aes-256-cbc"
  private readonly key: string

  constructor(secretKey?: string) {
    // 秘密鍵を生成または使用
    this.key = secretKey || this.generateKey()
  }

  private generateKey(): string {
    return createHash("sha256").update(randomBytes(32)).digest("hex")
  }

  encrypt(text: string): string {
    if (text === null || text === undefined) {
      throw new Error("Cannot encrypt null or undefined value")
    }

    if (text === "") {
      return this.encryptEmpty()
    }

    const iv = randomBytes(16)
    const key = createHash("sha256").update(this.key).digest()
    const cipher = createCipheriv(this.algorithm, key, iv)

    let encrypted = cipher.update(text, "utf8", "hex")
    encrypted += cipher.final("hex")

    // IVを先頭に付加
    return `${iv.toString("hex")}:${encrypted}`
  }

  decrypt(encryptedText: string): string {
    if (encryptedText === null || encryptedText === undefined) {
      throw new Error("Cannot decrypt null or undefined value")
    }

    if (this.isEmptyEncrypted(encryptedText)) {
      return ""
    }

    try {
      const parts = encryptedText.split(":")
      if (parts.length !== 2) {
        throw new Error("Invalid encrypted data format")
      }

      const iv = Buffer.from(parts[0], "hex")
      const encrypted = parts[1]
      const key = createHash("sha256").update(this.key).digest()

      const decipher = createDecipheriv(this.algorithm, key, iv)

      let decrypted = decipher.update(encrypted, "hex", "utf8")
      decrypted += decipher.final("utf8")

      return decrypted
    } catch (error) {
      throw new Error(`Decryption failed: ${error}`)
    }
  }

  private encryptEmpty(): string {
    return `EMPTY_STRING_MARKER:${randomBytes(8).toString("hex")}`
  }

  private isEmptyEncrypted(encryptedText: string): boolean {
    return encryptedText.startsWith("EMPTY_STRING_MARKER:")
  }

  encryptDatabaseConfig(config: DatabaseConfig): DatabaseConfig {
    if (!config.password) {
      return config
    }

    return {
      ...config,
      password: this.encrypt(config.password),
    }
  }

  decryptDatabaseConfig(encryptedConfig: DatabaseConfig): DatabaseConfig {
    if (!encryptedConfig.password) {
      return encryptedConfig
    }

    return {
      ...encryptedConfig,
      password: this.decrypt(encryptedConfig.password),
    }
  }

  encryptPassword(password: string): string {
    return this.encrypt(password)
  }

  decryptPassword(encryptedPassword: string): string {
    return this.decrypt(encryptedPassword)
  }

  encryptMultipleDatabaseConfigs(configs: DatabaseConfig[]): DatabaseConfig[] {
    return configs.map((config) => this.encryptDatabaseConfig(config))
  }

  decryptMultipleDatabaseConfigs(encryptedConfigs: DatabaseConfig[]): DatabaseConfig[] {
    return encryptedConfigs.map((config) => this.decryptDatabaseConfig(config))
  }
}
