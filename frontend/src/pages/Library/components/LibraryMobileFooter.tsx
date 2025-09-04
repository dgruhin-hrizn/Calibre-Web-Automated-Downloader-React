import { ChevronDown, ChevronLeft, ChevronRight, BookOpen, Calendar, User, Clock, TrendingUp, TrendingDown, ArrowUp, ArrowDown } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import type { SortParam } from '../types'

interface LibraryMobileFooterProps {
  // Sort controls
  sortParam: SortParam
  onSortChange: (sort: SortParam) => void
  loading: boolean
  
  // Pagination controls
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

// Sort options configuration with icons (same as LibraryToolbar)
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

export function LibraryMobileFooter({
  sortParam,
  onSortChange,
  loading,
  currentPage,
  totalPages,
  onPageChange
}: LibraryMobileFooterProps) {
  if (totalPages <= 1) {
    // Only show sort controls if no pagination needed
    return (
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90 border-t border-border">
        <div className="px-4 py-3">
          <div className="flex items-center justify-center">
            {/* Sort Dropdown - Centered */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={loading}
                  className="flex items-center gap-2 min-w-[140px]"
                  title={sortOptions.find(option => option.value === sortParam)?.label || 'Sort by...'}
                >
                  {(() => {
                    const currentOption = sortOptions.find(option => option.value === sortParam)
                    const IconComponent = currentOption?.icon || BookOpen
                    return <IconComponent className="h-4 w-4" />
                  })()}
                  <span className="text-sm">Sort</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content 
                  className="min-w-[200px] bg-background border border-border rounded-md shadow-lg p-1 z-50"
                  align="center"
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
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90 border-t border-border">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Sort Dropdown - Left */}
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
                align="start"
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

          {/* Pagination - Center/Right */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1 || loading}
              className="h-9 w-9 p-0"
              title="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex items-center px-2 py-1 bg-muted rounded text-sm font-medium min-w-[60px] justify-center">
              <span>{currentPage}</span>
              <span className="text-muted-foreground mx-1">/</span>
              <span>{totalPages}</span>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || loading}
              className="h-9 w-9 p-0"
              title="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
