import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface DownloadState {
  id: string
  status: 'idle' | 'processing' | 'downloading' | 'waiting' | 'completed' | 'error'
  progress: number
  title?: string
  author?: string
  error?: string
  timestamp?: string
  size?: string
  format?: string
  coverUrl?: string
  waitTime?: number      // Total wait time in seconds
  waitStart?: number     // When waiting started (timestamp)
}

interface DownloadHistory {
  id: string
  title: string
  author?: string
  status: 'completed' | 'error'
  timestamp: string
  error?: string
  size?: string
  format?: string
  coverUrl?: string
}

interface DownloadStore {
  downloads: Record<string, DownloadState>
  history: DownloadHistory[]
  notificationHistory: DownloadHistory[]
  dismissedNotifications: Set<string>
  setDownloadStatus: (id: string, status: Partial<DownloadState>) => void
  removeDownload: (id: string) => void
  clearCompleted: () => void
  clearHistory: () => void
  clearNotifications: () => void
  clearAll: () => void
  dismissNotification: (id: string) => void
  getDownloadStatus: (id: string) => DownloadState | null
  getRecentDownloads: () => DownloadHistory[]
  getNotificationHistory: () => DownloadHistory[]
  cleanupStaleDownloads: (activeDownloadIds: string[]) => void
}

export const useDownloadStore = create<DownloadStore>()(
  persist(
    (set, get) => ({
      downloads: {},
      history: [],
      notificationHistory: [],
      dismissedNotifications: new Set(),
      
      setDownloadStatus: (id: string, status: Partial<DownloadState>) => {
        set((state) => {
          const currentDownload = state.downloads[id]
          const newDownload = {
            id,
            status: (status.status || currentDownload?.status || 'idle') as const,
            progress: status.progress ?? currentDownload?.progress ?? 0,
            ...currentDownload,
            ...status,
            timestamp: status.status === 'completed' || status.status === 'error' 
              ? new Date().toISOString() 
              : currentDownload?.timestamp
          }

          // Add to both history and notification history if completed or error (and not already in history)
          let newHistory = state.history
          let newNotificationHistory = state.notificationHistory
          
          if ((status.status === 'completed' || status.status === 'error') && 
              newDownload.title &&
              !state.history.some(h => h.id === id)) {
            const historyItem: DownloadHistory = {
              id,
              title: newDownload.title,
              author: newDownload.author,
              status: status.status,
              timestamp: newDownload.timestamp!,
              error: newDownload.error,
              size: newDownload.size,
              format: newDownload.format,
              coverUrl: newDownload.coverUrl,
            }
            newHistory = [historyItem, ...state.history].slice(0, 100) // Keep last 100 items
            newNotificationHistory = [historyItem, ...state.notificationHistory].slice(0, 50) // Keep last 50 for notifications
          }

          return {
            downloads: {
              ...state.downloads,
              [id]: newDownload
            },
            history: newHistory,
            notificationHistory: newNotificationHistory
          }
        })
      },
      
      removeDownload: (id: string) => {
        set((state) => {
          const { [id]: removed, ...rest } = state.downloads
          return { downloads: rest }
        })
      },
      
      clearCompleted: () => {
        set((state) => {
          const activeDownloads = Object.fromEntries(
            Object.entries(state.downloads).filter(([_, download]) => 
              download.status !== 'completed' && download.status !== 'error'
            )
          )
          return { downloads: activeDownloads }
        })
      },

      clearHistory: () => {
        set({ history: [] })
      },

      clearNotifications: () => {
        set((state) => {
          // Get all current completed/error items from backend to dismiss them
          // const currentCompletedIds = new Set<string>()
          // We'll populate this in the component where we have access to backend data
          
          return {
            ...state,
            notificationHistory: [],
            dismissedNotifications: new Set([...state.dismissedNotifications])
          }
        })
      },

      clearAll: () => {
        set(() => ({
          downloads: {},
          history: [],
          notificationHistory: [],
          dismissedNotifications: new Set()
        }))
      },

      dismissNotification: (id: string) => {
        set((state) => ({
          ...state,
          dismissedNotifications: new Set([...state.dismissedNotifications, id])
        }))
      },
      
      getDownloadStatus: (id: string) => {
        return get().downloads[id] || null
      },

      getRecentDownloads: () => {
        return get().history.slice(0, 20) // Return last 20 items
      },

      getNotificationHistory: () => {
        return get().notificationHistory.slice(0, 20) // Return last 20 notification items
      },

      cleanupStaleDownloads: (activeDownloadIds: string[]) => {
        set((state) => {
          const newDownloads = { ...state.downloads }
          
          // Remove downloads that are no longer active and are in downloading/processing state
          Object.keys(newDownloads).forEach(id => {
            const download = newDownloads[id]
            if (!activeDownloadIds.includes(id) && 
                (download.status === 'downloading' || download.status === 'processing' || download.status === 'waiting')) {
              delete newDownloads[id]
            }
          })
          
          return {
            ...state,
            downloads: newDownloads
          }
        })
      }
    }),
    {
      name: 'download-store',
      partialize: (state) => ({ 
        history: state.history,
        notificationHistory: state.notificationHistory 
      }), // Only persist history and notifications, not active downloads
    }
  )
)
