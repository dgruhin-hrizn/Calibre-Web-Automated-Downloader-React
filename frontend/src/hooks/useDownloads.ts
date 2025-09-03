import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiRequest, api } from '../lib/utils'
import { useDownloadStore } from '../stores/downloadStore'

const API_BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:8084'
import { useEffect } from 'react'

export interface Book {
  id: string
  title: string
  author: string
  format?: string
  size?: string
  language?: string
  year?: string
  publisher?: string
  preview?: string
  description?: string
  info?: Record<string, any>
  categories?: string[]
  tags?: string[]
}

export interface DownloadStatus {
  id: string
  title: string
  author?: string
  progress?: number
  speed?: string
  eta?: string
  size?: string
  format?: string
  error?: string
  timestamp?: string
  wait_time?: number      // Total wait time in seconds
  wait_start?: number     // When waiting started (timestamp)
  preview?: string        // Cover image URL
}

export interface StatusResponse {
  downloading: Record<string, DownloadStatus>
  processing: Record<string, DownloadStatus>
  waiting: Record<string, DownloadStatus>
  queued: Record<string, DownloadStatus>
  available: Record<string, DownloadStatus>
  done: Record<string, DownloadStatus>
  error: Record<string, DownloadStatus>
  cancelled: Record<string, DownloadStatus>
}

// Hook for getting download status (USER-SPECIFIC)
export function useDownloadStatus() {
  const setDownloadStatus = useDownloadStore((state) => state.setDownloadStatus)
  
  const query = useQuery({
    queryKey: ['userDownloadStatus'], // Changed key to reflect user-specific data
    queryFn: () => apiRequest('/api/downloads/status') as Promise<Record<string, any[]>>, // Use user-specific endpoint
    refetchInterval: 2000, // Refetch every 2 seconds
    refetchIntervalInBackground: true,
  })

  // Update download store when status changes (USER-SPECIFIC DATA)
  useEffect(() => {
    if (query.data) {
      
      // Update downloading items
      if (Array.isArray(query.data.downloading)) {
        query.data.downloading.forEach((item: any) => {
          setDownloadStatus(item.id, {
            status: 'downloading',
            progress: item.progress || 0,
            title: item.title,
            author: item.author,
            coverUrl: item.cover_url || item.preview,
          })
        })
      }

      // Update processing items  
      if (Array.isArray(query.data.processing)) {
        query.data.processing.forEach((item: any) => {
          setDownloadStatus(item.id, {
            status: 'processing',
            progress: 0,
            title: item.title,
            author: item.author,
            coverUrl: item.cover_url || item.preview,
          })
        })
      }

      // Update waiting items
      if (Array.isArray(query.data.waiting)) {
        query.data.waiting.forEach((item: any) => {
          setDownloadStatus(item.id, {
            status: 'waiting',
            progress: 0,
            title: item.title,
            author: item.author,
            coverUrl: item.cover_url || item.preview,
            waitTime: item.wait_time,
            waitStart: item.wait_start,
          })
        })
      }

      // Update queued items
      if (Array.isArray(query.data.queued)) {
        query.data.queued.forEach((item: any) => {
          setDownloadStatus(item.id, {
            status: 'processing', // Map 'queued' to 'processing' for UI consistency
            progress: 0,
            title: item.title,
            author: item.author,
            coverUrl: item.cover_url || item.preview,
          })
        })
      }
    }
  }, [query.data, setDownloadStatus])

  return query
}

// Hook for searching books
export function useBookSearch() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (searchParams: {
      query: string
      author?: string
      title?: string
      isbn?: string
      language?: string
      format?: string
      sort?: string
    }) => {
      const params = new URLSearchParams()
      Object.entries(searchParams).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })
      
      return apiRequest(`${api.search}?${params.toString()}`) as Promise<Book[]>
    },
    onSuccess: () => {
      // Invalidate and refetch download status after search
      queryClient.invalidateQueries({ queryKey: ['downloadStatus'] })
    },
  })
}

// Hook for getting book info
export function useBookInfo(bookId: string | null) {
  return useQuery({
    queryKey: ['bookInfo', bookId],
    queryFn: () => apiRequest(`${api.info}?id=${encodeURIComponent(bookId!)}`),
    enabled: !!bookId,
  })
}

// Hook for getting enhanced book details with Google Books data
export function useEnhancedBookDetails(bookId: string | null) {
  return useQuery({
    queryKey: ['enhancedBookDetails', bookId],
    queryFn: () => apiRequest(`${API_BASE_URL}/api/book-details/${encodeURIComponent(bookId!)}`),
    enabled: !!bookId,
    staleTime: 5 * 60 * 1000, // 5 minutes - Google Books data doesn't change often
  })
}

// Hook for downloading a book
export function useDownloadBook() {
  const queryClient = useQueryClient()
  const setDownloadStatus = useDownloadStore((state) => state.setDownloadStatus)
  
  return useMutation({
    mutationFn: async (bookData: { id: string; title?: string; author?: string; coverUrl?: string }) => {
      // Set initial downloading state
      setDownloadStatus(bookData.id, {
        status: 'downloading',
        progress: 0,
        title: bookData.title,
        author: bookData.author,
        coverUrl: bookData.coverUrl,
      })
      
      return apiRequest(`${api.download}?id=${encodeURIComponent(bookData.id)}`)
    },
    onSuccess: () => {
      // Invalidate and refetch download status after starting download
      queryClient.invalidateQueries({ queryKey: ['downloadStatus'] })
    },
    onError: (error, bookData) => {
      // Set error state if download fails to start
      setDownloadStatus(bookData.id, {
        status: 'error',
        progress: 0,
        title: bookData.title,
        author: bookData.author,
        coverUrl: bookData.coverUrl,
        error: error.message,
      })
    },
  })
}

// Hook for cancelling a download
export function useCancelDownload() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (bookId: string) => {
      return apiRequest(`${api.cancelDownload}/${bookId}/cancel`, {
        method: 'DELETE',
      })
    },
    onSuccess: () => {
      // Invalidate and refetch download status after cancelling
      queryClient.invalidateQueries({ queryKey: ['downloadStatus'] })
    },
  })
}

// Hook for clearing completed downloads
export function useClearCompleted() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async () => {
      return apiRequest(api.clearCompleted, {
        method: 'DELETE',
      })
    },
    onSuccess: () => {
      // Invalidate and refetch download status after clearing
      queryClient.invalidateQueries({ queryKey: ['downloadStatus'] })
    },
  })
}

// Hook for getting active downloads
export function useActiveDownloads() {
  return useQuery({
    queryKey: ['activeDownloads'],
    queryFn: () => apiRequest(api.activeDownloads),
    refetchInterval: 5000, // Refetch every 5 seconds
  })
}

// Hook for getting user's download history
export function useUserDownloadHistory(status?: string, limit: number = 50, offset: number = 0) {
  return useQuery({
    queryKey: ['userDownloadHistory', status, limit, offset],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (status) params.append('status', status)
      params.append('limit', limit.toString())
      params.append('offset', offset.toString())
      
      const response = await apiRequest(`/api/downloads/history?${params.toString()}`)
      return response.downloads || []
    },
    refetchInterval: 30000, // Refetch every 30 seconds (less frequent than active status)
  })
}
