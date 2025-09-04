import { useState, useEffect } from 'react'
import { Search, Grid, List, ChevronDown, X, Calendar, User, BookOpen, TrendingUp, TrendingDown, Clock, ArrowUp, ArrowDown, Copy } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { LibraryPagination } from './LibraryPagination'
import type { ViewMode, SortParam } from '../types'

interface LibraryToolbarProps {
  // Search and filters
  searchQuery: string
  onSearchChange: (query: string) => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  sortParam: SortParam
  onSortChange: (sort: SortParam) => void
  totalBooks: number
  loading: boolean
  
  // Pagination
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  
  // Admin controls
  isAdmin: boolean
  onManageDuplicates: () => void
}

// Sort options configuration with icons
const sortOptions = [
  { value: 'new' as SortParam, label: 'Date Added (Newest)', icon: Clock },
  { value: 'old' as SortParam, label: 'Date Added (Oldest)', icon: Clock },
  { value: 'abc' as SortParam, label: 'Title (A-Z)', icon: ArrowUp },
  { value: 'zyx' as SortParam, label: 'Title (Z-A)', icon: ArrowDown },
  { value: 'authaz' as SortParam, label: 'Author (A-Z)', icon: User },
  { value: 'authza' as SortParam, label: 'Author (Z-A)', icon: User },
  { value: 'pubnew' as SortParam, label: 'Publication (Newest)', icon: Calendar },
  { value: 'pubold' as SortParam, label: 'Publication (Oldest)', icon: Calendar },
  { value: 'hotasc' as SortParam, label: 'Downloads (Low to High)', icon: TrendingUp },
  { value: 'hotdesc' as SortParam, label: 'Downloads (High to Low)', icon: TrendingDown }
]

export function LibraryToolbar({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  sortParam,
  onSortChange,
  totalBooks,
  loading,
  currentPage,
  totalPages,
  onPageChange,
  isAdmin,
  onManageDuplicates
}: LibraryToolbarProps) {
  // Local search input state (separate from actual search query)
  const [searchInput, setSearchInput] = useState(searchQuery)

  // Handle search form submission
  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmedInput = searchInput.trim()
    if (trimmedInput !== searchQuery) {
      onSearchChange(trimmedInput)
    }
  }

  // Handle clear search
  const handleClearSearch = () => {
    setSearchInput('')
    if (searchQuery !== '') {
      onSearchChange('')
    }
  }

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // Sync local search input with external search query changes
  useEffect(() => {
    setSearchInput(searchQuery)
  }, [searchQuery])

  return (
    <div className="library-toolbar sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90 border-b border-border -mx-6 mb-8 -mt-8">
      <div className="px-6 py-4">
        <div className="flex flex-col gap-4">
          {/* Top Row: Title and Admin Controls */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Library</h1>
              <p className="text-sm text-muted-foreground">
                {totalBooks > 0 ? `${totalBooks} books in your collection` : 'Browse your CWA library collection'}
              </p>
            </div>
            
            {/* Mobile Controls: Sort + Admin */}
            <div className="flex items-center gap-2 md:hidden">
              {/* Sort Dropdown - Mobile Only */}
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={loading}
                    className="flex items-center gap-2"
                    title={sortOptions.find(option => option.value === sortParam)?.label || 'Sort by...'}
                  >
                    {(() => {
                      const currentOption = sortOptions.find(option => option.value === sortParam)
                      const IconComponent = currentOption?.icon || BookOpen
                      return <IconComponent className="h-4 w-4" />
                    })()}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content 
                    className="min-w-[200px] bg-background border border-border rounded-md shadow-lg p-1 z-50"
                    align="end"
                    sideOffset={8}
                  >
                    {sortOptions.map((option) => {
                      const IconComponent = option.icon
                      return (
                        <DropdownMenu.Item
                          key={option.value}
                          className={`
                            flex items-center gap-3 px-3 py-2 text-sm rounded-sm cursor-pointer outline-none
                            hover:bg-accent hover:text-accent-foreground
                            focus:bg-accent focus:text-accent-foreground
                            ${sortParam === option.value ? 'bg-accent text-accent-foreground' : ''}
                          `}
                          onSelect={() => onSortChange(option.value)}
                        >
                          <IconComponent className="h-4 w-4 flex-shrink-0" />
                          <span className="flex-1">{option.label}</span>
                        </DropdownMenu.Item>
                      )
                    })}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>

              {/* Admin Controls - Mobile (icon only) */}
              {isAdmin && (
                <Button
                  onClick={onManageDuplicates}
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  title="Manage Duplicates"
                  className="h-9 w-9 p-0"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Desktop Admin Controls */}
            <div className="hidden md:flex">
              {isAdmin && (
                <Button
                  onClick={onManageDuplicates}
                  variant="outline"
                  className="flex items-center gap-2"
                  disabled={loading}
                  title="Manage Duplicates"
                >
                  <Copy className="h-4 w-4" />
                  <span>Manage Duplicates</span>
                </Button>
              )}
            </div>
          </div>

          {/* Bottom Row: Search, Filters, View Mode, and Pagination */}
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            {/* Left Side: Search */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center w-full lg:flex-1">
              {/* Search */}
              <form onSubmit={handleSearch} className="flex gap-2 w-full items-center">
                <div className="relative flex-1 md:w-80 lg:w-96">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Search books..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={loading}
                    className="pl-10 pr-10 py-3 w-full h-10 rounded-md border border-input bg-background text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  {searchInput && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button 
                  type="submit" 
                  variant="outline" 
                  disabled={loading}
                  className="flex items-center gap-2 h-10 px-4"
                >
                  <Search className="h-4 w-4" />
                  Search
                </Button>
                {searchQuery && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={handleClearSearch}
                    disabled={loading}
                    className="flex items-center gap-2 h-10 px-4"
                  >
                    <X className="h-4 w-4" />
                    Clear
                  </Button>
                )}
              </form>
            </div>

            {/* Right Side: Sort, View Mode, and Pagination - Hidden on mobile */}
            <div className="hidden md:flex items-center gap-4">
              {/* Sort Dropdown */}
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={loading}
                    className="flex items-center gap-2"
                    title={sortOptions.find(option => option.value === sortParam)?.label || 'Sort by...'}
                  >
                    {(() => {
                      const currentOption = sortOptions.find(option => option.value === sortParam)
                      const IconComponent = currentOption?.icon || BookOpen
                      return <IconComponent className="h-4 w-4" />
                    })()}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content 
                    className="min-w-[180px] sm:min-w-[220px] bg-background border border-border rounded-md shadow-lg p-1 z-50"
                    align="end"
                    sideOffset={4}
                  >
                    {sortOptions.map((option) => {
                      const IconComponent = option.icon
                      return (
                        <DropdownMenu.Item
                          key={option.value}
                          className={`
                            flex items-center gap-3 px-3 py-2 text-sm rounded-sm cursor-pointer outline-none
                            hover:bg-accent hover:text-accent-foreground
                            focus:bg-accent focus:text-accent-foreground
                            ${sortParam === option.value ? 'bg-accent text-accent-foreground' : ''}
                          `}
                          onSelect={() => onSortChange(option.value)}
                        >
                          <IconComponent className="h-4 w-4 flex-shrink-0" />
                          <span className="flex-1">{option.label}</span>
                        </DropdownMenu.Item>
                      )
                    })}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>

              {/* View Mode Toggle - Hidden on mobile */}
              <div className="hidden md:flex items-center border rounded-md">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onViewModeChange('grid')}
                  disabled={loading}
                  className="rounded-r-none"
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onViewModeChange('list')}
                  disabled={loading}
                  className="rounded-l-none"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>

              {/* Pagination */}
              <LibraryPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={onPageChange}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
