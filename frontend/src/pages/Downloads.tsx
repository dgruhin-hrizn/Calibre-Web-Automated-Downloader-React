import { useState, useCallback } from 'react'
import { Download, AlertCircle, Activity, BarChart3, Clock } from 'lucide-react'

import { QueueItem } from '../components/QueueItem'
import { DraggableQueueItem } from '../components/DraggableQueueItem'
import { QueueControls } from '../components/QueueControls'
import * as Tabs from '@radix-ui/react-tabs'
import { useDownloadStatus, useCancelDownload, useClearCompleted } from '../hooks/useDownloads'

export function Downloads() {
  // All hooks must be called at the top level, before any early returns
  const { data: statusData, isLoading, error } = useDownloadStatus()
  const cancelDownload = useCancelDownload()
  const clearCompleted = useClearCompleted()
  
  // State for queue management
  const [currentSort, setCurrentSort] = useState<'priority' | 'date' | 'title' | 'author'>('priority')
  const [currentFilter, setCurrentFilter] = useState<'all' | 'downloading' | 'queued' | 'completed' | 'failed'>('all')
  const [selectedTab, setSelectedTab] = useState('queue')
  const [draggedItems, setDraggedItems] = useState<any[]>([]) // Local state for drag operations

  // Process data for rendering (safe to do before early returns)
  const downloads = {
    active: Object.values(statusData?.downloading || {}),
    processing: Object.values(statusData?.processing || {}),
    waiting: Object.values(statusData?.waiting || {}),
    queued: Object.values(statusData?.queued || {}),
    completed: [
      ...Object.values(statusData?.done || {}),
      ...Object.values(statusData?.available || {})
    ],
    failed: Object.values(statusData?.error || {}),
    cancelled: Object.values(statusData?.cancelled || {})
  }

  const queueItems = [
    ...downloads.active.map((item: any) => ({ ...item, status: 'downloading' })),
    ...downloads.processing.map((item: any) => ({ ...item, status: 'processing' })),
    ...downloads.waiting.map((item: any) => ({ ...item, status: 'waiting' })),
    ...downloads.queued.map((item: any) => ({ ...item, status: 'queued' })),
    ...downloads.completed.map((item: any) => ({ ...item, status: 'completed' })),
    ...downloads.failed.map((item: any) => ({ ...item, status: 'failed' })),
    ...downloads.cancelled.map((item: any) => ({ ...item, status: 'cancelled' }))
  ]

  const filteredItems = queueItems.filter(item => {
    if (currentFilter === 'all') return true
    return item.status === currentFilter
  })

  const sortedItems = [...filteredItems].sort((a, b) => {
    switch (currentSort) {
      case 'priority':
        return (a.position || 0) - (b.position || 0)
      case 'date':
        return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
      case 'title':
        return (a.title || '').localeCompare(b.title || '')
      case 'author':
        return (a.author || '').localeCompare(b.author || '')
      default:
        return 0
    }
  })

  // Drag & Drop handler - moved to top level with other hooks
  const moveItem = useCallback((dragIndex: number, hoverIndex: number) => {
    const items = draggedItems.length > 0 ? draggedItems : sortedItems
    const draggedItem = items[dragIndex]
    const newItems = [...items]
    newItems.splice(dragIndex, 1)
    newItems.splice(hoverIndex, 0, draggedItem)
    setDraggedItems(newItems)
    
    // TODO: Update backend queue order
    console.log('Moved item from position', dragIndex, 'to', hoverIndex)
  }, [draggedItems, sortedItems])

  // Queue management handlers
  const handleCancel = (bookId: string) => {
    cancelDownload.mutate(bookId)
  }

  const handlePause = (bookId: string) => {
    // TODO: Implement pause functionality
    console.log('Pause download:', bookId)
  }

  const handleResume = (bookId: string) => {
    // TODO: Implement resume functionality
    console.log('Resume download:', bookId)
  }

  const handleMoveUp = (bookId: string) => {
    // TODO: Implement move up in queue
    console.log('Move up:', bookId)
  }

  const handleMoveDown = (bookId: string) => {
    // TODO: Implement move down in queue
    console.log('Move down:', bookId)
  }

  const handleSetPriority = (bookId: string, priority: 'high' | 'normal' | 'low') => {
    // TODO: Implement priority setting
    console.log('Set priority:', bookId, priority)
  }

  const handleClearCompleted = () => {
    clearCompleted.mutate()
  }

  // Handle loading and error states after all hooks are called
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
        <p className="text-destructive">Failed to load downloads</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Download Queue</h1>
          <p className="text-muted-foreground">
            Manage your download queue and monitor progress
          </p>
        </div>
      </div>

      {/* Queue Controls */}
      <QueueControls
        activeCount={downloads.active.length}
        queuedCount={downloads.processing.length + downloads.waiting.length + downloads.queued.length}
        completedCount={downloads.completed.length}
        failedCount={downloads.failed.length}
        onClearCompleted={handleClearCompleted}
        onSortChange={setCurrentSort}
        onFilterChange={setCurrentFilter}
        currentSort={currentSort}
        currentFilter={currentFilter}
      />

      <Tabs.Root value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <Tabs.List className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
          <Tabs.Trigger 
            value="queue" 
            className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <Activity className="h-4 w-4 mr-2" />
            Queue ({downloads.active.length + downloads.processing.length + downloads.waiting.length + downloads.queued.length})
          </Tabs.Trigger>
          <Tabs.Trigger 
            value="completed"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            Completed ({downloads.completed.length})
          </Tabs.Trigger>
          <Tabs.Trigger 
            value="failed"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            Failed ({downloads.failed.length})
          </Tabs.Trigger>
          <Tabs.Trigger 
            value="analytics"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </Tabs.Trigger>
        </Tabs.List>

        {/* Queue Tab - Active Downloads and Queue */}
        <Tabs.Content value="queue" className="space-y-6">
          {sortedItems.length > 0 ? (
            <div className="space-y-4">
              {/* Queue Flow Visualization */}
              <div className="bg-muted/30 rounded-lg p-4 border">
                <div className="flex items-center justify-center space-x-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span>Downloading ({downloads.active.length})</span>
                  </div>
                  {downloads.processing.length > 0 && (
                    <>
                      <div className="text-muted-foreground">→</div>
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full bg-purple-500 animate-spin"></div>
                        <span>Processing ({downloads.processing.length})</span>
                      </div>
                    </>
                  )}
                  {downloads.waiting.length > 0 && (
                    <>
                      <div className="text-muted-foreground">→</div>
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
                        <span>Waiting ({downloads.waiting.length})</span>
                      </div>
                    </>
                  )}
                  <div className="text-muted-foreground">→</div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                    <span>Queued ({downloads.queued.length})</span>
                  </div>
                  <div className="text-muted-foreground">→</div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-teal-500"></div>
                    <span>Complete</span>
                  </div>
                </div>
              </div>

              {/* Queue Items */}
              {(draggedItems.length > 0 ? draggedItems : sortedItems).map((download, index) => (
                <DraggableQueueItem
                  key={download.id}
                  download={download}
                  index={index}
                  position={download.position}
                  isActive={download.status === 'downloading'}
                  onCancel={handleCancel}
                  onPause={handlePause}
                  onResume={handleResume}
                  onMoveUp={index > 0 ? handleMoveUp : undefined}
                  onMoveDown={index < sortedItems.length - 1 ? handleMoveDown : undefined}
                  onSetPriority={handleSetPriority}
                  onMoveItem={moveItem}
                  showDragHandle={download.status === 'queued'}
                  showPosition={true}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No Active Downloads</h3>
              <p>Your download queue is empty. Start by searching for books to download.</p>
            </div>
          )}
        </Tabs.Content>

        {/* Completed Downloads */}
        <Tabs.Content value="completed" className="space-y-4">
          {downloads.completed.map((download) => (
            <QueueItem
              key={download.id}
              download={{
                ...download,
                status: 'completed',
                coverUrl: download.preview || undefined
              }}
            />
          ))}
          {downloads.completed.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Download className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No completed downloads</p>
            </div>
          )}
        </Tabs.Content>

        {/* Failed Downloads */}
        <Tabs.Content value="failed" className="space-y-4">
          {downloads.failed.map((download) => (
            <QueueItem
              key={download.id}
              download={{
                ...download,
                status: 'error',
                coverUrl: download.preview || undefined
              }}
              onCancel={handleCancel}
            />
          ))}
          {downloads.failed.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No failed downloads</p>
            </div>
          )}
        </Tabs.Content>

        {/* Analytics Tab */}
        <Tabs.Content value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Stats Cards */}
            <div className="bg-card rounded-lg p-6 border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Downloads</p>
                  <p className="text-2xl font-bold">
                    {downloads.active.length + downloads.queued.length + downloads.completed.length + downloads.failed.length}
                  </p>
                </div>
                <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                  <Download className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg p-6 border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold">
                    {downloads.completed.length + downloads.failed.length > 0 
                      ? Math.round((downloads.completed.length / (downloads.completed.length + downloads.failed.length)) * 100)
                      : 0}%
                  </p>
                </div>
                <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                  <BarChart3 className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg p-6 border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Queue Length</p>
                  <p className="text-2xl font-bold">{downloads.active.length + downloads.queued.length}</p>
                </div>
                <div className="h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg p-6 border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Failed Downloads</p>
                  <p className="text-2xl font-bold">{downloads.failed.length}</p>
                </div>
                <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Queue Health */}
          <div className="bg-card rounded-lg p-6 border">
            <h3 className="text-lg font-semibold mb-4">Queue Health</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Queue Status</span>
                <span className={`text-sm font-medium ${
                  downloads.active.length > 0 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                }`}>
                  {downloads.active.length > 0 ? 'Active' : 'Idle'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Average Queue Time</span>
                <span className="text-sm text-muted-foreground">~2.5 minutes</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Estimated Completion</span>
                <span className="text-sm text-muted-foreground">
                  {downloads.queued.length > 0 ? `~${downloads.queued.length * 3} minutes` : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}
