import type {
  CellValue,
  ColumnDefinition,
  CursorAIDefaultOptions,
  CursorAIPattern,
  CursorAISuggestion,
  CursorAITransformation,
  CursorAIValidation,
  ValidationResult,
} from "../types/datagrid"

export interface CursorAIResponse {
  suggestions?: Array<{
    column: string
    value: CellValue
    confidence: number
    reasoning?: string
  }>
  patterns?: CursorAIPattern[]
  metadata?: {
    processingTime: number
    model: string
    context: string
  }
}

interface ValidationApiResponse {
  issues?: string[]
  confidence?: number
  suggestions?: string[]
}

interface TransformationApiResponse {
  transformation?: (value: unknown) => CellValue
  preview?: Array<{ original: CellValue; transformed: CellValue }>
}

export interface CursorAIConfig {
  apiKey?: string
  model: string
  endpoint: string
  timeout: number
  retryAttempts: number
  cacheEnabled: boolean
  confidenceThreshold: number
}

export class CursorAIIntegration {
  private config: CursorAIConfig
  private cache: Map<string, unknown> = new Map()
  private rateLimiter: Map<string, number> = new Map()

  constructor(config?: Partial<CursorAIConfig>) {
    this.config = {
      model: "cursor-composer-v2",
      endpoint: "https://api.cursor.so/v1/composer",
      timeout: 10000,
      retryAttempts: 3,
      cacheEnabled: true,
      confidenceThreshold: 0.6,
      ...config,
    }
  }

  /**
   * Generate smart default values using Cursor AI
   */
  async generateDefaults(options: CursorAIDefaultOptions): Promise<Record<string, CellValue>> {
    const cacheKey = this.getCacheKey("defaults", options)

    if (this.config.cacheEnabled && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) as Record<string, CellValue>
    }

    try {
      const prompt = this.buildDefaultGenerationPrompt(options)
      const response = await this.callCursorAPI(prompt, "generate-defaults")

      const defaults: Record<string, CellValue> = {}

      const typedResponse = response as CursorAIResponse
      const suggestions = typedResponse.suggestions || []
      for (const suggestion of suggestions) {
        if (suggestion.confidence >= this.config.confidenceThreshold) {
          defaults[suggestion.column] = suggestion.value
        }
      }

      if (this.config.cacheEnabled) {
        this.cache.set(cacheKey, defaults)
      }

      return defaults
    } catch (error) {
      console.warn("Cursor AI generation failed, falling back to basic defaults:", error)
      return this.generateFallbackDefaults(options.columns || [])
    }
  }

  /**
   * Analyze data patterns in existing dataset
   */
  async analyzeDataPatterns(
    rows: Record<string, CellValue>[],
    columns: ColumnDefinition[]
  ): Promise<Record<string, CursorAIPattern>> {
    const cacheKey = this.getCacheKey("patterns", { rows: rows.slice(0, 5), columns })

    if (this.config.cacheEnabled && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) as Record<string, CursorAIPattern>
    }

    try {
      const prompt = this.buildPatternAnalysisPrompt(rows, columns)
      const _response = await this.callCursorAPI(prompt, "analyze-patterns")

      const patterns: Record<string, CursorAIPattern> = {}

      for (const column of columns) {
        const columnData = rows.map((row) => row[column.id]).filter((val) => val != null)
        patterns[column.id] = this.analyzeColumnPattern(columnData, column)
      }

      if (this.config.cacheEnabled) {
        this.cache.set(cacheKey, patterns)
      }

      return patterns
    } catch (error) {
      console.warn("Pattern analysis failed, using basic analysis:", error)
      return this.performBasicPatternAnalysis(rows, columns)
    }
  }

  /**
   * Get contextual suggestions while typing
   */
  async getContextualSuggestions(
    partialValue: string,
    columnId: string,
    existingData: Record<string, CellValue>[]
  ): Promise<string[]> {
    if (partialValue.length < 2) {
      return []
    }

    const cacheKey = this.getCacheKey("suggestions", { partialValue, columnId })

    if (this.config.cacheEnabled && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) as string[]
    }

    try {
      const prompt = this.buildSuggestionPrompt(partialValue, columnId, existingData)
      const response = await this.callCursorAPI(prompt, "get-suggestions")

      const typedResponse = response as CursorAIResponse
      const responseSuggestions = typedResponse.suggestions || []
      const suggestions = responseSuggestions
        .filter((s: { confidence: number }) => s.confidence >= this.config.confidenceThreshold)
        .map((s) => String(s.value))
        .slice(0, 10) // Limit to top 10 suggestions

      if (this.config.cacheEnabled) {
        this.cache.set(cacheKey, suggestions)
      }

      return suggestions
    } catch (error) {
      console.warn("Contextual suggestions failed, using basic completion:", error)
      return this.getBasicSuggestions(partialValue, columnId, existingData)
    }
  }

  /**
   * AI-powered data quality validation
   */
  async validateDataQuality(data: {
    rowIndex: number
    data: Record<string, CellValue>
  }): Promise<CursorAIValidation> {
    try {
      const prompt = this.buildValidationPrompt(data)
      const response = await this.callCursorAPI(prompt, "validate-quality")

      const typedResponse = response as ValidationApiResponse
      return {
        issues: typedResponse.issues || [],
        confidence: typedResponse.confidence || 0.5,
        suggestions: typedResponse.suggestions || [],
      }
    } catch (error) {
      console.warn("AI validation failed:", error)
      return {
        issues: [],
        confidence: 0,
        suggestions: [],
      }
    }
  }

  /**
   * Get intelligent auto-completion
   */
  async getAutoCompletions(
    input: string,
    columnId: string,
    existingData: Record<string, CellValue>[]
  ): Promise<string[]> {
    if (input.length < 1) {
      return []
    }

    try {
      // Extract unique values from existing data for this column
      const existingValues = [
        ...new Set(
          existingData
            .map((row) => row[columnId])
            .filter((val) => val != null && typeof val === "string")
            .map((val) => val as string)
        ),
      ]

      // Filter values that start with the input
      const matchingValues = existingValues
        .filter((value) => value.toLowerCase().startsWith(input.toLowerCase()))
        .slice(0, 5)

      // Get AI suggestions for additional completions
      const aiSuggestions = await this.getContextualSuggestions(input, columnId, existingData)

      // Combine and deduplicate
      const allSuggestions = [...new Set([...matchingValues, ...aiSuggestions])]

      return allSuggestions.slice(0, 8)
    } catch (error) {
      console.warn("Auto-completion failed:", error)
      return []
    }
  }

  /**
   * Suggest data transformations
   */
  async suggestTransformation(options: {
    sourceColumn: string
    targetColumn: string
    sampleData: CellValue[]
  }): Promise<CursorAITransformation> {
    try {
      const prompt = this.buildTransformationPrompt(options)
      const response = await this.callCursorAPI(prompt, "suggest-transformation")

      return {
        sourceColumn: options.sourceColumn,
        targetColumn: options.targetColumn,
        function:
          (response as TransformationApiResponse).transformation ||
          ((x: unknown) => x as CellValue),
        preview: ((response as TransformationApiResponse).preview || []).map((p) => p.transformed),
      }
    } catch (error) {
      console.warn("Transformation suggestion failed:", error)
      return {
        sourceColumn: options.sourceColumn,
        targetColumn: options.targetColumn,
        function: (x: unknown) => x as CellValue,
        preview: [],
      }
    }
  }

  /**
   * Private methods for API interaction
   */
  private async callCursorAPI(prompt: string, operation: string): Promise<Record<string, unknown>> {
    // Check rate limiting
    const now = Date.now()
    const lastCall = this.rateLimiter.get(operation) || 0
    const minInterval = 1000 // 1 second between calls

    if (now - lastCall < minInterval) {
      throw new Error("Rate limit exceeded")
    }

    this.rateLimiter.set(operation, now)

    // For now, return mock responses since we don't have actual Cursor AI API
    return this.getMockAIResponse(prompt, operation)
  }

  private getMockAIResponse(prompt: string, operation: string): Record<string, unknown> {
    // Mock implementation - in real scenario, this would call the actual Cursor AI API
    switch (operation) {
      case "generate-defaults":
        return {
          suggestions: [
            { column: "email", value: "user@company.com", confidence: 0.8 },
            { column: "name", value: "John Smith", confidence: 0.7 },
            { column: "age", value: 30, confidence: 0.6 },
          ],
        }

      case "analyze-patterns":
        return {
          patterns: {
            emailPattern: /.*@.*\.com$/,
            namePattern: /^[A-Z][a-z]+ [A-Z][a-z]+$/,
            ageRange: { min: 18, max: 65 },
          },
        }

      case "get-suggestions":
        if (prompt.includes("email")) {
          return {
            suggestions: [
              { value: "john.doe@company.com", confidence: 0.9 },
              { value: "jane.smith@company.com", confidence: 0.8 },
            ],
          }
        }
        return { suggestions: [] }

      case "validate-quality":
        return {
          issues: ["Age value seems unrealistic"],
          confidence: 0.8,
          suggestions: ["Consider values between 18-100"],
          severity: "warning",
        }

      case "suggest-transformation":
        return {
          transformation: (name: string) =>
            name
              .split(" ")
              .map((n) => n[0])
              .join("."),
          preview: ["J.D.", "J.S.", "B.J."],
          confidence: 0.9,
          description: "Convert full names to initials",
        }

      default:
        return { suggestions: [] }
    }
  }

  private buildDefaultGenerationPrompt(options: CursorAIDefaultOptions): string {
    const contextInfo = options.context || "Adding new record"
    const existingDataSample = (options.existingData || []).slice(0, 3)
    const columnInfo = (options.columns || []).map((col) => `${col.name} (${col.type})`).join(", ")

    return `
Generate smart default values for new database record.

Context: ${contextInfo}
Columns: ${columnInfo}
Sample existing data: ${JSON.stringify(existingDataSample, null, 2)}

Please suggest appropriate default values that:
1. Follow patterns in existing data
2. Are realistic and contextually appropriate
3. Respect data types and constraints
4. Maintain data consistency

Return suggestions with confidence scores.
    `.trim()
  }

  private buildPatternAnalysisPrompt(
    rows: Record<string, CellValue>[],
    columns: ColumnDefinition[]
  ): string {
    const sampleData = rows.slice(0, 10)

    return `
Analyze data patterns in this dataset:

Columns: ${columns.map((col) => `${col.name} (${col.type})`).join(", ")}
Sample data: ${JSON.stringify(sampleData, null, 2)}

Identify:
1. Data format patterns (email, phone, naming conventions)
2. Value ranges and distributions
3. Common prefixes, suffixes, or structures
4. Relationships between columns
5. Data quality issues

Return patterns with confidence scores.
    `.trim()
  }

  private buildSuggestionPrompt(
    partialValue: string,
    columnId: string,
    existingData: Record<string, CellValue>[]
  ): string {
    const columnData = existingData
      .map((row) => row[columnId])
      .filter((val) => val != null)
      .slice(0, 10)

    return `
Complete this partial value: "${partialValue}"
Column: ${columnId}
Existing values: ${JSON.stringify(columnData)}

Suggest completions that:
1. Match the partial input
2. Follow existing data patterns
3. Are contextually appropriate
4. Maintain consistency

Return top suggestions with confidence scores.
    `.trim()
  }

  private buildValidationPrompt(data: {
    rowIndex: number
    data: Record<string, CellValue>
  }): string {
    return `
Validate data quality for this record:
${JSON.stringify(data.data, null, 2)}

Check for:
1. Unrealistic values (age > 150, negative prices, etc.)
2. Inconsistent formats
3. Potential data entry errors
4. Missing relationships
5. Outliers

Return issues with severity levels and suggestions.
    `.trim()
  }

  private buildTransformationPrompt(options: {
    sourceColumn: string
    targetColumn: string
    sampleData: CellValue[]
  }): string {
    return `
Suggest transformation from ${options.sourceColumn} to ${options.targetColumn}:
Sample source data: ${JSON.stringify(options.sampleData.slice(0, 5))}

Analyze the pattern and suggest:
1. Transformation function
2. Preview of results
3. Confidence level
4. Description of transformation

Common transformations: extract initials, format phone numbers, standardize dates, etc.
    `.trim()
  }

  /**
   * Fallback methods when AI is unavailable
   */
  private generateFallbackDefaults(columns: ColumnDefinition[]): Record<string, CellValue> {
    const defaults: Record<string, CellValue> = {}

    for (const column of columns) {
      if (column.isAutoIncrement || column.isPrimaryKey) {
        continue
      }

      const columnName = column.name.toLowerCase()
      const columnType = column.type.toLowerCase()

      // Generate contextual defaults based on column name
      if (columnName.includes("email")) {
        defaults[column.id] = "user@example.com"
      } else if (columnName.includes("name")) {
        defaults[column.id] = "John Doe"
      } else if (columnName.includes("phone")) {
        defaults[column.id] = "555-0123"
      } else if (columnName.includes("age")) {
        defaults[column.id] = 25
      } else if (columnName.includes("date")) {
        defaults[column.id] = new Date().toISOString().split("T")[0]
      } else if (columnType.includes("int")) {
        defaults[column.id] = 0
      } else if (columnType.includes("bool")) {
        defaults[column.id] = false
      } else if (!column.nullable) {
        defaults[column.id] = ""
      }
    }

    return defaults
  }

  private performBasicPatternAnalysis(
    rows: Record<string, CellValue>[],
    columns: ColumnDefinition[]
  ): Record<string, CursorAIPattern> {
    const patterns: Record<string, CursorAIPattern> = {}

    for (const column of columns) {
      const values = rows.map((row) => row[column.id]).filter((val) => val != null)

      patterns[column.id] = {
        pattern: this.detectBasicPattern(values) as string,
        confidence: 0.5,
        examples: values.slice(0, 3) as string[],
      }
    }

    return patterns
  }

  private analyzeColumnPattern(data: CellValue[], _column: ColumnDefinition): CursorAIPattern {
    if (data.length === 0) {
      return { pattern: "", confidence: 0, examples: [] }
    }

    const stringData = data.filter((val) => typeof val === "string") as string[]

    if (stringData.length === 0) {
      return { pattern: "", confidence: 0.5, examples: data.slice(0, 3) as string[] }
    }

    // Detect email pattern
    if (stringData.every((val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val))) {
      return {
        pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
        confidence: 0.9,
        examples: stringData.slice(0, 3),
      }
    }

    // Detect name pattern
    if (stringData.every((val) => /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(val))) {
      return {
        pattern: "^[A-Z][a-z]+ [A-Z][a-z]+$",
        confidence: 0.8,
        examples: stringData.slice(0, 3),
      }
    }

    return {
      pattern: "",
      confidence: 0.3,
      examples: stringData.slice(0, 3),
    }
  }

  private detectBasicPattern(values: CellValue[]): string {
    if (values.length === 0) return ""

    const stringValues = values.filter((val) => typeof val === "string") as string[]

    if (stringValues.length === 0) return ""

    // Simple pattern detection
    if (stringValues.every((val) => val.includes("@"))) {
      return ".*@.*\\..*"
    }

    return ""
  }

  private getBasicSuggestions(
    partialValue: string,
    columnId: string,
    existingData: Record<string, CellValue>[]
  ): string[] {
    const columnValues = existingData
      .map((row) => row[columnId])
      .filter((val) => typeof val === "string") as string[]

    return columnValues
      .filter((val) => val.toLowerCase().startsWith(partialValue.toLowerCase()))
      .slice(0, 5)
  }

  private getCacheKey(operation: string, data: unknown): string {
    return `${operation}:${JSON.stringify(data)}`
  }

  /**
   * Cache and performance management
   */
  clearCache(): void {
    this.cache.clear()
  }

  getCacheStats(): { size: number; operations: string[] } {
    return {
      size: this.cache.size,
      operations: Array.from(this.cache.keys()).map((key) => key.split(":")[0]),
    }
  }

  updateConfig(newConfig: Partial<CursorAIConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }
}
