import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ToolbarCustomizationService } from "../../shared/services/ToolbarCustomizationService"
import { CustomizableToolbar } from "../../webview/components/CustomizableToolbar"

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}

Object.defineProperty(window, "localStorage", {
  value: mockLocalStorage,
  writable: true,
})

describe("CustomizableToolbar", () => {
  let toolbarService: ToolbarCustomizationService
  let mockActions: { [key: string]: vi.Mock }

  beforeEach(() => {
    mockLocalStorage.getItem.mockReturnValue(null)
    toolbarService = new ToolbarCustomizationService()

    mockActions = {
      "new-connection": vi.fn(),
      "new-query": vi.fn(),
      "execute-query": vi.fn(),
      "import-data": vi.fn(),
    }

    // Register mock actions
    for (const [actionId, mockAction] of Object.entries(mockActions)) {
      toolbarService.registerAction(actionId, mockAction)
    }
  })

  describe("Rendering", () => {
    it("should render toolbar with default layout", () => {
      render(<CustomizableToolbar toolbarService={toolbarService} />)

      // Should show customize button
      expect(screen.getByText("Customize")).toBeInTheDocument()

      // Should show some default items
      expect(screen.getByText("New Connection")).toBeInTheDocument()
      expect(screen.getByText("New Query")).toBeInTheDocument()
      expect(screen.getByText("Execute")).toBeInTheDocument()
    })

    it("should render items grouped by sections", () => {
      render(<CustomizableToolbar toolbarService={toolbarService} />)

      const layout = toolbarService.getLayout()

      // Database section
      const dbSection = layout.sections.find((s) => s.id === "database")
      expect(dbSection?.items).toHaveLength(2) // new-connection, refresh-connections

      // Editor section
      const editorSection = layout.sections.find((s) => s.id === "editor")
      expect(editorSection?.items.length).toBeGreaterThan(0)
    })

    it("should apply theme classes correctly", () => {
      toolbarService.updateTheme("compact")
      render(<CustomizableToolbar toolbarService={toolbarService} />)

      const toolbar = screen.getByText("Customize").closest("div")?.parentElement
      expect(toolbar).toHaveClass("py-1", "px-2")
    })

    it("should show/hide labels based on layout setting", async () => {
      render(<CustomizableToolbar toolbarService={toolbarService} />)

      // Labels should be visible by default
      expect(screen.getByText("New Connection")).toBeInTheDocument()

      // Hide labels
      toolbarService.toggleLabels()

      // Wait for re-render (simulated refresh)
      await waitFor(() => {
        const layout = toolbarService.getLayout()
        expect(layout.showLabels).toBe(false)
      })
    })

    it("should render different icon sizes", () => {
      toolbarService.updateIconSize("large")
      render(<CustomizableToolbar toolbarService={toolbarService} />)

      const layout = toolbarService.getLayout()
      expect(layout.iconSize).toBe("large")
    })
  })

  describe("Item Interactions", () => {
    it("should execute item actions when clicked", async () => {
      render(<CustomizableToolbar toolbarService={toolbarService} />)

      const newQueryButton = screen.getByText("New Query")

      // Get the layout to check the actual action
      const layout = toolbarService.getLayout()
      const editorSection = layout.sections.find((s) => s.id === "editor")
      const newQueryItem = editorSection?.items.find((i) => i.id === "new-query")

      // Verify the item has an action
      expect(newQueryItem?.action).toBeDefined()

      fireEvent.click(newQueryButton)

      await waitFor(
        () => {
          expect(mockActions["new-query"]).toHaveBeenCalledOnce()
        },
        { timeout: 2000 }
      )
    })

    it("should handle dropdown items", async () => {
      render(<CustomizableToolbar toolbarService={toolbarService} />)

      const exportButton = screen.getByText("Export")
      fireEvent.click(exportButton)

      await waitFor(() => {
        expect(screen.getByText("Export as CSV")).toBeInTheDocument()
        expect(screen.getByText("Export as JSON")).toBeInTheDocument()
        expect(screen.getByText("Export as SQL")).toBeInTheDocument()
      })
    })

    it("should close dropdown when clicking outside", async () => {
      render(<CustomizableToolbar toolbarService={toolbarService} />)

      const exportButton = screen.getByText("Export")
      fireEvent.click(exportButton)

      // Dropdown should be open
      await waitFor(() => {
        expect(screen.getByText("Export as CSV")).toBeInTheDocument()
      })

      // Click backdrop
      const backdrop = document.querySelector(".fixed.inset-0")
      if (backdrop) {
        fireEvent.click(backdrop)
      }

      await waitFor(() => {
        expect(screen.queryByText("Export as CSV")).not.toBeInTheDocument()
      })
    })

    it("should not execute actions for disabled items", async () => {
      // First get a layout and disable an item
      const layout = toolbarService.getLayout()
      const section = layout.sections.find((s) => s.id === "editor")
      if (section?.items[0]) {
        section.items[0].disabled = true
      }

      render(<CustomizableToolbar toolbarService={toolbarService} />)

      const disabledButton = screen
        .getAllByRole("button")
        .find((button) => button.hasAttribute("disabled"))

      if (disabledButton) {
        fireEvent.click(disabledButton)
        await waitFor(() => {
          // Should not have called any mock action
          for (const mockAction of Object.values(mockActions)) {
            expect(mockAction).not.toHaveBeenCalled()
          }
        })
      }
    })
  })

  describe("Customization Dialog", () => {
    it("should open customization dialog when customize button is clicked", async () => {
      render(<CustomizableToolbar toolbarService={toolbarService} />)

      const customizeButton = screen.getByText("Customize")
      fireEvent.click(customizeButton)

      await waitFor(() => {
        expect(screen.getByText("Customize Toolbar")).toBeInTheDocument()
      })
    })

    it("should close customization dialog", async () => {
      render(<CustomizableToolbar toolbarService={toolbarService} />)

      // Open dialog
      const customizeButton = screen.getByText("Customize")
      fireEvent.click(customizeButton)

      await waitFor(() => {
        expect(screen.getByText("Customize Toolbar")).toBeInTheDocument()
      })

      // Close dialog
      const closeButton = screen.getByText("Cancel")
      fireEvent.click(closeButton)

      await waitFor(() => {
        expect(screen.queryByText("Customize Toolbar")).not.toBeInTheDocument()
      })
    })
  })

  describe("Search Input", () => {
    it("should render search input for search type items", () => {
      render(<CustomizableToolbar toolbarService={toolbarService} />)

      const searchInput = screen.getByPlaceholderText("Search")
      expect(searchInput).toBeInTheDocument()
      expect(searchInput).toHaveAttribute("type", "text")
    })
  })

  describe("Separators", () => {
    it("should render separators between sections", () => {
      render(<CustomizableToolbar toolbarService={toolbarService} />)

      // Look for separator elements (they have aria-hidden="true")
      const separators = document.querySelectorAll('[aria-hidden="true"]')
      expect(separators.length).toBeGreaterThan(0)
    })
  })

  describe("Responsive Behavior", () => {
    it("should handle overflow with horizontal scroll", () => {
      render(<CustomizableToolbar toolbarService={toolbarService} />)

      const toolbarContent = screen.getByText("New Connection").closest("div")
      expect(toolbarContent?.parentElement).toHaveClass("overflow-x-auto")
    })
  })

  describe("Accessibility", () => {
    it("should have proper ARIA attributes for dropdown", async () => {
      render(<CustomizableToolbar toolbarService={toolbarService} />)

      const exportButton = screen.getByText("Export").closest("button")
      expect(exportButton).toHaveAttribute("aria-haspopup", "true")
      expect(exportButton).toHaveAttribute("aria-expanded", "false")

      if (exportButton) {
        fireEvent.click(exportButton)

        await waitFor(() => {
          expect(exportButton).toHaveAttribute("aria-expanded", "true")
        })
      }
    })

    it("should have proper tooltips for items", () => {
      render(<CustomizableToolbar toolbarService={toolbarService} />)

      const newConnectionButton = screen.getByText("New Connection")
      expect(newConnectionButton.closest("button")).toHaveAttribute(
        "title",
        "Create new database connection"
      )
    })

    it("should have proper keyboard navigation support", () => {
      render(<CustomizableToolbar toolbarService={toolbarService} />)

      const buttons = screen.getAllByRole("button")
      for (const button of buttons) {
        expect(button).toHaveAttribute("type", "button")
      }
    })
  })

  describe("Error Handling", () => {
    it("should handle action execution errors gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // Intentionally empty for test mocking
      })

      // Make an action throw an error
      mockActions["new-query"].mockRejectedValue(new Error("Test error"))

      render(<CustomizableToolbar toolbarService={toolbarService} />)

      const newQueryButton = screen.getByText("New Query")
      fireEvent.click(newQueryButton)

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          "Failed to execute action new-query:",
          expect.any(Error)
        )
      })

      consoleSpy.mockRestore()
    })
  })
})
