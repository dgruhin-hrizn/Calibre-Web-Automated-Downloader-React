import { useCallback } from 'react'
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query'
import { apiRequest } from '../lib/utils'

export interface ReadStatus {
  book_id: number
  read_status: number // 0=unread, 1=read, 2=in_progress, 3=want_to_read
  is_read: boolean
  is_in_progress: boolean
  is_want_to_read: boolean
  last_modified: string | null
  last_time_started_reading: string | null
  times_started_reading: number
}

export interface ReadingStats {
  total_books_tracked: number
  books_read: number
  books_in_progress: number
  books_unread: number
}

// Hook for managing individual book read status
export function useReadStatus(bookId: string | number | null | undefined) {
  const queryClient = useQueryClient()

  // Get read status for a single book
  const { data: readStatus, isLoading } = useQuery({
    queryKey: ['readStatus', bookId],
    queryFn: async (): Promise<ReadStatus> => {
      return await apiRequest(`/api/books/${bookId}/read-status`)
    },
    enabled: !!bookId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Mutation to update read status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ action }: { action: 'toggle' | 'mark_read' | 'mark_unread' | 'mark_in_progress' | 'mark_want_to_read' }) => {
      return await apiRequest(`/api/books/${bookId}/read-status`, {
        method: 'POST',
        body: JSON.stringify({ action })
      })
    },
    onSuccess: (newStatus) => {
      // Update the specific book's read status
      queryClient.setQueryData(['readStatus', bookId], newStatus)
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['readingStats'] })
      queryClient.invalidateQueries({ queryKey: ['userBooks'] })
      
      // Update any cached book lists that include this book
      queryClient.invalidateQueries({ queryKey: ['books'] })
      queryClient.invalidateQueries({ queryKey: ['metadata', 'books'] })
      queryClient.invalidateQueries({ queryKey: ['library'] })
    },
    onError: (error) => {
      console.error('Failed to update read status:', error)
    }
  })

  const updateStatus = useCallback(async (action: 'toggle' | 'mark_read' | 'mark_unread' | 'mark_in_progress' | 'mark_want_to_read') => {
    await updateStatusMutation.mutateAsync({ action })
  }, [updateStatusMutation])

  return {
    readStatus,
    isLoading,
    updateStatus,
    isUpdating: updateStatusMutation.isPending,
    error: updateStatusMutation.error
  }
}

// Hook for managing multiple books' read status
export function useBulkReadStatus() {
  const queryClient = useQueryClient()

  // Get read status for multiple books
  const getBulkStatusMutation = useMutation({
    mutationFn: async (bookIds: (string | number)[]): Promise<{ book_statuses: Record<string, ReadStatus> }> => {
      return await apiRequest('/api/books/read-status', {
        method: 'POST',
        body: JSON.stringify({ book_ids: bookIds })
      })
    }
  })

  const getBulkStatus = useCallback(async (bookIds: (string | number)[]) => {
    const result = await getBulkStatusMutation.mutateAsync(bookIds)
    
    // Cache individual book statuses
    Object.entries(result.book_statuses).forEach(([bookId, status]) => {
      queryClient.setQueryData(['readStatus', bookId], status)
    })
    
    return result.book_statuses
  }, [getBulkStatusMutation, queryClient])

  return {
    getBulkStatus,
    isLoading: getBulkStatusMutation.isPending,
    error: getBulkStatusMutation.error
  }
}

// Hook for user reading statistics
export function useReadingStats() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['readingStats'],
    queryFn: async (): Promise<ReadingStats> => {
      return await apiRequest('/api/user/reading-stats')
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  return {
    stats,
    isLoading
  }
}

// Hook for getting books by read status
export function useBooksByStatus(status: 'read' | 'unread' | 'in_progress', limit = 50) {
  const { data: bookIds, isLoading } = useQuery({
    queryKey: ['userBooks', status, limit],
    queryFn: async (): Promise<{ book_ids: number[], status: string, count: number }> => {
      return await apiRequest(`/api/user/books/${status}?limit=${limit}`)
    },
    enabled: !!status,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  return {
    bookIds: bookIds?.book_ids || [],
    count: bookIds?.count || 0,
    isLoading
  }
}
