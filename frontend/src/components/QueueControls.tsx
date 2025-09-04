
import { 
  Play, 
  Pause, 
  ArrowUp,
  Filter,
  SortAsc,
  SortDesc
} from 'lucide-react'
import { Button } from './ui/Button'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'


interface QueueControlsProps {
  activeCount: number
  queuedCount: number
  completedCount: number
  failedCount: number
  onPauseAll?: () => void
  onResumeAll?: () => void
  onSortChange?: (sort: 'priority' | 'date' | 'title' | 'author') => void
  onFilterChange?: (filter: 'all' | 'downloading' | 'queued' | 'completed' | 'failed') => void
  currentSort?: string
  currentFilter?: string
  isQueuePaused?: boolean
}

export function QueueControls({
  activeCount,
  queuedCount,
  completedCount,
  failedCount,
  onPauseAll,
  onResumeAll,
  onSortChange,
  onFilterChange,
  currentSort = 'priority',
  currentFilter = 'all',
  isQueuePaused = false
}: QueueControlsProps) {


  const totalItems = activeCount + queuedCount + completedCount + failedCount



  return (
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-3 sm:p-4 bg-muted/30 rounded-lg border">
        {/* Queue Summary */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
          <div className="text-sm font-medium">
            Queue Status
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
            {activeCount > 0 && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span>{activeCount} downloading</span>
              </div>
            )}
            {queuedCount > 0 && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                <span>{queuedCount} queued</span>
              </div>
            )}
            {completedCount > 0 && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span>{completedCount} completed</span>
              </div>
            )}
            {failedCount > 0 && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span>{failedCount} failed</span>
              </div>
            )}
            {totalItems === 0 && (
              <span>No items in queue</span>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Sort Dropdown */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs sm:text-sm">
                {currentSort === 'priority' && <ArrowUp className="h-3 w-3 mr-1" />}
                {currentSort === 'date' && <SortDesc className="h-3 w-3 mr-1" />}
                {currentSort === 'title' && <SortAsc className="h-3 w-3 mr-1" />}
                {currentSort === 'author' && <SortAsc className="h-3 w-3 mr-1" />}
                <span className="hidden sm:inline">Sort</span>
                <span className="sm:hidden">⇅</span>
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="min-w-40 bg-popover border border-border rounded-md shadow-lg p-1 z-50">
                <DropdownMenu.Item
                  className={`px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm ${
                    currentSort === 'priority' ? 'bg-accent' : ''
                  }`}
                  onClick={() => onSortChange?.('priority')}
                >
                  <ArrowUp className="h-3 w-3 mr-2" />
                  Priority
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={`px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm ${
                    currentSort === 'date' ? 'bg-accent' : ''
                  }`}
                  onClick={() => onSortChange?.('date')}
                >
                  <SortDesc className="h-3 w-3 mr-2" />
                  Date Added
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={`px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm ${
                    currentSort === 'title' ? 'bg-accent' : ''
                  }`}
                  onClick={() => onSortChange?.('title')}
                >
                  <SortAsc className="h-3 w-3 mr-2" />
                  Title
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={`px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm ${
                    currentSort === 'author' ? 'bg-accent' : ''
                  }`}
                  onClick={() => onSortChange?.('author')}
                >
                  <SortAsc className="h-3 w-3 mr-2" />
                  Author
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          {/* Filter Dropdown */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs sm:text-sm">
                <Filter className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Filter</span>
                <span className="sm:hidden">⚬</span>
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="min-w-40 bg-popover border border-border rounded-md shadow-lg p-1 z-50">
                <DropdownMenu.Item
                  className={`px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm ${
                    currentFilter === 'all' ? 'bg-accent' : ''
                  }`}
                  onClick={() => onFilterChange?.('all')}
                >
                  All Items
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={`px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm ${
                    currentFilter === 'downloading' ? 'bg-accent' : ''
                  }`}
                  onClick={() => onFilterChange?.('downloading')}
                >
                  Downloading
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={`px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm ${
                    currentFilter === 'queued' ? 'bg-accent' : ''
                  }`}
                  onClick={() => onFilterChange?.('queued')}
                >
                  Queued
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={`px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm ${
                    currentFilter === 'completed' ? 'bg-accent' : ''
                  }`}
                  onClick={() => onFilterChange?.('completed')}
                >
                  Completed
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={`px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm ${
                    currentFilter === 'failed' ? 'bg-accent' : ''
                  }`}
                  onClick={() => onFilterChange?.('failed')}
                >
                  Failed
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          {/* Queue Control Buttons */}
          {(activeCount > 0 || queuedCount > 0) && (
            <>
              {!isQueuePaused ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs sm:text-sm"
                  onClick={() => onPauseAll?.()}
                >
                  <Pause className="h-3 w-3 mr-1" />
                  <span className="hidden sm:inline">Pause All</span>
                  <span className="sm:hidden">⏸</span>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs sm:text-sm"
                  onClick={() => onResumeAll?.()}
                >
                  <Play className="h-3 w-3 mr-1" />
                  <span className="hidden sm:inline">Resume All</span>
                  <span className="sm:hidden">▶</span>
                </Button>
              )}
            </>
          )}


        </div>
      </div>
  )
}
