import type React from "react"

interface LayoutProps {
  children: React.ReactNode
  currentView: string
  onViewChange: (view: "dashboard" | "explorer" | "datagrid" | "sql") => void
  theme: "dark" | "light"
}

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onViewChange, theme }) => {
  return (
    <div className={`flex flex-col h-screen ${theme === "dark" ? "bg-gray-900" : "bg-white"}`}>
      {/* Header */}
      <header className='flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800'>
        <div className='flex items-center space-x-4'>
          <div className='flex items-center space-x-2'>
            <svg className='w-6 h-6 text-blue-400' fill='currentColor' viewBox='0 0 20 20'>
              <path
                fillRule='evenodd'
                d='M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V8zm0 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2z'
                clipRule='evenodd'
              />
            </svg>
            <span className='font-semibold text-white'>DB Manager</span>
          </div>
        </div>

        <nav className='flex space-x-2'>
          <button
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
      </header>

      {/* Main Content */}
      <main className='flex-1 overflow-hidden'>{children}</main>

      {/* Status Bar */}
      <footer className='flex items-center justify-between px-4 py-2 text-xs bg-gray-800 border-t border-gray-700'>
        <div className='flex items-center space-x-4'>
          <span className='text-gray-400'>Ready</span>
          <span className='text-gray-400'>|</span>
          <span className='text-gray-400'>React 19 + Vite</span>
        </div>
        <div className='flex items-center space-x-2'>
          <span className='text-gray-400'>Theme: {theme}</span>
        </div>
      </footer>
    </div>
  )
}
