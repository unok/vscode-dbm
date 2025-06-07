import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsService } from "../../shared/services/SettingsService";
import { SettingsUI } from "../../webview/components/SettingsUI";

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

Object.defineProperty(window, "localStorage", {
  value: mockLocalStorage,
  writable: true,
});

describe("SettingsUI Simplified", () => {
  let settingsService: SettingsService;
  let mockOnClose: vi.Mock;

  beforeEach(() => {
    mockLocalStorage.getItem.mockReturnValue(null);
    settingsService = new SettingsService();
    mockOnClose = vi.fn();
  });

  it("should render settings dialog", () => {
    render(
      <SettingsUI settingsService={settingsService} onClose={mockOnClose} />,
    );

    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("General")).toBeInTheDocument();
    expect(screen.getByText("Database")).toBeInTheDocument();
    expect(screen.getByText("Editor")).toBeInTheDocument();
    expect(screen.getByText("UI")).toBeInTheDocument();
    expect(screen.getByText("Advanced")).toBeInTheDocument();
  });

  it("should render general settings by default", () => {
    render(
      <SettingsUI settingsService={settingsService} onClose={mockOnClose} />,
    );

    expect(screen.getByText("Auto-save queries")).toBeInTheDocument();
    expect(screen.getByText("Remember window size")).toBeInTheDocument();
    expect(screen.getByText("Check for updates")).toBeInTheDocument();
  });

  it("should switch to database settings", async () => {
    render(
      <SettingsUI settingsService={settingsService} onClose={mockOnClose} />,
    );

    const databaseTab = screen.getByText("Database");
    fireEvent.click(databaseTab);

    await waitFor(() => {
      expect(
        screen.getByText("Connection timeout (seconds)"),
      ).toBeInTheDocument();
      expect(screen.getByText("Query timeout (seconds)")).toBeInTheDocument();
    });
  });

  it("should close dialog when cancel is clicked", async () => {
    render(
      <SettingsUI settingsService={settingsService} onClose={mockOnClose} />,
    );

    const cancelButton = screen.getByText("Cancel");
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledOnce();
    });
  });

  it("should save settings and close when save is clicked", async () => {
    render(
      <SettingsUI settingsService={settingsService} onClose={mockOnClose} />,
    );

    // Toggle a setting
    const autoSaveCheckbox = screen.getByRole("checkbox", {
      name: /auto-save queries/i,
    });
    fireEvent.click(autoSaveCheckbox);

    // Save
    const saveButton = screen.getByText("Save");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledOnce();
    });

    // Check that setting was saved
    const settings = settingsService.getSettings();
    expect(settings.general.autoSaveQueries).toBe(false);
  });

  it("should reset to defaults", async () => {
    render(
      <SettingsUI settingsService={settingsService} onClose={mockOnClose} />,
    );

    // Make a change
    const autoSaveCheckbox = screen.getByRole("checkbox", {
      name: /auto-save queries/i,
    });
    fireEvent.click(autoSaveCheckbox);

    // Reset
    const resetButton = screen.getByText("Reset to Defaults");
    fireEvent.click(resetButton);

    await waitFor(() => {
      expect(autoSaveCheckbox).toBeChecked();
    });
  });

  it("should handle input validation", async () => {
    render(
      <SettingsUI settingsService={settingsService} onClose={mockOnClose} />,
    );

    // Switch to database tab
    const databaseTab = screen.getByText("Database");
    fireEvent.click(databaseTab);

    await waitFor(() => {
      const timeoutInput = screen.getByDisplayValue("30");
      fireEvent.change(timeoutInput, { target: { value: "-10" } });
      fireEvent.blur(timeoutInput);
    });

    await waitFor(() => {
      expect(screen.getByText("Value must be positive")).toBeInTheDocument();
    });
  });

  it("should handle export settings", async () => {
    render(
      <SettingsUI settingsService={settingsService} onClose={mockOnClose} />,
    );

    const advancedTab = screen.getByText("Advanced");
    fireEvent.click(advancedTab);

    await waitFor(() => {
      const exportButton = screen.getByText("Export Settings");
      expect(exportButton).toBeInTheDocument();
    });
  });

  it("should have proper accessibility attributes", () => {
    render(
      <SettingsUI settingsService={settingsService} onClose={mockOnClose} />,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-labelledby", "settings-title");

    const tabs = screen.getAllByRole("tab");
    expect(tabs.length).toBe(5);

    for (const tab of tabs) {
      expect(tab).toHaveAttribute("type", "button");
    }
  });
});
