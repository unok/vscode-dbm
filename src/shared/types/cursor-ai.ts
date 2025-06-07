/**
 * Cursor AI API レスポンスの型定義
 * 注：公式型定義がないため、観測されたレスポンスから推測
 */

export interface CursorAISuggestion {
  column?: string
  field?: string
  value?: unknown
  default?: unknown
  confidence?: number
  score?: number
  reasoning?: string
  explanation?: string
}

export interface CursorAICompletion {
  text?: string
  value?: string
  confidence?: number
  score?: number
}

export interface CursorAIDefaultsResponse {
  suggestions?: CursorAISuggestion[]
  metadata?: Record<string, unknown>
}

export interface CursorAIPatternsResponse {
  patterns?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface CursorAICompletionsResponse {
  completions?: CursorAICompletion[]
  metadata?: Record<string, unknown>
}

export interface CursorAIValidationResponse {
  validation?: {
    isValid?: boolean
    errorMessage?: string
    suggestions?: string[]
    confidence?: number
    issues?: unknown[]
    severity?: string
  }
  metadata?: Record<string, unknown>
}

export interface CursorAITransformationResponse {
  transformation?: {
    type?: string
    steps?: string[]
    confidence?: number
    result?: unknown
    code?: string
    preview?: unknown[]
    description?: string
  }
  metadata?: Record<string, unknown>
}

export type CursorAIResponse =
  | CursorAIDefaultsResponse
  | CursorAIPatternsResponse
  | CursorAICompletionsResponse
  | CursorAIValidationResponse
  | CursorAITransformationResponse
  | Record<string, unknown> // フォールバック型
