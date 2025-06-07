/**
 * SettingsService - アプリケーション設定管理
 * フェーズ12: ユーザビリティ向上機能
 */

export interface GeneralSettings {
  autoSaveQueries: boolean;
  rememberWindowSize: boolean;
  checkForUpdates: boolean;
  autoBackup: boolean;
  backupInterval: number; // minutes
}

export interface DatabaseSettings {
  connectionTimeout: number; // seconds
  queryTimeout: number; // seconds
  maxConnections: number;
  autoRefreshSchema: boolean;
  defaultDatabase: string;
  encryptPasswords: boolean;
}

export interface EditorSettings {
  tabSize: number;
  insertSpaces: boolean;
  wordWrap: boolean;
  autoComplete: boolean;
  showMinimap: boolean;
  highlightCurrentLine: boolean;
  formatOnSave: boolean;
  fontSize: number;
}

export interface UISettings {
  theme: "auto" | "light" | "dark";
  fontSize: number;
  showLineNumbers: boolean;
  showStatusBar: boolean;
  compactMode: boolean;
  animationsEnabled: boolean;
}

export interface AdvancedSettings {
  debugMode: boolean;
  enableTelemetry: boolean;
  logLevel: "error" | "warn" | "info" | "debug";
  maxLogFiles: number;
  performanceMonitoring: boolean;
  experimentalFeatures: boolean;
}

export interface AppSettings {
  general: GeneralSettings;
  database: DatabaseSettings;
  editor: EditorSettings;
  ui: UISettings;
  advanced: AdvancedSettings;
}

export interface SettingsValidationError {
  field: string;
  message: string;
}

export class SettingsService {
  private settings: AppSettings;
  private defaultSettings: AppSettings;
  private readonly STORAGE_KEY = "db-extension-settings";

  constructor() {
    this.defaultSettings = this.getDefaultSettings();
    this.settings = this.loadSettings();
  }

  /**
   * デフォルト設定を取得
   */
  private getDefaultSettings(): AppSettings {
    return {
      general: {
        autoSaveQueries: true,
        rememberWindowSize: true,
        checkForUpdates: true,
        autoBackup: true,
        backupInterval: 30,
      },
      database: {
        connectionTimeout: 30,
        queryTimeout: 120,
        maxConnections: 5,
        autoRefreshSchema: true,
        defaultDatabase: "",
        encryptPasswords: true,
      },
      editor: {
        tabSize: 2,
        insertSpaces: true,
        wordWrap: true,
        autoComplete: true,
        showMinimap: false,
        highlightCurrentLine: true,
        formatOnSave: false,
        fontSize: 14,
      },
      ui: {
        theme: "auto",
        fontSize: 14,
        showLineNumbers: true,
        showStatusBar: true,
        compactMode: false,
        animationsEnabled: true,
      },
      advanced: {
        debugMode: false,
        enableTelemetry: true,
        logLevel: "info",
        maxLogFiles: 10,
        performanceMonitoring: false,
        experimentalFeatures: false,
      },
    };
  }

  /**
   * 現在の設定を取得
   */
  getSettings(): AppSettings {
    return JSON.parse(JSON.stringify(this.settings));
  }

  /**
   * 設定を更新
   */
  updateSettings(newSettings: Partial<AppSettings>): void {
    this.settings = {
      ...this.settings,
      ...newSettings,
      general: { ...this.settings.general, ...newSettings.general },
      database: { ...this.settings.database, ...newSettings.database },
      editor: { ...this.settings.editor, ...newSettings.editor },
      ui: { ...this.settings.ui, ...newSettings.ui },
      advanced: { ...this.settings.advanced, ...newSettings.advanced },
    };
    this.saveSettings();
  }

  /**
   * 個別設定の更新
   */
  updateGeneralSettings(settings: Partial<GeneralSettings>): void {
    this.settings.general = { ...this.settings.general, ...settings };
    this.saveSettings();
  }

  updateDatabaseSettings(settings: Partial<DatabaseSettings>): void {
    this.settings.database = { ...this.settings.database, ...settings };
    this.saveSettings();
  }

  updateEditorSettings(settings: Partial<EditorSettings>): void {
    this.settings.editor = { ...this.settings.editor, ...settings };
    this.saveSettings();
  }

  updateUISettings(settings: Partial<UISettings>): void {
    this.settings.ui = { ...this.settings.ui, ...settings };
    this.saveSettings();
  }

  updateAdvancedSettings(settings: Partial<AdvancedSettings>): void {
    this.settings.advanced = { ...this.settings.advanced, ...settings };
    this.saveSettings();
  }

  /**
   * 設定のバリデーション
   */
  validateSettings(settings: Partial<AppSettings>): SettingsValidationError[] {
    const errors: SettingsValidationError[] = [];

    // General settings validation
    if (settings.general) {
      if (settings.general.backupInterval !== undefined) {
        if (
          settings.general.backupInterval < 1 ||
          settings.general.backupInterval > 1440
        ) {
          errors.push({
            field: "general.backupInterval",
            message: "Backup interval must be between 1 and 1440 minutes",
          });
        }
      }
    }

    // Database settings validation
    if (settings.database) {
      if (settings.database.connectionTimeout !== undefined) {
        if (settings.database.connectionTimeout < 1) {
          errors.push({
            field: "database.connectionTimeout",
            message: "Value must be positive",
          });
        }
      }
      if (settings.database.queryTimeout !== undefined) {
        if (settings.database.queryTimeout < 1) {
          errors.push({
            field: "database.queryTimeout",
            message: "Value must be positive",
          });
        }
      }
      if (settings.database.maxConnections !== undefined) {
        if (
          settings.database.maxConnections < 1 ||
          settings.database.maxConnections > 50
        ) {
          errors.push({
            field: "database.maxConnections",
            message: "Max connections must be between 1 and 50",
          });
        }
      }
    }

    // Editor settings validation
    if (settings.editor) {
      if (settings.editor.tabSize !== undefined) {
        if (settings.editor.tabSize < 1 || settings.editor.tabSize > 8) {
          errors.push({
            field: "editor.tabSize",
            message: "Tab size must be between 1 and 8",
          });
        }
      }
      if (settings.editor.fontSize !== undefined) {
        if (settings.editor.fontSize < 8 || settings.editor.fontSize > 30) {
          errors.push({
            field: "editor.fontSize",
            message: "Font size must be between 8 and 30",
          });
        }
      }
    }

    // UI settings validation
    if (settings.ui) {
      if (settings.ui.fontSize !== undefined) {
        if (settings.ui.fontSize < 8 || settings.ui.fontSize > 30) {
          errors.push({
            field: "ui.fontSize",
            message: "Font size must be between 8 and 30",
          });
        }
      }
      if (settings.ui.theme !== undefined) {
        if (!["auto", "light", "dark"].includes(settings.ui.theme)) {
          errors.push({
            field: "ui.theme",
            message: "Invalid theme value",
          });
        }
      }
    }

    // Advanced settings validation
    if (settings.advanced) {
      if (settings.advanced.logLevel !== undefined) {
        if (
          !["error", "warn", "info", "debug"].includes(
            settings.advanced.logLevel,
          )
        ) {
          errors.push({
            field: "advanced.logLevel",
            message: "Invalid log level",
          });
        }
      }
      if (settings.advanced.maxLogFiles !== undefined) {
        if (
          settings.advanced.maxLogFiles < 1 ||
          settings.advanced.maxLogFiles > 100
        ) {
          errors.push({
            field: "advanced.maxLogFiles",
            message: "Max log files must be between 1 and 100",
          });
        }
      }
    }

    return errors;
  }

  /**
   * デフォルト設定にリセット
   */
  resetToDefaults(): void {
    this.settings = JSON.parse(JSON.stringify(this.defaultSettings));
    this.saveSettings();
  }

  /**
   * 設定をエクスポート
   */
  exportSettings(): string {
    return JSON.stringify(this.settings, null, 2);
  }

  /**
   * 設定をインポート
   */
  importSettings(settingsJson: string): void {
    try {
      const imported = JSON.parse(settingsJson);

      // Validate structure
      if (!this.validateSettingsStructure(imported)) {
        throw new Error("Invalid settings structure");
      }

      // Validate values
      const errors = this.validateSettings(imported);
      if (errors.length > 0) {
        throw new Error(
          `Validation errors: ${errors.map((e) => e.message).join(", ")}`,
        );
      }

      this.settings = {
        ...this.defaultSettings,
        ...imported,
        general: { ...this.defaultSettings.general, ...imported.general },
        database: { ...this.defaultSettings.database, ...imported.database },
        editor: { ...this.defaultSettings.editor, ...imported.editor },
        ui: { ...this.defaultSettings.ui, ...imported.ui },
        advanced: { ...this.defaultSettings.advanced, ...imported.advanced },
      };

      this.saveSettings();
    } catch (error) {
      throw new Error(
        `Failed to import settings: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * 設定構造の検証
   */
  private validateSettingsStructure(
    settings: unknown,
  ): settings is AppSettings {
    if (typeof settings !== "object" || settings === null) {
      return false;
    }

    const s = settings as Record<string, unknown>;

    return (
      typeof s.general === "object" &&
      typeof s.database === "object" &&
      typeof s.editor === "object" &&
      typeof s.ui === "object" &&
      typeof s.advanced === "object"
    );
  }

  /**
   * 設定変更の監視
   */
  onSettingsChanged(callback: (settings: AppSettings) => void): () => void {
    const handler = () => callback(this.getSettings());
    window.addEventListener("storage", handler);

    return () => {
      window.removeEventListener("storage", handler);
    };
  }

  /**
   * 特定の設定値を取得
   */
  getSetting<T extends keyof AppSettings>(category: T): AppSettings[T] {
    return JSON.parse(JSON.stringify(this.settings[category]));
  }

  /**
   * 設定のマージ（深いマージ）
   */
  mergeSettings(newSettings: Partial<AppSettings>): void {
    const errors = this.validateSettings(newSettings);
    if (errors.length > 0) {
      throw new Error(
        `Validation errors: ${errors.map((e) => e.message).join(", ")}`,
      );
    }

    this.updateSettings(newSettings);
  }

  /**
   * 設定の読み込み
   */
  private loadSettings(): AppSettings {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (this.validateSettingsStructure(parsed)) {
          // Merge with defaults to ensure all fields exist
          return {
            ...this.defaultSettings,
            ...parsed,
            general: { ...this.defaultSettings.general, ...parsed.general },
            database: { ...this.defaultSettings.database, ...parsed.database },
            editor: { ...this.defaultSettings.editor, ...parsed.editor },
            ui: { ...this.defaultSettings.ui, ...parsed.ui },
            advanced: { ...this.defaultSettings.advanced, ...parsed.advanced },
          };
        }
      }
    } catch (error) {
      console.warn("Failed to load settings, using defaults:", error);
    }

    return JSON.parse(JSON.stringify(this.defaultSettings));
  }

  /**
   * 設定の保存
   */
  private saveSettings(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.settings));
    } catch (error) {
      console.error("Failed to save settings:", error);
      throw error;
    }
  }
}
