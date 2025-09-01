import { useState } from 'react'
import { 
  Play, 
  Pause, 
  Square, 
  Trash2, 
  RotateCcw, 
  ArrowUp, 
  ArrowDown,
  Settings,
  Filter,
  SortAsc,
  SortDesc
} from 'lucide-react'
import { Button } from './ui/Button'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Dialog from '@radix-ui/react-dialog'

interface QueueControlsProps {
  activeCount: number
  queuedCount: number
  completedCount: number
  failedCount: number
  onPauseAll?: () => void
  onResumeAll?: () => void
  onCancelAll?: () => void
  onClearCompleted?: () => void
  onRetryAllFailed?: () => void
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
  onCancelAll,
  onClearCompleted,
  onRetryAllFailed,
  onSortChange,
  onFilterChange,
  currentSort = 'priority',
  currentFilter = 'all',
  isQueuePaused = false
}: QueueControlsProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState<string | null>(null)

  const totalItems = activeCount + queuedCount + completedCount + failedCount

  const handleBulkAction = (action: string) => {
    switch (action) {
      case 'pauseAll':
        onPauseAll?.()
        break
      case 'resumeAll':
        onResumeAll?.()
        break
      case 'cancelAll':
        setShowConfirmDialog('cancelAll')
        break
      case 'clearCompleted':
        setShowConfirmDialog('clearCompleted')
        break
      case 'retryFailed':
        onRetryAllFailed?.()
        break
    }
  }

  const confirmAction = () => {
    switch (showConfirmDialog) {
      case 'cancelAll':
        onCancelAll?.()
        break
      case 'clearCompleted':
        onClearCompleted?.()
        break
    }
    setShowConfirmDialog(null)
  }

  return (
    <>
      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border">
        {/* Queue Summary */}
        <div className="flex items-center gap-6">
          <div className="text-sm font-medium">
            Queue Status
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
        <div className="flex items-center gap-2">
          {/* Sort Dropdown */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                {currentSort === 'priority' && <ArrowUp className="h-3 w-3 mr-1" />}
                {currentSort === 'date' && <SortDesc className="h-3 w-3 mr-1" />}
                {currentSort === 'title' && <SortAsc className="h-3 w-3 mr-1" />}
                {currentSort === 'author' && <SortAsc className="h-3 w-3 mr-1" />}
                Sort
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
              <Button variant="outline" size="sm" className="h-8">
                <Filter className="h-3 w-3 mr-1" />
                Filter
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
                  className="h-8"
                  onClick={() => handleBulkAction('pauseAll')}
                >
                  <Pause className="h-3 w-3 mr-1" />
                  Pause All
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => handleBulkAction('resumeAll')}
                >
                  <Play className="h-3 w-3 mr-1" />
                  Resume All
                </Button>
              )}
            </>
          )}

          {/* Bulk Actions Menu */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <Settings className="h-3 w-3 mr-1" />
                Actions
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="min-w-48 bg-popover border border-border rounded-md shadow-lg p-1 z-50">
                {failedCount > 0 && (
                  <DropdownMenu.Item
                    className="px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm"
                    onClick={() => handleBulkAction('retryFailed')}
                  >
                    <RotateCcw className="h-3 w-3 mr-2" />
                    Retry All Failed ({failedCount})
                  </DropdownMenu.Item>
                )}
                {completedCount > 0 && (
                  <DropdownMenu.Item
                    className="px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm"
                    onClick={() => handleBulkAction('clearCompleted')}
                  >
                    <Trash2 className="h-3 w-3 mr-2" />
                    Clear Completed ({completedCount})
                  </DropdownMenu.Item>
                )}
                {(activeCount > 0 || queuedCount > 0) && (
                  <>
                    <DropdownMenu.Separator className="h-px bg-border my-1" />
                    <DropdownMenu.Item
                      className="px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm text-destructive"
                      onClick={() => handleBulkAction('cancelAll')}
                    >
                      <Square className="h-3 w-3 mr-2" />
                      Cancel All Downloads
                    </DropdownMenu.Item>
                  </>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog.Root open={!!showConfirmDialog} onOpenChange={() => setShowConfirmDialog(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-background border border-border rounded-lg shadow-lg p-6 w-96 z-50">
            <Dialog.Title className="text-lg font-semibold mb-2">
              {showConfirmDialog === 'cancelAll' && 'Cancel All Downloads'}
              {showConfirmDialog === 'clearCompleted' && 'Clear Completed Downloads'}
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground mb-4">
              {showConfirmDialog === 'cancelAll' && 
                `This will cancel ${activeCount + queuedCount} downloads. This action cannot be undone.`
              }
              {showConfirmDialog === 'clearCompleted' && 
                `This will remove ${completedCount} completed downloads from the list. This action cannot be undone.`
              }
            </Dialog.Description>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowConfirmDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmAction}
              >
                {showConfirmDialog === 'cancelAll' && 'Cancel All'}
                {showConfirmDialog === 'clearCompleted' && 'Clear All'}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
