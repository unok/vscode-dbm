import { beforeEach, describe, expect, test } from "vitest";
import {
  type TransactionOptions,
  TransactionService,
} from "../../shared/services/TransactionService";
import type { QueryExecutionContext } from "../../shared/types/sql";

describe("TransactionService", () => {
  let transactionService: TransactionService;
  let mockContext: QueryExecutionContext;

  beforeEach(() => {
    transactionService = new TransactionService();
    mockContext = {
      connection: {
        id: "conn_1",
        name: "Test Connection",
        type: "mysql",
        host: "localhost",
        port: 3306,
        database: "test_db",
        username: "user",
        password: "password",
      },
      database: "test_db",
      schema: "public",
      transaction: false,
      autoCommit: true,
    };
  });

  describe("Transaction Lifecycle", () => {
    test("should begin a new transaction", async () => {
      const options: TransactionOptions = {
        isolationLevel: "READ_COMMITTED",
        autoCommit: false,
      };

      const result = await transactionService.beginTransaction(
        mockContext,
        options,
      );

      expect(result.success).toBe(true);
      expect(result.transactionId).toBeTruthy();
      expect(result.affectedRows).toBe(0);
      expect(result.executionTime).toBeGreaterThan(0);

      const transaction = transactionService.getTransaction(
        result.transactionId,
      );
      expect(transaction).toBeTruthy();
      expect(transaction?.status).toBe("active");
      expect(transaction?.isolationLevel).toBe("READ_COMMITTED");
      expect(transaction?.autoCommit).toBe(false);
    });

    test("should commit a transaction", async () => {
      const beginResult =
        await transactionService.beginTransaction(mockContext);
      expect(beginResult.success).toBe(true);

      const commitResult = await transactionService.commitTransaction(
        beginResult.transactionId,
        mockContext,
      );

      expect(commitResult.success).toBe(true);
      expect(commitResult.transactionId).toBe(beginResult.transactionId);

      const transaction = transactionService.getTransaction(
        beginResult.transactionId,
      );
      expect(transaction?.status).toBe("committed");
      expect(transaction?.endTime).toBeTruthy();
    });

    test("should rollback a transaction", async () => {
      const beginResult =
        await transactionService.beginTransaction(mockContext);
      expect(beginResult.success).toBe(true);

      const rollbackResult = await transactionService.rollbackTransaction(
        beginResult.transactionId,
        mockContext,
      );

      expect(rollbackResult.success).toBe(true);
      expect(rollbackResult.transactionId).toBe(beginResult.transactionId);

      const transaction = transactionService.getTransaction(
        beginResult.transactionId,
      );
      expect(transaction?.status).toBe("rolled_back");
      expect(transaction?.endTime).toBeTruthy();
    });

    test("should not commit non-existent transaction", async () => {
      const result = await transactionService.commitTransaction(
        "non_existent",
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Transaction not found");
    });

    test("should not rollback non-existent transaction", async () => {
      const result = await transactionService.rollbackTransaction(
        "non_existent",
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Transaction not found");
    });
  });

  describe("Statement Execution in Transaction", () => {
    test("should execute statement within transaction", async () => {
      const beginResult =
        await transactionService.beginTransaction(mockContext);
      const sql =
        "INSERT INTO users (name, email) VALUES ('John', 'john@example.com')";

      const execResult = await transactionService.executeInTransaction(
        beginResult.transactionId,
        sql,
        mockContext,
      );

      expect(execResult.success).toBe(true);
      expect(execResult.transactionId).toBe(beginResult.transactionId);
      expect(execResult.affectedRows).toBeGreaterThan(0);
      expect(execResult.executionTime).toBeGreaterThan(0);

      const transaction = transactionService.getTransaction(
        beginResult.transactionId,
      );
      expect(transaction?.statements).toHaveLength(1);
      expect(transaction?.statements[0].sql).toBe(sql);
      expect(transaction?.statements[0].success).toBe(true);
    });

    test("should handle statement execution errors", async () => {
      const beginResult =
        await transactionService.beginTransaction(mockContext);
      const sql = "FORCE_ERROR invalid sql";

      const execResult = await transactionService.executeInTransaction(
        beginResult.transactionId,
        sql,
        mockContext,
      );

      expect(execResult.success).toBe(false);
      expect(execResult.error).toBeTruthy();

      const transaction = transactionService.getTransaction(
        beginResult.transactionId,
      );
      expect(transaction?.statements).toHaveLength(1);
      expect(transaction?.statements[0].success).toBe(false);
      expect(transaction?.statements[0].error).toBeTruthy();
      expect(transaction?.status).toBe("active"); // Should remain active for manual rollback
    });

    test("should auto-commit when autoCommit is enabled", async () => {
      const options: TransactionOptions = {
        autoCommit: true,
      };

      const beginResult = await transactionService.beginTransaction(
        mockContext,
        options,
      );
      const sql =
        "INSERT INTO users (name, email) VALUES ('John', 'john@example.com')";

      const execResult = await transactionService.executeInTransaction(
        beginResult.transactionId,
        sql,
        mockContext,
      );

      expect(execResult.success).toBe(true);

      const transaction = transactionService.getTransaction(
        beginResult.transactionId,
      );
      expect(transaction?.status).toBe("committed"); // Auto-committed
    });

    test("should auto-rollback on error when autoCommit is enabled", async () => {
      const options: TransactionOptions = {
        autoCommit: true,
      };

      const beginResult = await transactionService.beginTransaction(
        mockContext,
        options,
      );
      const sql = "FORCE_ERROR invalid sql";

      const execResult = await transactionService.executeInTransaction(
        beginResult.transactionId,
        sql,
        mockContext,
      );

      expect(execResult.success).toBe(false);

      const transaction = transactionService.getTransaction(
        beginResult.transactionId,
      );
      expect(transaction?.status).toBe("rolled_back"); // Auto-rolled back
    });

    test("should not execute in inactive transaction", async () => {
      const beginResult =
        await transactionService.beginTransaction(mockContext);
      await transactionService.commitTransaction(
        beginResult.transactionId,
        mockContext,
      );

      const execResult = await transactionService.executeInTransaction(
        beginResult.transactionId,
        "SELECT 1",
        mockContext,
      );

      expect(execResult.success).toBe(false);
      expect(execResult.error).toContain("committed");
    });
  });

  describe("Savepoints", () => {
    test("should create savepoint", async () => {
      const beginResult =
        await transactionService.beginTransaction(mockContext);

      const savepointResult = await transactionService.createSavepoint(
        beginResult.transactionId,
        "sp1",
        mockContext,
      );

      expect(savepointResult.success).toBe(true);

      const transaction = transactionService.getTransaction(
        beginResult.transactionId,
      );
      expect(transaction?.savepoints).toHaveLength(1);
      expect(transaction?.savepoints[0].name).toBe("sp1");
      expect(transaction?.savepoints[0].statements).toBe(0);
    });

    test("should not create duplicate savepoint", async () => {
      const beginResult =
        await transactionService.beginTransaction(mockContext);

      await transactionService.createSavepoint(
        beginResult.transactionId,
        "sp1",
        mockContext,
      );
      const duplicateResult = await transactionService.createSavepoint(
        beginResult.transactionId,
        "sp1",
        mockContext,
      );

      expect(duplicateResult.success).toBe(false);
      expect(duplicateResult.error).toContain("already exists");
    });

    test("should rollback to savepoint", async () => {
      const beginResult =
        await transactionService.beginTransaction(mockContext);

      // Execute first statement
      await transactionService.executeInTransaction(
        beginResult.transactionId,
        "INSERT INTO users (name) VALUES ('User1')",
        mockContext,
      );

      // Create savepoint
      await transactionService.createSavepoint(
        beginResult.transactionId,
        "sp1",
        mockContext,
      );

      // Execute second statement
      await transactionService.executeInTransaction(
        beginResult.transactionId,
        "INSERT INTO users (name) VALUES ('User2')",
        mockContext,
      );

      let transaction = transactionService.getTransaction(
        beginResult.transactionId,
      );
      expect(transaction?.statements).toHaveLength(2);

      // Rollback to savepoint
      const rollbackResult = await transactionService.rollbackTransaction(
        beginResult.transactionId,
        mockContext,
        "sp1",
      );

      expect(rollbackResult.success).toBe(true);

      transaction = transactionService.getTransaction(
        beginResult.transactionId,
      );
      expect(transaction?.statements).toHaveLength(1); // Second statement removed
      expect(transaction?.status).toBe("active"); // Still active
    });

    test("should release savepoint", async () => {
      const beginResult =
        await transactionService.beginTransaction(mockContext);

      await transactionService.createSavepoint(
        beginResult.transactionId,
        "sp1",
        mockContext,
      );
      await transactionService.createSavepoint(
        beginResult.transactionId,
        "sp2",
        mockContext,
      );

      let transaction = transactionService.getTransaction(
        beginResult.transactionId,
      );
      expect(transaction?.savepoints).toHaveLength(2);

      const releaseResult = await transactionService.releaseSavepoint(
        beginResult.transactionId,
        "sp1",
        mockContext,
      );

      expect(releaseResult.success).toBe(true);

      transaction = transactionService.getTransaction(
        beginResult.transactionId,
      );
      expect(transaction?.savepoints).toHaveLength(0); // sp1 and subsequent sp2 removed
    });

    test("should not rollback to non-existent savepoint", async () => {
      const beginResult =
        await transactionService.beginTransaction(mockContext);

      const rollbackResult = await transactionService.rollbackTransaction(
        beginResult.transactionId,
        mockContext,
        "non_existent",
      );

      expect(rollbackResult.success).toBe(false);
      expect(rollbackResult.error).toContain(
        "Savepoint 'non_existent' not found",
      );
    });
  });

  describe("Isolation Levels", () => {
    test("should set READ_UNCOMMITTED isolation level", async () => {
      const options: TransactionOptions = {
        isolationLevel: "READ_UNCOMMITTED",
      };

      const result = await transactionService.beginTransaction(
        mockContext,
        options,
      );
      expect(result.success).toBe(true);

      const transaction = transactionService.getTransaction(
        result.transactionId,
      );
      expect(transaction?.isolationLevel).toBe("READ_UNCOMMITTED");
    });

    test("should set SERIALIZABLE isolation level", async () => {
      const options: TransactionOptions = {
        isolationLevel: "SERIALIZABLE",
      };

      const result = await transactionService.beginTransaction(
        mockContext,
        options,
      );
      expect(result.success).toBe(true);

      const transaction = transactionService.getTransaction(
        result.transactionId,
      );
      expect(transaction?.isolationLevel).toBe("SERIALIZABLE");
    });

    test("should default to READ committed isolation level", async () => {
      const result = await transactionService.beginTransaction(mockContext);
      expect(result.success).toBe(true);

      const transaction = transactionService.getTransaction(
        result.transactionId,
      );
      expect(transaction?.isolationLevel).toBe("READ_COMMITTED");
    });
  });

  describe("Transaction Management", () => {
    test("should get active transactions", async () => {
      const tx1 = await transactionService.beginTransaction(mockContext);
      const tx2 = await transactionService.beginTransaction(mockContext);
      await transactionService.commitTransaction(
        tx2.transactionId,
        mockContext,
      );

      const activeTransactions = transactionService.getActiveTransactions();

      expect(activeTransactions).toHaveLength(1);
      expect(activeTransactions[0].id).toBe(tx1.transactionId);
    });

    test("should clean up old transactions", async () => {
      const tx1 = await transactionService.beginTransaction(mockContext);
      const tx2 = await transactionService.beginTransaction(mockContext);

      await transactionService.commitTransaction(
        tx1.transactionId,
        mockContext,
      );
      await transactionService.rollbackTransaction(
        tx2.transactionId,
        mockContext,
      );

      // Set end time to past
      const transaction1 = transactionService.getTransaction(tx1.transactionId);
      const transaction2 = transactionService.getTransaction(tx2.transactionId);
      if (transaction1)
        transaction1.endTime = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      if (transaction2)
        transaction2.endTime = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago

      const cleanedCount = transactionService.cleanupTransactions();

      expect(cleanedCount).toBe(2);
      expect(transactionService.getTransaction(tx1.transactionId)).toBeNull();
      expect(transactionService.getTransaction(tx2.transactionId)).toBeNull();
    });

    test("should not clean up recent transactions", async () => {
      const tx = await transactionService.beginTransaction(mockContext);
      await transactionService.commitTransaction(tx.transactionId, mockContext);

      const cleanedCount = transactionService.cleanupTransactions();

      expect(cleanedCount).toBe(0);
      expect(transactionService.getTransaction(tx.transactionId)).toBeTruthy();
    });

    test("should get transaction statistics", async () => {
      const tx1 = await transactionService.beginTransaction(mockContext);
      const tx2 = await transactionService.beginTransaction(mockContext);
      await transactionService.beginTransaction(mockContext);

      await transactionService.commitTransaction(
        tx1.transactionId,
        mockContext,
      );
      await transactionService.rollbackTransaction(
        tx2.transactionId,
        mockContext,
      );

      const stats = transactionService.getTransactionStats();

      expect(stats.total).toBe(3);
      expect(stats.active).toBe(1);
      expect(stats.committed).toBe(1);
      expect(stats.rolledBack).toBe(1);
      expect(stats.failed).toBe(0);
      expect(stats.avgExecutionTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Error Scenarios", () => {
    test("should handle begin transaction failure", async () => {
      const failContext = {
        ...mockContext,
        connection: {
          ...mockContext.connection,
          id: "FORCE_ERROR", // This will trigger mock failure
        },
      };

      const result = await transactionService.beginTransaction(failContext);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.transactionId).toBe("");
    });

    test("should handle commit failure", async () => {
      const beginResult =
        await transactionService.beginTransaction(mockContext);

      // Force error in commit by modifying context
      const failContext = {
        ...mockContext,
        connection: {
          ...mockContext.connection,
          database: "FORCE_ERROR",
        },
      };

      const commitResult = await transactionService.commitTransaction(
        beginResult.transactionId,
        failContext,
      );

      expect(commitResult.success).toBe(false);
      expect(commitResult.error).toBeTruthy();

      const transaction = transactionService.getTransaction(
        beginResult.transactionId,
      );
      expect(transaction?.status).toBe("failed");
    });

    test("should handle rollback failure", async () => {
      const beginResult =
        await transactionService.beginTransaction(mockContext);

      // Force error in rollback
      const failContext = {
        ...mockContext,
        connection: {
          ...mockContext.connection,
          database: "FORCE_ERROR",
        },
      };

      const rollbackResult = await transactionService.rollbackTransaction(
        beginResult.transactionId,
        failContext,
      );

      expect(rollbackResult.success).toBe(false);
      expect(rollbackResult.error).toBeTruthy();

      const transaction = transactionService.getTransaction(
        beginResult.transactionId,
      );
      expect(transaction?.status).toBe("failed");
    });

    test("should not operate on non-active transactions", async () => {
      const beginResult =
        await transactionService.beginTransaction(mockContext);
      await transactionService.commitTransaction(
        beginResult.transactionId,
        mockContext,
      );

      const commitAgainResult = await transactionService.commitTransaction(
        beginResult.transactionId,
        mockContext,
      );
      expect(commitAgainResult.success).toBe(false);
      expect(commitAgainResult.error).toContain("already committed");

      const rollbackCommittedResult =
        await transactionService.rollbackTransaction(
          beginResult.transactionId,
          mockContext,
        );
      expect(rollbackCommittedResult.success).toBe(false);
      expect(rollbackCommittedResult.error).toContain("already committed");

      const savepointResult = await transactionService.createSavepoint(
        beginResult.transactionId,
        "sp1",
        mockContext,
      );
      expect(savepointResult.success).toBe(false);
      expect(savepointResult.error).toContain("committed");
    });
  });

  describe("Transaction State Tracking", () => {
    test("should track statement execution order", async () => {
      const beginResult =
        await transactionService.beginTransaction(mockContext);

      await transactionService.executeInTransaction(
        beginResult.transactionId,
        "INSERT INTO users (name) VALUES ('User1')",
        mockContext,
      );

      await transactionService.executeInTransaction(
        beginResult.transactionId,
        "INSERT INTO users (name) VALUES ('User2')",
        mockContext,
      );

      const transaction = transactionService.getTransaction(
        beginResult.transactionId,
      );
      expect(transaction?.statements).toHaveLength(2);
      expect(transaction?.statements[0].sql).toContain("User1");
      expect(transaction?.statements[1].sql).toContain("User2");
      expect(transaction?.statements[0].executedAt).toBeLessThanOrEqual(
        transaction?.statements[1].executedAt,
      );
    });

    test("should track affected rows", async () => {
      const beginResult =
        await transactionService.beginTransaction(mockContext);

      await transactionService.executeInTransaction(
        beginResult.transactionId,
        "INSERT INTO users (name) VALUES ('User1')",
        mockContext,
      );

      const commitResult = await transactionService.commitTransaction(
        beginResult.transactionId,
        mockContext,
      );

      expect(commitResult.affectedRows).toBeGreaterThan(0);
    });

    test("should generate unique transaction IDs", async () => {
      const tx1 = await transactionService.beginTransaction(mockContext);
      const tx2 = await transactionService.beginTransaction(mockContext);
      const tx3 = await transactionService.beginTransaction(mockContext);

      expect(tx1.transactionId).not.toBe(tx2.transactionId);
      expect(tx2.transactionId).not.toBe(tx3.transactionId);
      expect(tx1.transactionId).not.toBe(tx3.transactionId);
    });

    test("should track transaction timing", async () => {
      const beginResult =
        await transactionService.beginTransaction(mockContext);

      // Small delay to ensure measurable time difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      await transactionService.commitTransaction(
        beginResult.transactionId,
        mockContext,
      );

      const transaction = transactionService.getTransaction(
        beginResult.transactionId,
      );
      expect(transaction?.startTime).toBeTruthy();
      expect(transaction?.endTime).toBeTruthy();
      expect(transaction?.endTime?.getTime()).toBeGreaterThan(
        transaction?.startTime.getTime(),
      );
    });
  });
});
