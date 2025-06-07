// Advanced SQL AutoCompleter Types
export interface AutoCompleteResult {
  suggestions: CompletionSuggestion[];
  range?: {
    start: number;
    end: number;
  };
}

export interface CompletionSuggestion {
  text: string;
  type: "table" | "column" | "keyword" | "function" | "subquery" | "alias";
  detail?: string;
  documentation?: string;
  insertText?: string;
  priority: number;
}

export interface CompletionContext {
  sql: string;
  position: number;
  cursorPosition: number;
  database?: string;
}

// SQL Formatter Types
export interface FormatOptions {
  keywordCase?: "upper" | "lower" | "preserve";
  indentSize?: number;
  lineBreakBeforeKeywords?: boolean;
  maxLineLength?: number;
  commaPosition?: "before" | "after";
  alignColumns?: boolean;
  preserveComments?: boolean;
}

// Query History Types
export interface QueryHistoryEntry {
  id: string;
  sql: string;
  executedAt: Date;
  executionTime?: number;
  rowCount?: number;
  success: boolean;
  error?: string;
  database: string;
  connection: string;
  user: string;
  isFavorite: boolean;
}

export interface HistorySearchOptions {
  searchText?: string;
  startDate?: Date;
  endDate?: Date;
  minExecutionTime?: number;
  maxExecutionTime?: number;
  successOnly?: boolean;
  database?: string;
  limit?: number;
  offset?: number;
}

export interface QueryExecutionResult {
  rowCount?: number;
  executionTime?: number;
  success?: boolean;
  error?: string;
}

// Query Plan Types
export interface QueryPlan {
  query: string;
  databaseType: string;
  nodes: PlanNode[];
  totalCost: number;
  estimatedRows: number;
  actualRows?: number;
  executionTime?: number;
  planningTime?: number;
}

export interface PlanNode {
  id: string;
  operation: string;
  objectName?: string;
  condition?: string;
  cost: number;
  rows: number;
  actualRows?: number;
  executionTime?: number;
  relativeCost: number;
  children: PlanNode[];
  warnings: PlanWarning[];
}

export interface PlanWarning {
  type: "performance" | "index" | "statistics" | "syntax";
  severity: "low" | "medium" | "high";
  message: string;
  suggestion?: string;
}

export interface PlanTreeNode {
  node: PlanNode;
  children: PlanTreeNode[];
  depth: number;
  isLast: boolean;
}

// Bookmark Types
export interface QueryBookmark {
  id: string;
  name: string;
  sql: string;
  description: string;
  category: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  accessCount: number;
  lastAccessedAt?: Date;
}

export interface BookmarkSearchOptions {
  searchText?: string;
  category?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
  sortBy?: "name" | "createdAt" | "updatedAt" | "accessCount";
  sortOrder?: "asc" | "desc";
}

export interface BookmarkCategory {
  name: string;
  count: number;
  description?: string;
}

// SQL Analysis Types
export interface SQLAnalysisResult {
  statementType:
    | "SELECT"
    | "INSERT"
    | "UPDATE"
    | "DELETE"
    | "CREATE"
    | "ALTER"
    | "DROP"
    | "UNKNOWN";
  tables: string[];
  columns: string[];
  functions: string[];
  complexity: "low" | "medium" | "high";
  estimatedExecutionTime?: number;
  recommendations: string[];
}

// Advanced Features Configuration
export interface AdvancedSQLConfig {
  autoComplete: {
    enabled: boolean;
    maxSuggestions: number;
    includeKeywords: boolean;
    includeFunctions: boolean;
    includeTableColumns: boolean;
    fuzzyMatching: boolean;
  };
  formatter: {
    defaultOptions: FormatOptions;
    customKeywords: string[];
  };
  history: {
    enabled: boolean;
    maxEntries: number;
    retentionDays: number;
    trackExecutionTime: boolean;
    autoFavorite: {
      enabled: boolean;
      minExecutionTime: number;
      minUsageCount: number;
    };
  };
  queryPlan: {
    enabled: boolean;
    autoAnalyze: boolean;
    warningThresholds: {
      highCost: number;
      slowExecution: number;
      manyRows: number;
    };
  };
  bookmarks: {
    enabled: boolean;
    defaultCategory: string;
    autoGenerateNames: boolean;
    exportFormat: "json" | "sql" | "csv";
  };
}
