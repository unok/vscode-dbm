import { EncryptionService } from "@/shared/security/EncryptionService"
import type { DatabaseConfig } from "@/shared/types"
import { beforeEach, describe, expect, it } from "vitest"

describe("EncryptionService", () => {
  let encryptionService: EncryptionService
  let mockConfig: DatabaseConfig

  beforeEach(() => {
    encryptionService = new EncryptionService()
    mockConfig = {
      id: "test-connection-1",
      name: "Test Database",
      type: "mysql",
      host: "localhost",
      port: 3306,
      username: "test_user",
      password: "test_password",
      database: "test_db",
      ssl: false,
    }
  })

  describe("基本的な暗号化・復号化テスト", () => {
    it("文字列の暗号化・復号化が正常に動作する", () => {
      const originalText = "sensitive_password_123"

      const encrypted = encryptionService.encrypt(originalText)
      expect(encrypted).not.toBe(originalText)
      expect(encrypted).toBeDefined()
      expect(encrypted.length).toBeGreaterThan(0)

      const decrypted = encryptionService.decrypt(encrypted)
      expect(decrypted).toBe(originalText)
    })

    it("空文字列の暗号化・復号化が正常に動作する", () => {
      const originalText = ""

      const encrypted = encryptionService.encrypt(originalText)
      const decrypted = encryptionService.decrypt(encrypted)

      expect(decrypted).toBe(originalText)
    })

    it("長いテキストの暗号化・復号化が正常に動作する", () => {
      const originalText = "a".repeat(1000)

      const encrypted = encryptionService.encrypt(originalText)
      const decrypted = encryptionService.decrypt(encrypted)

      expect(decrypted).toBe(originalText)
    })

    it("特殊文字を含むテキストの暗号化・復号化が正常に動作する", () => {
      const originalText = "!@#$%^&*()_+-=[]{}|;:,.<>?/~`\"'\\"

      const encrypted = encryptionService.encrypt(originalText)
      const decrypted = encryptionService.decrypt(encrypted)

      expect(decrypted).toBe(originalText)
    })

    it("日本語テキストの暗号化・復号化が正常に動作する", () => {
      const originalText = "テストデータベースパスワード１２３"

      const encrypted = encryptionService.encrypt(originalText)
      const decrypted = encryptionService.decrypt(encrypted)

      expect(decrypted).toBe(originalText)
    })
  })

  describe("データベース設定の暗号化・復号化テスト", () => {
    it("データベース設定全体の暗号化・復号化が正常に動作する", () => {
      const encryptedConfig = encryptionService.encryptDatabaseConfig(mockConfig)

      // 暗号化されたconfigの検証
      expect(encryptedConfig.password).not.toBe(mockConfig.password)
      expect(encryptedConfig.id).toBe(mockConfig.id) // IDは暗号化されない
      expect(encryptedConfig.name).toBe(mockConfig.name) // 名前は暗号化されない
      expect(encryptedConfig.type).toBe(mockConfig.type) // タイプは暗号化されない

      const decryptedConfig = encryptionService.decryptDatabaseConfig(encryptedConfig)

      // 復号化後の検証
      expect(decryptedConfig).toEqual(mockConfig)
    })

    it("パスワードのみの暗号化・復号化が正常に動作する", () => {
      const originalPassword = "super_secret_password"

      const encryptedPassword = encryptionService.encryptPassword(originalPassword)
      expect(encryptedPassword).not.toBe(originalPassword)

      const decryptedPassword = encryptionService.decryptPassword(encryptedPassword)
      expect(decryptedPassword).toBe(originalPassword)
    })

    it("複数のデータベース設定を暗号化・復号化できる", () => {
      const configs = [
        mockConfig,
        {
          ...mockConfig,
          id: "test-connection-2",
          name: "Test Database 2",
          password: "another_password",
        },
        {
          ...mockConfig,
          id: "test-connection-3",
          name: "Test Database 3",
          type: "postgresql" as const,
          password: "postgres_password",
        },
      ]

      const encryptedConfigs = encryptionService.encryptMultipleDatabaseConfigs(configs)
      const decryptedConfigs = encryptionService.decryptMultipleDatabaseConfigs(encryptedConfigs)

      expect(decryptedConfigs).toEqual(configs)
    })
  })

  describe("セキュリティテスト", () => {
    it("同じテキストでも毎回異なる暗号化結果になる", () => {
      const originalText = "test_password"

      const encrypted1 = encryptionService.encrypt(originalText)
      const encrypted2 = encryptionService.encrypt(originalText)

      expect(encrypted1).not.toBe(encrypted2)

      // ただし、復号化すると同じ結果になる
      expect(encryptionService.decrypt(encrypted1)).toBe(originalText)
      expect(encryptionService.decrypt(encrypted2)).toBe(originalText)
    })

    it("暗号化キーが異なると復号化できない", () => {
      const originalText = "test_password"
      const encryptionService1 = new EncryptionService()
      const encryptionService2 = new EncryptionService()

      const encrypted = encryptionService1.encrypt(originalText)

      // 異なるインスタンス（異なるキー）では復号化できない
      expect(() => {
        encryptionService2.decrypt(encrypted)
      }).toThrow()
    })

    it("無効な暗号化データの復号化でエラーが発生する", () => {
      expect(() => {
        encryptionService.decrypt("invalid_encrypted_data")
      }).toThrow()
    })

    it("暗号化データの改ざん検知が動作する", () => {
      const originalText = "test_password"
      const encrypted = encryptionService.encrypt(originalText)

      // 暗号化データを改ざん
      const tamperedData = `${encrypted.slice(0, -5)}xxxxx`

      expect(() => {
        encryptionService.decrypt(tamperedData)
      }).toThrow()
    })
  })

  describe("パフォーマンステスト", () => {
    it("大量データの暗号化・復号化が適切な時間で完了する", () => {
      const largeData = "x".repeat(100000)

      const startTime = Date.now()
      const encrypted = encryptionService.encrypt(largeData)
      const decrypted = encryptionService.decrypt(encrypted)
      const endTime = Date.now()

      expect(decrypted).toBe(largeData)
      expect(endTime - startTime).toBeLessThan(1000) // 1秒以内
    })

    it("複数のデータベース設定の一括暗号化が適切な時間で完了する", () => {
      const configs = Array.from({ length: 100 }, (_, i) => ({
        ...mockConfig,
        id: `test-connection-${i}`,
        password: `password_${i}`,
      }))

      const startTime = Date.now()
      const encryptedConfigs = encryptionService.encryptMultipleDatabaseConfigs(configs)
      const decryptedConfigs = encryptionService.decryptMultipleDatabaseConfigs(encryptedConfigs)
      const endTime = Date.now()

      expect(decryptedConfigs).toEqual(configs)
      expect(endTime - startTime).toBeLessThan(2000) // 2秒以内
    })
  })

  describe("エラーハンドリングテスト", () => {
    it("nullの暗号化でエラーが発生する", () => {
      expect(() => {
        encryptionService.encrypt(null as any)
      }).toThrow()
    })

    it("undefinedの暗号化でエラーが発生する", () => {
      expect(() => {
        encryptionService.encrypt(undefined as any)
      }).toThrow()
    })

    it("nullの復号化でエラーが発生する", () => {
      expect(() => {
        encryptionService.decrypt(null as any)
      }).toThrow()
    })

    it("undefinedの復号化でエラーが発生する", () => {
      expect(() => {
        encryptionService.decrypt(undefined as any)
      }).toThrow()
    })
  })
})
