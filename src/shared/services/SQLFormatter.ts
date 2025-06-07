import type { FormatOptions } from "../types/advanced-sql";

export class SQLFormatter {
  private keywords: Set<string>;
  private operators: Set<string>;
  private functions: Set<string>;

  constructor() {
    this.keywords = new Set([
      "SELECT",
      "FROM",
      "WHERE",
      "JOIN",
      "INNER",
      "LEFT",
      "RIGHT",
      "FULL",
      "OUTER",
      "CROSS",
      "ON",
      "USING",
      "GROUP",
      "BY",
      "HAVING",
      "ORDER",
      "LIMIT",
      "OFFSET",
      "DISTINCT",
      "ALL",
      "AS",
      "AND",
      "OR",
      "NOT",
      "IN",
      "EXISTS",
      "BETWEEN",
      "LIKE",
      "ILIKE",
      "IS",
      "NULL",
      "TRUE",
      "FALSE",
      "CASE",
      "WHEN",
      "THEN",
      "ELSE",
      "END",
      "INSERT",
      "INTO",
      "VALUES",
      "UPDATE",
      "SET",
      "DELETE",
      "CREATE",
      "ALTER",
      "DROP",
      "TABLE",
      "VIEW",
      "INDEX",
      "CONSTRAINT",
      "PRIMARY",
      "KEY",
      "FOREIGN",
      "REFERENCES",
      "UNIQUE",
      "DEFAULT",
      "CHECK",
      "UNION",
      "INTERSECT",
      "EXCEPT",
      "WITH",
      "RECURSIVE",
    ]);

    this.operators = new Set([
      "=",
      "!=",
      "<>",
      "<",
      ">",
      "<=",
      ">=",
      "+",
      "-",
      "*",
      "/",
      "%",
      "||",
    ]);

    this.functions = new Set([
      "COUNT",
      "SUM",
      "AVG",
      "MAX",
      "MIN",
      "CONCAT",
      "SUBSTRING",
      "LENGTH",
      "UPPER",
      "LOWER",
      "TRIM",
      "COALESCE",
      "NULLIF",
      "CAST",
      "CONVERT",
      "DATE",
      "DATETIME",
      "TIMESTAMP",
      "NOW",
      "CURRENT_DATE",
      "CURRENT_TIME",
      "CURRENT_TIMESTAMP",
    ]);
  }

  format(sql: string, options: FormatOptions = {}): string {
    const config = this.getDefaultOptions(options);

    try {
      const tokens = this.tokenize(sql);
      const formatted = this.formatTokens(tokens, config);
      return this.cleanupWhitespace(formatted);
    } catch (error) {
      // If formatting fails, return original SQL with basic cleanup
      console.warn("SQL formatting failed, returning original:", error);
      return this.basicCleanup(sql);
    }
  }

  private getDefaultOptions(options: FormatOptions): Required<FormatOptions> {
    return {
      keywordCase: options.keywordCase || "upper",
      indentSize: options.indentSize || 2,
      lineBreakBeforeKeywords: options.lineBreakBeforeKeywords ?? true,
      maxLineLength: options.maxLineLength || 120,
      commaPosition: options.commaPosition || "after",
      alignColumns: options.alignColumns ?? false,
      preserveComments: options.preserveComments ?? true,
    };
  }

  private tokenize(sql: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;

    while (i < sql.length) {
      const char = sql[i];

      // Skip whitespace
      if (/\s/.test(char)) {
        const whitespace = this.readWhitespace(sql, i);
        tokens.push({ type: "whitespace", value: whitespace.value });
        i = whitespace.newIndex;
        continue;
      }

      // Single line comment
      if (sql.substring(i, i + 2) === "--") {
        const comment = this.readSingleLineComment(sql, i);
        tokens.push({ type: "comment", value: comment.value });
        i = comment.newIndex;
        continue;
      }

      // Multi-line comment
      if (sql.substring(i, i + 2) === "/*") {
        const comment = this.readMultiLineComment(sql, i);
        tokens.push({ type: "comment", value: comment.value });
        i = comment.newIndex;
        continue;
      }

      // String literal
      if (char === "'" || char === '"') {
        const string = this.readString(sql, i, char);
        tokens.push({ type: "string", value: string.value });
        i = string.newIndex;
        continue;
      }

      // Numbers
      if (/\d/.test(char) || (char === "." && /\d/.test(sql[i + 1]))) {
        const number = this.readNumber(sql, i);
        tokens.push({ type: "number", value: number.value });
        i = number.newIndex;
        continue;
      }

      // Operators and punctuation
      if (this.isPunctuation(char)) {
        const operator = this.readOperator(sql, i);
        tokens.push({ type: "operator", value: operator.value });
        i = operator.newIndex;
        continue;
      }

      // Identifiers and keywords
      if (/[a-zA-Z_]/.test(char)) {
        const identifier = this.readIdentifier(sql, i);
        const upperValue = identifier.value.toUpperCase();

        if (this.keywords.has(upperValue)) {
          tokens.push({ type: "keyword", value: identifier.value });
        } else if (this.functions.has(upperValue)) {
          tokens.push({ type: "function", value: identifier.value });
        } else {
          tokens.push({ type: "identifier", value: identifier.value });
        }
        i = identifier.newIndex;
        continue;
      }

      // Unknown character, skip it
      i++;
    }

    return tokens;
  }

  private formatTokens(
    tokens: Token[],
    options: Required<FormatOptions>,
  ): string {
    let result = "";
    let indentLevel = 0;
    let needsNewLine = false;
    let needsIndent = false;
    let prevToken: Token | null = null;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const nextToken = tokens[i + 1];

      // Skip original whitespace except for comments
      if (token.type === "whitespace") {
        continue;
      }

      // Preserve comments
      if (token.type === "comment") {
        if (options.preserveComments) {
          if (needsNewLine) {
            result += "\n";
            needsNewLine = false;
            needsIndent = true;
          }
          if (needsIndent) {
            result += " ".repeat(indentLevel * options.indentSize);
            needsIndent = false;
          }
          result += token.value;
          if (token.value.startsWith("--")) {
            needsNewLine = true;
          }
        }
        continue;
      }

      // Handle indentation and line breaks
      if (needsNewLine) {
        result += "\n";
        needsNewLine = false;
        needsIndent = true;
      }

      if (needsIndent) {
        result += " ".repeat(indentLevel * options.indentSize);
        needsIndent = false;
      }

      // Process token based on type
      switch (token.type) {
        case "keyword":
          result += this.formatKeyword(token, options, prevToken);

          // Handle indentation for specific keywords
          if (this.isMainClauseKeyword(token.value)) {
            if (
              options.lineBreakBeforeKeywords &&
              prevToken &&
              prevToken.type !== "whitespace"
            ) {
              if (prevToken.type !== "operator" || prevToken.value !== "(") {
                needsNewLine = true;
              }
            }
          }

          // Increase indentation after certain keywords
          if (this.shouldIncreaseIndent(token.value)) {
            indentLevel++;
          }

          // Decrease indentation before certain keywords
          if (this.shouldDecreaseIndentBefore(token.value)) {
            indentLevel = Math.max(0, indentLevel - 1);
          }

          break;

        case "function":
          result += this.formatKeyword(token, options, prevToken);
          break;

        case "operator":
          result += this.formatOperator(token, prevToken, nextToken);

          if (token.value === "(") {
            indentLevel++;
          } else if (token.value === ")") {
            indentLevel = Math.max(0, indentLevel - 1);
          }

          break;

        case "identifier":
        case "string":
        case "number":
          result += this.formatLiteral(token, prevToken);
          break;

        default:
          result += token.value;
      }

      prevToken = token;
    }

    return result;
  }

  private formatKeyword(
    token: Token,
    options: Required<FormatOptions>,
    prevToken: Token | null,
  ): string {
    let value = token.value;

    // Apply case transformation
    switch (options.keywordCase) {
      case "upper":
        value = value.toUpperCase();
        break;
      case "lower":
        value = value.toLowerCase();
        break;
      case "preserve":
        // Keep original case
        break;
    }

    // Add space before if needed
    if (prevToken && !this.needsNoSpaceBefore(value, prevToken)) {
      value = ` ${value}`;
    }

    return value;
  }

  private formatOperator(
    token: Token,
    prevToken: Token | null,
    nextToken: Token | null,
  ): string {
    let value = token.value;

    // Add spaces around operators
    if (this.needsSpaceAround(value)) {
      if (
        prevToken &&
        !this.isWhitespace(prevToken) &&
        prevToken.value !== "("
      ) {
        value = ` ${value}`;
      }
      if (
        nextToken &&
        !this.isWhitespace(nextToken) &&
        nextToken.value !== ")"
      ) {
        value += " ";
      }
    } else if (value === ",") {
      // Handle comma spacing
      if (nextToken && !this.isWhitespace(nextToken)) {
        value += " ";
      }
    }

    return value;
  }

  private formatLiteral(token: Token, prevToken: Token | null): string {
    let value = token.value;

    // Add space before if needed
    if (prevToken && this.needsSpaceBefore(token, prevToken)) {
      value = ` ${value}`;
    }

    return value;
  }

  private cleanupWhitespace(sql: string): string {
    return sql
      .split("\n")
      .map((line) => line.trimEnd()) // Remove trailing spaces
      .join("\n")
      .replace(/\n{3,}/g, "\n\n") // Limit consecutive empty lines
      .trim();
  }

  private basicCleanup(sql: string): string {
    return sql
      .replace(/\s+/g, " ")
      .replace(/\s*([(),;])\s*/g, "$1 ")
      .replace(/\s+$/, "")
      .trim();
  }

  // Helper methods for tokenization
  private readWhitespace(
    sql: string,
    startIndex: number,
  ): { value: string; newIndex: number } {
    let i = startIndex;
    while (i < sql.length && /\s/.test(sql[i])) {
      i++;
    }
    return { value: sql.substring(startIndex, i), newIndex: i };
  }

  private readSingleLineComment(
    sql: string,
    startIndex: number,
  ): { value: string; newIndex: number } {
    let i = startIndex;
    while (i < sql.length && sql[i] !== "\n") {
      i++;
    }
    return { value: sql.substring(startIndex, i), newIndex: i };
  }

  private readMultiLineComment(
    sql: string,
    startIndex: number,
  ): { value: string; newIndex: number } {
    let i = startIndex + 2; // Skip /*
    while (i < sql.length - 1) {
      if (sql.substring(i, i + 2) === "*/") {
        i += 2;
        break;
      }
      i++;
    }
    return { value: sql.substring(startIndex, i), newIndex: i };
  }

  private readString(
    sql: string,
    startIndex: number,
    quote: string,
  ): { value: string; newIndex: number } {
    let i = startIndex + 1; // Skip opening quote
    while (i < sql.length) {
      if (sql[i] === quote) {
        if (sql[i + 1] === quote) {
          // Escaped quote
          i += 2;
        } else {
          // End of string
          i++;
          break;
        }
      } else {
        i++;
      }
    }
    return { value: sql.substring(startIndex, i), newIndex: i };
  }

  private readNumber(
    sql: string,
    startIndex: number,
  ): { value: string; newIndex: number } {
    let i = startIndex;
    let hasDecimal = false;

    while (i < sql.length) {
      const char = sql[i];
      if (/\d/.test(char)) {
        i++;
      } else if (char === "." && !hasDecimal) {
        hasDecimal = true;
        i++;
      } else {
        break;
      }
    }

    return { value: sql.substring(startIndex, i), newIndex: i };
  }

  private readOperator(
    sql: string,
    startIndex: number,
  ): { value: string; newIndex: number } {
    // Try two-character operators first
    const twoChar = sql.substring(startIndex, startIndex + 2);
    if (this.operators.has(twoChar)) {
      return { value: twoChar, newIndex: startIndex + 2 };
    }

    // Single character operator
    return { value: sql[startIndex], newIndex: startIndex + 1 };
  }

  private readIdentifier(
    sql: string,
    startIndex: number,
  ): { value: string; newIndex: number } {
    let i = startIndex;
    while (i < sql.length && /[a-zA-Z0-9_]/.test(sql[i])) {
      i++;
    }
    return { value: sql.substring(startIndex, i), newIndex: i };
  }

  // Helper methods for formatting logic
  private isPunctuation(char: string): boolean {
    return /[(),.;=<>!+\-*/%|]/.test(char);
  }

  private isMainClauseKeyword(keyword: string): boolean {
    const mainKeywords = [
      "SELECT",
      "FROM",
      "WHERE",
      "GROUP",
      "HAVING",
      "ORDER",
      "LIMIT",
      "UNION",
      "INTERSECT",
      "EXCEPT",
    ];
    return mainKeywords.includes(keyword.toUpperCase());
  }

  private shouldIncreaseIndent(keyword: string): boolean {
    const indentKeywords = [
      "SELECT",
      "FROM",
      "WHERE",
      "GROUP",
      "HAVING",
      "ORDER",
    ];
    return indentKeywords.includes(keyword.toUpperCase());
  }

  private shouldDecreaseIndentBefore(keyword: string): boolean {
    const dedentKeywords = [
      "FROM",
      "WHERE",
      "GROUP",
      "HAVING",
      "ORDER",
      "UNION",
      "INTERSECT",
      "EXCEPT",
    ];
    return dedentKeywords.includes(keyword.toUpperCase());
  }

  private needsNoSpaceBefore(keyword: string, prevToken: Token): boolean {
    // Check if specific keywords or previous tokens require no space
    return (
      prevToken.value === "(" ||
      prevToken.type === "operator" ||
      (keyword.toLowerCase() === "(" && prevToken.type === "function")
    );
  }

  private needsSpaceAround(operator: string): boolean {
    const spaceAroundOps = [
      "=",
      "!=",
      "<>",
      "<",
      ">",
      "<=",
      ">=",
      "+",
      "-",
      "*",
      "/",
      "%",
      "||",
      "AND",
      "OR",
    ];
    return spaceAroundOps.includes(operator.toUpperCase());
  }

  private needsSpaceBefore(token: Token, prevToken: Token): boolean {
    if (prevToken.type === "operator" && prevToken.value === "(") {
      return false;
    }
    if (token.type === "operator" && token.value === ")") {
      return false;
    }
    return prevToken.type !== "whitespace";
  }

  private isWhitespace(token: Token): boolean {
    return token.type === "whitespace";
  }
}

interface Token {
  type:
    | "keyword"
    | "identifier"
    | "operator"
    | "string"
    | "number"
    | "comment"
    | "whitespace"
    | "function";
  value: string;
}

export type { FormatOptions };
