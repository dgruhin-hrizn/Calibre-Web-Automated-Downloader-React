import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../lib/utils'

interface LibraryCheckParams {
  query?: string
  author?: string
  title?: string
}

interface LibraryBook {
  id: number
  title: string
  authors: string[]
  series?: string
  series_index?: number
  formats: string[]
  cover_url?: string
  rating?: number
  read_status?: string
}

interface LibraryCheckResponse {
  books: LibraryBook[]
  total: number
}

/**
 * Hook to check if books already exist in the library
 * Uses the existing /api/metadata/books endpoint with search functionality
 */
export function useLibraryCheck(params: LibraryCheckParams | null, enabled: boolean = true) {
  return useQuery<LibraryCheckResponse>({
    queryKey: ['libraryCheck', params],
    queryFn: async () => {
      if (!params || (!params.query && !params.title && !params.author)) {
        return { books: [], total: 0 }
      }

      // Build search query from available parameters
      const searchTerms: string[] = []
      
      if (params.title) {
        searchTerms.push(params.title)
      }
      
      if (params.author) {
        searchTerms.push(params.author)
      }
      
      if (params.query && !searchTerms.includes(params.query)) {
        searchTerms.push(params.query)
      }
      
      const searchQuery = searchTerms.join(' ')
      
      if (!searchQuery.trim()) {
        return { books: [], total: 0 }
      }

      // Use existing metadata/books endpoint with search parameter
      const searchParams = new URLSearchParams({
        search: searchQuery,
        limit: '8', // Limit to 8 matches for the modal
        offset: '0',
        sort: 'timestamp' // Most recent first
      })
      
      const response = await apiRequest(`/api/metadata/books?${searchParams.toString()}`) as LibraryCheckResponse
      
      return {
        books: response.books || [],
        total: response.total || 0
      }
    },
    enabled: enabled && !!params && (!!params.query || !!params.title || !!params.author),
    staleTime: 30 * 1000, // 30 seconds fresh (shorter for real-time checking)
    gcTime: 2 * 60 * 1000, // 2 minutes in cache
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

/**
 * Hook to manually trigger library check
 */
export function useLibraryCheckMutation() {
  return async (params: LibraryCheckParams): Promise<LibraryCheckResponse> => {
    if (!params.query && !params.title && !params.author) {
      return { books: [], total: 0 }
    }

    const searchTerms: string[] = []
    
    if (params.title) {
      searchTerms.push(params.title)
    }
    
    if (params.author) {
      searchTerms.push(params.author)
    }
    
    if (params.query && !searchTerms.includes(params.query)) {
      searchTerms.push(params.query)
    }
    
    const searchQuery = searchTerms.join(' ')
    
    if (!searchQuery.trim()) {
      return { books: [], total: 0 }
    }

    const searchParams = new URLSearchParams({
      search: searchQuery,
      limit: '8',
      offset: '0',
      sort: 'timestamp'
    })
    
    const response = await apiRequest(`/api/metadata/books?${searchParams.toString()}`) as LibraryCheckResponse
    
    return {
      books: response.books || [],
      total: response.total || 0
    }
  }
}
