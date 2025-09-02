import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, BookOpen, Clock, CheckCircle, AlertCircle, TrendingUp, Activity, Zap, ChevronLeft, ChevronRight, Search, RotateCcw, Database } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { BookCover } from '../components/ui/BookCover'
import { CircularProgress } from '../components/ui/CircularProgress'
import CWAStatus from '../components/CWAStatus'
import { useDownloadStatus } from '../hooks/useDownloads'
import { useDownloadStore } from '../stores/downloadStore'
import { formatDate } from '../lib/utils'

export function Dashboard() {
  const { data: statusData, isLoading, error } = useDownloadStatus()
  const { getRecentDownloads } = useDownloadStore()
  const recentHistory = getRecentDownloads()
  const navigate = useNavigate()
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(5)
  
  // Calculate stats from real data
  const stats = {
    totalBooks: recentHistory.length, // Use history count as total
    activeDownloads: statusData ? Object.keys(statusData.downloading || {}).length : 0,
    queuedDownloads: statusData ? Object.keys(statusData.queued || {}).length : 0,
    completedToday: statusData ? 
      (Object.keys(statusData.available || {}).length + Object.keys(statusData.done || {}).length) : 0,
    failedDownloads: statusData ? Object.keys(statusData.error || {}).length : 0
  }

  // Get recent downloads from all categories with enhanced data
  const recentDownloads = []
  if (statusData) {
    // Add downloading items with progress
    Object.values(statusData.downloading || {}).forEach(item => 
      recentDownloads.push({ 
        ...item, 
        status: 'downloading',
        coverUrl: item.preview,
        timestamp: new Date().toISOString()
      })
    )
    // Add queued items
    Object.values(statusData.queued || {}).forEach(item => 
      recentDownloads.push({ 
        ...item, 
        status: 'queued',
        coverUrl: item.preview,
        timestamp: new Date().toISOString()
      })
    )
    // Add available items as completed
    Object.values(statusData.available || {}).forEach(item => 
      recentDownloads.push({ 
        ...item, 
        status: 'completed',
        coverUrl: item.preview,
        timestamp: item.timestamp || new Date().toISOString()
      })
    )
    // Add done items as completed
    Object.values(statusData.done || {}).forEach(item => 
      recentDownloads.push({ 
        ...item, 
        status: 'completed',
        coverUrl: item.preview,
        timestamp: item.timestamp || new Date().toISOString()
      })
    )
    // Add error items
    Object.values(statusData.error || {}).forEach(item => 
      recentDownloads.push({ 
        ...item, 
        status: 'error',
        coverUrl: item.preview,
        timestamp: item.timestamp || new Date().toISOString()
      })
    )
  }

  // Add recent history items that aren't already in current status
  recentHistory.forEach(historyItem => {
    if (!recentDownloads.some(rd => rd.id === historyItem.id)) {
      recentDownloads.push({
        ...historyItem,
        progress: historyItem.status === 'completed' ? 100 : 0
      })
    }
  })

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
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your book download activity
        </p>
      </div>


      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium text-foreground">Library Size</h3>
            <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
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
            <div className="h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
              <Activity className="h-4 w-4 text-orange-600 dark:text-orange-400" />
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
            <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
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
            <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.failedDownloads}</div>
          <p className="text-xs text-muted-foreground">
            Need attention
          </p>
        </div>

        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium text-foreground">Library Access</h3>
            <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
              <Database className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">CWA Proxy</div>
          <p className="text-xs text-muted-foreground">
            Via remote connection
          </p>
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
              <div className="space-y-4">
                {paginatedDownloads.map((download) => (
                <div key={`${download.id}-${download.timestamp}`} className="relative group flex items-start gap-4 p-4 rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="relative flex-shrink-0">
                    <BookCover 
                      src={download.coverUrl} 
                      alt={download.title} 
                      size="md"
                    />
                    {/* Hover overlay for failed downloads */}
                    {download.status === 'error' && (
                      <div className="absolute inset-0 bg-black/60 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSearchAgain(download)
                          }}
                          className="text-xs h-7 px-2 bg-card/90 hover:bg-card text-card-foreground"
                        >
                          <Search className="w-3 h-3 mr-1" />
                          Search Again
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div>
                      <h4 className="font-medium text-sm line-clamp-1 text-foreground">{download.title}</h4>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        by {download.author || 'Unknown Author'}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{formatDate(download.timestamp || new Date().toISOString())}</span>
                      {download.format && (
                        <span className="px-2 py-1 bg-muted rounded-md font-mono">
                          {download.format.toUpperCase()}
                        </span>
                      )}
                      {download.size && (
                        <span>{download.size}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {download.status === 'completed' && (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-green-600 dark:text-green-400 font-medium">Completed</span>
                      </div>
                    )}
                    
                    {download.status === 'downloading' && (
                      <div className="flex items-center gap-3">
                        <CircularProgress
                          progress={download.progress || 0}
                          status="downloading"
                          size={20}
                          showPercentage={false}
                          showText={false}
                        />
                        <div className="flex flex-col items-end">
                          <span className="text-sm font-medium text-primary">
                            {Math.round(download.progress || 0)}%
                          </span>
                          <span className="text-xs text-muted-foreground">Downloading</span>
                        </div>
                      </div>
                    )}
                    
                    {download.status === 'queued' && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-yellow-500" />
                        <span className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">Queued</span>
                      </div>
                    )}
                    
                    {download.status === 'error' && (
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-destructive" />
                          <span className="text-sm text-destructive font-medium">Failed</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSearchAgain(download)
                          }}
                          className="h-7 px-2 text-xs border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          title="Search for this book again"
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          Retry
                        </Button>
                      </div>
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

