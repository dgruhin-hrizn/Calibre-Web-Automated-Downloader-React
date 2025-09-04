import { useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { apiRequest } from '../../../lib/utils'
import type { LibraryBook, LibraryStats, SortParam } from '../types'

// Helper to handle both arrays and comma-separated strings
const ensureArray = (value: any) => {
  if (!value) return []
  if (Array.isArray(value)) {
    // Handle array of objects (from metadata API) vs array of strings (from library API)
    return value.map(item => {
      if (typeof item === 'object' && item !== null) {
        // For objects like {id: 1, name: 'Author'} or {id: 1, code: 'en'}
        return item.name || item.code || item.format || String(item)
      }
      return String(item)
    }).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value.split(',').map(s => s.trim()).filter(Boolean)
  }
  return []
}

// Transform raw book data to LibraryBook format
const transformBook = (book: any): LibraryBook => {
  // Handle series data - could be string (library API) or object (metadata API)
  let series = undefined
  let series_index = undefined
  
  if (book?.series) {
    if (typeof book.series === 'object' && book.series !== null) {
      // Metadata API format: {id: 1, name: 'Series Name', index: 1.0}
      series = book.series.name
      series_index = book.series.index
    } else {
      // Library API format: series as string, series_index as separate field
      series = book.series
      series_index = book?.series_index ? parseFloat(book.series_index) : undefined
    }
  }

  return {
    id: book?.id || 0,
    title: book?.title || 'Unknown Title',
    authors: ensureArray(book?.authors),
    series,
    series_index,
    rating: book?.rating || undefined,
    pubdate: book?.pubdate || undefined,
    timestamp: book?.timestamp || undefined,
    last_modified: book?.last_modified || undefined,
    tags: ensureArray(book?.tags),
    languages: ensureArray(book?.languages),
    formats: ensureArray(book?.formats),
    file_sizes: book?.file_sizes || {},
    path: book?.path || '',
    has_cover: book?.has_cover === true || book?.has_cover === 1,
    comments: book?.comments || undefined,
    isbn: book?.isbn || undefined,
    uuid: book?.uuid || undefined,
    publishers: ensureArray(book?.publishers)
  }
}

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
 * Hook for fetching individual book data
 */
export function useLibraryBook(bookId: number, enabled: boolean = true) {
  return useQuery<LibraryBook>({
    queryKey: ['library', 'book', bookId],
    queryFn: async () => {
      const cacheBuster = Date.now()
      const url = `/api/metadata/books/${bookId}?_t=${cacheBuster}`
      
      try {
        const response = await apiRequest(url)
        const transformedBook = transformBook(response)
        
        return transformedBook
      } catch (error) {
        console.error(`[useLibraryBook] Error fetching book ${bookId}:`, error)
        throw error
      }
    },
    enabled: enabled && bookId > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes fresh (shorter for individual books)
    gcTime: 10 * 60 * 1000,   // 10 minutes in cache
    refetchOnWindowFocus: false,
    retry: 2
  })
}

/**
 * Hook for fetching library books with pagination and caching
 */
export function useLibraryBooks({ page, search = '', sort = 'new', perPage = 20 }: LibraryBooksParams) {
  return useQuery<LibraryBooksResponse>({
    queryKey: ['library', 'books', { page, search, sort, perPage }],
    queryFn: async () => {
      const offset = (page - 1) * perPage
      const cacheBuster = Date.now()
      
      const searchParam = search ? `&search=${encodeURIComponent(search)}` : ''
      const url = `/api/metadata/books?offset=${offset}&limit=${perPage}&sort=${sort}${searchParam}&_t=${cacheBuster}`
      

      const response: any = await apiRequest(url)

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
export function useInfiniteLibraryBooks({ search = '', sort = 'new', perPage = 20 }: Omit<LibraryBooksParams, 'page'>) {
  return useInfiniteQuery<LibraryBooksResponse>({
    queryKey: ['library', 'infinite', { search, sort, perPage }],
    queryFn: async (context) => {
      const pageParam = context.pageParam as number || 1
      const offset = (pageParam - 1) * perPage
      const cacheBuster = Date.now()
      
      const searchParam = search ? `&search=${encodeURIComponent(search)}` : ''
      const url = `/api/metadata/books?offset=${offset}&limit=${perPage}&sort=${sort}${searchParam}&_t=${cacheBuster}`
      

      const response: any = await apiRequest(url)

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

  const prefetchPage = async ({ page, search = '', sort = 'new', perPage = 20 }: LibraryBooksParams) => {
    await queryClient.prefetchQuery({
      queryKey: ['library', 'books', { page, search, sort, perPage }],
      queryFn: async () => {
        const offset = (page - 1) * perPage
        const cacheBuster = Date.now()
        
        const searchParam = search ? `&search=${encodeURIComponent(search)}` : ''
        const url = `/api/metadata/books?offset=${offset}&limit=${perPage}&sort=${sort}${searchParam}&_t=${cacheBuster}`
        

        const response: any = await apiRequest(url)

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

  const updateBookInCache = (bookId: number, updatedBook: LibraryBook) => {
    // Update individual book cache
    queryClient.setQueryData(['library', 'book', bookId], updatedBook)

    // Update all cached book queries with the updated book
    queryClient.setQueriesData<LibraryBooksResponse>(
      { queryKey: ['library', 'books'] },
      (oldData) => {
        if (!oldData) return oldData
        return {
          ...oldData,
          books: oldData.books.map(book => 
            book.id === bookId ? updatedBook : book
          )
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
            books: page.books.map((book: LibraryBook) => 
              book.id === bookId ? updatedBook : book
            )
          }))
        }
      }
    )
  }

  const refetchBook = async (bookId: number) => {
    try {
      // First, invalidate any existing cache for this book to force fresh fetch
      await queryClient.invalidateQueries({ 
        queryKey: ['library', 'book', bookId],
        exact: true 
      })
      
      // Use fetchQuery to ensure we get fresh data, with staleTime: 0 to force network request
      const freshData = await queryClient.fetchQuery({
        queryKey: ['library', 'book', bookId],
        queryFn: async () => {
          const cacheBuster = Date.now()
          const url = `/api/metadata/books/${bookId}?_t=${cacheBuster}`
          
          const response = await fetch(url, {
            cache: 'no-cache',  // Force bypass browser cache too
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          })
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }
          const data = await response.json()
          const transformedBook = transformBook(data)
          
          return transformedBook
        },
        staleTime: 0,  // Force immediate network request
        gcTime: 0      // Don't cache this forced refresh
      })
      
      return freshData
    } catch (error) {
      console.error(`[useLibraryCache] Error during refetch for book ${bookId}:`, error)
      throw error
    }
  }

  const getCachedBooks = ({ page, search = '', sort = 'new', perPage = 20 }: LibraryBooksParams) => {
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
    updateBookInCache,
    refetchBook,
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
