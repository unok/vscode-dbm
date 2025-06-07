import type {
  CellValue,
  ColumnDefinition,
  ValidationResult,
  ValidationRule,
} from "../types/datagrid";

export interface ValidationContext {
  row: Record<string, CellValue>;
  rowIndex: number;
  allRows?: Record<string, CellValue>[];
}

export class CellValidationEngine {
  private schema: ColumnDefinition[] = [];
  private customRules: Map<string, ValidationRule[]> = new Map();
  private validationCache: Map<string, ValidationResult> = new Map();

  setSchema(columns: ColumnDefinition[]): void {
    this.schema = columns;
    this.validationCache.clear(); // Clear cache when schema changes
  }

  addCustomRule(columnId: string, rule: ValidationRule): void {
    if (!this.customRules.has(columnId)) {
      this.customRules.set(columnId, []);
    }
    this.customRules.get(columnId)?.push(rule);
  }

  removeCustomRule(columnId: string, ruleType: string): void {
    const rules = this.customRules.get(columnId);
    if (rules) {
      const filtered = rules.filter((rule) => rule.type !== ruleType);
      this.customRules.set(columnId, filtered);
    }
  }

  async validateValue(
    value: CellValue,
    column: ColumnDefinition,
    context?: ValidationContext,
  ): Promise<ValidationResult> {
    const cacheKey = this.getCacheKey(value, column, context);

    // Check cache first for expensive validations
    if (this.validationCache.has(cacheKey)) {
      const cached = this.validationCache.get(cacheKey);
      return (
        cached ?? { isValid: false, errors: ["Cache error"], warnings: [] }
      );
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Basic null/undefined validation
      if (value === null || value === undefined || value === "") {
        if (!column.nullable) {
          errors.push(`${column.name} cannot be null or empty`);
        }
      } else {
        // Type-specific validation
        const typeValidation = await this.validateDataType(value, column);
        errors.push(...typeValidation.errors);
        warnings.push(...typeValidation.warnings);

        // Length validation
        const lengthValidation = this.validateLength(value, column);
        errors.push(...lengthValidation.errors);
        warnings.push(...lengthValidation.warnings);

        // Format validation
        const formatValidation = this.validateFormat(value, column);
        errors.push(...formatValidation.errors);
        warnings.push(...formatValidation.warnings);

        // Business logic validation
        if (context) {
          const businessValidation = await this.validateBusinessLogic(
            value,
            column,
            context,
          );
          errors.push(...businessValidation.errors);
          warnings.push(...businessValidation.warnings);
        }

        // Custom rules validation
        const customValidation = await this.validateCustomRules(
          value,
          column,
          context,
        );
        errors.push(...customValidation.errors);
        warnings.push(...customValidation.warnings);
      }

      const result: ValidationResult = {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions: await this.getSuggestions(value, column, errors),
      };

      // Cache the result
      this.validationCache.set(cacheKey, result);

      return result;
    } catch (error) {
      const result: ValidationResult = {
        isValid: false,
        errors: [
          `Validation error: ${error instanceof Error ? error.message : "Unknown error"}`,
        ],
        warnings: [],
      };

      return result;
    }
  }

  private async validateDataType(
    value: CellValue,
    column: ColumnDefinition,
  ): Promise<{ errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const columnType = column.type.toLowerCase();

    switch (true) {
      case columnType.includes("int"):
        if (this.isInteger(value)) {
          const numValue = Number(value);
          if (
            columnType.includes("tinyint") &&
            (numValue < -128 || numValue > 127)
          ) {
            errors.push("Value must be between -128 and 127 for TINYINT");
          } else if (
            columnType.includes("smallint") &&
            (numValue < -32768 || numValue > 32767)
          ) {
            errors.push(
              "Value must be between -32,768 and 32,767 for SMALLINT",
            );
          } else if (
            columnType.includes("bigint") &&
            (numValue < -9223372036854775000 || numValue > 9223372036854775000)
          ) {
            errors.push("Value exceeds BIGINT range");
          }
        } else {
          errors.push("Value must be an integer");
        }
        break;

      case columnType.includes("decimal") || columnType.includes("numeric"):
        if (this.isNumeric(value)) {
          const precision = this.extractPrecision(column.type);
          const scale = this.extractScale(column.type);
          const validation = this.validateDecimal(value, precision, scale);
          errors.push(...validation.errors);
          warnings.push(...validation.warnings);
        } else {
          errors.push("Value must be a valid number");
        }
        break;

      case columnType.includes("float") || columnType.includes("double"):
        if (!this.isFloat(value)) {
          errors.push("Value must be a valid floating-point number");
        }
        break;

      case columnType.includes("bool"):
        if (!this.isBoolean(value)) {
          errors.push("Value must be true, false, 1, or 0");
        }
        break;

      case columnType.includes("date") && !columnType.includes("time"):
        if (!this.isValidDate(value)) {
          errors.push("Value must be a valid date (YYYY-MM-DD)");
        }
        break;

      case columnType.includes("datetime") || columnType.includes("timestamp"):
        if (!this.isValidDateTime(value)) {
          errors.push("Value must be a valid datetime (YYYY-MM-DD HH:MM:SS)");
        }
        break;

      case columnType.includes("time"):
        if (!this.isValidTime(value)) {
          errors.push("Value must be a valid time (HH:MM:SS)");
        }
        break;

      case columnType.includes("json"): {
        const jsonValidation = this.validateJSON(value);
        errors.push(...jsonValidation.errors);
        warnings.push(...jsonValidation.warnings);
        break;
      }

      case columnType.includes("uuid"):
        if (!this.isValidUUID(value)) {
          errors.push("Value must be a valid UUID");
        }
        break;

      case columnType.includes("email"):
        if (!this.isValidEmail(value)) {
          errors.push("Invalid email format");
        }
        break;

      case columnType.includes("url"):
        if (!this.isValidURL(value)) {
          errors.push("Invalid URL format");
        }
        break;

      case columnType.includes("varchar") ||
        columnType.includes("char") ||
        columnType.includes("text"):
        if (typeof value !== "string") {
          errors.push("Value must be a string");
        }
        break;
    }

    return { errors, warnings };
  }

  private validateLength(
    value: CellValue,
    column: ColumnDefinition,
  ): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof value === "string") {
      const maxLength = column.maxLength || this.extractMaxLength(column.type);

      if (maxLength && value.length > maxLength) {
        errors.push(`Value exceeds maximum length of ${maxLength} characters`);
      }

      // Warning for very long strings
      if (maxLength && value.length > maxLength * 0.9) {
        warnings.push(
          `Value is close to maximum length limit (${value.length}/${maxLength})`,
        );
      }
    }

    return { errors, warnings };
  }

  private validateFormat(
    value: CellValue,
    column: ColumnDefinition,
  ): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Custom format validation based on column name patterns
    const columnName = column.name.toLowerCase();

    if (columnName.includes("phone")) {
      if (typeof value === "string" && !this.isValidPhoneNumber(value)) {
        errors.push("Invalid phone number format");
      }
    }

    if (columnName.includes("postal") || columnName.includes("zip")) {
      if (typeof value === "string" && !this.isValidPostalCode(value)) {
        errors.push("Invalid postal/zip code format");
      }
    }

    if (columnName.includes("ssn") || columnName.includes("social")) {
      if (typeof value === "string" && !this.isValidSSN(value)) {
        errors.push("Invalid SSN format");
      }
    }

    return { errors, warnings };
  }

  private async validateBusinessLogic(
    value: CellValue,
    column: ColumnDefinition,
    context: ValidationContext,
  ): Promise<{ errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Age validation
    if (
      column.name.toLowerCase().includes("age") &&
      typeof value === "number"
    ) {
      if (value < 0) {
        errors.push("Age cannot be negative");
      } else if (value > 150) {
        warnings.push("Age seems unusually high");
      } else if (value < 13) {
        warnings.push("Age seems unusually low for this context");
      }
    }

    // Email uniqueness check
    if (column.name.toLowerCase().includes("email") && context.allRows) {
      const duplicateEmails = context.allRows.filter(
        (row, index) => index !== context.rowIndex && row[column.id] === value,
      );
      if (duplicateEmails.length > 0) {
        errors.push("Email address must be unique");
      }
    }

    // Date range validation
    if (column.type.toLowerCase().includes("date")) {
      const dateValue = new Date(String(value));
      const now = new Date();

      if (column.name.toLowerCase().includes("birth")) {
        if (dateValue > now) {
          errors.push("Birth date cannot be in the future");
        }
        if (dateValue < new Date("1900-01-01")) {
          warnings.push("Birth date seems unusually old");
        }
      }

      if (
        column.name.toLowerCase().includes("created") ||
        column.name.toLowerCase().includes("start")
      ) {
        if (dateValue > new Date(now.getTime() + 24 * 60 * 60 * 1000)) {
          // More than 1 day in future
          warnings.push("Date is in the future");
        }
      }
    }

    // Salary/price validation
    if (
      (column.name.toLowerCase().includes("salary") ||
        column.name.toLowerCase().includes("price") ||
        column.name.toLowerCase().includes("amount")) &&
      typeof value === "number"
    ) {
      if (value < 0) {
        errors.push("Amount cannot be negative");
      } else if (value > 10000000) {
        warnings.push("Amount seems unusually large");
      }
    }

    return { errors, warnings };
  }

  private async validateCustomRules(
    value: CellValue,
    column: ColumnDefinition,
    context?: ValidationContext,
  ): Promise<{ errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const rules = this.customRules.get(column.id) || [];

    for (const rule of rules) {
      try {
        switch (rule.type) {
          case "required":
            if (!value || (typeof value === "string" && value.trim() === "")) {
              errors.push(rule.message);
            }
            break;

          case "minLength":
            if (
              typeof value === "string" &&
              value.length < (rule.value as number)
            ) {
              errors.push(rule.message);
            }
            break;

          case "maxLength":
            if (
              typeof value === "string" &&
              value.length > (rule.value as number)
            ) {
              errors.push(rule.message);
            }
            break;

          case "pattern":
            if (
              typeof value === "string" &&
              !(rule.value as RegExp).test(value)
            ) {
              errors.push(rule.message);
            }
            break;

          case "custom":
            if (rule.validator && context) {
              const isValid = await Promise.resolve(
                rule.validator(value, context.row),
              );
              if (!isValid) {
                errors.push(rule.message);
              }
            }
            break;
        }
      } catch (error) {
        warnings.push(
          `Custom validation error: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }

    return { errors, warnings };
  }

  private async getSuggestions(
    value: CellValue,
    _column: ColumnDefinition,
    errors: string[],
  ): Promise<string[]> {
    const suggestions: string[] = [];

    if (errors.length === 0) {
      return suggestions;
    }

    // Suggest corrections based on common errors
    if (errors.some((e) => e.includes("email"))) {
      if (typeof value === "string") {
        if (!value.includes("@")) {
          suggestions.push("Email must contain @ symbol");
        }
        if (!value.includes(".")) {
          suggestions.push(
            "Email must contain a domain with extension (e.g., .com)",
          );
        }
      }
    }

    if (errors.some((e) => e.includes("integer"))) {
      if (typeof value === "string" && /^\d+\.\d+$/.test(value)) {
        suggestions.push(
          `Try ${Math.round(Number(value))} (rounded to nearest integer)`,
        );
      }
    }

    if (errors.some((e) => e.includes("date"))) {
      if (typeof value === "string") {
        // Try to suggest valid date format
        const dateAttempt = new Date(value);
        if (!Number.isNaN(dateAttempt.getTime())) {
          suggestions.push(
            `Try ${dateAttempt.toISOString().split("T")[0]} (YYYY-MM-DD format)`,
          );
        }
      }
    }

    return suggestions;
  }

  // Type checking helper methods
  private isInteger(value: CellValue): boolean {
    return (
      (typeof value === "number" && Number.isInteger(value)) ||
      (typeof value === "string" && /^-?\d+$/.test(value))
    );
  }

  private isNumeric(value: CellValue): boolean {
    return !Number.isNaN(Number(value));
  }

  private isFloat(value: CellValue): boolean {
    return (
      typeof value === "number" ||
      (typeof value === "string" && /^-?\d*\.?\d+([eE][-+]?\d+)?$/.test(value))
    );
  }

  private isBoolean(value: CellValue): boolean {
    return (
      typeof value === "boolean" ||
      (typeof value === "string" &&
        ["true", "false", "1", "0"].includes(value.toLowerCase())) ||
      (typeof value === "number" && [0, 1].includes(value))
    );
  }

  private isValidDate(value: CellValue): boolean {
    if (typeof value !== "string") return false;
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  private isValidDateTime(value: CellValue): boolean {
    if (typeof value !== "string") return false;
    const date = new Date(value);
    return !Number.isNaN(date.getTime());
  }

  private isValidTime(value: CellValue): boolean {
    if (typeof value !== "string") return false;
    return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(value);
  }

  private isValidUUID(value: CellValue): boolean {
    if (typeof value !== "string") return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  private isValidEmail(value: CellValue): boolean {
    if (typeof value !== "string") return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  private isValidURL(value: CellValue): boolean {
    if (typeof value !== "string") return false;
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  private isValidPhoneNumber(value: string): boolean {
    // Basic phone number validation - can be enhanced based on requirements
    return /^[+]?[1-9][\d]{0,15}$/.test(value.replace(/[\s\-()]/g, ""));
  }

  private isValidPostalCode(value: string): boolean {
    // Basic postal code validation - supports US and international formats
    return /^[A-Z0-9]{3,10}$/i.test(value.replace(/[\s-]/g, ""));
  }

  private isValidSSN(value: string): boolean {
    // US SSN format validation
    return /^\d{3}-?\d{2}-?\d{4}$/.test(value);
  }

  private validateJSON(value: CellValue): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof value === "string") {
      try {
        JSON.parse(value);
      } catch {
        errors.push("Invalid JSON format");
      }
    } else if (typeof value === "object") {
      try {
        JSON.stringify(value);
      } catch {
        errors.push("Object cannot be serialized to JSON");
      }
    }

    return { errors, warnings };
  }

  private validateDecimal(
    value: CellValue,
    precision?: number,
    scale?: number,
  ): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const numValue = Number(value);
    const valueStr = String(numValue);

    if (precision) {
      const totalDigits = valueStr.replace(/[.-]/g, "").length;
      if (totalDigits > precision) {
        errors.push(`Number exceeds precision of ${precision} digits`);
      }
    }

    if (scale && valueStr.includes(".")) {
      const decimalPlaces = valueStr.split(".")[1].length;
      if (decimalPlaces > scale) {
        errors.push(`Number exceeds scale of ${scale} decimal places`);
      }
    }

    return { errors, warnings };
  }

  private extractMaxLength(type: string): number | null {
    const match = type.match(/\((\d+)\)/);
    return match ? Number.parseInt(match[1]) : null;
  }

  private extractPrecision(type: string): number | undefined {
    const match = type.match(/\((\d+)(?:,\d+)?\)/);
    return match ? Number.parseInt(match[1]) : undefined;
  }

  private extractScale(type: string): number | undefined {
    const match = type.match(/\(\d+,(\d+)\)/);
    return match ? Number.parseInt(match[1]) : undefined;
  }

  private getCacheKey(
    value: CellValue,
    column: ColumnDefinition,
    context?: ValidationContext,
  ): string {
    const contextKey = context
      ? `${context.rowIndex}:${JSON.stringify(context.row)}`
      : "no-context";
    return `${column.id}:${String(value)}:${contextKey}`;
  }

  clearCache(): void {
    this.validationCache.clear();
  }
}
