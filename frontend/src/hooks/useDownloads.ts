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

// Hook for getting download status
export function useDownloadStatus() {
  const setDownloadStatus = useDownloadStore((state) => state.setDownloadStatus)
  
  const query = useQuery({
    queryKey: ['downloadStatus'],
    queryFn: () => apiRequest(api.status) as Promise<StatusResponse>,
    refetchInterval: 2000, // Refetch every 2 seconds
    refetchIntervalInBackground: true,
  })

  // Update download store when status changes
  useEffect(() => {
    if (query.data) {
      // Update downloading items
      Object.entries(query.data.downloading || {}).forEach(([id, item]) => {
        setDownloadStatus(id, {
          status: 'downloading',
          progress: item.progress || 0,
          title: item.title,
          author: item.author,
          coverUrl: item.preview, // Use preview as cover URL
        })
      })

      // Update processing items
      Object.entries(query.data.processing || {}).forEach(([id, item]) => {
        setDownloadStatus(id, {
          status: 'processing',
          progress: 0,
          title: item.title,
          author: item.author,
          coverUrl: item.preview,
        })
      })

      // Update waiting items
      Object.entries(query.data.waiting || {}).forEach(([id, item]) => {
        setDownloadStatus(id, {
          status: 'waiting',
          progress: 0,
          title: item.title,
          author: item.author,
          coverUrl: item.preview,
          waitTime: item.wait_time,
          waitStart: item.wait_start,
        })
      })

      // Update available items as completed
      Object.entries(query.data.available || {}).forEach(([id, item]) => {
        setDownloadStatus(id, {
          status: 'completed',
          progress: 100,
          title: item.title,
          author: item.author,
          size: item.size,
          format: item.format,
          coverUrl: item.preview,
        })
      })

      // Update done items as completed
      Object.entries(query.data.done || {}).forEach(([id, item]) => {
        setDownloadStatus(id, {
          status: 'completed',
          progress: 100,
          title: item.title,
          author: item.author,
          size: item.size,
          format: item.format,
          coverUrl: item.preview,
        })
      })

      // Update error items - these will be added to history automatically
      Object.entries(query.data.error || {}).forEach(([id, item]) => {
        setDownloadStatus(id, {
          status: 'error',
          progress: 0,
          title: item.title,
          author: item.author,
          error: item.error,
          size: item.size,
          format: item.format,
          coverUrl: item.preview,
        })
      })
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
