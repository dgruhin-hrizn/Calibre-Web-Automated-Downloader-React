import { useState } from 'react'
import { Download, Clock, Play, Pause, ChevronDown, ChevronUp, Timer, Cog } from 'lucide-react'
import { Button } from './ui/Button'
import { CircularProgress } from './ui/CircularProgress'
import { BookCover } from './ui/BookCover'
import { useDownloadStatus } from '../hooks/useDownloads'
import { formatCountdown } from '../lib/utils'
import * as Collapsible from '@radix-ui/react-collapsible'

export function QueueWidget() {
  const { data: statusData } = useDownloadStatus()
  const [isOpen, setIsOpen] = useState(false)

  if (!statusData) return null

  const activeDownloads = Object.values(statusData.downloading || {})
  const processingDownloads = Object.values(statusData.processing || {})
  const waitingDownloads = Object.values(statusData.waiting || {})
  const queuedDownloads = Object.values(statusData.queued || {})
  const totalInQueue = activeDownloads.length + processingDownloads.length + waitingDownloads.length + queuedDownloads.length

  // Don't show widget if nothing is happening
  if (totalInQueue === 0) return null

  // Sort current downloads by status priority, then by progress
  const currentDownloads = [...activeDownloads, ...processingDownloads, ...waitingDownloads].sort((a, b) => {
    // Priority order: downloading > processing > waiting
    const aIsDownloading = activeDownloads.some(d => d.id === a.id)
    const bIsDownloading = activeDownloads.some(d => d.id === b.id)
    const aIsProcessing = processingDownloads.some(d => d.id === a.id)
    const bIsProcessing = processingDownloads.some(d => d.id === b.id)
    
    if (aIsDownloading && !bIsDownloading) return -1
    if (!aIsDownloading && bIsDownloading) return 1
    if (aIsProcessing && !bIsProcessing && !bIsDownloading) return -1
    if (!aIsProcessing && bIsProcessing && !aIsDownloading) return 1
    
    // Within each group, sort by progress (highest first)
    return (b.progress || 0) - (a.progress || 0)
  })
  const nextInQueue = queuedDownloads[0] // Next queued item

  return (
    <div className="fixed top-20 right-6 z-40 w-80 bg-card border border-border rounded-lg shadow-lg">
      <Collapsible.Root open={isOpen} onOpenChange={setIsOpen}>
        <Collapsible.Trigger asChild>
          <div className="p-4 cursor-pointer hover:bg-accent/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Download className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="font-medium text-sm">Queue Status</div>
                  <div className="text-xs text-muted-foreground">
                    {currentDownloads.length > 0 && `${activeDownloads.length} downloading • ${processingDownloads.length + waitingDownloads.length + queuedDownloads.length} queued`}
                    {currentDownloads.length === 0 && `${processingDownloads.length + waitingDownloads.length + queuedDownloads.length} queued`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activeDownloads.length > 0 && (
                  <div className="flex items-center gap-1">
                    {activeDownloads.length === 1 ? (
                      <CircularProgress
                        progress={activeDownloads[0].progress || 0}
                        status="downloading"
                        size={20}
                        showPercentage={false}
                        showText={false}
                      />
                    ) : (
                      <div className="flex items-center gap-1">
                        <div className="text-xs text-primary font-medium">
                          {activeDownloads.length}
                        </div>
                        <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                          <Download className="h-3 w-3 text-green-600 dark:text-green-400" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </div>
        </Collapsible.Trigger>

        <Collapsible.Content className="border-t border-border">
          <div className="p-4 space-y-4">
            {/* Currently Downloading */}
            {currentDownloads.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Currently Downloading ({currentDownloads.length})
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {currentDownloads.map((download, index) => {
                    const isDownloading = activeDownloads.some(d => d.id === download.id)
                    const isProcessing = processingDownloads.some(p => p.id === download.id)
                    const isWaiting = waitingDownloads.some(w => w.id === download.id)
                    
                    let bgColor, iconColor, badgeColor, icon
                    if (isDownloading) {
                      bgColor = 'bg-green-50 dark:bg-green-900/20'
                      iconColor = 'text-green-600 dark:text-green-400'
                      badgeColor = 'bg-green-100 dark:bg-green-900/40'
                      icon = <Play className={`h-4 w-4 ${iconColor}`} />
                    } else if (isProcessing) {
                      bgColor = 'bg-purple-50 dark:bg-purple-900/20'
                      iconColor = 'text-purple-600 dark:text-purple-400'
                      badgeColor = 'bg-purple-100 dark:bg-purple-900/40'
                      icon = <Cog className={`h-4 w-4 ${iconColor} animate-spin`} />
                    } else if (isWaiting) {
                      bgColor = 'bg-blue-50 dark:bg-blue-900/20'
                      iconColor = 'text-blue-600 dark:text-blue-400'
                      badgeColor = 'bg-blue-100 dark:bg-blue-900/40'
                      icon = <Timer className={`h-4 w-4 ${iconColor} animate-pulse`} />
                    } else {
                      // Fallback for any other status
                      bgColor = 'bg-gray-50 dark:bg-gray-900/20'
                      iconColor = 'text-gray-600 dark:text-gray-400'
                      badgeColor = 'bg-gray-100 dark:bg-gray-900/40'
                      icon = <Timer className={`h-4 w-4 ${iconColor}`} />
                    }
                    
                    return (
                    <div key={download.id} className={`flex items-center gap-3 p-3 ${bgColor} rounded-lg`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded-full ${badgeColor} flex items-center justify-center`}>
                          <span className={`text-xs font-bold ${iconColor}`}>{index + 1}</span>
                        </div>
                        {icon}
                      </div>
                      <BookCover
                        src={download.preview}
                        alt={download.title}
                        size="sm"
                        className="flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{download.title}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          by {download.author || 'Unknown Author'}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {isDownloading ? (
                            <>
                              <div className="flex-1 bg-secondary rounded-full h-1.5">
                                <div 
                                  className="bg-green-500 h-1.5 rounded-full transition-all duration-300" 
                                  style={{ width: `${download.progress || 0}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {Math.round(download.progress || 0)}%
                              </span>
                            </>
                          ) : isProcessing ? (
                            <>
                              <div className="flex-1 bg-secondary rounded-full h-1.5">
                                <div className="bg-purple-500 h-1.5 rounded-full animate-pulse" style={{ width: '100%' }} />
                              </div>
                              <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                                Processing...
                              </span>
                            </>
                          ) : isWaiting ? (
                            <>
                              <div className="flex-1 bg-secondary rounded-full h-1.5">
                                <div className="bg-blue-500 h-1.5 rounded-full animate-pulse" style={{ width: '100%' }} />
                              </div>
                              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                Waiting...
                              </span>
                            </>
                          ) : (
                            <>
                              <div className="flex-1 bg-secondary rounded-full h-1.5">
                                <div 
                                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-1000" 
                                  style={{ 
                                    width: `${download.wait_time && download.wait_start ? 
                                      Math.max(0, Math.min(100, ((Date.now() / 1000 - download.wait_start) / download.wait_time) * 100)) : 0}%` 
                                  }}
                                />
                              </div>
                              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                {download.wait_time && download.wait_start ? formatCountdown(download.wait_time, download.wait_start) : 'Waiting...'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Next in Queue */}
            {nextInQueue && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Up Next
                </div>
                <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
                    <span className="text-xs font-bold text-orange-600 dark:text-orange-400">1</span>
                  </div>
                  <BookCover
                    src={nextInQueue.preview}
                    alt={nextInQueue.title}
                    size="sm"
                    className="flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{nextInQueue.title}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      by {nextInQueue.author || 'Unknown Author'}
                    </div>
                    <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                      Position #1 in queue
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Queue Summary */}
            {(queuedDownloads.length > 1 || (queuedDownloads.length > 0 && currentDownloads.length > 0)) && (
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div className="text-sm">
                    {queuedDownloads.length > 1 && (
                      <span>{queuedDownloads.length - 1} more in queue</span>
                    )}
                    {queuedDownloads.length === 1 && currentDownloads.length > 0 && (
                      <span>1 waiting in queue</span>
                    )}
                    {queuedDownloads.length === 0 && currentDownloads.length > 1 && (
                      <span>Multiple downloads active</span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => {
                    // Navigate to downloads page
                    window.location.href = '/downloads'
                  }}
                >
                  View All
                </Button>
              </div>
            )}

            {/* Quick Actions */}
            <div className="flex gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs h-8"
              >
                <Pause className="h-3 w-3 mr-1" />
                Pause Queue
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs h-8"
                onClick={() => {
                  window.location.href = '/downloads'
                }}
              >
                Manage
              </Button>
            </div>
          </div>
        </Collapsible.Content>
      </Collapsible.Root>
    </div>
  )
}
