import type { QueryExecutionContext } from "../types/sql";

export interface Transaction {
  id: string;
  connectionId: string;
  status: "active" | "committed" | "rolled_back" | "failed";
  isolationLevel:
    | "READ_UNCOMMITTED"
    | "READ_COMMITTED"
    | "REPEATABLE_READ"
    | "SERIALIZABLE";
  autoCommit: boolean;
  startTime: Date;
  endTime?: Date;
  statements: TransactionStatement[];
  savepoints: Savepoint[];
}

export interface TransactionStatement {
  id: string;
  sql: string;
  executedAt: Date;
  affectedRows: number;
  executionTime: number;
  success: boolean;
  error?: string;
}

export interface Savepoint {
  name: string;
  createdAt: Date;
  statements: number; // Number of statements executed when savepoint was created
}

export interface TransactionOptions {
  isolationLevel?:
    | "READ_UNCOMMITTED"
    | "READ_COMMITTED"
    | "REPEATABLE_READ"
    | "SERIALIZABLE";
  autoCommit?: boolean;
  timeout?: number; // milliseconds
}

export interface TransactionResult {
  success: boolean;
  transactionId: string;
  affectedRows: number;
  executionTime: number;
  error?: string;
}

export class TransactionService {
  private transactions = new Map<string, Transaction>();
  private nextTransactionId = 1;

  /**
   * Begin a new transaction
   */
  async beginTransaction(
    context: QueryExecutionContext,
    options: TransactionOptions = {},
  ): Promise<TransactionResult> {
    try {
      const transactionId = `tx_${this.nextTransactionId++}_${Date.now()}`;

      const transaction: Transaction = {
        id: transactionId,
        connectionId: context.connection.id,
        status: "active",
        isolationLevel: options.isolationLevel || "READ_COMMITTED",
        autoCommit: options.autoCommit || false,
        startTime: new Date(),
        statements: [],
        savepoints: [],
      };

      // Execute BEGIN TRANSACTION statement
      const beginResult = await this.executeTransactionControl(
        context,
        this.generateBeginStatement(transaction.isolationLevel),
      );

      if (!beginResult.success) {
        throw new Error(beginResult.error || "Failed to begin transaction");
      }

      this.transactions.set(transactionId, transaction);

      return {
        success: true,
        transactionId,
        affectedRows: 0,
        executionTime: beginResult.executionTime,
      };
    } catch (error) {
      return {
        success: false,
        transactionId: "",
        affectedRows: 0,
        executionTime: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Execute statement within transaction
   */
  async executeInTransaction(
    transactionId: string,
    sql: string,
    context: QueryExecutionContext,
  ): Promise<TransactionResult> {
    const transaction = this.transactions.get(transactionId);

    if (!transaction) {
      return {
        success: false,
        transactionId,
        affectedRows: 0,
        executionTime: 0,
        error: "Transaction not found",
      };
    }

    if (transaction.status !== "active") {
      return {
        success: false,
        transactionId,
        affectedRows: 0,
        executionTime: 0,
        error: `Transaction is ${transaction.status}`,
      };
    }

    try {
      const startTime = Date.now();

      // In a real implementation, this would execute against the database
      const result = await this.executeStatement(context, sql);

      const executionTime = Date.now() - startTime;

      const statement: TransactionStatement = {
        id: `stmt_${transaction.statements.length + 1}_${Date.now()}`,
        sql,
        executedAt: new Date(),
        affectedRows: result.affectedRows,
        executionTime,
        success: result.success,
        error: result.error,
      };

      transaction.statements.push(statement);

      if (!result.success) {
        if (transaction.autoCommit) {
          // Auto-rollback on error
          await this.rollbackTransaction(transactionId, context);
          return {
            success: false,
            transactionId,
            affectedRows: 0,
            executionTime,
            error: result.error,
          };
        }
        // Keep transaction active for manual rollback
        return {
          success: false,
          transactionId,
          affectedRows: 0,
          executionTime,
          error: result.error,
        };
      }

      // Auto-commit if enabled
      if (transaction.autoCommit && this.isModifyingStatement(sql)) {
        const commitResult = await this.commitTransaction(
          transactionId,
          context,
        );
        return {
          success: commitResult.success,
          transactionId,
          affectedRows: result.affectedRows,
          executionTime: executionTime + commitResult.executionTime,
          error: commitResult.error,
        };
      }

      return {
        success: true,
        transactionId,
        affectedRows: result.affectedRows,
        executionTime,
      };
    } catch (error) {
      return {
        success: false,
        transactionId,
        affectedRows: 0,
        executionTime: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Commit transaction
   */
  async commitTransaction(
    transactionId: string,
    context: QueryExecutionContext,
  ): Promise<TransactionResult> {
    const transaction = this.transactions.get(transactionId);

    if (!transaction) {
      return {
        success: false,
        transactionId,
        affectedRows: 0,
        executionTime: 0,
        error: "Transaction not found",
      };
    }

    if (transaction.status !== "active") {
      return {
        success: false,
        transactionId,
        affectedRows: 0,
        executionTime: 0,
        error: `Transaction is already ${transaction.status}`,
      };
    }

    try {
      const result = await this.executeTransactionControl(context, "COMMIT");

      transaction.status = result.success ? "committed" : "failed";
      transaction.endTime = new Date();

      const totalAffectedRows = transaction.statements.reduce(
        (sum, stmt) => sum + stmt.affectedRows,
        0,
      );

      return {
        success: result.success,
        transactionId,
        affectedRows: totalAffectedRows,
        executionTime: result.executionTime,
        error: result.error,
      };
    } catch (error) {
      transaction.status = "failed";
      transaction.endTime = new Date();

      return {
        success: false,
        transactionId,
        affectedRows: 0,
        executionTime: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Rollback transaction
   */
  async rollbackTransaction(
    transactionId: string,
    context: QueryExecutionContext,
    savepointName?: string,
  ): Promise<TransactionResult> {
    const transaction = this.transactions.get(transactionId);

    if (!transaction) {
      return {
        success: false,
        transactionId,
        affectedRows: 0,
        executionTime: 0,
        error: "Transaction not found",
      };
    }

    if (transaction.status !== "active") {
      return {
        success: false,
        transactionId,
        affectedRows: 0,
        executionTime: 0,
        error: `Transaction is already ${transaction.status}`,
      };
    }

    try {
      let rollbackSql = "ROLLBACK";

      if (savepointName) {
        const savepoint = transaction.savepoints.find(
          (sp) => sp.name === savepointName,
        );
        if (!savepoint) {
          return {
            success: false,
            transactionId,
            affectedRows: 0,
            executionTime: 0,
            error: `Savepoint '${savepointName}' not found`,
          };
        }
        rollbackSql = `ROLLBACK TO SAVEPOINT ${savepointName}`;

        // Remove statements executed after savepoint
        transaction.statements = transaction.statements.slice(
          0,
          savepoint.statements,
        );
        // Remove savepoints created after this one
        transaction.savepoints = transaction.savepoints.filter(
          (sp) => sp.createdAt <= savepoint.createdAt,
        );
      } else {
        // Full rollback
        transaction.status = "rolled_back";
        transaction.endTime = new Date();
      }

      const result = await this.executeTransactionControl(context, rollbackSql);

      return {
        success: result.success,
        transactionId,
        affectedRows: 0,
        executionTime: result.executionTime,
        error: result.error,
      };
    } catch (error) {
      transaction.status = "failed";
      transaction.endTime = new Date();

      return {
        success: false,
        transactionId,
        affectedRows: 0,
        executionTime: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Create savepoint
   */
  async createSavepoint(
    transactionId: string,
    savepointName: string,
    context: QueryExecutionContext,
  ): Promise<TransactionResult> {
    const transaction = this.transactions.get(transactionId);

    if (!transaction) {
      return {
        success: false,
        transactionId,
        affectedRows: 0,
        executionTime: 0,
        error: "Transaction not found",
      };
    }

    if (transaction.status !== "active") {
      return {
        success: false,
        transactionId,
        affectedRows: 0,
        executionTime: 0,
        error: `Transaction is ${transaction.status}`,
      };
    }

    // Check if savepoint name already exists
    if (transaction.savepoints.some((sp) => sp.name === savepointName)) {
      return {
        success: false,
        transactionId,
        affectedRows: 0,
        executionTime: 0,
        error: `Savepoint '${savepointName}' already exists`,
      };
    }

    try {
      const result = await this.executeTransactionControl(
        context,
        `SAVEPOINT ${savepointName}`,
      );

      if (result.success) {
        const savepoint: Savepoint = {
          name: savepointName,
          createdAt: new Date(),
          statements: transaction.statements.length,
        };
        transaction.savepoints.push(savepoint);
      }

      return {
        success: result.success,
        transactionId,
        affectedRows: 0,
        executionTime: result.executionTime,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        transactionId,
        affectedRows: 0,
        executionTime: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Release savepoint
   */
  async releaseSavepoint(
    transactionId: string,
    savepointName: string,
    context: QueryExecutionContext,
  ): Promise<TransactionResult> {
    const transaction = this.transactions.get(transactionId);

    if (!transaction) {
      return {
        success: false,
        transactionId,
        affectedRows: 0,
        executionTime: 0,
        error: "Transaction not found",
      };
    }

    const savepointIndex = transaction.savepoints.findIndex(
      (sp) => sp.name === savepointName,
    );
    if (savepointIndex === -1) {
      return {
        success: false,
        transactionId,
        affectedRows: 0,
        executionTime: 0,
        error: `Savepoint '${savepointName}' not found`,
      };
    }

    try {
      const result = await this.executeTransactionControl(
        context,
        `RELEASE SAVEPOINT ${savepointName}`,
      );

      if (result.success) {
        // Remove the savepoint and all subsequent ones
        transaction.savepoints = transaction.savepoints.slice(
          0,
          savepointIndex,
        );
      }

      return {
        success: result.success,
        transactionId,
        affectedRows: 0,
        executionTime: result.executionTime,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        transactionId,
        affectedRows: 0,
        executionTime: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get transaction status
   */
  getTransaction(transactionId: string): Transaction | null {
    return this.transactions.get(transactionId) || null;
  }

  /**
   * Get all active transactions
   */
  getActiveTransactions(): Transaction[] {
    return Array.from(this.transactions.values()).filter(
      (tx) => tx.status === "active",
    );
  }

  /**
   * Clean up completed transactions
   */
  cleanupTransactions(
    olderThan: Date = new Date(Date.now() - 24 * 60 * 60 * 1000),
  ): number {
    let cleaned = 0;

    for (const [id, transaction] of this.transactions) {
      if (
        transaction.status !== "active" &&
        transaction.endTime &&
        transaction.endTime < olderThan
      ) {
        this.transactions.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Generate BEGIN statement with isolation level
   */
  private generateBeginStatement(isolationLevel: string): string {
    return `BEGIN TRANSACTION ISOLATION LEVEL ${isolationLevel}`;
  }

  /**
   * Execute transaction control statement (BEGIN, COMMIT, ROLLBACK, etc.)
   */
  private async executeTransactionControl(
    context: QueryExecutionContext,
    sql: string,
  ): Promise<{ success: boolean; executionTime: number; error?: string }> {
    // Mock implementation - in real app, this would execute against the database
    // using context.connectionId and context.databaseProxy
    console.debug(
      `Executing transaction control: ${sql} on connection ${context.connection.id}`,
    );
    const startTime = Date.now();

    // Simulate execution time
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 50));

    const executionTime = Date.now() - startTime;

    // Mock success/failure
    const success = !sql.includes("FORCE_ERROR");

    return {
      success,
      executionTime,
      error: success ? undefined : "Mock transaction control error",
    };
  }

  /**
   * Execute a regular statement
   */
  private async executeStatement(
    context: QueryExecutionContext,
    sql: string,
  ): Promise<{ success: boolean; affectedRows: number; error?: string }> {
    // Mock implementation - in real app, this would execute against the database
    // using context.connectionId and context.databaseProxy
    console.debug(
      `Executing statement: ${sql} on connection ${context.connection.id}`,
    );

    // Simulate execution
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));

    // Mock success/failure
    const success = !sql.includes("FORCE_ERROR");
    const affectedRows = success ? Math.floor(Math.random() * 10) + 1 : 0;

    return {
      success,
      affectedRows,
      error: success ? undefined : "Mock statement execution error",
    };
  }

  /**
   * Check if statement modifies data
   */
  private isModifyingStatement(sql: string): boolean {
    const modifyingKeywords = [
      "INSERT",
      "UPDATE",
      "DELETE",
      "CREATE",
      "ALTER",
      "DROP",
      "TRUNCATE",
    ];
    const upperSql = sql.trim().toUpperCase();

    return modifyingKeywords.some((keyword) => upperSql.startsWith(keyword));
  }

  /**
   * Get transaction statistics
   */
  getTransactionStats(): {
    total: number;
    active: number;
    committed: number;
    rolledBack: number;
    failed: number;
    avgExecutionTime: number;
  } {
    const transactions = Array.from(this.transactions.values());
    const active = transactions.filter((tx) => tx.status === "active").length;
    const committed = transactions.filter(
      (tx) => tx.status === "committed",
    ).length;
    const rolledBack = transactions.filter(
      (tx) => tx.status === "rolled_back",
    ).length;
    const failed = transactions.filter((tx) => tx.status === "failed").length;

    const completedTransactions = transactions.filter((tx) => tx.endTime);
    const avgExecutionTime =
      completedTransactions.length > 0
        ? completedTransactions.reduce((sum, tx) => {
            const duration =
              (tx.endTime?.getTime() || 0) - tx.startTime.getTime();
            return sum + duration;
          }, 0) / completedTransactions.length
        : 0;

    return {
      total: transactions.length,
      active,
      committed,
      rolledBack,
      failed,
      avgExecutionTime,
    };
  }
}
