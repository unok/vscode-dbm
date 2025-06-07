import type React from "react";

interface LayoutProps {
  children: React.ReactNode;
  currentView: string;
  onViewChange: (view: "dashboard" | "explorer" | "datagrid" | "sql") => void;
  theme: "dark" | "light";
  onShowSettings?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  currentView,
  onViewChange,
  theme,
  onShowSettings,
}) => {
  return (
    <div
      className={`flex flex-col h-screen ${theme === "dark" ? "bg-gray-900" : "bg-white"}`}
    >
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <svg
              className="w-6 h-6 text-blue-400"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V8zm0 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2z"
                clipRule="evenodd"
              />
            </svg>
            <span className="font-semibold text-white">DB Manager</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <nav className="flex space-x-2">
            <button
              type="button"
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                currentView === "dashboard"
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:text-white hover:bg-gray-700"
              }`}
              onClick={() => onViewChange("dashboard")}
            >
              Dashboard
            </button>
            <button
              type="button"
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                currentView === "explorer"
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:text-white hover:bg-gray-700"
              }`}
              onClick={() => onViewChange("explorer")}
            >
              Explorer
            </button>
            <button
              type="button"
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                currentView === "datagrid"
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:text-white hover:bg-gray-700"
              }`}
              onClick={() => onViewChange("datagrid")}
            >
              DataGrid
            </button>
            <button
              type="button"
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                currentView === "sql"
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:text-white hover:bg-gray-700"
              }`}
              onClick={() => onViewChange("sql")}
            >
              SQL
            </button>
          </nav>

          {onShowSettings && (
            <button
              type="button"
              className="p-2 rounded text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
              onClick={onShowSettings}
              title="Settings"
            >
              <svg
                className="w-4 h-4"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">{children}</main>

      {/* Status Bar */}
      <footer className="flex items-center justify-between px-4 py-2 text-xs bg-gray-800 border-t border-gray-700">
        <div className="flex items-center space-x-4">
          <span className="text-gray-400">Ready</span>
          <span className="text-gray-400">|</span>
          <span className="text-gray-400">React 19 + Vite</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-gray-400">Theme: {theme}</span>
        </div>
      </footer>
    </div>
  );
};
