import { Search, Grid, List, AlertTriangle, ChevronDown } from 'lucide-react'
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

// Sort options configuration
const sortOptions = [
  { value: 'new' as SortParam, label: 'Date Added (Newest)' },
  { value: 'old' as SortParam, label: 'Date Added (Oldest)' },
  { value: 'abc' as SortParam, label: 'Title (A-Z)' },
  { value: 'zyx' as SortParam, label: 'Title (Z-A)' },
  { value: 'authaz' as SortParam, label: 'Author (A-Z)' },
  { value: 'authza' as SortParam, label: 'Author (Z-A)' },
  { value: 'pubnew' as SortParam, label: 'Publication (Newest)' },
  { value: 'pubold' as SortParam, label: 'Publication (Oldest)' },
  { value: 'hotasc' as SortParam, label: 'Downloads (Low to High)' },
  { value: 'hotdesc' as SortParam, label: 'Downloads (High to Low)' }
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

  return (
    <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90 border-b border-border -mx-6 mb-8">
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
            
            {/* Admin Controls */}
            {isAdmin && (
              <Button
                onClick={onManageDuplicates}
                variant="outline"
                className="flex items-center gap-2"
                disabled={loading}
              >
                <AlertTriangle className="h-4 w-4" />
                Manage Duplicates
              </Button>
            )}
          </div>

          {/* Bottom Row: Search, Filters, View Mode, and Pagination */}
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            {/* Left Side: Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-1">
              {/* Search */}
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search books..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  disabled={loading}
                  className="pl-10 pr-4 py-2 w-full rounded-md border border-input bg-background text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              {/* Sort Dropdown */}
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={loading}
                    className="min-w-[180px] justify-between"
                  >
                    <span className="truncate">
                      {sortOptions.find(option => option.value === sortParam)?.label || 'Sort by...'}
                    </span>
                    <ChevronDown className="h-4 w-4 ml-2 flex-shrink-0" />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content 
                    className="min-w-[220px] bg-background border border-border rounded-md shadow-lg p-1 z-50"
                    align="start"
                    sideOffset={4}
                  >
                    {sortOptions.map((option) => (
                      <DropdownMenu.Item
                        key={option.value}
                        className={`
                          flex items-center px-3 py-2 text-sm rounded-sm cursor-pointer outline-none
                          hover:bg-accent hover:text-accent-foreground
                          focus:bg-accent focus:text-accent-foreground
                          ${sortParam === option.value ? 'bg-accent text-accent-foreground' : ''}
                        `}
                        onSelect={() => onSortChange(option.value)}
                      >
                        {option.label}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>

            {/* Right Side: View Mode and Pagination */}
            <div className="flex items-center gap-4">
              {/* View Mode Toggle */}
              <div className="flex items-center border rounded-md">
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
