import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BOOKS_PER_PAGE, PAGINATION_DETECTION } from '../constants/pagination'
import { useInfiniteLibraryBooks, useLibraryStats, useCWAHealth, useLibraryCache } from './useLibraryQueries'
import { useInfiniteScroll, useScrollMemory, usePageInView, useBookInView, useScrollToBook } from './useInfiniteScroll'
import type { ViewMode, SortParam, LibraryBook } from '../types'

interface UseInfiniteLibraryStateOptions {
  enableInfiniteScroll?: boolean
  enableScrollMemory?: boolean
  enableBookTracking?: boolean
  mode?: 'library' | 'mybooks'
  readStatus?: 'read' | 'unread' | 'in_progress' | 'want_to_read'
}

/**
 * Hook that manages infinite library state with URL synchronization and scroll memory
 */
export function useInfiniteLibraryState({ 
  enableInfiniteScroll = true,
  enableScrollMemory = true,
  enableBookTracking = true,
  mode = 'library',
  readStatus
}: UseInfiniteLibraryStateOptions = {}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const { invalidateLibraryStats } = useLibraryCache()

  // Extract state from URL params with defaults
  const searchQuery = searchParams.get('search') || ''
  const sortParam = (searchParams.get('sort') || 'new') as SortParam
  const viewMode = (searchParams.get('view') || 'grid') as ViewMode
  const currentPage = parseInt(searchParams.get('page') || '1', 10)
  const urlStatusFilter = searchParams.get('status') || (mode === 'mybooks' ? 'all' : '')

  // Use URL status filter for MyBooks mode, otherwise use prop
  const effectiveReadStatus = mode === 'mybooks' ? urlStatusFilter : readStatus

  // React Query infinite query
  const infiniteQuery = useInfiniteLibraryBooks({ 
    search: searchQuery, 
    sort: sortParam,
    mode,
    readStatus: effectiveReadStatus
  })
  
  const statsQuery = useLibraryStats()
  const healthQuery = useCWAHealth()

  // Flatten all pages into a single books array
  // Keep deleting books visible during animation
  const books = useMemo(() => {
    const allBooks = infiniteQuery.data?.pages.flatMap(page => page.books) || []
    // Don't filter out deleting books - let them stay visible for animation
    return allBooks
  }, [infiniteQuery.data])

  // Calculate current logical page based on loaded books
  const totalBooks = infiniteQuery.data?.pages[0]?.total || 0
  // const booksPerPage = 20
  const loadedPages = infiniteQuery.data?.pages.length || 0
  const totalPages = infiniteQuery.data?.pages[0]?.pages || 1
  const hasNextPage = infiniteQuery.hasNextPage

  // Scroll memory management
  const scrollMemory = useScrollMemory(`library-${searchQuery}-${sortParam}`)
  
  // Clear any existing scroll memory data on mount to prevent conflicts with page-based navigation
  useEffect(() => {
    const bookInViewKey = `book-in-view-library-${searchQuery}-${sortParam}`
    const scrollPositionKey = `scroll-position-library-${searchQuery}-${sortParam}`
    sessionStorage.removeItem(bookInViewKey)
    sessionStorage.removeItem(scrollPositionKey)
  }, [searchQuery, sortParam])
  
  // Simple page tracking using page markers
  const { currentPage: detectedPage, registerPageRef } = usePageInView(true)
  const registerBookRef = () => {} // No-op function for compatibility
  const { scrollToBook, scrollToTop } = useScrollToBook()

  // Infinite scroll setup
  const { targetRef: loadMoreRef, isIntersecting } = useInfiniteScroll(
    infiniteQuery.fetchNextPage,
    {
      hasNextPage,
      isFetchingNextPage: infiniteQuery.isFetchingNextPage,
      enabled: enableInfiniteScroll && !infiniteQuery.isError
    }
  )

  // Local UI state
  const [selectedBook, setSelectedBook] = useState<LibraryBook | null>(null)
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [deletingBooks, setDeletingBooks] = useState<Set<number>>(new Set())
  const [hasRestoredScroll, setHasRestoredScroll] = useState(false)
  const [pendingPageNavigation, setPendingPageNavigation] = useState<number | null>(null)

  // Update URL params while preserving others
  const updateURLParams = useCallback((updates: Record<string, string | number | undefined>) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev)
      
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === '') {
          newParams.delete(key)
        } else {
          newParams.set(key, value.toString())
        }
      })
      
      return newParams
    }, { replace: false })
  }, [setSearchParams])

  // Update URL when detected page changes (for manual scrolling)
  const updateCurrentPage = useCallback(() => {
    // Don't update URL during pending page navigation to avoid conflicts
    if (pendingPageNavigation !== null) {
      return
    }
    
    // Only update if the detected page is different and valid
    if (detectedPage !== currentPage && detectedPage <= totalPages && detectedPage >= 1) {
      // Use replace: true for scroll-based updates to avoid cluttering browser history
      setSearchParams(prev => {
        const newParams = new URLSearchParams(prev)
        newParams.set('page', detectedPage.toString())
        return newParams
      }, { replace: true })
    }
  }, [detectedPage, currentPage, totalPages, setSearchParams, pendingPageNavigation])

  // Navigation handlers that reset infinite scroll
  const handleSearchChange = useCallback((query: string) => {
    scrollMemory.clearScrollMemory()
    setHasRestoredScroll(false) // Reset scroll restoration flag
    setPendingPageNavigation(null) // Clear any pending navigation
    updateURLParams({ search: query, page: undefined }) // Reset page on search
  }, [updateURLParams, scrollMemory])

  const handleSortChange = useCallback((sort: SortParam) => {
    scrollMemory.clearScrollMemory()
    setHasRestoredScroll(false) // Reset scroll restoration flag
    setPendingPageNavigation(null) // Clear any pending navigation
    updateURLParams({ sort, page: undefined }) // Reset page on sort change
  }, [updateURLParams, scrollMemory])

  const handleViewModeChange = useCallback((view: ViewMode) => {
    updateURLParams({ view })
  }, [updateURLParams])

  const handleStatusFilterChange = useCallback((status: string) => {
    scrollMemory.clearScrollMemory()
    setHasRestoredScroll(false)
    setPendingPageNavigation(null)
    updateURLParams({ status, page: undefined }) // Reset page on status change
  }, [updateURLParams, scrollMemory])

  // Load more books manually (for "Load More" button)
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !infiniteQuery.isFetchingNextPage) {
      infiniteQuery.fetchNextPage()
    }
  }, [hasNextPage, infiniteQuery.isFetchingNextPage, infiniteQuery.fetchNextPage])

  // Save scroll position periodically
  useEffect(() => {
    if (!enableScrollMemory) return

    const mainElement = document.querySelector('main')
    if (!mainElement) return

    const handleScroll = () => {
      const scrollPosition = mainElement.scrollTop
      scrollMemory.saveScrollPosition(scrollPosition) // Don't save book ID - only scroll position
    }

    // Throttle scroll events
    let timeoutId: NodeJS.Timeout
    const throttledHandleScroll = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(handleScroll, 100)
    }

    mainElement.addEventListener('scroll', throttledHandleScroll, { passive: true })
    return () => {
      mainElement.removeEventListener('scroll', throttledHandleScroll)
      clearTimeout(timeoutId)
    }
  }, [scrollMemory, enableScrollMemory])

  // Restore scroll position on mount or when data changes
  useEffect(() => {
    if (!enableScrollMemory || hasRestoredScroll || infiniteQuery.isLoading || infiniteQuery.isFetchingNextPage || books.length === 0) return

    const { position, bookId } = scrollMemory.getScrollPosition()
    const loadedPages = infiniteQuery.data?.pages.length || 0
    
    // Check if this is a pending page navigation (manual pagination click)
    const isManualNavigation = pendingPageNavigation !== null
    const targetPage = isManualNavigation ? pendingPageNavigation : currentPage
    
    // Handle page navigation (including page 1)
    if (targetPage >= 1 && loadedPages >= targetPage) {
      const booksPerPage = BOOKS_PER_PAGE
      const targetBookIndex = (targetPage - 1) * booksPerPage
      const targetBook = books[targetBookIndex]
      
              if (targetBook) {
          // Choose scroll behavior based on navigation type
          const scrollBehavior = isManualNavigation ? 'smooth' : 'auto'
          
          
          setTimeout(() => {
            scrollToBook(targetBook.id, scrollBehavior)
            setHasRestoredScroll(true)
            // Clear pending navigation after smooth scroll completes
            if (isManualNavigation) {
              setTimeout(() => setPendingPageNavigation(null), 1000)
            } else {
              setPendingPageNavigation(null)
            }
          }, isManualNavigation ? 100 : 300)
        return
      }
    } else if (targetPage > loadedPages) {
      // Still loading required pages, don't attempt scroll restoration yet
      return
    }
    
    // No scroll restoration - use page-based navigation only
    setHasRestoredScroll(true)
    if (isManualNavigation) {
      setPendingPageNavigation(null)
    }
  }, [books.length, infiniteQuery.isLoading, infiniteQuery.isFetchingNextPage, scrollMemory, scrollToBook, enableScrollMemory, currentPage, loadedPages, hasRestoredScroll, pendingPageNavigation])

  // Update URL page when book in view changes (throttled and debounced)
  useEffect(() => {

    // Shorter throttle for more responsiveness
    const timeoutId = setTimeout(() => {
      updateCurrentPage()
    }, 500) // Wait 500ms after changes
    
    return () => clearTimeout(timeoutId)
  }, [updateCurrentPage])

  // Ref for scroll timeout
  // const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load initial pages if URL specifies a page > 1
  useEffect(() => {
    if (infiniteQuery.isLoading || infiniteQuery.isError) return
    
    const targetPage = currentPage
    const loadedPages = infiniteQuery.data?.pages.length || 0
    
    // If URL specifies a page beyond what we have loaded, load more pages
    if (targetPage > loadedPages && hasNextPage && !infiniteQuery.isFetchingNextPage) {

      infiniteQuery.fetchNextPage()
    }
  }, [currentPage, infiniteQuery.data?.pages.length, hasNextPage, infiniteQuery.fetchNextPage, infiniteQuery.isLoading, infiniteQuery.isError, infiniteQuery.isFetchingNextPage])

  // Book action handlers
  const handleBookClick = useCallback((book: LibraryBook) => {
    setSelectedBook(book)
  }, [])

  const handleBookDeleted = useCallback((deletedBookId: number) => {
    // Starting delete animation
    
    // Add book to deleting set for animation
    setDeletingBooks(prev => {
      const newSet = new Set([...prev, deletedBookId])
      // Updated deletingBooks set
      return newSet
    })
    
    // Wait for animation to complete, then refetch and clean up
    setTimeout(() => {
      // Animation complete, refetching data
      
      // Refetch data to get updated list without deleted book
      infiniteQuery.refetch()
      invalidateLibraryStats()
      
      // Clean up deleting state
      setDeletingBooks(prev => {
        const newSet = new Set(prev)
        newSet.delete(deletedBookId)
        // Cleaned up deletingBooks after animation
        return newSet
      })
    }, 1000) // Wait for flip + fade animations to complete (500ms + 500ms)
  }, [infiniteQuery, invalidateLibraryStats])

  const closeBookModal = useCallback(() => {
    setSelectedBook(null)
  }, [])

  const updateSelectedBook = useCallback((updatedBook: LibraryBook) => {
    setSelectedBook(updatedBook)
  }, [])

  // Pagination-style navigation for page clicks
  const handlePageChange = useCallback((page: number) => {
    const booksPerPage = BOOKS_PER_PAGE
    const targetBookIndex = (page - 1) * booksPerPage
    const targetBook = books[targetBookIndex]
    
    // Reset scroll restoration flag to allow new scroll
    setHasRestoredScroll(false)
    
    // Set pending navigation to track this is a manual page click
    setPendingPageNavigation(page)
    
    // Update URL first (use regular navigation, not replace, for page clicks)
    updateURLParams({ page })
    
    if (targetBook) {
      // Book is already loaded, scroll to it immediately with smooth animation
      setTimeout(() => {
        scrollToBook(targetBook.id, 'smooth')
        // Clear pending navigation after smooth scroll animation completes
        setTimeout(() => setPendingPageNavigation(null), 1200)
      }, 100)
    } else if (page <= totalPages) {
      // Need to load more pages to reach this page
      // The useEffect that handles loading will trigger, and when it completes,
      // the scroll restoration useEffect will scroll to the right position
    }
  }, [books, totalPages, scrollToBook, updateURLParams])

  // Derived state
  const stats = statsQuery.data
  const isHealthy = healthQuery.data?.status === 'ok'
  
  // Loading states
  const isLoading = infiniteQuery.isLoading || statsQuery.isLoading
  const isLoadingMore = infiniteQuery.isFetchingNextPage
  const isError = infiniteQuery.isError || statsQuery.isError || healthQuery.isError
  const error = infiniteQuery.error || statsQuery.error || healthQuery.error

  // Format error message
  const errorMessage = error instanceof Error ? error.message : 
    isError && !isHealthy ? 'CWA health check failed. Please ensure your CWA instance is running and accessible.' :
    'Failed to load library data'

  return {
    // Data
    books,
    stats,
    totalPages,
    totalBooks: totalBooks,
    loadedPages,
    hasNextPage,
    isHealthy,
    
    // Current state
    currentPage,
    searchQuery,
    sortParam,
    viewMode,
    statusFilter: urlStatusFilter,
    
    // UI state
    selectedBook,
    showDuplicateModal,
    setShowDuplicateModal,
    deletingBooks,
    
    // Loading states
    isLoading,
    isLoadingMore,
    isError,
    error: errorMessage,
    
    // Query states
    infiniteQuery,
    statsQuery,
    healthQuery,
    
    // Handlers
    handleSearchChange,
    handleSortChange,
    handleViewModeChange,
    handleStatusFilterChange,
    handleBookClick,
    handleBookDeleted,
    closeBookModal,
    updateSelectedBook,
    handlePageChange,
    handleLoadMore,
    
    // Infinite scroll
    loadMoreRef,
    isIntersecting,
    
    // Scroll management
    bookInView: null, // Deprecated, kept for compatibility
    registerBookRef,
    registerPageRef,
    scrollToBook,
    scrollToTop,
    scrollMemory,
    
    // Cache info
    isCached: !infiniteQuery.isLoading && !infiniteQuery.isFetching,
    isStale: infiniteQuery.isStale,
    isFetching: infiniteQuery.isFetching
  }
}
