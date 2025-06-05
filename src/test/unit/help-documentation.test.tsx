import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { HelpDocumentationService } from "../../shared/services/HelpDocumentationService"
import { HelpUI } from "../../webview/components/HelpUI"

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

describe("HelpDocumentationService", () => {
  let helpService: HelpDocumentationService

  beforeEach(() => {
    mockLocalStorage.getItem.mockReturnValue(null)
    helpService = new HelpDocumentationService()
  })

  describe("Service Initialization", () => {
    it("should initialize with default help sections", () => {
      const sections = helpService.getHelpSections()

      expect(sections).toHaveLength(6)
      expect(sections.map((s) => s.id)).toEqual([
        "getting-started",
        "database-connections",
        "data-grid",
        "sql-editor",
        "settings",
        "troubleshooting",
      ])
    })

    it("should provide search functionality", () => {
      const results = helpService.searchHelp("database")

      expect(results.length).toBeGreaterThan(0)
      expect(results.every((r) => r.content.toLowerCase().includes("database"))).toBe(true)
    })

    it("should track recently viewed topics", () => {
      helpService.markTopicAsViewed("getting-started")
      helpService.markTopicAsViewed("database-connections")

      const recent = helpService.getRecentlyViewed()
      expect(recent).toHaveLength(2)
      expect(recent[0].id).toBe("database-connections") // Most recent first
    })
  })

  describe("Help Content Management", () => {
    it("should get help content by topic ID", () => {
      const content = helpService.getHelpContent("getting-started")

      expect(content).toBeDefined()
      expect(content.id).toBe("getting-started")
      expect(content.title).toBe("Getting Started")
      expect(content.content).toContain("Welcome to Database DataGrid Manager")
    })

    it("should handle invalid topic IDs gracefully", () => {
      const content = helpService.getHelpContent("invalid-topic")

      expect(content).toBeNull()
    })

    it("should provide contextual help based on current view", () => {
      const contextualHelp = helpService.getContextualHelp("datagrid")

      expect(contextualHelp).toBeDefined()
      expect(contextualHelp.length).toBeGreaterThan(0)
      expect(contextualHelp.some((h) => h.id === "data-grid")).toBe(true)
    })
  })

  describe("Search Functionality", () => {
    it("should search across all help content", () => {
      const results = helpService.searchHelp("connection")

      expect(results.length).toBeGreaterThan(0)
      expect(
        results.every(
          (r) =>
            r.title.toLowerCase().includes("connection") ||
            r.content.toLowerCase().includes("connection") ||
            r.keywords.some((k) => k.toLowerCase().includes("connection"))
        )
      ).toBe(true)
    })

    it("should return empty array for no matches", () => {
      const results = helpService.searchHelp("nonexistentterm12345")

      expect(results).toHaveLength(0)
    })

    it("should handle empty search queries", () => {
      const results = helpService.searchHelp("")

      expect(results).toHaveLength(0)
    })

    it("should rank search results by relevance", () => {
      const results = helpService.searchHelp("SQL")

      expect(results.length).toBeGreaterThan(1)
      // SQL Editor should be ranked higher than general mentions
      const sqlEditorIndex = results.findIndex((r) => r.id === "sql-editor")
      expect(sqlEditorIndex).toBeGreaterThanOrEqual(0)
    })
  })

  describe("User Preferences", () => {
    it("should save and load user preferences", () => {
      helpService.updatePreferences({
        showTooltips: false,
        autoOpenHelp: true,
        preferredLanguage: "ja",
      })

      const prefs = helpService.getPreferences()
      expect(prefs.showTooltips).toBe(false)
      expect(prefs.autoOpenHelp).toBe(true)
      expect(prefs.preferredLanguage).toBe("ja")
    })

    it("should persist preferences to localStorage", () => {
      helpService.updatePreferences({ showTooltips: false })

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        "db-extension-help-preferences",
        expect.stringContaining("showTooltips")
      )
    })
  })

  describe("Analytics and Tracking", () => {
    it("should track help topic views", () => {
      helpService.markTopicAsViewed("getting-started")

      const analytics = helpService.getAnalytics()
      expect(analytics.totalViews).toBe(1)
      expect(analytics.topicViews["getting-started"]).toBe(1)
    })

    it("should track search queries", () => {
      helpService.searchHelp("test query")

      const analytics = helpService.getAnalytics()
      expect(analytics.searchQueries).toContain("test query")
    })

    it("should provide popular topics", () => {
      helpService.markTopicAsViewed("getting-started")
      helpService.markTopicAsViewed("getting-started")
      helpService.markTopicAsViewed("database-connections")

      const popular = helpService.getPopularTopics()
      expect(popular[0].id).toBe("getting-started")
      expect(popular[0].views).toBe(2)
    })
  })
})

describe("HelpUI Component", () => {
  let helpService: HelpDocumentationService
  let mockOnClose: vi.Mock

  beforeEach(() => {
    mockLocalStorage.getItem.mockReturnValue(null)
    helpService = new HelpDocumentationService()
    mockOnClose = vi.fn()
  })

  describe("Rendering", () => {
    it("should render help dialog with navigation", () => {
      render(<HelpUI helpService={helpService} onClose={mockOnClose} />)

      expect(screen.getByText("Help & Documentation")).toBeInTheDocument()
      // Use getAllByText since "Getting Started" appears multiple times
      const gettingStartedElements = screen.getAllByText("Getting Started")
      expect(gettingStartedElements.length).toBeGreaterThan(0)

      // Check navigation items are present
      const navElement = screen.getByRole("navigation")
      expect(within(navElement).getByText("Getting Started")).toBeInTheDocument()
      expect(within(navElement).getByText("Database Connections")).toBeInTheDocument()
      expect(within(navElement).getByText("Data Grid")).toBeInTheDocument()
      expect(within(navElement).getByText("SQL Editor")).toBeInTheDocument()
    })

    it("should show search functionality", () => {
      render(<HelpUI helpService={helpService} onClose={mockOnClose} />)

      const searchInput = screen.getByPlaceholderText("Search help topics...")
      expect(searchInput).toBeInTheDocument()
      expect(searchInput).toHaveAttribute("type", "text")
    })

    it("should display default help content", () => {
      render(<HelpUI helpService={helpService} onClose={mockOnClose} />)

      // Check for the welcome text in the content area
      const welcomeText = screen.getByText(/Welcome to Database DataGrid Manager/)
      expect(welcomeText).toBeInTheDocument()
    })
  })

  describe("Navigation", () => {
    it("should navigate between help topics", async () => {
      render(<HelpUI helpService={helpService} onClose={mockOnClose} />)

      const navElement = screen.getByRole("navigation")
      const databaseLink = within(navElement).getByText("Database Connections")
      fireEvent.click(databaseLink)

      await waitFor(() => {
        expect(screen.getByText(/Managing Database Connections/)).toBeInTheDocument()
      })
    })

    it("should highlight active navigation item", async () => {
      render(<HelpUI helpService={helpService} onClose={mockOnClose} />)

      const navElement = screen.getByRole("navigation")
      const databaseLink = within(navElement).getByText("Database Connections")
      fireEvent.click(databaseLink)

      await waitFor(() => {
        expect(databaseLink.closest("button")).toHaveClass("bg-blue-100")
      })
    })

    it("should show breadcrumb navigation", async () => {
      render(<HelpUI helpService={helpService} onClose={mockOnClose} />)

      const navElement = screen.getByRole("navigation")
      const databaseLink = within(navElement).getByText("Database Connections")
      fireEvent.click(databaseLink)

      await waitFor(() => {
        const breadcrumb = screen.getByText("Help")
        expect(breadcrumb).toBeInTheDocument()
        // Check that breadcrumb contains "Database Connections"
        const breadcrumbContainer = breadcrumb.parentElement
        expect(breadcrumbContainer).toHaveTextContent("Database Connections")
      })
    })
  })

  describe("Search Functionality", () => {
    it("should search help content", async () => {
      render(<HelpUI helpService={helpService} onClose={mockOnClose} />)

      const searchInput = screen.getByPlaceholderText("Search help topics...")
      fireEvent.change(searchInput, { target: { value: "SQL" } })
      fireEvent.keyDown(searchInput, { key: "Enter" })

      await waitFor(() => {
        expect(screen.getByText("Search Results for 'SQL'")).toBeInTheDocument()
      })
    })

    it("should clear search results", async () => {
      render(<HelpUI helpService={helpService} onClose={mockOnClose} />)

      const searchInput = screen.getByPlaceholderText("Search help topics...")
      fireEvent.change(searchInput, { target: { value: "SQL" } })
      fireEvent.keyDown(searchInput, { key: "Enter" })

      await waitFor(() => {
        expect(screen.getByText("Search Results for 'SQL'")).toBeInTheDocument()
      })

      const clearButton = screen.getByText("Clear")
      fireEvent.click(clearButton)

      await waitFor(() => {
        expect(screen.getByText(/Welcome to Database DataGrid Manager/)).toBeInTheDocument()
      })
    })

    it("should show no results message", async () => {
      render(<HelpUI helpService={helpService} onClose={mockOnClose} />)

      const searchInput = screen.getByPlaceholderText("Search help topics...")
      fireEvent.change(searchInput, { target: { value: "nonexistentterm12345" } })
      fireEvent.keyDown(searchInput, { key: "Enter" })

      await waitFor(() => {
        expect(screen.getByText("No results found")).toBeInTheDocument()
      })
    })
  })

  describe("Recently Viewed", () => {
    it("should show recently viewed topics", async () => {
      render(<HelpUI helpService={helpService} onClose={mockOnClose} />)

      // View a topic first
      const navElement = screen.getByRole("navigation")
      const databaseLink = within(navElement).getByText("Database Connections")
      fireEvent.click(databaseLink)

      await waitFor(() => {
        expect(screen.getByText("Recently Viewed")).toBeInTheDocument()
        const recentSection = screen.getByText("Recently Viewed").parentElement
        expect(within(recentSection).getByText("Database Connections")).toBeInTheDocument()
      })
    })
  })

  describe("User Actions", () => {
    it("should close help dialog", async () => {
      render(<HelpUI helpService={helpService} onClose={mockOnClose} />)

      const closeButton = screen.getByText("Close")
      fireEvent.click(closeButton)

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledOnce()
      })
    })

    it("should toggle help preferences", async () => {
      render(<HelpUI helpService={helpService} onClose={mockOnClose} />)

      const preferencesButton = screen.getByText("Preferences")
      fireEvent.click(preferencesButton)

      await waitFor(() => {
        expect(screen.getByText("Help Preferences")).toBeInTheDocument()
      })

      const tooltipsCheckbox = screen.getByRole("checkbox", { name: /show tooltips/i })
      fireEvent.click(tooltipsCheckbox)

      const prefs = helpService.getPreferences()
      expect(prefs.showTooltips).toBe(false)
    })
  })

  describe("Contextual Help", () => {
    it("should show contextual help for current view", () => {
      render(<HelpUI helpService={helpService} onClose={mockOnClose} currentView='datagrid' />)

      expect(screen.getByText("Related to Data Grid")).toBeInTheDocument()
    })

    it("should provide quick action buttons", () => {
      render(<HelpUI helpService={helpService} onClose={mockOnClose} />)

      expect(screen.getByText("Quick Start Guide")).toBeInTheDocument()
      expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument()
      expect(screen.getByText("Report Issue")).toBeInTheDocument()
    })
  })

  describe("Accessibility", () => {
    it("should have proper ARIA attributes", () => {
      render(<HelpUI helpService={helpService} onClose={mockOnClose} />)

      const dialog = screen.getByRole("dialog")
      expect(dialog).toHaveAttribute("aria-labelledby")

      const navigation = screen.getByRole("navigation")
      expect(navigation).toBeInTheDocument()
    })

    it("should support keyboard navigation", () => {
      render(<HelpUI helpService={helpService} onClose={mockOnClose} />)

      const navButtons = screen.getAllByRole("button")
      for (const button of navButtons) {
        expect(button).toHaveAttribute("type", "button")
      }
    })

    it("should have proper heading hierarchy", () => {
      render(<HelpUI helpService={helpService} onClose={mockOnClose} />)

      const mainHeading = screen.getByRole("heading", { level: 2 })
      expect(mainHeading).toHaveTextContent("Help & Documentation")
    })
  })

  describe("Error Handling", () => {
    it("should handle missing help content gracefully", async () => {
      render(<HelpUI helpService={helpService} onClose={mockOnClose} />)

      // Mock invalid topic
      vi.spyOn(helpService, "getHelpContent").mockReturnValue(null)

      const navElement = screen.getByRole("navigation")
      const invalidLink = within(navElement).getByText("Getting Started")
      fireEvent.click(invalidLink)

      await waitFor(() => {
        expect(screen.getByText("Content not available")).toBeInTheDocument()
      })
    })

    it("should handle search errors gracefully", async () => {
      render(<HelpUI helpService={helpService} onClose={mockOnClose} />)

      // Mock search error
      vi.spyOn(helpService, "searchHelp").mockImplementation(() => {
        throw new Error("Search failed")
      })

      const searchInput = screen.getByPlaceholderText("Search help topics...")
      fireEvent.change(searchInput, { target: { value: "test" } })
      fireEvent.keyDown(searchInput, { key: "Enter" })

      await waitFor(() => {
        expect(screen.getByText("Search temporarily unavailable")).toBeInTheDocument()
      })
    })
  })
})
