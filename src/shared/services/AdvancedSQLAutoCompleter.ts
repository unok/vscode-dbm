import type {
  AdvancedSQLConfig,
  AutoCompleteResult,
  CompletionContext,
  CompletionSuggestion,
} from "../types/advanced-sql";
import type { DatabaseSchema } from "../types/sql";

export class AdvancedSQLAutoCompleter {
  private schema: DatabaseSchema;
  private config: AdvancedSQLConfig["autoComplete"];
  private keywords: string[];
  private functions: string[];

  constructor(
    schema: DatabaseSchema,
    config: AdvancedSQLConfig["autoComplete"] = {
      enabled: true,
      maxSuggestions: 50,
      includeKeywords: true,
      includeFunctions: true,
      includeTableColumns: true,
      fuzzyMatching: true,
    },
  ) {
    this.schema = schema;
    this.config = config;
    this.keywords = this.getDefaultKeywords();
    this.functions = (schema.functions || []).map((f) =>
      typeof f === "string" ? f : f.name,
    );
  }

  async getCompletions(
    context: CompletionContext,
  ): Promise<AutoCompleteResult> {
    if (!this.config.enabled) {
      return { suggestions: [] };
    }

    const suggestions: CompletionSuggestion[] = [];
    const sqlContext = this.analyzeSQLContext(context);

    // Get completions based on context
    if (sqlContext.expectingTable) {
      suggestions.push(...this.getTableSuggestions());
    }

    if (sqlContext.expectingColumn) {
      suggestions.push(...this.getColumnSuggestions(sqlContext.tableAlias));
    }

    if (sqlContext.expectingKeyword) {
      if (this.config.includeKeywords) {
        suggestions.push(...this.getKeywordSuggestions(context));
      }
    }

    if (sqlContext.expectingFunction) {
      if (this.config.includeFunctions) {
        suggestions.push(...this.getFunctionSuggestions());
      }
    }

    if (sqlContext.expectingJoin) {
      suggestions.push(...this.getJoinSuggestions());
    }

    if (sqlContext.expectingSubquery) {
      suggestions.push(...this.getSubquerySuggestions());
    }

    // Filter and rank suggestions
    const filtered = this.filterSuggestions(suggestions, context);
    const ranked = this.rankSuggestions(filtered, context);

    return {
      suggestions: ranked.slice(0, this.config.maxSuggestions),
      range: this.getReplacementRange(context),
    };
  }

  private analyzeSQLContext(context: CompletionContext): SqlContext {
    const sql = context.sql.toLowerCase();
    const beforeCursor = sql.substring(0, context.position).trim();
    const afterCursor = sql.substring(context.position).trim();

    const tokens = this.tokenize(beforeCursor);
    const lastToken = tokens[tokens.length - 1] || "";
    const secondLastToken = tokens[tokens.length - 2] || "";

    return {
      expectingTable: this.isExpectingTable(tokens),
      expectingColumn: this.isExpectingColumn(tokens),
      expectingKeyword: this.isExpectingKeyword(tokens),
      expectingFunction: this.isExpectingFunction(tokens),
      expectingJoin: this.isExpectingJoin(tokens),
      expectingSubquery: this.isExpectingSubquery(tokens),
      tableAlias: this.getCurrentTableAlias(tokens),
      lastToken,
      secondLastToken,
      tokens,
      beforeCursor,
      afterCursor,
    };
  }

  private isExpectingTable(tokens: string[]): boolean {
    const lastToken = tokens[tokens.length - 1]?.toLowerCase();
    const secondLastToken = tokens[tokens.length - 2]?.toLowerCase();

    return (
      lastToken === "from" ||
      lastToken === "join" ||
      lastToken === "update" ||
      lastToken === "into" ||
      (secondLastToken === "inner" && lastToken === "join") ||
      (secondLastToken === "left" && lastToken === "join") ||
      (secondLastToken === "right" && lastToken === "join") ||
      (secondLastToken === "full" && lastToken === "join")
    );
  }

  private isExpectingColumn(tokens: string[]): boolean {
    const lastToken = tokens[tokens.length - 1]?.toLowerCase();
    const secondLastToken = tokens[tokens.length - 2]?.toLowerCase();

    // After SELECT
    if (
      lastToken === "select" ||
      (lastToken === "distinct" && secondLastToken === "select")
    ) {
      return true;
    }

    // After comma in SELECT
    if (this.isInSelectList(tokens)) {
      return true;
    }

    // After table alias with dot
    if (lastToken?.endsWith(".")) {
      return true;
    }

    // After WHERE, HAVING, ORDER BY, GROUP BY
    return (
      lastToken === "where" ||
      lastToken === "having" ||
      lastToken === "by" ||
      lastToken === "on" ||
      (secondLastToken === "order" && lastToken === "by") ||
      (secondLastToken === "group" && lastToken === "by")
    );
  }

  private isExpectingKeyword(tokens: string[]): boolean {
    if (tokens.length === 0) return true;

    const lastToken = tokens[tokens.length - 1]?.toLowerCase();

    // Check if we're at the start of a new clause
    return (
      !lastToken ||
      this.isCompleteClause(tokens) ||
      lastToken === "select" ||
      lastToken === "from" ||
      lastToken === "where" ||
      lastToken === "group" ||
      lastToken === "having" ||
      lastToken === "order" ||
      lastToken === "limit"
    );
  }

  private isExpectingFunction(tokens: string[]): boolean {
    const lastToken = tokens[tokens.length - 1]?.toLowerCase();

    // After SELECT or in expression context
    return (
      lastToken === "select" ||
      lastToken === "(" ||
      this.isInSelectList(tokens) ||
      this.isInWhereClause(tokens)
    );
  }

  private isExpectingJoin(tokens: string[]): boolean {
    // Look for FROM clause completion
    return this.hasFromClause(tokens) && !this.hasWhereClause(tokens);
  }

  private isExpectingSubquery(tokens: string[]): boolean {
    const lastToken = tokens[tokens.length - 1]?.toLowerCase();
    return lastToken === "(" && this.isInWhereClause(tokens);
  }

  private getCurrentTableAlias(tokens: string[]): string | undefined {
    const lastToken = tokens[tokens.length - 1]?.toLowerCase();

    if (lastToken?.endsWith(".")) {
      return lastToken.slice(0, -1);
    }

    // Look for table aliases in FROM/JOIN clauses
    for (let i = tokens.length - 1; i >= 0; i--) {
      const token = tokens[i]?.toLowerCase();
      if (token === "from" || token === "join") {
        // Look for alias after table name
        if (i + 2 < tokens.length) {
          const potentialAlias = tokens[i + 2];

          if (!this.isKeyword(potentialAlias)) {
            return potentialAlias;
          }
        }
      }
    }

    return undefined;
  }

  private getTableSuggestions(): CompletionSuggestion[] {
    return this.schema.tables.map((table) => ({
      text: table.name,
      type: "table" as const,
      detail: `Table with ${table.columns.length} columns`,
      documentation: this.getTableDocumentation(table.name),
      priority: 10,
    }));
  }

  private getColumnSuggestions(tableAlias?: string): CompletionSuggestion[] {
    const suggestions: CompletionSuggestion[] = [];

    if (tableAlias) {
      // Find table by alias
      const table = this.findTableByAlias(tableAlias);
      if (table) {
        suggestions.push(
          ...table.columns.map((column) => ({
            text: column.name,
            type: "column" as const,
            detail: `${column.type}${column.nullable ? " | nullable" : ""}`,
            documentation: this.getColumnDocumentation(table.name, column.name),
            priority: 15,
          })),
        );
      }
    } else {
      // Include all columns with table prefix
      for (const table of this.schema.tables) {
        suggestions.push(
          ...table.columns.map((column) => ({
            text: `${table.name}.${column.name}`,
            type: "column" as const,
            detail: `${table.name}.${column.name} (${column.type})`,
            documentation: this.getColumnDocumentation(table.name, column.name),
            priority: 8,
          })),
        );
      }
    }

    return suggestions;
  }

  private getKeywordSuggestions(
    context: CompletionContext,
  ): CompletionSuggestion[] {
    const sqlContext = this.analyzeSQLContext(context);

    return this.keywords
      .filter((keyword) => this.isKeywordRelevant(keyword, sqlContext))
      .map((keyword) => ({
        text: keyword,
        type: "keyword" as const,
        detail: "SQL Keyword",
        documentation: this.getKeywordDocumentation(keyword),
        priority: 5,
      }));
  }

  private getFunctionSuggestions(): CompletionSuggestion[] {
    return this.functions.map((func) => ({
      text: func,
      type: "function" as const,
      detail: "SQL Function",
      insertText: this.getFunctionTemplate(func),
      documentation: this.getFunctionDocumentation(func),
      priority: 12,
    }));
  }

  private getJoinSuggestions(): CompletionSuggestion[] {
    const suggestions: CompletionSuggestion[] = [];

    // Basic JOIN types
    const joinTypes = [
      "INNER JOIN",
      "LEFT JOIN",
      "RIGHT JOIN",
      "FULL OUTER JOIN",
      "CROSS JOIN",
    ];

    for (const joinType of joinTypes) {
      suggestions.push({
        text: joinType,
        type: "keyword" as const,
        detail: "JOIN clause",
        insertText: `${joinType} ${this.getJoinTemplate()}`,
        documentation: this.getJoinDocumentation(joinType),
        priority: 11,
      });
    }

    return suggestions;
  }

  private getSubquerySuggestions(): CompletionSuggestion[] {
    return [
      {
        text: "SELECT",
        type: "subquery" as const,
        detail: "Subquery",
        insertText: "SELECT ${1:columns} FROM ${2:table}",
        documentation: "Start a subquery",
        priority: 9,
      },
    ];
  }

  private filterSuggestions(
    suggestions: CompletionSuggestion[],
    context: CompletionContext,
  ): CompletionSuggestion[] {
    if (!context.sql) return suggestions;

    const currentWord = this.getCurrentWord(context);
    if (!currentWord) return suggestions;

    if (this.config.fuzzyMatching) {
      return suggestions.filter((suggestion) =>
        this.fuzzyMatch(
          suggestion.text.toLowerCase(),
          currentWord.toLowerCase(),
        ),
      );
    }
    return suggestions.filter((suggestion) =>
      suggestion.text.toLowerCase().startsWith(currentWord.toLowerCase()),
    );
  }

  private rankSuggestions(
    suggestions: CompletionSuggestion[],
    context: CompletionContext,
  ): CompletionSuggestion[] {
    const currentWord = this.getCurrentWord(context);

    return suggestions.sort((a, b) => {
      // Primary sort by priority
      const priorityDiff = b.priority - a.priority;

      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      // Secondary sort by relevance to current word
      if (currentWord) {
        const aRelevance = this.calculateRelevance(a.text, currentWord);
        const bRelevance = this.calculateRelevance(b.text, currentWord);
        return bRelevance - aRelevance;
      }

      // Tertiary sort alphabetically
      return a.text.localeCompare(b.text);
    });
  }

  private getReplacementRange(
    context: CompletionContext,
  ): { start: number; end: number } | undefined {
    const currentWord = this.getCurrentWord(context);
    if (!currentWord) return undefined;

    const start = context.position - currentWord.length;
    const end = context.position;

    return { start, end };
  }

  private getCurrentWord(context: CompletionContext): string {
    const beforeCursor = context.sql.substring(0, context.position);
    const match = beforeCursor.match(/[a-zA-Z_][a-zA-Z0-9_]*$/);
    return match ? match[0] : "";
  }

  private tokenize(sql: string): string[] {
    return sql
      .replace(/[(),;]/g, " $& ")
      .split(/\s+/)
      .filter((token) => token.trim().length > 0);
  }

  private isCompleteClause(tokens: string[]): boolean {
    // Check if the current tokens form a complete SQL clause
    const clauseKeywords = [
      "select",
      "from",
      "where",
      "group",
      "having",
      "order",
      "limit",
    ];
    const lastKeywordIndex = this.findLastKeywordIndex(tokens, clauseKeywords);

    if (lastKeywordIndex === -1) return false;

    const tokensAfterKeyword = tokens.slice(lastKeywordIndex + 1);
    return (
      tokensAfterKeyword.length > 0 &&
      !tokensAfterKeyword.some((token) => this.isKeyword(token))
    );
  }

  private isInSelectList(tokens: string[]): boolean {
    const selectIndex = this.findLastIndex(tokens, "select");
    const fromIndex = this.findLastIndex(tokens, "from");

    return selectIndex !== -1 && (fromIndex === -1 || selectIndex > fromIndex);
  }

  private isInWhereClause(tokens: string[]): boolean {
    const whereIndex = this.findLastIndex(tokens, "where");
    const orderIndex = this.findLastIndex(tokens, "order");
    const groupIndex = this.findLastIndex(tokens, "group");

    return (
      whereIndex !== -1 &&
      (orderIndex === -1 || whereIndex > orderIndex) &&
      (groupIndex === -1 || whereIndex > groupIndex)
    );
  }

  private hasFromClause(tokens: string[]): boolean {
    return tokens.some((token) => token.toLowerCase() === "from");
  }

  private hasWhereClause(tokens: string[]): boolean {
    return tokens.some((token) => token.toLowerCase() === "where");
  }

  private findTableByAlias(
    alias: string,
  ): DatabaseSchema["tables"][0] | undefined {
    // In a real implementation, this would track table aliases from the query
    // For now, return the first table that could match
    return this.schema.tables.find(
      (table) => table.name.toLowerCase() === alias.toLowerCase(),
    );
  }

  private isKeyword(token: string): boolean {
    return this.keywords.includes(token.toUpperCase());
  }

  private isKeywordRelevant(keyword: string, context: SqlContext): boolean {
    // Filter keywords based on context
    const lowerKeyword = keyword.toLowerCase();

    if (context.expectingTable) {
      return false; // Don't suggest keywords when expecting table names
    }

    if (context.lastToken === "select" && lowerKeyword === "from") {
      return false; // Don't suggest FROM immediately after SELECT without columns
    }

    return true;
  }

  private fuzzyMatch(text: string, pattern: string): boolean {
    let patternIndex = 0;
    for (let i = 0; i < text.length && patternIndex < pattern.length; i++) {
      if (text[i] === pattern[patternIndex]) {
        patternIndex++;
      }
    }
    return patternIndex === pattern.length;
  }

  private calculateRelevance(text: string, currentWord: string): number {
    const lowerText = text.toLowerCase();
    const lowerWord = currentWord.toLowerCase();

    if (lowerText === lowerWord) return 100;
    if (lowerText.startsWith(lowerWord)) return 80;
    if (lowerText.includes(lowerWord)) return 60;

    // Calculate fuzzy match score
    let score = 0;
    let wordIndex = 0;
    for (let i = 0; i < lowerText.length && wordIndex < lowerWord.length; i++) {
      if (lowerText[i] === lowerWord[wordIndex]) {
        score += 1;
        wordIndex++;
      }
    }

    return (score / lowerWord.length) * 40;
  }

  private findLastIndex(tokens: string[], target: string): number {
    for (let i = tokens.length - 1; i >= 0; i--) {
      if (tokens[i].toLowerCase() === target) {
        return i;
      }
    }
    return -1;
  }

  private findLastKeywordIndex(tokens: string[], keywords: string[]): number {
    for (let i = tokens.length - 1; i >= 0; i--) {
      if (keywords.includes(tokens[i].toLowerCase())) {
        return i;
      }
    }
    return -1;
  }

  private getDefaultKeywords(): string[] {
    return [
      "SELECT",
      "FROM",
      "WHERE",
      "JOIN",
      "INNER JOIN",
      "LEFT JOIN",
      "RIGHT JOIN",
      "FULL OUTER JOIN",
      "ON",
      "GROUP BY",
      "HAVING",
      "ORDER BY",
      "LIMIT",
      "OFFSET",
      "DISTINCT",
      "AS",
      "AND",
      "OR",
      "NOT",
      "NULL",
      "IS",
      "IS NOT",
      "IN",
      "EXISTS",
      "BETWEEN",
      "LIKE",
      "ILIKE",
      "CASE",
      "WHEN",
      "THEN",
      "ELSE",
      "END",
      "INSERT",
      "UPDATE",
      "DELETE",
      "CREATE",
      "ALTER",
      "DROP",
      "INDEX",
      "VIEW",
      "PROCEDURE",
      "FUNCTION",
      "TRIGGER",
    ];
  }

  private getTableDocumentation(tableName: string): string {
    return `Table: ${tableName}`;
  }

  private getColumnDocumentation(
    tableName: string,
    columnName: string,
  ): string {
    return `Column: ${tableName}.${columnName}`;
  }

  private getKeywordDocumentation(keyword: string): string {
    const docs: Record<string, string> = {
      SELECT: "Retrieve data from one or more tables",
      FROM: "Specify the source table(s) for the query",
      WHERE: "Filter rows based on specified conditions",
      JOIN: "Combine rows from multiple tables",
      "GROUP BY": "Group rows that have the same values in specified columns",
      "ORDER BY": "Sort the result set by one or more columns",
    };
    return docs[keyword] || `SQL keyword: ${keyword}`;
  }

  private getFunctionDocumentation(functionName: string): string {
    const docs: Record<string, string> = {
      COUNT: "Count the number of rows",
      SUM: "Calculate the sum of values",
      AVG: "Calculate the average of values",
      MAX: "Find the maximum value",
      MIN: "Find the minimum value",
      CONCAT: "Concatenate strings",
      UPPER: "Convert string to uppercase",
      LOWER: "Convert string to lowercase",
    };
    return docs[functionName] || `SQL function: ${functionName}`;
  }

  private getFunctionTemplate(functionName: string): string {
    const templates: Record<string, string> = {
      COUNT: "COUNT(${1:*})",
      SUM: "SUM(${1:column})",
      AVG: "AVG(${1:column})",
      MAX: "MAX(${1:column})",
      MIN: "MIN(${1:column})",
      CONCAT: "CONCAT(${1:string1}, ${2:string2})",
      UPPER: "UPPER(${1:string})",
      LOWER: "LOWER(${1:string})",
    };
    return templates[functionName] || `${functionName}(\${1:})`;
  }

  private getJoinTemplate(): string {
    return "${1:table} ON ${2:condition}";
  }

  private getJoinDocumentation(joinType: string): string {
    const docs: Record<string, string> = {
      "INNER JOIN": "Return only rows that have matching values in both tables",
      "LEFT JOIN":
        "Return all rows from the left table and matching rows from the right",
      "RIGHT JOIN":
        "Return all rows from the right table and matching rows from the left",
      "FULL OUTER JOIN":
        "Return all rows when there is a match in either table",
      "CROSS JOIN": "Return the Cartesian product of both tables",
    };
    return docs[joinType] || `JOIN type: ${joinType}`;
  }
}

interface SqlContext {
  expectingTable: boolean;
  expectingColumn: boolean;
  expectingKeyword: boolean;
  expectingFunction: boolean;
  expectingJoin: boolean;
  expectingSubquery: boolean;
  tableAlias?: string;
  lastToken: string;
  secondLastToken: string;
  tokens: string[];
  beforeCursor: string;
  afterCursor: string;
}

export type { AutoCompleteResult, CompletionSuggestion, CompletionContext };
