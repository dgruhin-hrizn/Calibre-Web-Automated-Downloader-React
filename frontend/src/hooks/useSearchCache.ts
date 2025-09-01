import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest, api } from '../lib/utils'
import type { Book } from './useDownloads'

interface SearchParams {
  query: string
  author?: string
  language?: string
  format?: string
}

// Enhanced search hook with React Query caching
export function useSearchBooks(params: SearchParams | null) {
  return useQuery({
    queryKey: ['search', params],
    queryFn: async () => {
      if (!params) return []
      
      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value) searchParams.append(key, value)
      })
      
      return apiRequest(`${api.search}?${searchParams.toString()}`) as Promise<Book[]>
    },
    enabled: !!params?.query,
    staleTime: 5 * 60 * 1000, // 5 minutes fresh
    gcTime: 30 * 60 * 1000,   // 30 minutes in cache
    retry: 2,
    refetchOnWindowFocus: false, // Don't refetch on tab focus
  })
}

// Hook to prefetch search results
export function usePrefetchSearch() {
  const queryClient = useQueryClient()
  
  return (params: SearchParams) => {
    queryClient.prefetchQuery({
      queryKey: ['search', params],
      queryFn: async () => {
        const searchParams = new URLSearchParams()
        Object.entries(params).forEach(([key, value]) => {
          if (value) searchParams.append(key, value)
        })
        return apiRequest(`${api.search}?${searchParams.toString()}`) as Promise<Book[]>
      },
      staleTime: 5 * 60 * 1000,
    })
  }
}

// Hook to get cached search results without triggering fetch
export function useSearchCache(params: SearchParams | null) {
  const queryClient = useQueryClient()
  
  return queryClient.getQueryData<Book[]>(['search', params])
}

// Hook to invalidate search cache
export function useInvalidateSearch() {
  const queryClient = useQueryClient()
  
  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: ['search'] }),
    invalidateSearch: (params: SearchParams) => 
      queryClient.invalidateQueries({ queryKey: ['search', params] }),
    clearAll: () => queryClient.removeQueries({ queryKey: ['search'] }),
  }
}
