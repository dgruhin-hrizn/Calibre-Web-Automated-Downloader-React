import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Clock, CheckCircle, AlertCircle, TrendingUp, Activity, Zap, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { BookCover } from '../components/ui/BookCover'
import { CircularProgress } from '../components/ui/CircularProgress'
// import CWAStatus from '../components/CWAStatus'
import { useDownloadStatus, useUserDownloadHistory } from '../hooks/useDownloads'
import { useLibraryStats } from '../pages/Library/hooks/useLibraryQueries'
import { LibraryStats } from '../pages/Library/components/LibraryStats'
import { formatDate } from '../lib/utils'

export function Stats() {
  const { data: statusData, isLoading, error } = useDownloadStatus()
  const { data: userHistory } = useUserDownloadHistory(undefined, 20, 0) // Get recent user history
  const { data: libraryStats } = useLibraryStats() // Get library collection stats

  const navigate = useNavigate()
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(5)
  
  // Calculate stats from real data
  const stats = {
    totalBooks: userHistory?.length || 0, // Use database history count as total
    activeDownloads: statusData ? Object.keys(statusData.downloading || {}).length : 0,
    queuedDownloads: statusData ? Object.keys(statusData.queued || {}).length : 0,
    completedToday: userHistory ? 
      userHistory.filter((item: any) => {
        const today = new Date().toDateString()
        const itemDate = new Date(item.created_at).toDateString()
        return item.status === 'completed' && itemDate === today
      }).length : 0,
    failedDownloads: userHistory ? 
      userHistory.filter((item: any) => item.status === 'error').length : 0
  }

  // Combine active downloads from statusData with historical data from userHistory
  const recentDownloads: Array<any> = []
  
  // Add active downloads from statusData (real-time)
  if (statusData) {
    // Add downloading items with progress
    Object.values(statusData.downloading || {}).forEach((item: any) => 
      recentDownloads.push({ 
        ...item, 
        status: 'downloading',
        coverUrl: item.preview || item.coverUrl,
        timestamp: new Date().toISOString()
      })
    )
    
    // Add queued items
    Object.values(statusData.queued || {}).forEach((item: any) => 
      recentDownloads.push({ 
        ...item, 
        status: 'queued',
        coverUrl: item.preview || item.coverUrl,
        timestamp: new Date().toISOString()
      })
    )
    
    // Add processing items
    Object.values(statusData.processing || {}).forEach((item: any) => 
      recentDownloads.push({ 
        ...item, 
        status: 'processing',
        coverUrl: item.preview || item.coverUrl,
        timestamp: new Date().toISOString()
      })
    )
    
    // Add waiting items
    Object.values(statusData.waiting || {}).forEach((item: any) => 
      recentDownloads.push({ 
        ...item, 
        status: 'waiting',
        coverUrl: item.preview || item.coverUrl,
        timestamp: new Date().toISOString()
      })
    )
  }

  // Add historical data from database (completed, failed, etc.)
  if (userHistory) {
    userHistory.forEach((item: any) => {
      // Only add non-active statuses from database to avoid duplicates
      // Active statuses (downloading, queued, processing, waiting) come from statusData
      if (!['downloading', 'queued', 'processing', 'waiting'].includes(item.status)) {
        recentDownloads.push({
          id: item.book_id,
          title: item.book_title,
          author: item.book_author,
          format: item.book_format,
          size: item.book_size,
          coverUrl: item.cover_url,
          status: item.status,
          timestamp: item.created_at,
          progress: item.status === 'completed' ? 100 : 0
        })
      }
    })
  }

  // Sort by timestamp (don't limit here, we'll paginate)
  const sortedRecentDownloads = recentDownloads
    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())

  // Pagination calculations
  const totalItems = sortedRecentDownloads.length
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedDownloads = sortedRecentDownloads.slice(startIndex, endIndex)

  // Reset to first page when items per page changes
  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage)
    setCurrentPage(1)
  }

  // Navigation functions
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  // Retry/search failed download
  const handleSearchAgain = (download: any) => {
    const searchQuery = `${download.title} ${download.author || ''}`.trim()
    navigate(`/search?q=${encodeURIComponent(searchQuery)}`)
  }
  
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
        <p className="text-destructive">Failed to load dashboard data</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Stats</h1>
        <p className="text-muted-foreground">
          Overview of your library collection and download activity
        </p>
      </div>

      {/* Library Collection Stats */}
      {libraryStats && (
        <div>
          <h2 className="text-xl font-semibold mb-4 text-foreground">Library Collection</h2>
          <LibraryStats stats={libraryStats} />
        </div>
      )}

      {/* Download Activity Stats */}
      <div>
        <h2 className="text-xl font-semibold mb-4 text-foreground">Download Activity</h2>
        {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium text-foreground">Total Downloads</h3>
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-blue-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.totalBooks}</div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            Books downloaded
          </p>
        </div>

        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium text-foreground">Active Downloads</h3>
            <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center">
              <Activity className="h-4 w-4 text-orange-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.activeDownloads}</div>
          <p className="text-xs text-muted-foreground">
            {stats.queuedDownloads} queued
          </p>
        </div>

        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium text-foreground">Recent Completed</h3>
            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.completedToday}</div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Zap className="h-3 w-3" />
            Ready to read
          </p>
        </div>

        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium text-foreground">Failed Downloads</h3>
            <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="h-4 w-4 text-destructive" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.failedDownloads}</div>
          <p className="text-xs text-muted-foreground">
            Need attention
          </p>
        </div>


      </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Recent Activity</h3>
              <p className="text-sm text-muted-foreground">
                Your latest download activity
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* Items per page selector - only show if there are items */}
              {totalItems > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Show:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                    className="px-2 py-1 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={18}>18</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              )}
              <div className="text-sm text-muted-foreground">
                {totalItems} total
              </div>
            </div>
          </div>
        </div>
        <div className="p-6">
          {totalItems === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No recent downloads</p>
              <p className="text-sm text-muted-foreground">Start downloading books to see them here</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {paginatedDownloads.map((download) => (
                <div key={`${download.id}-${download.timestamp}`} className="group relative flex items-center gap-4 p-4 rounded-lg border border-border hover:border-border/80 hover:bg-accent/30 transition-all">
                  {/* Book Cover */}
                  <BookCover 
                    src={download.coverUrl} 
                    alt={download.title} 
                    size="lg"
                    className="flex-shrink-0"
                  />

                  {/* Book Info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div>
                      <h4 className="font-medium text-sm line-clamp-1">{download.title}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        by {download.author || 'Unknown Author'}
                      </p>
                    </div>
                    
                    {/* Status and Progress */}
                    <div className="flex items-center gap-3">
                      {download.status === 'completed' && (
                        <div className="flex items-center gap-1.5 text-green-600">
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-xs font-medium">Completed</span>
                        </div>
                      )}
                      
                      {download.status === 'downloading' && (
                        <>
                          <div className="flex items-center gap-1.5 text-green-600">
                            <CircularProgress
                              progress={download.progress || 0}
                              status="downloading"
                              size={16}
                            />
                            <span className="text-xs font-medium">Downloading</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {Math.round(download.progress || 0)}%
                          </div>
                        </>
                      )}
                      
                      {download.status === 'queued' && (
                        <div className="flex items-center gap-1.5 text-yellow-600">
                          <Clock className="w-4 h-4" />
                          <span className="text-xs font-medium">Queued</span>
                        </div>
                      )}
                      
                      {download.status === 'error' && (
                        <div className="flex items-center gap-1.5 text-destructive">
                          <AlertCircle className="w-4 h-4" />
                          <span className="text-xs font-medium">Failed</span>
                        </div>
                      )}
                    </div>

                    {/* Additional Info */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {download.format && (
                        <span className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">
                          {download.format.toUpperCase()}
                        </span>
                      )}
                      {download.size && <span>{download.size}</span>}
                      <span>{formatDate(download.timestamp || new Date().toISOString())}</span>
                    </div>

                    {/* Progress Bar for Downloading */}
                    {download.status === 'downloading' && (
                      <div className="w-full bg-secondary rounded-full h-1.5 mt-2">
                        <div 
                          className="bg-green-500 h-1.5 rounded-full transition-all duration-300" 
                          style={{ width: `${download.progress || 0}%` }}
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {download.status === 'error' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSearchAgain(download)
                        }}
                        className="text-xs h-7 px-2"
                      >
                        <Search className="w-3 h-3 mr-1" />
                        Search Again
                      </Button>
                    )}
                  </div>
                </div>
                              ))}
              </div>
              
              {/* Pagination Controls at Bottom */}
              {totalPages > 1 && (
                <div className="mt-6 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} downloads
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter(page => {
                            // Show first page, last page, current page, and pages around current
                            return page === 1 || 
                                   page === totalPages || 
                                   Math.abs(page - currentPage) <= 1
                          })
                          .map((page, index, array) => (
                            <div key={page} className="flex items-center">
                              {/* Add ellipsis if there's a gap */}
                              {index > 0 && array[index - 1] < page - 1 && (
                                <span className="px-2 text-muted-foreground">...</span>
                              )}
                              <Button
                                variant={currentPage === page ? "default" : "ghost"}
                                size="sm"
                                onClick={() => goToPage(page)}
                                className="h-8 w-8 p-0"
                              >
                                {page}
                              </Button>
                            </div>
                          ))
                        }
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

