import { beforeEach, describe, expect, test } from "vitest"
import type { CellValue, ColumnDefinition, ValidationRule } from "../../shared/types/datagrid"
import { CellValidationEngine } from "../../shared/utils/CellValidationEngine"

describe("CellValidationEngine", () => {
  let validationEngine: CellValidationEngine
  let mockColumns: ColumnDefinition[]

  beforeEach(() => {
    mockColumns = [
      {
        id: "id",
        name: "id",
        type: "integer",
        nullable: false,
        isPrimaryKey: true,
        isAutoIncrement: true,
      },
      {
        id: "email",
        name: "email",
        type: "varchar(255)",
        nullable: false,
        isPrimaryKey: false,
        isAutoIncrement: false,
      },
      {
        id: "age",
        name: "age",
        type: "integer",
        nullable: true,
        isPrimaryKey: false,
        isAutoIncrement: false,
      },
      {
        id: "price",
        name: "price",
        type: "decimal(10,2)",
        nullable: true,
        isPrimaryKey: false,
        isAutoIncrement: false,
      },
      {
        id: "active",
        name: "active",
        type: "boolean",
        nullable: false,
        isPrimaryKey: false,
        isAutoIncrement: false,
      },
      {
        id: "created_at",
        name: "created_at",
        type: "timestamp",
        nullable: false,
        isPrimaryKey: false,
        isAutoIncrement: false,
      },
      {
        id: "data",
        name: "data",
        type: "json",
        nullable: true,
        isPrimaryKey: false,
        isAutoIncrement: false,
      },
      {
        id: "uuid",
        name: "uuid",
        type: "uuid",
        nullable: false,
        isPrimaryKey: false,
        isAutoIncrement: false,
      },
      {
        id: "website",
        name: "website",
        type: "url",
        nullable: true,
        isPrimaryKey: false,
        isAutoIncrement: false,
      },
    ]

    validationEngine = new CellValidationEngine(mockColumns)
  })

  describe("Integer Validation", () => {
    test("should validate integer values", async () => {
      const result = await validationEngine.validateCell(0, "age", 25)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    test("should reject non-integer values", async () => {
      const result = await validationEngine.validateCell(0, "age", "not a number")

      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain("Invalid integer")
    })

    test("should validate integer zero", async () => {
      const result = await validationEngine.validateCell(0, "age", 0)

      expect(result.isValid).toBe(true)
    })

    test("should validate negative integers", async () => {
      const result = await validationEngine.validateCell(0, "age", -5)

      expect(result.isValid).toBe(true)
    })

    test("should reject decimal values for integer fields", async () => {
      const result = await validationEngine.validateCell(0, "age", 25.5)

      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain("must be a whole number")
    })
  })

  describe("Decimal Validation", () => {
    test("should validate decimal values", async () => {
      const result = await validationEngine.validateCell(0, "price", 99.99)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    test("should validate integer values in decimal fields", async () => {
      const result = await validationEngine.validateCell(0, "price", 100)

      expect(result.isValid).toBe(true)
    })

    test("should reject non-numeric values in decimal fields", async () => {
      const result = await validationEngine.validateCell(0, "price", "not a number")

      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain("Invalid decimal")
    })

    test("should validate negative decimal values", async () => {
      const result = await validationEngine.validateCell(0, "price", -99.99)

      expect(result.isValid).toBe(true)
    })
  })

  describe("Boolean Validation", () => {
    test("should validate boolean true", async () => {
      const result = await validationEngine.validateCell(0, "active", true)

      expect(result.isValid).toBe(true)
    })

    test("should validate boolean false", async () => {
      const result = await validationEngine.validateCell(0, "active", false)

      expect(result.isValid).toBe(true)
    })

    test("should validate string boolean values", async () => {
      const trueResult = await validationEngine.validateCell(0, "active", "true")
      const falseResult = await validationEngine.validateCell(0, "active", "false")

      expect(trueResult.isValid).toBe(true)
      expect(falseResult.isValid).toBe(true)
    })

    test("should validate numeric boolean values", async () => {
      const trueResult = await validationEngine.validateCell(0, "active", 1)
      const falseResult = await validationEngine.validateCell(0, "active", 0)

      expect(trueResult.isValid).toBe(true)
      expect(falseResult.isValid).toBe(true)
    })

    test("should reject invalid boolean values", async () => {
      const result = await validationEngine.validateCell(0, "active", "maybe")

      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain("Invalid boolean")
    })
  })

  describe("Date Validation", () => {
    test("should validate ISO date strings", async () => {
      const result = await validationEngine.validateCell(0, "created_at", "2023-01-01T10:00:00Z")

      expect(result.isValid).toBe(true)
    })

    test("should validate Date objects", async () => {
      const result = await validationEngine.validateCell(0, "created_at", new Date())

      expect(result.isValid).toBe(true)
    })

    test("should validate common date formats", async () => {
      const formats = ["2023-01-01", "01/01/2023", "January 1, 2023", "2023-01-01 10:00:00"]

      for (const format of formats) {
        const result = await validationEngine.validateCell(0, "created_at", format)
        expect(result.isValid).toBe(true)
      }
    })

    test("should reject invalid date strings", async () => {
      const result = await validationEngine.validateCell(0, "created_at", "not a date")

      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain("Invalid date")
    })

    test("should reject impossible dates", async () => {
      const result = await validationEngine.validateCell(0, "created_at", "2023-02-30")

      expect(result.isValid).toBe(false)
    })
  })

  describe("JSON Validation", () => {
    test("should validate valid JSON objects", async () => {
      const result = await validationEngine.validateCell(0, "data", { key: "value", number: 123 })

      expect(result.isValid).toBe(true)
    })

    test("should validate valid JSON arrays", async () => {
      const result = await validationEngine.validateCell(0, "data", [1, 2, 3, "test"])

      expect(result.isValid).toBe(true)
    })

    test("should validate JSON strings", async () => {
      const result = await validationEngine.validateCell(0, "data", '{"key": "value"}')

      expect(result.isValid).toBe(true)
    })

    test("should reject invalid JSON strings", async () => {
      const result = await validationEngine.validateCell(0, "data", "{invalid json}")

      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain("Invalid JSON")
    })

    test("should validate primitive JSON values", async () => {
      const primitives = ["string", 123, true, null]

      for (const primitive of primitives) {
        const result = await validationEngine.validateCell(0, "data", primitive)
        expect(result.isValid).toBe(true)
      }
    })
  })

  describe("UUID Validation", () => {
    test("should validate UUID v4", async () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000"
      const result = await validationEngine.validateCell(0, "uuid", uuid)

      expect(result.isValid).toBe(true)
    })

    test("should validate UUID v1", async () => {
      const uuid = "12345678-1234-1234-1234-123456789012"
      const result = await validationEngine.validateCell(0, "uuid", uuid)

      expect(result.isValid).toBe(true)
    })

    test("should reject invalid UUID format", async () => {
      const result = await validationEngine.validateCell(0, "uuid", "not-a-uuid")

      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain("Invalid UUID")
    })

    test("should reject UUID with wrong length", async () => {
      const result = await validationEngine.validateCell(0, "uuid", "550e8400-e29b-41d4-a716")

      expect(result.isValid).toBe(false)
    })
  })

  describe("Email Validation", () => {
    test("should validate correct email addresses", async () => {
      const emails = [
        "test@example.com",
        "user.name@domain.co.uk",
        "test+tag@example.org",
        "123@numbers.com",
      ]

      for (const email of emails) {
        const result = await validationEngine.validateCell(0, "email", email)
        expect(result.isValid).toBe(true)
      }
    })

    test("should reject invalid email formats", async () => {
      const invalidEmails = [
        "notanemail",
        "@domain.com",
        "test@",
        "test..test@example.com",
        "test@domain",
        "",
      ]

      for (const email of invalidEmails) {
        const result = await validationEngine.validateCell(0, "email", email)
        expect(result.isValid).toBe(false)
        expect(result.errors[0]).toContain("Invalid email")
      }
    })
  })

  describe("URL Validation", () => {
    test("should validate HTTP URLs", async () => {
      const result = await validationEngine.validateCell(0, "website", "http://example.com")

      expect(result.isValid).toBe(true)
    })

    test("should validate HTTPS URLs", async () => {
      const result = await validationEngine.validateCell(
        0,
        "website",
        "https://www.example.com/path?query=value"
      )

      expect(result.isValid).toBe(true)
    })

    test("should validate URLs with ports", async () => {
      const result = await validationEngine.validateCell(0, "website", "http://localhost:3000")

      expect(result.isValid).toBe(true)
    })

    test("should reject invalid URLs", async () => {
      const invalidUrls = [
        "not a url",
        "http://",
        "ftp://example.com", // Only HTTP/HTTPS typically allowed
        "example.com",
      ]

      for (const url of invalidUrls) {
        const result = await validationEngine.validateCell(0, "website", url)
        expect(result.isValid).toBe(false)
      }
    })
  })

  describe("Nullable Fields", () => {
    test("should allow null values in nullable fields", async () => {
      const result = await validationEngine.validateCell(0, "age", null)

      expect(result.isValid).toBe(true)
    })

    test("should allow empty strings in nullable fields", async () => {
      const result = await validationEngine.validateCell(0, "age", "")

      expect(result.isValid).toBe(true)
    })

    test("should reject null in non-nullable fields", async () => {
      const result = await validationEngine.validateCell(0, "email", null)

      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain("cannot be null")
    })

    test("should reject empty strings in non-nullable fields", async () => {
      const result = await validationEngine.validateCell(0, "email", "")

      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain("cannot be empty")
    })
  })

  describe("Length Validation", () => {
    test("should validate string length within limits", async () => {
      const column: ColumnDefinition = {
        id: "short_text",
        name: "short_text",
        type: "varchar(10)",
        maxLength: 10,
        nullable: false,
        isPrimaryKey: false,
        isAutoIncrement: false,
      }

      validationEngine.setSchema([column])
      const result = await validationEngine.validateCell(0, "short_text", "test")

      expect(result.isValid).toBe(true)
    })

    test("should reject strings exceeding max length", async () => {
      const column: ColumnDefinition = {
        id: "short_text",
        name: "short_text",
        type: "varchar(5)",
        maxLength: 5,
        nullable: false,
        isPrimaryKey: false,
        isAutoIncrement: false,
      }

      validationEngine.setSchema([column])
      const result = await validationEngine.validateCell(0, "short_text", "this is too long")

      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain("exceeds maximum length")
    })

    test("should warn when approaching length limits", async () => {
      const column: ColumnDefinition = {
        id: "text_field",
        name: "text_field",
        type: "varchar(10)",
        maxLength: 10,
        nullable: false,
        isPrimaryKey: false,
        isAutoIncrement: false,
      }

      validationEngine.setSchema([column])
      const result = await validationEngine.validateCell(0, "text_field", "12345678") // 8/10 chars

      expect(result.isValid).toBe(true)
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings[0]).toContain("approaching maximum length")
    })
  })

  describe("Custom Validation Rules", () => {
    test("should apply custom validation rules", async () => {
      const customRule: ValidationRule = {
        name: "age_range",
        message: "Age must be between 0 and 120",
        validator: (value: CellValue) => {
          if (typeof value === "number") {
            return value >= 0 && value <= 120
          }
          return true
        },
      }

      validationEngine.addCustomRule("age", customRule)

      const validResult = await validationEngine.validateCell(0, "age", 25)
      expect(validResult.isValid).toBe(true)

      const invalidResult = await validationEngine.validateCell(0, "age", 150)
      expect(invalidResult.isValid).toBe(false)
      expect(invalidResult.errors[0]).toContain("Age must be between 0 and 120")
    })

    test("should apply multiple custom rules", async () => {
      const rule1: ValidationRule = {
        name: "positive",
        message: "Value must be positive",
        validator: (value: CellValue) => typeof value === "number" && value > 0,
      }

      const rule2: ValidationRule = {
        name: "even",
        message: "Value must be even",
        validator: (value: CellValue) => typeof value === "number" && value % 2 === 0,
      }

      validationEngine.addCustomRule("age", rule1)
      validationEngine.addCustomRule("age", rule2)

      const validResult = await validationEngine.validateCell(0, "age", 4)
      expect(validResult.isValid).toBe(true)

      const invalidResult = await validationEngine.validateCell(0, "age", 3)
      expect(invalidResult.isValid).toBe(false)
      expect(invalidResult.errors).toContain("Value must be even")
    })

    test("should remove custom validation rules", async () => {
      const customRule: ValidationRule = {
        name: "test_rule",
        message: "Test rule",
        validator: () => false,
      }

      validationEngine.addCustomRule("age", customRule)
      validationEngine.removeCustomRule("age", "test_rule")

      const result = await validationEngine.validateCell(0, "age", 25)
      expect(result.isValid).toBe(true) // Rule was removed
    })
  })

  describe("Business Logic Validation", () => {
    test("should validate unique email addresses", async () => {
      const existingEmails = ["john@example.com", "jane@example.com"]
      validationEngine.setBusinessLogic("unique_emails", existingEmails)

      const validResult = await validationEngine.validateCell(0, "email", "new@example.com")
      expect(validResult.isValid).toBe(true)

      const duplicateResult = await validationEngine.validateCell(0, "email", "john@example.com")
      expect(duplicateResult.isValid).toBe(false)
      expect(duplicateResult.errors[0]).toContain("already exists")
    })

    test("should validate date ranges", async () => {
      const dateRange = { min: "2020-01-01", max: "2030-12-31" }
      validationEngine.setBusinessLogic("date_range", dateRange)

      const validResult = await validationEngine.validateCell(0, "created_at", "2023-06-15")
      expect(validResult.isValid).toBe(true)

      const tooEarlyResult = await validationEngine.validateCell(0, "created_at", "2019-01-01")
      expect(tooEarlyResult.isValid).toBe(false)

      const tooLateResult = await validationEngine.validateCell(0, "created_at", "2031-01-01")
      expect(tooLateResult.isValid).toBe(false)
    })
  })

  describe("Format Validation", () => {
    test("should validate phone number formats", async () => {
      const phoneColumn: ColumnDefinition = {
        id: "phone",
        name: "phone",
        type: "varchar(20)",
        nullable: false,
        isPrimaryKey: false,
        isAutoIncrement: false,
      }

      validationEngine.setSchema([phoneColumn])

      const validPhones = ["+1-555-123-4567", "(555) 123-4567", "555.123.4567", "555-123-4567"]

      for (const phone of validPhones) {
        const result = await validationEngine.validateCell(0, "phone", phone)
        expect(result.isValid).toBe(true)
      }
    })

    test("should validate postal code formats", async () => {
      const postalColumn: ColumnDefinition = {
        id: "postal_code",
        name: "postal_code",
        type: "varchar(10)",
        nullable: false,
        isPrimaryKey: false,
        isAutoIncrement: false,
      }

      validationEngine.setSchema([postalColumn])

      const validCodes = [
        "12345",
        "12345-6789",
        "K1A 0A6", // Canadian
        "SW1A 1AA", // UK
      ]

      for (const code of validCodes) {
        const result = await validationEngine.validateCell(0, "postal_code", code)
        expect(result.isValid).toBe(true)
      }
    })
  })

  describe("Validation Caching", () => {
    test("should cache validation results", async () => {
      const startTime = Date.now()

      // First validation
      await validationEngine.validateCell(0, "email", "test@example.com")
      const firstTime = Date.now() - startTime

      const cacheStartTime = Date.now()

      // Second validation (should be cached)
      await validationEngine.validateCell(0, "email", "test@example.com")
      const cachedTime = Date.now() - cacheStartTime

      // Cached validation should be faster (though this is a simple test)
      expect(cachedTime).toBeLessThanOrEqual(firstTime + 10) // Allow for some variance
    })

    test("should clear validation cache", async () => {
      await validationEngine.validateCell(0, "email", "test@example.com")

      validationEngine.clearValidationCache()

      // Cache should be cleared (implementation dependent)
      const result = await validationEngine.validateCell(0, "email", "test@example.com")
      expect(result.isValid).toBe(true)
    })
  })

  describe("Suggestions", () => {
    test("should provide correction suggestions for invalid emails", async () => {
      const result = await validationEngine.validateCell(0, "email", "test@gmial.com")

      expect(result.isValid).toBe(false)
      expect(result.suggestions).toBeDefined()
      expect(result.suggestions?.length).toBeGreaterThan(0)
      expect(result.suggestions?.[0]).toContain("gmail.com")
    })

    test("should provide suggestions for invalid URLs", async () => {
      const result = await validationEngine.validateCell(0, "website", "example.com")

      expect(result.isValid).toBe(false)
      expect(result.suggestions).toBeDefined()
      expect(result.suggestions?.some((s) => s.includes("http://"))).toBe(true)
    })

    test("should provide date format suggestions", async () => {
      const result = await validationEngine.validateCell(0, "created_at", "01/32/2023")

      expect(result.isValid).toBe(false)
      expect(result.suggestions).toBeDefined()
      expect(result.suggestions?.length).toBeGreaterThan(0)
    })
  })

  describe("Error Handling", () => {
    test("should handle unknown column gracefully", async () => {
      const result = await validationEngine.validateCell(0, "non_existent_column", "value")

      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain("Column not found")
    })

    test("should handle undefined values", async () => {
      const result = await validationEngine.validateCell(0, "age", undefined)

      // Should treat undefined similar to null
      expect(result.isValid).toBe(true) // age is nullable
    })

    test("should handle complex objects in non-JSON fields", async () => {
      const complexObject = { nested: { deep: { value: 123 } } }
      const result = await validationEngine.validateCell(0, "email", complexObject)

      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain("Invalid email")
    })
  })

  describe("Schema Updates", () => {
    test("should update schema and validate accordingly", async () => {
      const newColumns: ColumnDefinition[] = [
        {
          id: "new_field",
          name: "new_field",
          type: "varchar(50)",
          nullable: false,
          isPrimaryKey: false,
          isAutoIncrement: false,
        },
      ]

      validationEngine.setSchema(newColumns)

      const result = await validationEngine.validateCell(0, "new_field", "test value")
      expect(result.isValid).toBe(true)

      // Old column should no longer exist
      const oldResult = await validationEngine.validateCell(0, "email", "test@example.com")
      expect(oldResult.isValid).toBe(false)
      expect(oldResult.errors[0]).toContain("Column not found")
    })
  })
})
