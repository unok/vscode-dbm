import type React from "react"
import { useEffect, useState } from "react"
import type {
  HelpDocumentationService,
  HelpPreferences,
  HelpTopic,
} from "../../shared/services/HelpDocumentationService"

interface HelpUIProps {
  helpService: HelpDocumentationService
  onClose: () => void
  currentView?: string
}

export const HelpUI: React.FC<HelpUIProps> = ({ helpService, onClose, currentView }) => {
  const [selectedTopic, setSelectedTopic] = useState<HelpTopic | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<HelpTopic[]>([])
  const [showPreferences, setShowPreferences] = useState(false)
  const [preferences, setPreferences] = useState<HelpPreferences>(helpService.getPreferences())
  const [recentlyViewed, setRecentlyViewed] = useState<HelpTopic[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState(false)

  useEffect(() => {
    // Load default content
    const defaultTopic = helpService.getHelpContent("getting-started")
    setSelectedTopic(defaultTopic)
    setRecentlyViewed(helpService.getRecentlyViewed())
  }, [helpService])

  const handleTopicSelect = (topicId: string) => {
    const topic = helpService.getHelpContent(topicId)
    if (topic) {
      setSelectedTopic(topic)
      helpService.markTopicAsViewed(topicId)
      setRecentlyViewed(helpService.getRecentlyViewed())
      setIsSearching(false)
      setSearchQuery("")
    } else {
      setSelectedTopic(null)
    }
  }

  const handleSearch = () => {
    if (!searchQuery.trim()) return

    try {
      setSearchError(false)
      const results = helpService.searchHelp(searchQuery)
      setSearchResults(results)
      setIsSearching(true)
    } catch {
      setSearchError(true)
      setSearchResults([])
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch()
    }
  }

  const clearSearch = () => {
    setSearchQuery("")
    setSearchResults([])
    setIsSearching(false)
    setSearchError(false)
    const defaultTopic = helpService.getHelpContent("getting-started")
    setSelectedTopic(defaultTopic)
  }

  const togglePreference = (key: keyof HelpPreferences) => {
    const newPrefs = { ...preferences }
    if (key === "showTooltips" || key === "autoOpenHelp") {
      newPrefs[key] = !newPrefs[key]
    }
    setPreferences(newPrefs)
    helpService.updatePreferences(newPrefs)
  }

  const contextualHelp = currentView ? helpService.getContextualHelp(currentView) : []
  const sections = helpService.getHelpSections()

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
      <div
        className='bg-white rounded-lg shadow-xl w-full max-w-4xl h-3/4 flex flex-col'
        role='dialog'
        aria-labelledby='help-title'
      >
        {/* Header */}
        <div className='flex items-center justify-between px-6 py-4 border-b'>
          <h2 id='help-title' className='text-xl font-semibold'>
            Help & Documentation
          </h2>
          <div className='flex items-center gap-2'>
            <button
              type='button'
              onClick={() => setShowPreferences(!showPreferences)}
              className='px-3 py-1 text-sm text-gray-600 hover:text-gray-800'
            >
              Preferences
            </button>
            <button
              type='button'
              onClick={onClose}
              className='px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded'
            >
              Close
            </button>
          </div>
        </div>

        {/* Preferences Panel */}
        {showPreferences && (
          <div className='px-6 py-4 bg-gray-50 border-b'>
            <h3 className='font-medium mb-3'>Help Preferences</h3>
            <label className='flex items-center gap-2 mb-2'>
              <input
                type='checkbox'
                checked={preferences.showTooltips}
                onChange={() => togglePreference("showTooltips")}
                className='rounded'
              />
              <span>Show tooltips</span>
            </label>
            <label className='flex items-center gap-2'>
              <input
                type='checkbox'
                checked={preferences.autoOpenHelp}
                onChange={() => togglePreference("autoOpenHelp")}
                className='rounded'
              />
              <span>Auto-open help for new features</span>
            </label>
          </div>
        )}

        {/* Search Bar */}
        <div className='px-6 py-4 border-b'>
          <div className='flex gap-2'>
            <input
              type='text'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='Search help topics...'
              className='flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
            <button
              type='button'
              onClick={handleSearch}
              className='px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600'
            >
              Search
            </button>
            {isSearching && (
              <button
                type='button'
                onClick={clearSearch}
                className='px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300'
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className='flex-1 flex overflow-hidden'>
          {/* Sidebar */}
          <nav className='w-64 bg-gray-50 border-r overflow-y-auto'>
            <div className='p-4'>
              {/* Quick Actions */}
              <div className='mb-6'>
                <h3 className='font-medium text-sm text-gray-500 uppercase mb-2'>Quick Actions</h3>
                <button
                  type='button'
                  className='block w-full text-left px-3 py-2 text-sm hover:bg-gray-200 rounded'
                >
                  Quick Start Guide
                </button>
                <button
                  type='button'
                  className='block w-full text-left px-3 py-2 text-sm hover:bg-gray-200 rounded'
                >
                  Keyboard Shortcuts
                </button>
                <button
                  type='button'
                  className='block w-full text-left px-3 py-2 text-sm hover:bg-gray-200 rounded'
                >
                  Report Issue
                </button>
              </div>

              {/* Recently Viewed */}
              {recentlyViewed.length > 0 && (
                <div className='mb-6'>
                  <h3 className='font-medium text-sm text-gray-500 uppercase mb-2'>
                    Recently Viewed
                  </h3>
                  {recentlyViewed.map((topic) => (
                    <button
                      key={topic.id}
                      type='button'
                      onClick={() => handleTopicSelect(topic.id)}
                      className='block w-full text-left px-3 py-2 text-sm hover:bg-gray-200 rounded'
                    >
                      {topic.title}
                    </button>
                  ))}
                </div>
              )}

              {/* Contextual Help */}
              {contextualHelp.length > 0 && (
                <div className='mb-6'>
                  <h3 className='font-medium text-sm text-gray-500 uppercase mb-2'>
                    Related to {currentView === "datagrid" ? "Data Grid" : currentView}
                  </h3>
                  {contextualHelp.map((topic) => (
                    <button
                      key={topic.id}
                      type='button'
                      onClick={() => handleTopicSelect(topic.id)}
                      className='block w-full text-left px-3 py-2 text-sm hover:bg-gray-200 rounded'
                    >
                      {topic.title}
                    </button>
                  ))}
                </div>
              )}

              {/* All Topics */}
              <div>
                <h3 className='font-medium text-sm text-gray-500 uppercase mb-2'>All Topics</h3>
                {sections.map((section) => (
                  <button
                    key={section.id}
                    type='button'
                    onClick={() => handleTopicSelect(section.id)}
                    className={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-200 rounded ${
                      selectedTopic?.id === section.id && !isSearching ? "bg-blue-100" : ""
                    }`}
                  >
                    {section.title}
                  </button>
                ))}
              </div>
            </div>
          </nav>

          {/* Content Area */}
          <div className='flex-1 overflow-y-auto'>
            <div className='p-6'>
              {/* Breadcrumb */}
              <div className='mb-4 text-sm text-gray-600'>
                <span>Help</span>
                {selectedTopic && !isSearching && (
                  <>
                    <span className='mx-2'>/</span>
                    <span>{selectedTopic.title}</span>
                  </>
                )}
                {isSearching && (
                  <>
                    <span className='mx-2'>/</span>
                    <span>Search Results</span>
                  </>
                )}
              </div>

              {/* Content */}
              {searchError ? (
                <div className='text-center py-8'>
                  <p className='text-gray-600'>Search temporarily unavailable</p>
                </div>
              ) : isSearching ? (
                <div>
                  <h3 className='text-lg font-semibold mb-4'>Search Results for '{searchQuery}'</h3>
                  {searchResults.length > 0 ? (
                    <div className='space-y-4'>
                      {searchResults.map((result) => (
                        <button
                          key={result.id}
                          type='button'
                          className='p-4 border rounded-lg hover:bg-gray-50 cursor-pointer w-full text-left'
                          onClick={() => handleTopicSelect(result.id)}
                        >
                          <h4 className='font-medium'>{result.title}</h4>
                          <p className='text-sm text-gray-600 mt-1'>
                            {result.content.substring(0, 150)}...
                          </p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className='text-gray-600'>No results found</p>
                  )}
                </div>
              ) : selectedTopic ? (
                <div>
                  <h3 className='text-2xl font-semibold mb-4'>{selectedTopic.title}</h3>
                  <div className='prose prose-sm max-w-none'>
                    {selectedTopic.content.split("\n").map((line, i) => {
                      const key = `${selectedTopic.id}-line-${i}`
                      if (line.startsWith("##")) {
                        return (
                          <h4 key={key} className='text-lg font-medium mt-4 mb-2'>
                            {line.replace("##", "").trim()}
                          </h4>
                        )
                      }
                      if (line.startsWith("###")) {
                        return (
                          <h5 key={key} className='text-base font-medium mt-3 mb-2'>
                            {line.replace("###", "").trim()}
                          </h5>
                        )
                      }
                      if (line.startsWith("-")) {
                        return (
                          <li key={key} className='ml-4'>
                            {line.replace("-", "").trim()}
                          </li>
                        )
                      }
                      if (line.trim()) {
                        return (
                          <p key={key} className='mb-2'>
                            {line}
                          </p>
                        )
                      }
                      return null
                    })}
                  </div>
                </div>
              ) : (
                <div className='text-center py-8'>
                  <p className='text-gray-600'>Content not available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
