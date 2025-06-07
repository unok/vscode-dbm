export interface HelpTopic {
  id: string;
  title: string;
  content: string;
  category: string;
  keywords: string[];
  relatedTopics?: string[];
}

export interface HelpPreferences {
  showTooltips: boolean;
  autoOpenHelp: boolean;
  preferredLanguage: string;
}

export interface HelpAnalytics {
  totalViews: number;
  topicViews: Record<string, number>;
  searchQueries: string[];
}

export interface PopularTopic {
  id: string;
  title: string;
  views: number;
}

export class HelpDocumentationService {
  private helpSections: HelpTopic[];
  private recentlyViewed: HelpTopic[] = [];
  private preferences: HelpPreferences;
  private analytics: HelpAnalytics = {
    totalViews: 0,
    topicViews: {},
    searchQueries: [],
  };

  constructor() {
    this.helpSections = this.initializeHelpSections();
    this.preferences = this.loadPreferences();
    this.loadAnalytics();
  }

  private initializeHelpSections(): HelpTopic[] {
    return [
      {
        id: "getting-started",
        title: "Getting Started",
        category: "basics",
        content: `Welcome to Database DataGrid Manager! This extension provides a powerful interface for managing databases directly within VS Code.

## Quick Start
1. Open the Database Manager from the sidebar
2. Click "Add Connection" to connect to a database
3. Start exploring your data with our intuitive DataGrid interface

## Key Features
- Multi-database support (MySQL, PostgreSQL, SQLite)
- Advanced DataGrid with inline editing
- SQL Editor with IntelliSense
- Export/Import functionality
- AI-powered assistance`,
        keywords: ["start", "begin", "introduction", "overview", "welcome"],
        relatedTopics: ["database-connections", "data-grid"],
      },
      {
        id: "database-connections",
        title: "Database Connections",
        category: "connections",
        content: `## Managing Database Connections

### Adding a Connection
1. Click the "Add Connection" button
2. Select your database type
3. Enter connection details
4. Test the connection
5. Save your configuration

### Connection Security
- All credentials are encrypted
- SSL/TLS support available
- SSH tunnel connections supported

### Troubleshooting
- Check firewall settings
- Verify database server is running
- Ensure correct credentials`,
        keywords: [
          "connection",
          "connect",
          "database",
          "mysql",
          "postgresql",
          "sqlite",
        ],
        relatedTopics: ["getting-started", "troubleshooting"],
      },
      {
        id: "data-grid",
        title: "Data Grid",
        category: "features",
        content: `## DataGrid Features

### Viewing Data
- Sort columns by clicking headers
- Filter data using the search bar
- Resize columns by dragging borders

### Editing Data
- Double-click cells to edit
- Press Enter to save changes
- Press Escape to cancel editing

### Advanced Features
- Multi-row selection with Ctrl/Cmd
- Copy/paste support
- Export selected data
- AI-powered value suggestions`,
        keywords: ["grid", "table", "data", "edit", "view", "datagrid"],
        relatedTopics: ["sql-editor", "settings"],
      },
      {
        id: "sql-editor",
        title: "SQL Editor",
        category: "features",
        content: `## SQL Editor

### Writing Queries
- IntelliSense for table and column names
- Syntax highlighting
- Auto-formatting with Shift+Alt+F

### Executing Queries
- Run selected text with Ctrl/Cmd+Enter
- Execute all with Ctrl/Cmd+Shift+Enter
- View execution plans

### Query History
- Access recent queries
- Save favorite queries
- Export query results`,
        keywords: ["sql", "query", "editor", "execute", "script"],
        relatedTopics: ["data-grid", "database-connections"],
      },
      {
        id: "settings",
        title: "Settings",
        category: "configuration",
        content: `## Extension Settings

### General Settings
- Theme preferences
- Default export format
- Auto-save options

### Editor Settings
- Font size and family
- Tab size
- Word wrap

### Performance Settings
- Query timeout
- Result set limits
- Cache settings`,
        keywords: ["settings", "preferences", "configuration", "options"],
        relatedTopics: ["getting-started"],
      },
      {
        id: "troubleshooting",
        title: "Troubleshooting",
        category: "support",
        content: `## Common Issues

### Connection Problems
- Verify network connectivity
- Check database server status
- Confirm firewall rules

### Performance Issues
- Reduce result set size
- Enable query caching
- Check extension logs

### Getting Help
- View extension logs
- Report issues on GitHub
- Contact support`,
        keywords: ["trouble", "problem", "issue", "error", "help", "support"],
        relatedTopics: ["database-connections", "settings"],
      },
    ];
  }

  private loadPreferences(): HelpPreferences {
    const stored = localStorage.getItem("db-extension-help-preferences");
    if (stored) {
      return JSON.parse(stored);
    }
    return {
      showTooltips: true,
      autoOpenHelp: false,
      preferredLanguage: "en",
    };
  }

  private savePreferences(): void {
    localStorage.setItem(
      "db-extension-help-preferences",
      JSON.stringify(this.preferences),
    );
  }

  private loadAnalytics(): void {
    const stored = localStorage.getItem("db-extension-help-analytics");
    if (stored) {
      this.analytics = JSON.parse(stored);
    }
  }

  private saveAnalytics(): void {
    localStorage.setItem(
      "db-extension-help-analytics",
      JSON.stringify(this.analytics),
    );
  }

  getHelpSections(): HelpTopic[] {
    return this.helpSections;
  }

  getHelpContent(topicId: string): HelpTopic | null {
    return this.helpSections.find((section) => section.id === topicId) || null;
  }

  searchHelp(query: string): HelpTopic[] {
    if (!query.trim()) {
      return [];
    }

    const lowerQuery = query.toLowerCase();
    const results: Array<{ topic: HelpTopic; score: number }> = [];

    for (const topic of this.helpSections) {
      let score = 0;

      // Title match (highest priority)
      if (topic.title.toLowerCase().includes(lowerQuery)) {
        score += 10;
      }

      // Keyword match (high priority)
      if (topic.keywords.some((k) => k.toLowerCase().includes(lowerQuery))) {
        score += 5;
      }

      // Content match (normal priority)
      if (topic.content.toLowerCase().includes(lowerQuery)) {
        score += 1;
      }

      if (score > 0) {
        results.push({ topic, score });
      }
    }

    // Track search query
    this.analytics.searchQueries.push(query);
    this.saveAnalytics();

    // Sort by score (descending) and return topics
    return results.sort((a, b) => b.score - a.score).map((r) => r.topic);
  }

  markTopicAsViewed(topicId: string): void {
    const topic = this.getHelpContent(topicId);
    if (!topic) return;

    // Update recently viewed
    this.recentlyViewed = [
      topic,
      ...this.recentlyViewed.filter((t) => t.id !== topicId),
    ].slice(0, 5);

    // Update analytics
    this.analytics.totalViews++;
    this.analytics.topicViews[topicId] =
      (this.analytics.topicViews[topicId] || 0) + 1;
    this.saveAnalytics();
  }

  getRecentlyViewed(): HelpTopic[] {
    return this.recentlyViewed;
  }

  getContextualHelp(currentView: string): HelpTopic[] {
    const contextMap: Record<string, string[]> = {
      datagrid: ["data-grid", "sql-editor"],
      connections: ["database-connections", "troubleshooting"],
      editor: ["sql-editor", "data-grid"],
      settings: ["settings", "getting-started"],
    };

    const topicIds = contextMap[currentView] || [];
    return topicIds
      .map((id) => this.getHelpContent(id))
      .filter((topic): topic is HelpTopic => topic !== null);
  }

  updatePreferences(updates: Partial<HelpPreferences>): void {
    this.preferences = { ...this.preferences, ...updates };
    this.savePreferences();
  }

  getPreferences(): HelpPreferences {
    return this.preferences;
  }

  getAnalytics(): HelpAnalytics {
    return this.analytics;
  }

  getPopularTopics(): PopularTopic[] {
    return Object.entries(this.analytics.topicViews)
      .map(([id, views]) => {
        const topic = this.getHelpContent(id);
        return topic ? { id, title: topic.title, views } : null;
      })
      .filter((topic): topic is PopularTopic => topic !== null)
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);
  }
}
