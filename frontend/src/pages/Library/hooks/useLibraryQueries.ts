import { useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { apiRequest } from '../../../lib/utils'
import type { LibraryBook, LibraryStats, CWALibraryResponse, SortParam } from '../types'

// Helper to handle both arrays and comma-separated strings
const ensureArray = (value: any) => {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    return value.split(',').map(s => s.trim()).filter(Boolean)
  }
  return []
}

// Transform raw book data to LibraryBook format
const transformBook = (book: any): LibraryBook => ({
  id: book?.id || 0,
  title: book?.title || 'Unknown Title',
  authors: ensureArray(book?.authors),
  series: book?.series || undefined,
  series_index: book?.series_index ? parseFloat(book.series_index) : undefined,
  rating: book?.rating || undefined,
  pubdate: book?.pubdate || undefined,
  timestamp: book?.timestamp || undefined,
  tags: ensureArray(book?.tags),
  languages: ensureArray(book?.languages),
  formats: ensureArray(book?.formats),
  path: book?.path || '',
  has_cover: book?.has_cover === true || book?.has_cover === 1,
  comments: book?.comments || undefined
})

interface LibraryBooksParams {
  page: number
  search?: string
  sort?: SortParam
  perPage?: number
}

interface LibraryBooksResponse {
  books: LibraryBook[]
  total: number
  page: number
  per_page: number
  pages: number
}

/**
 * Hook for fetching library books with pagination and caching
 */
export function useLibraryBooks({ page, search = '', sort = 'new', perPage = 18 }: LibraryBooksParams) {
  return useQuery<LibraryBooksResponse>({
    queryKey: ['library', 'books', { page, search, sort, perPage }],
    queryFn: async () => {
      const offset = (page - 1) * perPage
      const cacheBuster = Date.now()
      
      const searchParam = search ? `&search=${encodeURIComponent(search)}` : ''
      const url = `/api/metadata/books?offset=${offset}&limit=${perPage}&sort=${sort}${searchParam}&_t=${cacheBuster}`
      

      const response: CWALibraryResponse = await apiRequest(url)

      const transformedBooks = (response.books || []).map(transformBook)

      return {
        books: transformedBooks,
        total: response.total || 0,
        page: response.page || page,
        per_page: response.per_page || perPage,
        pages: response.pages || 1
      }
    },
    enabled: page > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes fresh
    gcTime: 30 * 60 * 1000,   // 30 minutes in cache
    refetchOnWindowFocus: false,
    retry: 2
  })
}

/**
 * Hook for fetching library statistics with caching
 */
export function useLibraryStats() {
  return useQuery<LibraryStats>({
    queryKey: ['library', 'stats'],
    queryFn: async () => {
      try {
        // Use the dedicated stats endpoint for accurate counts
        const statsResponse = await apiRequest('/api/metadata/stats')
        return statsResponse
      } catch (error) {
        console.error('Failed to load stats:', error)
        // Fallback to basic stats using books endpoint
        try {
          const basicResponse = await apiRequest('/api/metadata/books?offset=0&limit=1&sort=timestamp&order=')
          return {
            total_books: basicResponse.total || 0,
            total_authors: 0,
            total_series: 0,
            total_tags: 0
          }
        } catch (fallbackError) {
          console.error('Failed to load basic stats:', fallbackError)
          throw fallbackError
        }
      }
    },
    staleTime: 10 * 60 * 1000, // 10 minutes fresh (stats change less frequently)
    gcTime: 60 * 60 * 1000,    // 1 hour in cache
    refetchOnWindowFocus: false,
    retry: 2
  })
}

/**
 * Hook for infinite loading of library books
 */
export function useInfiniteLibraryBooks({ search = '', sort = 'new', perPage = 18 }: Omit<LibraryBooksParams, 'page'>) {
  return useInfiniteQuery<LibraryBooksResponse>({
    queryKey: ['library', 'infinite', { search, sort, perPage }],
    queryFn: async ({ pageParam = 1 }) => {
      const offset = (pageParam - 1) * perPage
      const cacheBuster = Date.now()
      
      const searchParam = search ? `&search=${encodeURIComponent(search)}` : ''
      const url = `/api/metadata/books?offset=${offset}&limit=${perPage}&sort=${sort}${searchParam}&_t=${cacheBuster}`
      

      const response: CWALibraryResponse = await apiRequest(url)

      const transformedBooks = (response.books || []).map(transformBook)

      return {
        books: transformedBooks,
        total: response.total || 0,
        page: response.page || pageParam,
        per_page: response.per_page || perPage,
        pages: response.pages || 1
      }
    },
    getNextPageParam: (lastPage) => {
      const nextPage = lastPage.page + 1
      return nextPage <= lastPage.pages ? nextPage : undefined
    },
    initialPageParam: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes fresh
    gcTime: 30 * 60 * 1000,   // 30 minutes in cache
    refetchOnWindowFocus: false,
    retry: 2
  })
}

/**
 * Hook for prefetching library pages
 */
export function usePrefetchLibraryBooks() {
  const queryClient = useQueryClient()

  const prefetchPage = async ({ page, search = '', sort = 'new', perPage = 18 }: LibraryBooksParams) => {
    await queryClient.prefetchQuery({
      queryKey: ['library', 'books', { page, search, sort, perPage }],
      queryFn: async () => {
        const offset = (page - 1) * perPage
        const cacheBuster = Date.now()
        
        const searchParam = search ? `&search=${encodeURIComponent(search)}` : ''
        const url = `/api/metadata/books?offset=${offset}&limit=${perPage}&sort=${sort}${searchParam}&_t=${cacheBuster}`
        

        const response: CWALibraryResponse = await apiRequest(url)

        const transformedBooks = (response.books || []).map(transformBook)

        return {
          books: transformedBooks,
          total: response.total || 0,
          page: response.page || page,
          per_page: response.per_page || perPage,
          pages: response.pages || 1
        }
      },
      staleTime: 5 * 60 * 1000
    })
  }

  return { prefetchPage }
}

/**
 * Hook for cache management and invalidation
 */
export function useLibraryCache() {
  const queryClient = useQueryClient()

  const invalidateLibraryBooks = () => {
    queryClient.invalidateQueries({ queryKey: ['library', 'books'] })
    queryClient.invalidateQueries({ queryKey: ['library', 'infinite'] })
  }

  const invalidateLibraryStats = () => {
    queryClient.invalidateQueries({ queryKey: ['library', 'stats'] })
  }

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['library'] })
  }

  const removeBookFromCache = (bookId: number) => {
    // Update all cached book queries to remove the deleted book
    queryClient.setQueriesData<LibraryBooksResponse>(
      { queryKey: ['library', 'books'] },
      (oldData) => {
        if (!oldData) return oldData
        return {
          ...oldData,
          books: oldData.books.filter(book => book.id !== bookId),
          total: oldData.total - 1
        }
      }
    )

    // Update infinite query cache
    queryClient.setQueriesData(
      { queryKey: ['library', 'infinite'] },
      (oldData: any) => {
        if (!oldData) return oldData
        return {
          ...oldData,
          pages: oldData.pages.map((page: LibraryBooksResponse) => ({
            ...page,
            books: page.books.filter((book: LibraryBook) => book.id !== bookId),
            total: page.total - 1
          }))
        }
      }
    )
  }

  const getCachedBooks = ({ page, search = '', sort = 'new', perPage = 18 }: LibraryBooksParams) => {
    return queryClient.getQueryData<LibraryBooksResponse>(['library', 'books', { page, search, sort, perPage }])
  }

  const getCachedStats = () => {
    return queryClient.getQueryData<LibraryStats>(['library', 'stats'])
  }

  return {
    invalidateLibraryBooks,
    invalidateLibraryStats,
    invalidateAll,
    removeBookFromCache,
    getCachedBooks,
    getCachedStats
  }
}

/**
 * Hook for testing CWA connection with caching
 */
export function useCWAHealth() {
  return useQuery<{ status: string }>({
    queryKey: ['cwa', 'health'],
    queryFn: async () => {
      try {
        const response = await apiRequest('/api/cwa/health')
        return response
      } catch (error) {
        console.error('CWA health check failed:', error)
        try {
          const proxyResponse = await apiRequest('/api/cwa/health-proxy')
          return proxyResponse
        } catch (proxyError) {
          console.error('CWA proxy health check also failed:', proxyError)
          throw proxyError
        }
      }
    },
    staleTime: 30 * 1000, // 30 seconds fresh
    gcTime: 2 * 60 * 1000, // 2 minutes in cache
    retry: 2,
    refetchInterval: 60 * 1000, // Check every minute
    refetchOnWindowFocus: true
  })
}
