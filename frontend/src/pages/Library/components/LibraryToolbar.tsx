import { Search, Grid, List, AlertTriangle, Clock, Calendar, ArrowUpAZ, ArrowDownZA, User, BookOpen, TrendingUp, TrendingDown, Hash } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
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
  // Helper function to get button classes with white background for inactive buttons
  const getSortButtonClasses = (isActive: boolean, baseClasses: string) => {
    return `${baseClasses} ${!isActive ? 'bg-white hover:bg-gray-50' : ''}`
  }

  return (
    <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border -mx-6 mb-8">
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

              {/* Sort Buttons - Organized in groups */}
              <div className="flex items-center gap-2">
                {/* Date Added Group */}
                <div className="flex items-center border rounded-md">
                  <Button
                    variant={sortParam === 'new' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => onSortChange('new')}
                    disabled={loading}
                    className={getSortButtonClasses(sortParam === 'new', 'rounded-r-none border-r')}
                    title="Date Added - Newest First"
                  >
                    <Clock className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={sortParam === 'old' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => onSortChange('old')}
                    disabled={loading}
                    className={getSortButtonClasses(sortParam === 'old', 'rounded-l-none')}
                    title="Date Added - Oldest First"
                  >
                    <Calendar className="h-4 w-4" />
                  </Button>
                </div>

                {/* Title Sort Group */}
                <div className="flex items-center border rounded-md">
                  <Button
                    variant={sortParam === 'abc' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => onSortChange('abc')}
                    disabled={loading}
                    className={getSortButtonClasses(sortParam === 'abc', 'rounded-r-none border-r')}
                    title="Title A-Z"
                  >
                    <ArrowUpAZ className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={sortParam === 'zyx' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => onSortChange('zyx')}
                    disabled={loading}
                    className={getSortButtonClasses(sortParam === 'zyx', 'rounded-l-none')}
                    title="Title Z-A"
                  >
                    <ArrowDownZA className="h-4 w-4" />
                  </Button>
                </div>

                {/* Author Sort Group */}
                <div className="flex items-center border rounded-md">
                  <Button
                    variant={sortParam === 'authaz' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => onSortChange('authaz')}
                    disabled={loading}
                    className={getSortButtonClasses(sortParam === 'authaz', 'rounded-r-none border-r')}
                    title="Authors A-Z"
                  >
                    <User className="h-4 w-4" />
                    <ArrowUpAZ className="h-3 w-3 ml-1" />
                  </Button>
                  <Button
                    variant={sortParam === 'authza' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => onSortChange('authza')}
                    disabled={loading}
                    className={getSortButtonClasses(sortParam === 'authza', 'rounded-l-none')}
                    title="Authors Z-A"
                  >
                    <User className="h-4 w-4" />
                    <ArrowDownZA className="h-3 w-3 ml-1" />
                  </Button>
                </div>

                {/* Publication Date Group */}
                <div className="flex items-center border rounded-md">
                  <Button
                    variant={sortParam === 'pubnew' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => onSortChange('pubnew')}
                    disabled={loading}
                    className={getSortButtonClasses(sortParam === 'pubnew', 'rounded-r-none border-r')}
                    title="Publication Date - Newest First"
                  >
                    <BookOpen className="h-4 w-4" />
                    <TrendingUp className="h-3 w-3 ml-1" />
                  </Button>
                  <Button
                    variant={sortParam === 'pubold' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => onSortChange('pubold')}
                    disabled={loading}
                    className={getSortButtonClasses(sortParam === 'pubold', 'rounded-l-none')}
                    title="Publication Date - Oldest First"
                  >
                    <BookOpen className="h-4 w-4" />
                    <TrendingDown className="h-3 w-3 ml-1" />
                  </Button>
                </div>

                {/* Series Index Group */}
                <div className="flex items-center border rounded-md">
                  <Button
                    variant={sortParam === 'seriesasc' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => onSortChange('seriesasc')}
                    disabled={loading}
                    className={getSortButtonClasses(sortParam === 'seriesasc', 'rounded-r-none border-r')}
                    title="Series Index - Ascending"
                  >
                    <Hash className="h-4 w-4" />
                    <TrendingUp className="h-3 w-3 ml-1" />
                  </Button>
                  <Button
                    variant={sortParam === 'seriesdesc' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => onSortChange('seriesdesc')}
                    disabled={loading}
                    className={getSortButtonClasses(sortParam === 'seriesdesc', 'rounded-l-none')}
                    title="Series Index - Descending"
                  >
                    <Hash className="h-4 w-4" />
                    <TrendingDown className="h-3 w-3 ml-1" />
                  </Button>
                </div>

                {/* Download Count Group (Hot Books) */}
                <div className="flex items-center border rounded-md">
                  <Button
                    variant={sortParam === 'hotasc' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => onSortChange('hotasc')}
                    disabled={loading}
                    className={getSortButtonClasses(sortParam === 'hotasc', 'rounded-r-none border-r')}
                    title="Download Count - Ascending"
                  >
                    <TrendingUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={sortParam === 'hotdesc' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => onSortChange('hotdesc')}
                    disabled={loading}
                    className={getSortButtonClasses(sortParam === 'hotdesc', 'rounded-l-none')}
                    title="Download Count - Descending"
                  >
                    <TrendingDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
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
                  className={getSortButtonClasses(viewMode === 'grid', 'rounded-r-none')}
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onViewModeChange('list')}
                  disabled={loading}
                  className={getSortButtonClasses(viewMode === 'list', 'rounded-l-none')}
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
