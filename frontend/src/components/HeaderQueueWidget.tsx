import { useState } from 'react'
import { Download, Clock, ChevronDown, ChevronUp, Timer, X, AlertCircle, CheckCircle, Activity } from 'lucide-react'
import { Button } from './ui/Button'

import { BookCover } from './ui/BookCover'
import { useDownloadStatus, useUserDownloadHistory, useCancelDownload } from '../hooks/useDownloads'
import { formatCountdown } from '../lib/utils'
import * as Collapsible from '@radix-ui/react-collapsible'

export function HeaderQueueWidget() {
  const { data: statusData } = useDownloadStatus()
  const { data: userHistory } = useUserDownloadHistory(undefined, 20, 0)
  const cancelDownload = useCancelDownload()
  const [isOpen, setIsOpen] = useState(false)

  if (!statusData) return null

  // Extract arrays from the new user-specific format
  const activeDownloads = statusData.downloading || []
  const processingDownloads = statusData.processing || []
  const waitingDownloads = statusData.waiting || []
  const queuedDownloads = statusData.queued || []
  const totalInQueue = activeDownloads.length + processingDownloads.length + waitingDownloads.length + queuedDownloads.length

  // Always show the widget - even when queue is empty

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

  // Recent completed/failed from history
  const recentHistory = userHistory?.slice(0, 5) || []

  const handleCancel = (bookId: string) => {
    cancelDownload.mutate(bookId)
  }

  return (
    <div className="relative">
      <Collapsible.Root open={isOpen} onOpenChange={setIsOpen}>
        <Collapsible.Trigger asChild>
          <button className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent/50 transition-colors">
            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
              <Download className="h-3 w-3 text-primary" />
            </div>
            <div className="text-sm">
              <span className="font-medium">{totalInQueue}</span>
              {/* HIDE THIS FOR NOW
              <span className="text-muted-foreground ml-1">
                {totalInQueue === 1 ? 'download' : 'downloads'}
              </span>
              */}
            </div>
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </Collapsible.Trigger>

        <Collapsible.Content asChild>
          <div className="absolute top-full right-0 mt-2 w-96 bg-card border border-border rounded-lg shadow-lg z-50 max-h-96 overflow-hidden">
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Download className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">Download Queue</div>
                    <div className="text-xs text-muted-foreground">
                      {totalInQueue === 0 ? 'No active downloads' : 
                       currentDownloads.length > 0 ? `${activeDownloads.length} downloading • ${processingDownloads.length + waitingDownloads.length + queuedDownloads.length} queued` :
                       `${processingDownloads.length + waitingDownloads.length + queuedDownloads.length} queued`}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {/* Empty State */}
              {totalInQueue === 0 && recentHistory.length === 0 && (
                <div className="p-6 text-center text-muted-foreground">
                  <Download className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <div className="text-sm font-medium mb-1">No Downloads Yet</div>
                  <div className="text-xs">Start downloading books to see them here</div>
                </div>
              )}

              {/* Current Downloads */}
              {currentDownloads.length > 0 && (
                <div className="p-3 space-y-2">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Active Downloads
                  </div>
                  {currentDownloads.map((download) => (
                    <div key={download.id} className="flex items-center gap-3 p-2 rounded-md bg-accent/30">
                      <BookCover
                        src={download.coverUrl || download.cover_url}
                        alt={download.title}
                        className="w-8 h-10 flex-shrink-0"
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">
                          {download.title || 'Unknown Title'}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {download.author || 'Unknown Author'}
                        </div>
                        
                        {/* Progress for downloading items */}
                        {activeDownloads.some(d => d.id === download.id) && (
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary transition-all duration-300"
                                style={{ width: `${download.progress || 0}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {Math.round(download.progress || 0)}%
                            </span>
                          </div>
                        )}
                        
                        {/* Status for other items */}
                        {processingDownloads.some(d => d.id === download.id) && (
                          <div className="flex items-center gap-1 mt-1">
                            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
                            <span className="text-xs text-muted-foreground">Processing</span>
                          </div>
                        )}
                        
                        {waitingDownloads.some(d => d.id === download.id) && (
                          <div className="flex items-center gap-1 mt-1">
                            <Timer className="w-3 h-3 text-blue-500" />
                            <span className="text-xs text-muted-foreground">
                              {download.waitTime && download.waitStart 
                                ? formatCountdown(download.waitTime, download.waitStart)
                                : 'Waiting'
                              }
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancel(download.id)}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Next in Queue */}
              {nextInQueue && (
                <div className="p-3 border-t border-border">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Next in Queue
                  </div>
                  <div className="flex items-center gap-3 p-2 rounded-md bg-muted/50">
                    <BookCover
                      src={nextInQueue.coverUrl || nextInQueue.cover_url}
                      alt={nextInQueue.title}
                      className="w-8 h-10 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">
                        {nextInQueue.title || 'Unknown Title'}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {nextInQueue.author || 'Unknown Author'}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3 text-orange-500" />
                        <span className="text-xs text-muted-foreground">Queued</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCancel(nextInQueue.id)}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Remaining Queue Count */}
              {queuedDownloads.length > 1 && (
                <div className="p-3 border-t border-border">
                  <div className="text-center text-xs text-muted-foreground">
                    +{queuedDownloads.length - 1} more in queue
                  </div>
                </div>
              )}

              {/* Recent History */}
              {recentHistory.length > 0 && (
                <div className="p-3 border-t border-border">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Recent Activity
                  </div>
                  <div className="space-y-1">
                    {recentHistory.map((item: any) => (
                      <div key={`${item.id}-${item.created_at}`} className="flex items-center gap-2 p-1 rounded-sm">
                        <div className="w-4 h-5 flex-shrink-0">
                          <BookCover
                            src={item.cover_url}
                            alt={item.book_title}
                            className="w-4 h-5"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs truncate">
                            {item.book_title || 'Unknown Title'}
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          {item.status === 'completed' ? (
                            <CheckCircle className="w-3 h-3 text-green-500" />
                          ) : item.status === 'error' ? (
                            <AlertCircle className="w-3 h-3 text-destructive" />
                          ) : (
                            <Activity className="w-3 h-3 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer Actions */}
              <div className="p-3 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => {
                    setIsOpen(false)
                    // Navigate to downloads page
                    window.location.href = '/downloads'
                  }}
                >
                  View Full Queue
                </Button>
              </div>
            </div>
          </div>
        </Collapsible.Content>
      </Collapsible.Root>
    </div>
  )
}