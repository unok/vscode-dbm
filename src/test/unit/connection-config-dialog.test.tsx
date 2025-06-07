import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EncryptionService } from "@/shared/security/EncryptionService";
import type { DatabaseConfig } from "@/shared/types";
import { ConnectionConfigDialog } from "@/webview/components/ConnectionConfigDialog";

// Mock VSCode API
const mockVsCodeApi = {
  showInfo: vi.fn(),
  showError: vi.fn(),
  showWarn: vi.fn(),
  postMessage: vi.fn(),
  onMessage: vi.fn(),
};

vi.mock("@/webview/api/vscode", () => ({
  useVSCodeAPI: vi.fn(() => mockVsCodeApi),
}));

// Mock EncryptionService
vi.mock("@/shared/security/EncryptionService");

describe("ConnectionConfigDialog", () => {
  let mockOnSave: ReturnType<typeof vi.fn>;
  let mockOnCancel: ReturnType<typeof vi.fn>;
  let mockOnTest: ReturnType<typeof vi.fn>;
  let mockEncryptPassword: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnSave = vi.fn();
    mockOnCancel = vi.fn();
    mockOnTest = vi
      .fn()
      .mockResolvedValue({ success: true, message: "Connection successful" });
    mockEncryptPassword = vi.fn((password) => `encrypted_${password}`);

    vi.mocked(EncryptionService).mockImplementation(() => ({
      encryptPassword: mockEncryptPassword,
      encrypt: vi.fn(),
      decrypt: vi.fn(),
      decryptPassword: vi.fn(),
      encryptDatabaseConfig: vi.fn(),
      decryptDatabaseConfig: vi.fn(),
      encryptMultipleDatabaseConfigs: vi.fn(),
      decryptMultipleDatabaseConfigs: vi.fn(),
    }));
  });

  describe("新規接続の作成", () => {
    it("ダイアログが正しく表示される", () => {
      render(
        <ConnectionConfigDialog
          isOpen={true}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onTest={mockOnTest}
        />,
      );

      expect(screen.getByText("New Connection")).toBeInTheDocument();
      expect(screen.getByLabelText(/Connection Name/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Database Type/)).toBeInTheDocument();
    });

    it("MySQL接続の設定フィールドが表示される", () => {
      render(
        <ConnectionConfigDialog
          isOpen={true}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onTest={mockOnTest}
        />,
      );

      expect(screen.getByLabelText(/Host/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Port/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Username/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Password/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Database Name/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Use SSL\/TLS/)).toBeInTheDocument();
    });

    it("PostgreSQLを選択するとポートが5432に変更される", async () => {
      render(
        <ConnectionConfigDialog
          isOpen={true}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onTest={mockOnTest}
        />,
      );

      const typeSelect = screen.getByLabelText(/Database Type/);
      fireEvent.change(typeSelect, { target: { value: "postgresql" } });

      await waitFor(() => {
        const portInput = screen.getByLabelText(/Port/) as HTMLInputElement;
        expect(portInput.value).toBe("5432");
      });
    });

    it("SQLiteを選択するとホスト関連フィールドが非表示になる", () => {
      render(
        <ConnectionConfigDialog
          isOpen={true}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onTest={mockOnTest}
        />,
      );

      const typeSelect = screen.getByLabelText(/Database Type/);
      fireEvent.change(typeSelect, { target: { value: "sqlite" } });

      expect(screen.queryByLabelText(/Host/)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Port/)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Username/)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Password/)).not.toBeInTheDocument();
      expect(screen.getByLabelText(/Database Path/)).toBeInTheDocument();
    });
  });

  describe("接続の編集", () => {
    const existingConfig: DatabaseConfig = {
      id: "test-connection",
      name: "Test MySQL",
      type: "mysql",
      host: "localhost",
      port: 3306,
      database: "testdb",
      username: "testuser",
      password: "testpass",
      ssl: false,
    };

    it("既存の設定が正しく表示される", () => {
      render(
        <ConnectionConfigDialog
          isOpen={true}
          initialConfig={existingConfig}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onTest={mockOnTest}
        />,
      );

      expect(screen.getByText("Edit Connection")).toBeInTheDocument();
      expect(
        (screen.getByLabelText(/Connection Name/) as HTMLInputElement).value,
      ).toBe("Test MySQL");
      expect((screen.getByLabelText(/Host/) as HTMLInputElement).value).toBe(
        "localhost",
      );
      expect((screen.getByLabelText(/Port/) as HTMLInputElement).value).toBe(
        "3306",
      );
      expect(
        (screen.getByLabelText(/Username/) as HTMLInputElement).value,
      ).toBe("testuser");
      expect(
        (screen.getByLabelText(/Database Name/) as HTMLInputElement).value,
      ).toBe("testdb");
    });
  });

  describe("バリデーション", () => {
    it("必須フィールドが空の場合エラーが表示される", () => {
      mockVsCodeApi.showError.mockClear();

      render(
        <ConnectionConfigDialog
          isOpen={true}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onTest={mockOnTest}
        />,
      );

      const saveButton = screen.getByText("Save");
      fireEvent.click(saveButton);

      expect(mockVsCodeApi.showError).toHaveBeenCalledWith(
        "Connection name is required",
      );
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it("MySQLで必須フィールドが入力されていれば保存できる", () => {
      render(
        <ConnectionConfigDialog
          isOpen={true}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onTest={mockOnTest}
        />,
      );

      fireEvent.change(screen.getByLabelText(/Connection Name/), {
        target: { value: "My Connection" },
      });
      fireEvent.change(screen.getByLabelText(/Host/), {
        target: { value: "localhost" },
      });
      fireEvent.change(screen.getByLabelText(/Username/), {
        target: { value: "root" },
      });
      fireEvent.change(screen.getByLabelText(/Database Name/), {
        target: { value: "mydb" },
      });

      const saveButton = screen.getByText("Save");
      fireEvent.click(saveButton);

      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "My Connection",
          type: "mysql",
          host: "localhost",
          username: "root",
          database: "mydb",
        }),
      );
    });
  });

  describe("接続テスト", () => {
    it("接続テストが成功した場合メッセージが表示される", async () => {
      render(
        <ConnectionConfigDialog
          isOpen={true}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onTest={mockOnTest}
        />,
      );

      // 必須フィールドを入力
      fireEvent.change(screen.getByLabelText(/Connection Name/), {
        target: { value: "Test Connection" },
      });
      fireEvent.change(screen.getByLabelText(/Host/), {
        target: { value: "localhost" },
      });
      fireEvent.change(screen.getByLabelText(/Username/), {
        target: { value: "root" },
      });

      const testButton = screen.getByText("Test Connection");
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(screen.getByText("Connection successful")).toBeInTheDocument();
      });
    });

    it("接続テストが失敗した場合エラーメッセージが表示される", async () => {
      mockOnTest.mockResolvedValueOnce({
        success: false,
        message: "Connection failed: Invalid credentials",
      });

      render(
        <ConnectionConfigDialog
          isOpen={true}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onTest={mockOnTest}
        />,
      );

      // 必須フィールドを入力
      fireEvent.change(screen.getByLabelText(/Connection Name/), {
        target: { value: "Test Connection" },
      });
      fireEvent.change(screen.getByLabelText(/Host/), {
        target: { value: "localhost" },
      });
      fireEvent.change(screen.getByLabelText(/Username/), {
        target: { value: "root" },
      });

      const testButton = screen.getByText("Test Connection");
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(
          screen.getByText("Connection failed: Invalid credentials"),
        ).toBeInTheDocument();
      });
    });

    it("接続テスト中はボタンが無効化される", async () => {
      mockOnTest.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ success: true, message: "OK" }), 1000),
          ),
      );

      render(
        <ConnectionConfigDialog
          isOpen={true}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onTest={mockOnTest}
        />,
      );

      // 必須フィールドを入力
      fireEvent.change(screen.getByLabelText(/Connection Name/), {
        target: { value: "Test Connection" },
      });
      fireEvent.change(screen.getByLabelText(/Host/), {
        target: { value: "localhost" },
      });
      fireEvent.change(screen.getByLabelText(/Username/), {
        target: { value: "root" },
      });

      const testButton = screen.getByText("Test Connection");
      fireEvent.click(testButton);

      expect(screen.getByText("Testing...")).toBeInTheDocument();
      expect(testButton).toBeDisabled();
    });
  });

  describe("パスワードの暗号化", () => {
    it("保存時にパスワードが暗号化される", () => {
      render(
        <ConnectionConfigDialog
          isOpen={true}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onTest={mockOnTest}
        />,
      );

      fireEvent.change(screen.getByLabelText(/Connection Name/), {
        target: { value: "My Connection" },
      });
      fireEvent.change(screen.getByLabelText(/Host/), {
        target: { value: "localhost" },
      });
      fireEvent.change(screen.getByLabelText(/Username/), {
        target: { value: "root" },
      });
      fireEvent.change(screen.getByLabelText(/Password/), {
        target: { value: "mypassword" },
      });
      fireEvent.change(screen.getByLabelText(/Database Name/), {
        target: { value: "mydb" },
      });

      const saveButton = screen.getByText("Save");
      fireEvent.click(saveButton);

      expect(mockEncryptPassword).toHaveBeenCalledWith("mypassword");
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          password: "encrypted_mypassword",
        }),
      );
    });
  });

  describe("キャンセル処理", () => {
    it("キャンセルボタンクリックでonCancelが呼ばれる", () => {
      render(
        <ConnectionConfigDialog
          isOpen={true}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onTest={mockOnTest}
        />,
      );

      const cancelButton = screen.getByText("Cancel");
      fireEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe("ダイアログの表示制御", () => {
    it("isOpenがfalseの場合何も表示されない", () => {
      const { container } = render(
        <ConnectionConfigDialog
          isOpen={false}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onTest={mockOnTest}
        />,
      );

      expect(container).toBeEmptyDOMElement();
    });
  });
});
