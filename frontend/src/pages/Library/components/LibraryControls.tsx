import React from 'react'
import { Search, Filter, Grid, List } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import type { ViewMode, SortParam } from '../types'

interface LibraryControlsProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  sortParam: SortParam
  onSortChange: (sort: SortParam) => void
  totalBooks: number
  loading: boolean
}

export function LibraryControls({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  sortParam,
  onSortChange,
  totalBooks,
  loading
}: LibraryControlsProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <input
          type="text"
          placeholder="Search books..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 pr-4 py-2 w-full rounded-md border border-input bg-background text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        {/* Sort */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={sortParam}
            onChange={(e) => onSortChange(e.target.value as SortParam)}
            className="px-3 py-1 rounded-md border border-input bg-background text-sm"
          >
            <option value="new">Newest First</option>
            <option value="old">Oldest First</option>
            <option value="az">A-Z</option>
            <option value="za">Z-A</option>
          </select>
        </div>

        {/* View Mode */}
        <div className="flex items-center border rounded-md">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('grid')}
            className="rounded-r-none"
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('list')}
            className="rounded-l-none"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
