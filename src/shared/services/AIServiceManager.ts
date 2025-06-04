import type { CellValue, CursorAIDefaultOptions } from "../types/datagrid"
import type { DatabaseSchema } from "../types/sql"

export interface AIServiceInterface {
  generateDefaults(options: CursorAIDefaultOptions): Promise<Record<string, CellValue>>
  generateSQL(description: string, schema: DatabaseSchema): Promise<string>
  analyzeDataPatterns(data: Record<string, CellValue>[]): Promise<PatternAnalysis>
  suggestImprovements(
    data: Record<string, CellValue>[],
    schema: DatabaseSchema
  ): Promise<QualityReport>
  isAvailable(): Promise<boolean>
}

export interface PatternAnalysis {
  patterns: DataPattern[]
  confidence: number
  suggestions: string[]
}

export interface DataPattern {
  column: string
  type: "sequence" | "format" | "relationship" | "distribution"
  pattern: string
  examples: CellValue[]
  confidence: number
}

export interface QualityReport {
  issues: QualityIssue[]
  improvements: QualityImprovement[]
  score: number
}

export interface QualityIssue {
  type: "duplicate" | "inconsistent" | "missing" | "invalid" | "outlier"
  column: string
  rows: number[]
  description: string
  severity: "low" | "medium" | "high"
}

export interface QualityImprovement {
  type: "normalize" | "standardize" | "enrich" | "validate" | "deduplicate"
  column: string
  description: string
  example: string
  impact: "low" | "medium" | "high"
}

export interface AIServiceConfig {
  cursorAI: {
    enabled: boolean
    apiKey?: string
    endpoint: string
    timeout: number
    retryAttempts: number
  }
  githubCopilot: {
    enabled: boolean
    apiKey?: string
    endpoint: string
    timeout: number
    retryAttempts: number
  }
  fallbackStrategy: "disabled" | "github_copilot" | "local_only"
  cacheEnabled: boolean
  cacheTTL: number
}

export class CursorAIService implements AIServiceInterface {
  private config: AIServiceConfig["cursorAI"]
  private cache = new Map<string, { data: any; timestamp: number }>()

  constructor(config: AIServiceConfig["cursorAI"]) {
    this.config = config
  }

  async generateDefaults(options: CursorAIDefaultOptions): Promise<Record<string, CellValue>> {
    if (!this.config.enabled || !(await this.isAvailable())) {
      throw new Error("Cursor AI service not available")
    }

    const cacheKey = `defaults_${JSON.stringify(options)}`
    const cached = this.getFromCache(cacheKey)
    if (cached) return cached

    try {
      const prompt = this.buildDefaultsPrompt(options)
      const response = await this.callCursorAPI(prompt, "generate-defaults")

      const defaults = this.parseDefaultsResponse(response, options)
      this.setCache(cacheKey, defaults)

      return defaults
    } catch (error) {
      throw new Error(
        `Cursor AI default generation failed: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    }
  }

  async generateSQL(description: string, schema: DatabaseSchema): Promise<string> {
    if (!this.config.enabled || !(await this.isAvailable())) {
      throw new Error("Cursor AI service not available")
    }

    const cacheKey = `sql_${description}_${JSON.stringify(schema.tables.map((t) => t.name))}`
    const cached = this.getFromCache(cacheKey)
    if (cached) return cached

    try {
      const prompt = this.buildSQLPrompt(description, schema)
      const response = await this.callCursorAPI(prompt, "generate-sql")

      const sql = this.parseSQLResponse(response)
      this.setCache(cacheKey, sql)

      return sql
    } catch (error) {
      throw new Error(
        `Cursor AI SQL generation failed: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    }
  }

  async analyzeDataPatterns(data: Record<string, CellValue>[]): Promise<PatternAnalysis> {
    if (!this.config.enabled || !(await this.isAvailable())) {
      throw new Error("Cursor AI service not available")
    }

    try {
      const prompt = this.buildPatternAnalysisPrompt(data)
      const response = await this.callCursorAPI(prompt, "analyze-patterns")

      return this.parsePatternAnalysisResponse(response)
    } catch (error) {
      throw new Error(
        `Cursor AI pattern analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    }
  }

  async suggestImprovements(
    data: Record<string, CellValue>[],
    schema: DatabaseSchema
  ): Promise<QualityReport> {
    if (!this.config.enabled || !(await this.isAvailable())) {
      throw new Error("Cursor AI service not available")
    }

    try {
      const prompt = this.buildQualityPrompt(data, schema)
      const response = await this.callCursorAPI(prompt, "analyze-quality")

      return this.parseQualityResponse(response)
    } catch (error) {
      throw new Error(
        `Cursor AI quality analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.endpoint}/health`, {
        method: "GET",
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(5000),
      })
      return response.ok
    } catch {
      return false
    }
  }

  private async callCursorAPI(prompt: string, operation: string): Promise<any> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const response = await fetch(this.config.endpoint, {
          method: "POST",
          headers: this.getHeaders(),
          body: JSON.stringify({
            prompt,
            operation,
            parameters: {
              temperature: 0.7,
              max_tokens: 2000,
              model: "cursor-composer",
            },
          }),
          signal: AbortSignal.timeout(this.config.timeout),
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        return await response.json()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown error")

        if (attempt < this.config.retryAttempts) {
          // Exponential backoff
          const delay = Math.min(1000 * 2 ** (attempt - 1), 5000)
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    throw lastError || new Error("Failed to call Cursor API")
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "VSCode-Database-Extension/1.0",
    }

    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`
    }

    return headers
  }

  private buildDefaultsPrompt(options: CursorAIDefaultOptions): string {
    return `Generate realistic default values for database columns.

Context:
- Target columns: ${options.columns?.map((col) => col.name).join(", ") || "No columns specified"}
- Existing data samples: ${JSON.stringify(options.existingData?.slice(0, 3) || [])}
- Data patterns: ${options.context}

Requirements:
- Generate values that fit the data type and constraints
- Consider existing data patterns for consistency
- Ensure values are realistic and business-appropriate
- Return as JSON object with column names as keys

Example output:
{
  "email": "user123@example.com",
  "name": "John Smith",
  "age": 28
}`
  }

  private buildSQLPrompt(description: string, schema: DatabaseSchema): string {
    const tableInfo = schema.tables
      .map(
        (table) =>
          `Table: ${table.name}\nColumns: ${table.columns
            .map(
              (col) =>
                `${col.name} (${col.type}${col.nullable ? ", nullable" : ""}${col.isPrimaryKey ? ", PK" : ""})`
            )
            .join(", ")}`
      )
      .join("\n\n")

    return `Generate SQL query based on natural language description.

Database Schema:
${tableInfo}

Description: ${description}

Requirements:
- Generate valid SQL that matches the description
- Use proper table and column names from the schema
- Include appropriate WHERE clauses, JOINs, and ordering
- Optimize for performance when possible
- Return only the SQL query without explanation

Example output:
SELECT u.name, COUNT(o.id) as order_count 
FROM users u 
LEFT JOIN orders o ON u.id = o.user_id 
GROUP BY u.id, u.name 
ORDER BY order_count DESC`
  }

  private buildPatternAnalysisPrompt(data: Record<string, CellValue>[]): string {
    const sample = data.slice(0, 10)
    return `Analyze data patterns in the following dataset sample.

Data Sample:
${JSON.stringify(sample, null, 2)}

Identify:
- Data format patterns (email, phone, date formats, etc.)
- Sequence patterns (incremental IDs, timestamps)
- Relationship patterns between columns
- Distribution patterns (ranges, frequencies)

Return analysis as JSON with patterns array containing:
- column: column name
- type: pattern type
- pattern: pattern description
- examples: sample values
- confidence: 0-1 confidence score`
  }

  private buildQualityPrompt(data: Record<string, CellValue>[], schema: DatabaseSchema): string {
    const sample = data.slice(0, 20)
    return `Analyze data quality and suggest improvements.

Schema:
${JSON.stringify(schema.tables, null, 2)}

Data Sample:
${JSON.stringify(sample, null, 2)}

Identify:
- Data quality issues (duplicates, inconsistencies, missing values)
- Potential improvements (normalization, standardization)
- Data validation problems
- Outliers and anomalies

Return as JSON with:
- issues: array of quality issues with severity
- improvements: array of improvement suggestions
- score: overall quality score 0-100`
  }

  private parseDefaultsResponse(
    response: any,
    options: CursorAIDefaultOptions
  ): Record<string, CellValue> {
    try {
      if (response.defaults) {
        return response.defaults
      }

      // Try to parse from response content
      const content =
        response.content || response.choices?.[0]?.message?.content || response.response

      if (typeof content === "string") {
        // Extract JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0])
        }
      }

      throw new Error("Invalid response format")
    } catch (_error) {
      // Fallback to local generation
      return this.generateFallbackDefaults(options)
    }
  }

  private parseSQLResponse(response: any): string {
    try {
      if (response.sql) {
        return response.sql
      }

      const content =
        response.content || response.choices?.[0]?.message?.content || response.response

      if (typeof content === "string") {
        // Extract SQL from response
        const sqlMatch =
          content.match(/```sql\n([\s\S]*?)\n```/) || content.match(/SELECT[\s\S]*?;?$/)
        if (sqlMatch) {
          return sqlMatch[1] || sqlMatch[0]
        }
        return content.trim()
      }

      throw new Error("Invalid response format")
    } catch (_error) {
      throw new Error("Failed to parse SQL response")
    }
  }

  private parsePatternAnalysisResponse(response: any): PatternAnalysis {
    try {
      if (response.patterns) {
        return {
          patterns: response.patterns,
          confidence: response.confidence || 0.8,
          suggestions: response.suggestions || [],
        }
      }

      throw new Error("Invalid response format")
    } catch (_error) {
      return {
        patterns: [],
        confidence: 0,
        suggestions: ["Unable to analyze patterns at this time"],
      }
    }
  }

  private parseQualityResponse(response: any): QualityReport {
    try {
      if (response.issues && response.improvements) {
        return {
          issues: response.issues,
          improvements: response.improvements,
          score: response.score || 75,
        }
      }

      throw new Error("Invalid response format")
    } catch (_error) {
      return {
        issues: [],
        improvements: [],
        score: 0,
      }
    }
  }

  private generateFallbackDefaults(options: CursorAIDefaultOptions): Record<string, CellValue> {
    const defaults: Record<string, CellValue> = {}

    if (!options.columns) {
      return defaults
    }

    for (const column of options.columns) {
      const columnName = column.name.toLowerCase()
      if (columnName.includes("email")) {
        defaults[column.name] = `user${Date.now()}@example.com`
      } else if (columnName.includes("name")) {
        defaults[column.name] = "John Doe"
      } else if (columnName.includes("age")) {
        defaults[column.name] = Math.floor(Math.random() * 50) + 20
      } else if (columnName.includes("id")) {
        defaults[column.name] = Date.now()
      } else {
        defaults[column.name] = "Default Value"
      }
    }

    return defaults
  }

  private getFromCache(key: string): any {
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < 300000) {
      // 5 minutes
      return cached.data
    }
    return null
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() })
  }
}

export class GitHubCopilotService implements AIServiceInterface {
  private config: AIServiceConfig["githubCopilot"]

  constructor(config: AIServiceConfig["githubCopilot"]) {
    this.config = config
  }

  async generateDefaults(options: CursorAIDefaultOptions): Promise<Record<string, CellValue>> {
    if (!this.config.enabled || !(await this.isAvailable())) {
      throw new Error("GitHub Copilot service not available")
    }

    // GitHub Copilot implementation would go here
    // For now, return fallback implementation
    return this.generateFallbackDefaults(options)
  }

  async generateSQL(_description: string, _schema: DatabaseSchema): Promise<string> {
    if (!this.config.enabled || !(await this.isAvailable())) {
      throw new Error("GitHub Copilot service not available")
    }

    // GitHub Copilot SQL generation would go here
    throw new Error("GitHub Copilot SQL generation not yet implemented")
  }

  async analyzeDataPatterns(_data: Record<string, CellValue>[]): Promise<PatternAnalysis> {
    throw new Error("GitHub Copilot pattern analysis not supported")
  }

  async suggestImprovements(
    _data: Record<string, CellValue>[],
    _schema: DatabaseSchema
  ): Promise<QualityReport> {
    throw new Error("GitHub Copilot quality analysis not supported")
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Check GitHub Copilot API availability
      const response = await fetch(`${this.config.endpoint}/health`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "User-Agent": "VSCode-Database-Extension/1.0",
        },
        signal: AbortSignal.timeout(5000),
      })
      return response.ok
    } catch {
      return false
    }
  }

  private generateFallbackDefaults(options: CursorAIDefaultOptions): Record<string, CellValue> {
    const defaults: Record<string, CellValue> = {}

    if (!options.columns) {
      return defaults
    }

    for (const column of options.columns) {
      const columnName = column.name.toLowerCase()
      if (columnName.includes("email")) {
        defaults[column.name] = `copilot${Date.now()}@example.com`
      } else if (columnName.includes("name")) {
        defaults[column.name] = "Generated Name"
      } else {
        defaults[column.name] = null
      }
    }

    return defaults
  }
}

export class AIServiceManager {
  private cursorAI: CursorAIService
  private githubCopilot: GitHubCopilotService
  private config: AIServiceConfig

  constructor(config: AIServiceConfig) {
    this.config = config
    this.cursorAI = new CursorAIService(config.cursorAI)
    this.githubCopilot = new GitHubCopilotService(config.githubCopilot)
  }

  async generateDefaults(options: CursorAIDefaultOptions): Promise<Record<string, CellValue>> {
    try {
      return await this.cursorAI.generateDefaults(options)
    } catch (cursorError) {
      console.warn("Cursor AI failed, attempting fallback:", cursorError)

      if (this.config.fallbackStrategy === "github_copilot") {
        try {
          return await this.githubCopilot.generateDefaults(options)
        } catch (copilotError) {
          console.warn("GitHub Copilot failed:", copilotError)
        }
      }

      if (
        this.config.fallbackStrategy === "local_only" ||
        this.config.fallbackStrategy === "github_copilot"
      ) {
        return this.generateLocalDefaults(options)
      }

      throw cursorError
    }
  }

  async generateSQL(description: string, schema: DatabaseSchema): Promise<string> {
    try {
      return await this.cursorAI.generateSQL(description, schema)
    } catch (cursorError) {
      console.warn("Cursor AI SQL generation failed, attempting fallback:", cursorError)

      if (this.config.fallbackStrategy === "github_copilot") {
        try {
          return await this.githubCopilot.generateSQL(description, schema)
        } catch (copilotError) {
          console.warn("GitHub Copilot SQL generation failed:", copilotError)
        }
      }

      throw cursorError
    }
  }

  async analyzeDataPatterns(data: Record<string, CellValue>[]): Promise<PatternAnalysis> {
    try {
      return await this.cursorAI.analyzeDataPatterns(data)
    } catch (_error) {
      return {
        patterns: [],
        confidence: 0,
        suggestions: ["Pattern analysis currently unavailable"],
      }
    }
  }

  async suggestImprovements(
    data: Record<string, CellValue>[],
    schema: DatabaseSchema
  ): Promise<QualityReport> {
    try {
      return await this.cursorAI.suggestImprovements(data, schema)
    } catch (_error) {
      return {
        issues: [],
        improvements: [],
        score: 0,
      }
    }
  }

  async getServiceStatus(): Promise<{
    cursorAI: boolean
    githubCopilot: boolean
    activeService: string
  }> {
    const [cursorAvailable, copilotAvailable] = await Promise.all([
      this.cursorAI.isAvailable(),
      this.githubCopilot.isAvailable(),
    ])

    let activeService = "none"
    if (cursorAvailable) {
      activeService = "cursor"
    } else if (copilotAvailable && this.config.fallbackStrategy === "github_copilot") {
      activeService = "copilot"
    } else if (this.config.fallbackStrategy === "local_only") {
      activeService = "local"
    }

    return {
      cursorAI: cursorAvailable,
      githubCopilot: copilotAvailable,
      activeService,
    }
  }

  private generateLocalDefaults(options: CursorAIDefaultOptions): Record<string, CellValue> {
    const defaults: Record<string, CellValue> = {}

    if (!options.columns) {
      return defaults
    }

    for (const column of options.columns) {
      const lower = column.name.toLowerCase()

      if (lower.includes("email")) {
        defaults[column.name] = `local${Date.now()}@example.com`
      } else if (lower.includes("name") || lower.includes("title")) {
        defaults[column.name] = "Local Generated"
      } else if (lower.includes("age") || lower.includes("count")) {
        defaults[column.name] = Math.floor(Math.random() * 100)
      } else if (lower.includes("date") || lower.includes("time")) {
        defaults[column.name] = new Date().toISOString()
      } else if (lower.includes("id") || lower.includes("uuid")) {
        defaults[column.name] = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      } else if (lower.includes("active") || lower.includes("enabled")) {
        defaults[column.name] = Math.random() > 0.5
      } else {
        defaults[column.name] = "Generated Value"
      }
    }

    return defaults
  }
}
