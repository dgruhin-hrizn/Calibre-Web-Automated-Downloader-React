import { useEffect, useState } from 'react'
import { CheckCircle, AlertCircle, Download } from 'lucide-react'
import { useDownloadStatus } from '../hooks/useDownloads'
import { useDownloadStore } from '../stores/downloadStore'
import { Button } from './ui/Button'
import { BookCover } from './ui/BookCover'

interface QueueNotification {
  id: string
  type: 'download_started' | 'download_completed' | 'download_failed'
  title: string
  message: string
  timestamp: number
  bookId?: string
  bookTitle?: string
  bookCover?: string
  autoHide?: boolean
  duration?: number // Duration in milliseconds before auto-hide
}

export function QueueNotifications() {
  const { data: statusData } = useDownloadStatus()
  const downloads = useDownloadStore((state) => state.downloads)
  const [notifications, setNotifications] = useState<QueueNotification[]>([])
  const [previousState, setPreviousState] = useState<any>(null)
  const [progressTick, setProgressTick] = useState(0)

  useEffect(() => {
    if (!statusData || !previousState) {
      setPreviousState(statusData)
      return
    }

    const newNotifications: QueueNotification[] = []
    const currentTime = Date.now()

    // Check for downloads that started
    Object.entries(statusData.downloading || {}).forEach(([id, download]) => {
      if (!previousState.downloading?.[id]) {
        // Try to get cover from downloadStore if not available in statusData
        const storeDownload = downloads[id]
        const coverUrl = download.coverUrl || storeDownload?.coverUrl
        
        newNotifications.push({
          id: `download_started_${id}`,
          type: 'download_started',
          title: 'Download Started',
          message: `"${download.title}" is now downloading`,
          timestamp: currentTime,
          bookId: id,
          bookTitle: download.title,
          bookCover: coverUrl,
          autoHide: true,
          duration: 3000 // 3 seconds
        })
      }
    })

    // Check for downloads that completed
    Object.entries(statusData.available || {}).forEach(([id, download]) => {
      if (!previousState.available?.[id] && !previousState.done?.[id]) {
        // Try to get cover from downloadStore if not available in statusData
        const storeDownload = downloads[id]
        const coverUrl = download.coverUrl || storeDownload?.coverUrl
        
        newNotifications.push({
          id: `download_completed_${id}`,
          type: 'download_completed',
          title: 'Download Completed',
          message: `"${download.title}" has finished downloading`,
          timestamp: currentTime,
          bookId: id,
          bookTitle: download.title,
          bookCover: coverUrl,
          autoHide: true,
          duration: 5000 // 5 seconds for completed downloads
        })
      }
    })

    Object.entries(statusData.done || {}).forEach(([id, download]) => {
      if (!previousState.available?.[id] && !previousState.done?.[id]) {
        // Try to get cover from downloadStore if not available in statusData
        const storeDownload = downloads[id]
        const coverUrl = download.coverUrl || storeDownload?.coverUrl
        
        newNotifications.push({
          id: `download_completed_${id}`,
          type: 'download_completed',
          title: 'Download Completed',
          message: `"${download.title}" has finished downloading`,
          timestamp: currentTime,
          bookId: id,
          bookTitle: download.title,
          bookCover: coverUrl,
          autoHide: true,
          duration: 5000 // 5 seconds for completed downloads
        })
      }
    })

    // Check for downloads that failed
    Object.entries(statusData.error || {}).forEach(([id, download]) => {
      if (!previousState.error?.[id]) {
        // Try to get cover from downloadStore if not available in statusData
        const storeDownload = downloads[id]
        const coverUrl = download.coverUrl || storeDownload?.coverUrl
        
        newNotifications.push({
          id: `download_failed_${id}`,
          type: 'download_failed',
          title: 'Download Failed',
          message: `"${download.title}" failed to download`,
          timestamp: currentTime,
          bookId: id,
          bookTitle: download.title,
          bookCover: coverUrl,
          autoHide: true,
          duration: 7000 // 7 seconds for failed downloads (longer to read error)
        })
      }
    })



    if (newNotifications.length > 0) {
      setNotifications(prev => [...newNotifications, ...prev].slice(0, 10)) // Keep only latest 10
    }

    setPreviousState(statusData)
  }, [statusData, notifications])

  // Auto-hide notifications with progress tracking
  useEffect(() => {
    const interval = setInterval(() => {
      // Update progress tick to trigger re-renders
      setProgressTick(prev => prev + 1)
      
      // Filter out expired notifications
      setNotifications(prev => 
        prev.filter(notification => {
          if (notification.autoHide) {
            const elapsed = Date.now() - notification.timestamp
            const duration = notification.duration || 5000
            if (elapsed >= duration) {
              return false
            }
          }
          return true
        })
      )
    }, 100) // Update more frequently for smooth progress bar

    return () => clearInterval(interval)
  }, [])

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const getProgressPercentage = (notification: QueueNotification) => {
    if (!notification.autoHide) return 100
    const elapsed = Date.now() - notification.timestamp
    const duration = notification.duration || 5000
    const progress = Math.max(0, Math.min(100, ((duration - elapsed) / duration) * 100))
    return progress
  }

  const getNotificationIcon = (type: QueueNotification['type']) => {
    switch (type) {
      case 'download_started':
        return <Download className="h-4 w-4 text-blue-600" />
      case 'download_completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'download_failed':
        return <AlertCircle className="h-4 w-4 text-red-600" />
      default:
        return <Download className="h-4 w-4 text-gray-600" />
    }
  }

  const getNotificationColor = (type: QueueNotification['type']) => {
    switch (type) {
      case 'download_started':
        return 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20'
      case 'download_completed':
        return 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
      case 'download_failed':
        return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
      default:
        return 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/20'
    }
  }

  if (notifications.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 space-y-2 max-w-sm">
      {notifications.map((notification) => {
        const progressPercentage = getProgressPercentage(notification)
        
        return (
          <div
            key={notification.id}
            className={`relative overflow-hidden rounded-lg border shadow-lg transition-all duration-300 ${getNotificationColor(notification.type)}`}
          >
            <div className="p-4">
              <div className="flex items-start gap-3">
                {/* Status Icon */}
                <div className="flex-shrink-0 mt-0.5">
                  {getNotificationIcon(notification.type)}
                </div>
                
                {/* Book Cover */}
                {notification.bookCover && (
                  <div className="flex-shrink-0">
                    <BookCover
                      src={notification.bookCover}
                      alt={notification.bookTitle || 'Book cover'}
                      className="w-12 h-16 rounded-md"
                    />
                  </div>
                )}
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {notification.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {notification.message}
                  </p>
                  <div className="flex justify-end mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => dismissNotification(notification.id)}
                      className="text-xs h-6 px-2"
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Progress Bar for Auto-Hide Notifications */}
            {notification.autoHide && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/10 dark:bg-white/10">
                <div 
                  className="h-full bg-current opacity-50 transition-all duration-100 ease-linear"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
