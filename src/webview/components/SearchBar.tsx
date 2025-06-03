import type React from "react"
import { useEffect, useRef, useState } from "react"

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  onFocus?: () => void
  onBlur?: () => void
  className?: string
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = "Search...",
  onFocus,
  onBlur,
  className = "",
}) => {
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFocus = () => {
    setIsFocused(true)
    onFocus?.()
  }

  const handleBlur = () => {
    setIsFocused(false)
    onBlur?.()
  }

  const handleClear = () => {
    onChange("")
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      if (value) {
        handleClear()
      } else {
        inputRef.current?.blur()
      }
    }
  }

  // Auto-focus on Ctrl+F or Cmd+F
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }

    document.addEventListener("keydown", handleGlobalKeyDown)
    return () => document.removeEventListener("keydown", handleGlobalKeyDown)
  }, [])

  return (
    <div className={`search-bar ${className}`}>
      <div className={`search-input-container ${isFocused ? "focused" : ""}`}>
        <div className='search-icon'>
          <SearchIcon />
        </div>

        <input
          ref={inputRef}
          type='text'
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className='search-input'
          spellCheck={false}
        />

        {value && (
          <button onClick={handleClear} className='search-clear-button' title='Clear search (Esc)'>
            <ClearIcon />
          </button>
        )}

        {!value && (
          <div className='search-shortcut'>
            <kbd className='search-shortcut-key'>Ctrl</kbd>
            <span className='search-shortcut-separator'>+</span>
            <kbd className='search-shortcut-key'>F</kbd>
          </div>
        )}
      </div>

      {value && (
        <div className='search-results-indicator'>
          <span className='text-xs text-gray-400'>
            Searching for: <span className='text-white'>{value}</span>
          </span>
        </div>
      )}
    </div>
  )
}

// Advanced search bar with filters
interface AdvancedSearchBarProps extends SearchBarProps {
  filters?: SearchFilter[]
  selectedFilters?: string[]
  onFilterChange?: (filters: string[]) => void
  showFilters?: boolean
}

interface SearchFilter {
  id: string
  label: string
  icon?: React.ReactNode
}

export const AdvancedSearchBar: React.FC<AdvancedSearchBarProps> = ({
  filters = [],
  selectedFilters = [],
  onFilterChange,
  showFilters = false,
  ...searchProps
}) => {
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)

  const toggleFilter = (filterId: string) => {
    const newFilters = selectedFilters.includes(filterId)
      ? selectedFilters.filter((id) => id !== filterId)
      : [...selectedFilters, filterId]
    onFilterChange?.(newFilters)
  }

  return (
    <div className='advanced-search-bar'>
      <SearchBar {...searchProps} />

      {showFilters && filters.length > 0 && (
        <div className='search-filters'>
          <div className='search-filters-header'>
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className='search-filters-toggle'
            >
              <FilterIcon />
              <span>Filters</span>
              {selectedFilters.length > 0 && (
                <span className='search-filters-count'>{selectedFilters.length}</span>
              )}
              <ChevronIcon expanded={showFilterDropdown} />
            </button>
          </div>

          {showFilterDropdown && (
            <div className='search-filters-dropdown'>
              {filters.map((filter) => (
                <label key={filter.id} className='search-filter-item'>
                  <input
                    type='checkbox'
                    checked={selectedFilters.includes(filter.id)}
                    onChange={() => toggleFilter(filter.id)}
                    className='search-filter-checkbox'
                  />
                  <div className='search-filter-content'>
                    {filter.icon && <span className='search-filter-icon'>{filter.icon}</span>}
                    <span>{filter.label}</span>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Icon components
const SearchIcon: React.FC = () => (
  <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20'>
    <path
      fillRule='evenodd'
      d='M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z'
      clipRule='evenodd'
    />
  </svg>
)

const ClearIcon: React.FC = () => (
  <svg className='w-3 h-3' fill='currentColor' viewBox='0 0 20 20'>
    <path
      fillRule='evenodd'
      d='M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z'
      clipRule='evenodd'
    />
  </svg>
)

const FilterIcon: React.FC = () => (
  <svg className='w-3 h-3' fill='currentColor' viewBox='0 0 20 20'>
    <path
      fillRule='evenodd'
      d='M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z'
      clipRule='evenodd'
    />
  </svg>
)

const ChevronIcon: React.FC<{ expanded: boolean }> = ({ expanded }) => (
  <svg
    className={`w-3 h-3 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
    fill='currentColor'
    viewBox='0 0 20 20'
  >
    <path
      fillRule='evenodd'
      d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z'
      clipRule='evenodd'
    />
  </svg>
)
