import { beforeEach, describe, expect, test, vi } from "vitest"
import {
  type AIServiceConfig,
  AIServiceManager,
  CursorAIService,
  GitHubCopilotService,
} from "../../shared/services/AIServiceManager"
import type { CursorAIDefaultOptions } from "../../shared/types/datagrid"
import type { DatabaseSchema } from "../../shared/types/sql"

// Mock fetch globally
global.fetch = vi.fn()

describe("AIServiceManager", () => {
  let aiManager: AIServiceManager
  let mockConfig: AIServiceConfig
  let mockSchema: DatabaseSchema

  beforeEach(() => {
    vi.clearAllMocks()

    mockConfig = {
      cursorAI: {
        enabled: true,
        apiKey: "test-cursor-key",
        endpoint: "https://api.cursor.com/v1",
        timeout: 30000,
        retryAttempts: 3,
      },
      githubCopilot: {
        enabled: true,
        apiKey: "test-copilot-key",
        endpoint: "https://api.github.com/copilot",
        timeout: 30000,
        retryAttempts: 2,
      },
      fallbackStrategy: "github_copilot",
      cacheEnabled: true,
      cacheTTL: 300000,
    }

    mockSchema = {
      tables: [
        {
          name: "users",
          schema: "public",
          columns: [
            { name: "id", type: "integer", nullable: false, isPrimaryKey: true },
            { name: "email", type: "varchar(255)", nullable: false, isPrimaryKey: false },
            { name: "name", type: "varchar(100)", nullable: true, isPrimaryKey: false },
            { name: "age", type: "integer", nullable: true, isPrimaryKey: false },
          ],
        },
      ],
      views: [],
      functions: [],
      procedures: [],
    }

    aiManager = new AIServiceManager(mockConfig)
  })

  describe("Default Value Generation", () => {
    test("should generate defaults using Cursor AI", async () => {
      const options: CursorAIDefaultOptions = {
        columns: ["email", "name", "age"],
        existingData: [
          { email: "john@example.com", name: "John Doe", age: 30 },
          { email: "jane@example.com", name: "Jane Smith", age: 25 },
        ],
        context: "User registration data",
      }

      // Mock successful Cursor AI response
      const mockResponse = {
        defaults: {
          email: "ai.generated@example.com",
          name: "AI Generated User",
          age: 28,
        },
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response)

      const result = await aiManager.generateDefaults(options)

      expect(result).toEqual(mockResponse.defaults)
      expect(fetch).toHaveBeenCalledWith(
        mockConfig.cursorAI.endpoint,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-cursor-key",
            "Content-Type": "application/json",
          }),
        })
      )
    })

    test("should fallback to GitHub Copilot when Cursor AI fails", async () => {
      const options: CursorAIDefaultOptions = {
        columns: ["email", "name"],
        existingData: [],
        context: "Test data",
      }

      // Mock Cursor AI failure
      vi.mocked(fetch).mockRejectedValueOnce(new Error("Cursor AI unavailable"))

      const result = await aiManager.generateDefaults(options)

      // Should get fallback defaults (local generation since Copilot isn't fully implemented)
      expect(result).toHaveProperty("email")
      expect(result).toHaveProperty("name")
      expect(result.email).toContain("@example.com")
    })

    test("should generate local defaults when all AI services fail", async () => {
      const localConfig: AIServiceConfig = {
        ...mockConfig,
        fallbackStrategy: "local_only",
      }

      const localManager = new AIServiceManager(localConfig)
      const options: CursorAIDefaultOptions = {
        columns: ["email", "name", "age", "active"],
        existingData: [],
        context: "Test",
      }

      // Mock all services as unavailable
      vi.mocked(fetch).mockRejectedValue(new Error("Service unavailable"))

      const result = await localManager.generateDefaults(options)

      expect(result).toHaveProperty("email")
      expect(result).toHaveProperty("name")
      expect(result).toHaveProperty("age")
      expect(result).toHaveProperty("active")
      expect(result.email).toContain("local")
      expect(typeof result.age).toBe("number")
      expect(typeof result.active).toBe("boolean")
    })
  })

  describe("SQL Generation", () => {
    test("should generate SQL using Cursor AI", async () => {
      const description = "Get all users with their order count"
      const expectedSQL = `SELECT u.name, COUNT(o.id) as order_count 
FROM users u 
LEFT JOIN orders o ON u.id = o.user_id 
GROUP BY u.id, u.name 
ORDER BY order_count DESC`

      const mockResponse = {
        sql: expectedSQL,
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response)

      const result = await aiManager.generateSQL(description, mockSchema)

      expect(result).toBe(expectedSQL)
      expect(fetch).toHaveBeenCalledWith(
        mockConfig.cursorAI.endpoint,
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining(description),
        })
      )
    })

    test("should handle SQL generation with markdown format", async () => {
      const description = "Count active users"
      const mockResponse = {
        content: "```sql\nSELECT COUNT(*) FROM users WHERE active = true\n```",
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response)

      const result = await aiManager.generateSQL(description, mockSchema)

      expect(result).toBe("SELECT COUNT(*) FROM users WHERE active = true")
    })

    test("should fail when SQL generation is unavailable", async () => {
      const description = "Test query"

      vi.mocked(fetch).mockRejectedValue(new Error("Service unavailable"))

      await expect(aiManager.generateSQL(description, mockSchema)).rejects.toThrow(
        "Cursor AI SQL generation failed"
      )
    })
  })

  describe("Data Pattern Analysis", () => {
    test("should analyze data patterns", async () => {
      const testData = [
        { email: "john@example.com", name: "John Doe", age: 30 },
        { email: "jane@example.com", name: "Jane Smith", age: 25 },
        { email: "bob@example.com", name: "Bob Johnson", age: 35 },
      ]

      const mockResponse = {
        patterns: [
          {
            column: "email",
            type: "format",
            pattern: "standard email format",
            examples: ["john@example.com", "jane@example.com"],
            confidence: 0.95,
          },
          {
            column: "age",
            type: "distribution",
            pattern: "adult age range",
            examples: [25, 30, 35],
            confidence: 0.8,
          },
        ],
        confidence: 0.87,
        suggestions: ["Data follows consistent patterns", "Email domain is standardized"],
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response)

      const result = await aiManager.analyzeDataPatterns(testData)

      expect(result.patterns).toHaveLength(2)
      expect(result.patterns[0].column).toBe("email")
      expect(result.patterns[1].column).toBe("age")
      expect(result.confidence).toBe(0.87)
      expect(result.suggestions).toContain("Data follows consistent patterns")
    })

    test("should handle pattern analysis failure gracefully", async () => {
      const testData = [{ test: "data" }]

      vi.mocked(fetch).mockRejectedValue(new Error("Analysis failed"))

      const result = await aiManager.analyzeDataPatterns(testData)

      expect(result.patterns).toHaveLength(0)
      expect(result.confidence).toBe(0)
      expect(result.suggestions).toContain("Pattern analysis currently unavailable")
    })
  })

  describe("Quality Analysis", () => {
    test("should analyze data quality", async () => {
      const testData = [
        { email: "john@example.com", name: "John Doe", age: 30 },
        { email: "invalid-email", name: "Jane", age: -5 },
        { email: "john@example.com", name: "John Duplicate", age: 30 },
      ]

      const mockResponse = {
        issues: [
          {
            type: "invalid",
            column: "email",
            rows: [1],
            description: "Invalid email format",
            severity: "high",
          },
          {
            type: "outlier",
            column: "age",
            rows: [1],
            description: "Negative age value",
            severity: "high",
          },
          {
            type: "duplicate",
            column: "email",
            rows: [0, 2],
            description: "Duplicate email addresses",
            severity: "medium",
          },
        ],
        improvements: [
          {
            type: "validate",
            column: "email",
            description: "Add email format validation",
            example: "user@domain.com",
            impact: "high",
          },
          {
            type: "normalize",
            column: "age",
            description: "Set age constraints (0-120)",
            example: "age >= 0 AND age <= 120",
            impact: "medium",
          },
        ],
        score: 65,
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response)

      const result = await aiManager.suggestImprovements(testData, mockSchema)

      expect(result.issues).toHaveLength(3)
      expect(result.improvements).toHaveLength(2)
      expect(result.score).toBe(65)
      expect(result.issues[0].type).toBe("invalid")
      expect(result.improvements[0].type).toBe("validate")
    })

    test("should handle quality analysis failure gracefully", async () => {
      const testData = [{ test: "data" }]

      vi.mocked(fetch).mockRejectedValue(new Error("Quality analysis failed"))

      const result = await aiManager.suggestImprovements(testData, mockSchema)

      expect(result.issues).toHaveLength(0)
      expect(result.improvements).toHaveLength(0)
      expect(result.score).toBe(0)
    })
  })

  describe("Service Status", () => {
    test("should report service availability", async () => {
      // Mock health check responses
      vi.mocked(fetch)
        .mockResolvedValueOnce({ ok: true } as Response) // Cursor AI health
        .mockResolvedValueOnce({ ok: true } as Response) // GitHub Copilot health

      const status = await aiManager.getServiceStatus()

      expect(status.cursorAI).toBe(true)
      expect(status.githubCopilot).toBe(true)
      expect(status.activeService).toBe("cursor")
    })

    test("should report fallback service when primary fails", async () => {
      // Mock health check responses
      vi.mocked(fetch)
        .mockRejectedValueOnce(new Error("Cursor AI down")) // Cursor AI health fails
        .mockResolvedValueOnce({ ok: true } as Response) // GitHub Copilot health succeeds

      const status = await aiManager.getServiceStatus()

      expect(status.cursorAI).toBe(false)
      expect(status.githubCopilot).toBe(true)
      expect(status.activeService).toBe("copilot")
    })

    test("should report local service when all AI services fail", async () => {
      const localConfig: AIServiceConfig = {
        ...mockConfig,
        fallbackStrategy: "local_only",
      }
      const localManager = new AIServiceManager(localConfig)

      // Mock all health checks as failing
      vi.mocked(fetch).mockRejectedValue(new Error("All services down"))

      const status = await localManager.getServiceStatus()

      expect(status.cursorAI).toBe(false)
      expect(status.githubCopilot).toBe(false)
      expect(status.activeService).toBe("local")
    })
  })

  describe("CursorAIService", () => {
    let cursorService: CursorAIService

    beforeEach(() => {
      cursorService = new CursorAIService(mockConfig.cursorAI)
    })

    test("should cache responses", async () => {
      const options: CursorAIDefaultOptions = {
        columns: ["email"],
        existingData: [],
        context: "test",
      }

      const mockResponse = { defaults: { email: "cached@example.com" } }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response)

      // First call
      const result1 = await cursorService.generateDefaults(options)

      // Second call (should use cache)
      const result2 = await cursorService.generateDefaults(options)

      expect(result1).toEqual(result2)
      expect(fetch).toHaveBeenCalledTimes(1) // Only called once due to caching
    })

    test("should retry on failure", async () => {
      const options: CursorAIDefaultOptions = {
        columns: ["email"],
        existingData: [],
        context: "test",
      }

      // Mock first two calls to fail, third to succeed
      vi.mocked(fetch)
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ defaults: { email: "retry@example.com" } }),
        } as Response)

      const result = await cursorService.generateDefaults(options)

      expect(result.email).toBe("retry@example.com")
      expect(fetch).toHaveBeenCalledTimes(3) // Retried twice before success
    })

    test("should fail after max retries", async () => {
      const options: CursorAIDefaultOptions = {
        columns: ["email"],
        existingData: [],
        context: "test",
      }

      vi.mocked(fetch).mockRejectedValue(new Error("Persistent network error"))

      await expect(cursorService.generateDefaults(options)).rejects.toThrow(
        "Cursor AI default generation failed"
      )

      expect(fetch).toHaveBeenCalledTimes(mockConfig.cursorAI.retryAttempts)
    })

    test("should check service availability", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response)

      const isAvailable = await cursorService.isAvailable()

      expect(isAvailable).toBe(true)
      expect(fetch).toHaveBeenCalledWith(
        `${mockConfig.cursorAI.endpoint}/health`,
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer test-cursor-key",
          }),
        })
      )
    })

    test("should handle service unavailability", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("Service down"))

      const isAvailable = await cursorService.isAvailable()

      expect(isAvailable).toBe(false)
    })
  })

  describe("GitHubCopilotService", () => {
    let copilotService: GitHubCopilotService

    beforeEach(() => {
      copilotService = new GitHubCopilotService(mockConfig.githubCopilot)
    })

    test("should generate fallback defaults", async () => {
      const options: CursorAIDefaultOptions = {
        columns: ["email", "name"],
        existingData: [],
        context: "test",
      }

      // Mock service as available but use fallback implementation
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response)

      const result = await copilotService.generateDefaults(options)

      expect(result).toHaveProperty("email")
      expect(result).toHaveProperty("name")
      expect(result.email).toContain("copilot")
    })

    test("should fail when service is disabled", async () => {
      const disabledConfig = { ...mockConfig.githubCopilot, enabled: false }
      const disabledService = new GitHubCopilotService(disabledConfig)

      const options: CursorAIDefaultOptions = {
        columns: ["email"],
        existingData: [],
        context: "test",
      }

      await expect(disabledService.generateDefaults(options)).rejects.toThrow(
        "GitHub Copilot service not available"
      )
    })

    test("should throw error for unsupported SQL generation", async () => {
      await expect(copilotService.generateSQL("test", mockSchema)).rejects.toThrow(
        "GitHub Copilot SQL generation not yet implemented"
      )
    })

    test("should throw error for unsupported pattern analysis", async () => {
      await expect(copilotService.analyzeDataPatterns([])).rejects.toThrow(
        "GitHub Copilot pattern analysis not supported"
      )
    })
  })

  describe("Error Handling", () => {
    test("should handle API timeout", async () => {
      const options: CursorAIDefaultOptions = {
        columns: ["email"],
        existingData: [],
        context: "test",
      }

      // Mock timeout error
      vi.mocked(fetch).mockRejectedValue(new Error("Request timed out"))

      await expect(aiManager.generateDefaults(options)).resolves.toBeTruthy() // Should fallback to local generation
    })

    test("should handle malformed API responses", async () => {
      const options: CursorAIDefaultOptions = {
        columns: ["email"],
        existingData: [],
        context: "test",
      }

      // Mock malformed response
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ invalid: "response" }),
      } as Response)

      const result = await aiManager.generateDefaults(options)

      // Should get fallback defaults
      expect(result).toHaveProperty("email")
    })

    test("should handle HTTP error responses", async () => {
      const options: CursorAIDefaultOptions = {
        columns: ["email"],
        existingData: [],
        context: "test",
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Rate Limited",
      } as Response)

      await expect(aiManager.generateDefaults(options)).resolves.toBeTruthy() // Should fallback gracefully
    })
  })

  describe("Configuration", () => {
    test("should handle disabled services", async () => {
      const disabledConfig: AIServiceConfig = {
        ...mockConfig,
        cursorAI: { ...mockConfig.cursorAI, enabled: false },
        githubCopilot: { ...mockConfig.githubCopilot, enabled: false },
        fallbackStrategy: "local_only",
      }

      const disabledManager = new AIServiceManager(disabledConfig)
      const options: CursorAIDefaultOptions = {
        columns: ["email", "name"],
        existingData: [],
        context: "test",
      }

      const result = await disabledManager.generateDefaults(options)

      expect(result).toHaveProperty("email")
      expect(result).toHaveProperty("name")
      expect(result.email).toContain("local")
    })

    test("should respect fallback strategy", async () => {
      const noFallbackConfig: AIServiceConfig = {
        ...mockConfig,
        fallbackStrategy: "disabled",
      }

      const noFallbackManager = new AIServiceManager(noFallbackConfig)

      vi.mocked(fetch).mockRejectedValue(new Error("Service unavailable"))

      await expect(
        noFallbackManager.generateDefaults({
          columns: ["email"],
          existingData: [],
          context: "test",
        })
      ).rejects.toThrow()
    })
  })
})
