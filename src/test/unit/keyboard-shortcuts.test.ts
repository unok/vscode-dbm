import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * KeyboardShortcutManager - ショートカットキー管理クラス
 * フェーズ12: ユーザビリティ向上機能のTDD実装
 */
interface ShortcutDefinition {
  id: string;
  key: string;
  modifiers: string[];
  action: () => void | Promise<void>;
  description: string;
  category: "editor" | "navigation" | "data" | "general";
  enabled: boolean;
  scope?: "global" | "editor" | "datagrid";
}

interface ShortcutCategory {
  name: string;
  shortcuts: ShortcutDefinition[];
}

interface KeyboardEvent {
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  preventDefault: () => void;
  stopPropagation: () => void;
}

// Mock implementation for testing
class KeyboardShortcutManager {
  private shortcuts: Map<string, ShortcutDefinition> = new Map();
  private listeners: Map<string, Array<(event: KeyboardEvent) => void>> =
    new Map();

  registerShortcut(shortcut: ShortcutDefinition): void {
    const key = this.generateKey(shortcut.key, shortcut.modifiers);
    this.shortcuts.set(key, shortcut);
  }

  unregisterShortcut(id: string): void {
    for (const [key, shortcut] of this.shortcuts) {
      if (shortcut.id === id) {
        this.shortcuts.delete(key);
        break;
      }
    }
  }

  handleKeyEvent(event: KeyboardEvent): boolean {
    const modifiers = [];
    if (event.ctrlKey || event.metaKey) modifiers.push("Ctrl");
    if (event.shiftKey) modifiers.push("Shift");
    if (event.altKey) modifiers.push("Alt");

    const key = this.generateKey(event.key, modifiers);
    const shortcut = this.shortcuts.get(key);

    if (shortcut?.enabled) {
      event.preventDefault();
      event.stopPropagation();
      shortcut.action();
      return true;
    }

    return false;
  }

  getShortcutsByCategory(): ShortcutCategory[] {
    const categories: Map<string, ShortcutDefinition[]> = new Map();

    for (const shortcut of this.shortcuts.values()) {
      if (!categories.has(shortcut.category)) {
        categories.set(shortcut.category, []);
      }
      categories.get(shortcut.category)?.push(shortcut);
    }

    return Array.from(categories.entries()).map(([name, shortcuts]) => ({
      name,
      shortcuts: shortcuts.sort((a, b) =>
        a.description.localeCompare(b.description),
      ),
    }));
  }

  enableShortcut(id: string): void {
    for (const shortcut of this.shortcuts.values()) {
      if (shortcut.id === id) {
        shortcut.enabled = true;
        break;
      }
    }
  }

  disableShortcut(id: string): void {
    for (const shortcut of this.shortcuts.values()) {
      if (shortcut.id === id) {
        shortcut.enabled = false;
        break;
      }
    }
  }

  private generateKey(key: string, modifiers: string[]): string {
    const sortedModifiers = modifiers.sort();
    return [...sortedModifiers, key].join("+");
  }
}

describe("KeyboardShortcutManager", () => {
  let shortcutManager: KeyboardShortcutManager;
  let mockAction: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    shortcutManager = new KeyboardShortcutManager();
    mockAction = vi.fn();
  });

  describe("Shortcut Registration", () => {
    it("should register a new shortcut", () => {
      const shortcut: ShortcutDefinition = {
        id: "test-shortcut",
        key: "S",
        modifiers: ["Ctrl"],
        action: mockAction,
        description: "Test shortcut",
        category: "general",
        enabled: true,
      };

      shortcutManager.registerShortcut(shortcut);

      const mockEvent = {
        key: "S",
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      };

      const result = shortcutManager.handleKeyEvent(mockEvent);

      expect(result).toBe(true);
      expect(mockAction).toHaveBeenCalledOnce();
      expect(mockEvent.preventDefault).toHaveBeenCalledOnce();
    });

    it("should unregister a shortcut", () => {
      const shortcut: ShortcutDefinition = {
        id: "test-shortcut",
        key: "S",
        modifiers: ["Ctrl"],
        action: mockAction,
        description: "Test shortcut",
        category: "general",
        enabled: true,
      };

      shortcutManager.registerShortcut(shortcut);
      shortcutManager.unregisterShortcut("test-shortcut");

      const mockEvent = {
        key: "S",
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      };

      const result = shortcutManager.handleKeyEvent(mockEvent);

      expect(result).toBe(false);
      expect(mockAction).not.toHaveBeenCalled();
    });
  });

  describe("Key Event Handling", () => {
    it("should handle Ctrl+S shortcut", () => {
      const shortcut: ShortcutDefinition = {
        id: "save",
        key: "S",
        modifiers: ["Ctrl"],
        action: mockAction,
        description: "Save current work",
        category: "general",
        enabled: true,
      };

      shortcutManager.registerShortcut(shortcut);

      const mockEvent = {
        key: "S",
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      };

      const result = shortcutManager.handleKeyEvent(mockEvent);

      expect(result).toBe(true);
      expect(mockAction).toHaveBeenCalledOnce();
    });

    it("should handle complex shortcuts with multiple modifiers", () => {
      const shortcut: ShortcutDefinition = {
        id: "complex",
        key: "D",
        modifiers: ["Ctrl", "Shift", "Alt"],
        action: mockAction,
        description: "Complex shortcut",
        category: "general",
        enabled: true,
      };

      shortcutManager.registerShortcut(shortcut);

      const mockEvent = {
        key: "D",
        ctrlKey: true,
        shiftKey: true,
        altKey: true,
        metaKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      };

      const result = shortcutManager.handleKeyEvent(mockEvent);

      expect(result).toBe(true);
      expect(mockAction).toHaveBeenCalledOnce();
    });

    it("should not trigger disabled shortcuts", () => {
      const shortcut: ShortcutDefinition = {
        id: "disabled",
        key: "S",
        modifiers: ["Ctrl"],
        action: mockAction,
        description: "Disabled shortcut",
        category: "general",
        enabled: false,
      };

      shortcutManager.registerShortcut(shortcut);

      const mockEvent = {
        key: "S",
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      };

      const result = shortcutManager.handleKeyEvent(mockEvent);

      expect(result).toBe(false);
      expect(mockAction).not.toHaveBeenCalled();
    });

    it("should return false for unregistered key combinations", () => {
      const mockEvent = {
        key: "X",
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      };

      const result = shortcutManager.handleKeyEvent(mockEvent);

      expect(result).toBe(false);
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe("Category Management", () => {
    it("should group shortcuts by category", () => {
      const shortcuts: ShortcutDefinition[] = [
        {
          id: "save",
          key: "S",
          modifiers: ["Ctrl"],
          action: mockAction,
          description: "Save",
          category: "general",
          enabled: true,
        },
        {
          id: "open",
          key: "O",
          modifiers: ["Ctrl"],
          action: mockAction,
          description: "Open",
          category: "general",
          enabled: true,
        },
        {
          id: "run-query",
          key: "F5",
          modifiers: [],
          action: mockAction,
          description: "Run Query",
          category: "editor",
          enabled: true,
        },
      ];

      for (const shortcut of shortcuts) {
        shortcutManager.registerShortcut(shortcut);
      }

      const categories = shortcutManager.getShortcutsByCategory();

      expect(categories).toHaveLength(2);

      const generalCategory = categories.find((cat) => cat.name === "general");
      expect(generalCategory?.shortcuts).toHaveLength(2);

      const editorCategory = categories.find((cat) => cat.name === "editor");
      expect(editorCategory?.shortcuts).toHaveLength(1);
    });

    it("should sort shortcuts within categories alphabetically", () => {
      const shortcuts: ShortcutDefinition[] = [
        {
          id: "save",
          key: "S",
          modifiers: ["Ctrl"],
          action: mockAction,
          description: "Save",
          category: "general",
          enabled: true,
        },
        {
          id: "about",
          key: "F1",
          modifiers: [],
          action: mockAction,
          description: "About",
          category: "general",
          enabled: true,
        },
      ];

      for (const shortcut of shortcuts) {
        shortcutManager.registerShortcut(shortcut);
      }

      const categories = shortcutManager.getShortcutsByCategory();
      const generalCategory = categories.find((cat) => cat.name === "general");

      expect(generalCategory?.shortcuts[0].description).toBe("About");
      expect(generalCategory?.shortcuts[1].description).toBe("Save");
    });
  });

  describe("Enable/Disable Shortcuts", () => {
    it("should enable a shortcut", () => {
      const shortcut: ShortcutDefinition = {
        id: "toggle-test",
        key: "T",
        modifiers: ["Ctrl"],
        action: mockAction,
        description: "Toggle test",
        category: "general",
        enabled: false,
      };

      shortcutManager.registerShortcut(shortcut);
      shortcutManager.enableShortcut("toggle-test");

      const mockEvent = {
        key: "T",
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      };

      const result = shortcutManager.handleKeyEvent(mockEvent);

      expect(result).toBe(true);
      expect(mockAction).toHaveBeenCalledOnce();
    });

    it("should disable a shortcut", () => {
      const shortcut: ShortcutDefinition = {
        id: "toggle-test",
        key: "T",
        modifiers: ["Ctrl"],
        action: mockAction,
        description: "Toggle test",
        category: "general",
        enabled: true,
      };

      shortcutManager.registerShortcut(shortcut);
      shortcutManager.disableShortcut("toggle-test");

      const mockEvent = {
        key: "T",
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      };

      const result = shortcutManager.handleKeyEvent(mockEvent);

      expect(result).toBe(false);
      expect(mockAction).not.toHaveBeenCalled();
    });
  });

  describe("Default Database Shortcuts", () => {
    it("should support common database operation shortcuts", () => {
      const databaseShortcuts: ShortcutDefinition[] = [
        {
          id: "execute-query",
          key: "F5",
          modifiers: [],
          action: mockAction,
          description: "Execute Query",
          category: "editor",
          enabled: true,
        },
        {
          id: "new-query",
          key: "N",
          modifiers: ["Ctrl"],
          action: mockAction,
          description: "New Query",
          category: "editor",
          enabled: true,
        },
        {
          id: "save-query",
          key: "S",
          modifiers: ["Ctrl"],
          action: mockAction,
          description: "Save Query",
          category: "editor",
          enabled: true,
        },
        {
          id: "refresh-schema",
          key: "F5",
          modifiers: ["Ctrl"],
          action: mockAction,
          description: "Refresh Schema",
          category: "navigation",
          enabled: true,
        },
      ];

      for (const shortcut of databaseShortcuts) {
        shortcutManager.registerShortcut(shortcut);
      }

      // Test F5 (Execute Query)
      let mockEvent = {
        key: "F5",
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      };

      expect(shortcutManager.handleKeyEvent(mockEvent)).toBe(true);

      // Test Ctrl+N (New Query)
      mockEvent = {
        key: "N",
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      };

      expect(shortcutManager.handleKeyEvent(mockEvent)).toBe(true);

      expect(mockAction).toHaveBeenCalledTimes(2);
    });
  });
});
