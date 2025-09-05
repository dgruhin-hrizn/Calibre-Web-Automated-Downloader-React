import { useEffect, useState } from 'react'
import { CheckCircle, AlertCircle, Download } from 'lucide-react'
import { useDownloadStatus } from '../hooks/useDownloads'
import { useRecentNotifications, type Notification } from '../hooks/useNotifications'
import { useDownloadStore } from '../stores/downloadStore'
import { Button } from './ui/Button'
import { BookCover } from './ui/BookCover'

export function QueueNotifications() {
  const { data: statusData } = useDownloadStatus()
  const { data: notificationsData } = useRecentNotifications(10)
  const downloads = useDownloadStore((state) => state.downloads)
  const [displayedNotifications, setDisplayedNotifications] = useState<Notification[]>([])
  const [previousState, setPreviousState] = useState<any>(null)
  const [seenNotificationIds, setSeenNotificationIds] = useState<Set<string>>(new Set())
  const [, setProgressTick] = useState(0)

  // Handle download started notifications from status changes
  useEffect(() => {
    if (!statusData || !previousState) {
      setPreviousState(statusData)
      return
    }

    const newNotifications: Notification[] = []
    const currentTime = Date.now()

    // Check for downloads that started
    Object.entries(statusData.downloading || {}).forEach(([id, download]) => {
      if (!previousState.downloading?.[id]) {
        // Get cover from download object first, then fall back to downloadStore
        const storeDownload = downloads[id]
        const coverUrl = download.cover_url || download.preview || storeDownload?.coverUrl
        
        newNotifications.push({
          id: `download_started_${id}`,
          type: 'download_started',
          title: 'Download Started',
          message: `"${download.title}" is now downloading`,
          timestamp: currentTime,
          book_id: id,
          book_title: download.title,
          cover_url: coverUrl,
          auto_hide: true,
          duration: 3000 // 3 seconds
        })
      }
    })

    // Note: Failure notifications are now handled by the backend NotificationManager
    // to prevent duplicate notifications. The backend triggers failure notifications
    // immediately when status changes to ERROR.

    if (newNotifications.length > 0) {
      setDisplayedNotifications(prev => [...newNotifications, ...prev].slice(0, 10))
    }

    setPreviousState(statusData)
  }, [statusData, previousState, downloads])

  // Handle real-time notifications from the API (completions, etc.)
  useEffect(() => {
    if (!notificationsData?.notifications) return

    const newNotifications = notificationsData.notifications.filter(
      notification => !seenNotificationIds.has(notification.id)
    )

    if (newNotifications.length > 0) {
      // Add new notifications to displayed list
      setDisplayedNotifications(prev => [...newNotifications, ...prev].slice(0, 10))
      
      // Mark as seen
      setSeenNotificationIds(prev => {
        const newSeen = new Set(prev)
        newNotifications.forEach(n => newSeen.add(n.id))
        return newSeen
      })
    }
  }, [notificationsData, seenNotificationIds])

  // Auto-hide notifications with progress tracking
  useEffect(() => {
    const interval = setInterval(() => {
      // Update progress tick to trigger re-renders
      setProgressTick(prev => prev + 1)
      
      // Filter out expired notifications
      setDisplayedNotifications(prev => 
        prev.filter(notification => {
          if (notification.auto_hide) {
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
    setDisplayedNotifications(prev => prev.filter(n => n.id !== id))
  }

  const getProgressPercentage = (notification: Notification) => {
    if (!notification.auto_hide) return 100
    const elapsed = Date.now() - notification.timestamp
    const duration = notification.duration || 5000
    const progress = Math.max(0, Math.min(100, ((duration - elapsed) / duration) * 100))
    return progress
  }

  const getNotificationIcon = (type: Notification['type']) => {
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

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'download_started':
        return 'border-blue-200 bg-blue-50'
      case 'download_completed':
        return 'border-green-200 bg-green-50'
      case 'download_failed':
        return 'border-red-200 bg-red-50'
      default:
        return 'border-gray-200 bg-gray-50'
    }
  }

  if (displayedNotifications.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 space-y-2 max-w-sm">
      {displayedNotifications.map((notification) => {
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
                {notification.cover_url && (
                  <div className="flex-shrink-0">
                    <BookCover
                      src={notification.cover_url}
                      alt={notification.book_title || 'Book cover'}
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
            {notification.auto_hide && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/10">
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
