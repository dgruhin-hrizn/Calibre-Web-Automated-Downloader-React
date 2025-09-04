import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useInfiniteLibraryBooks, useLibraryStats, useCWAHealth, useLibraryCache } from './useLibraryQueries'
import { useInfiniteScroll, useScrollMemory, useBookInView, useScrollToBook } from './useInfiniteScroll'
import type { ViewMode, SortParam, LibraryBook } from '../types'

interface UseInfiniteLibraryStateOptions {
  enableInfiniteScroll?: boolean
  enableScrollMemory?: boolean
  enableBookTracking?: boolean
}

/**
 * Hook that manages infinite library state with URL synchronization and scroll memory
 */
export function useInfiniteLibraryState({ 
  enableInfiniteScroll = true,
  enableScrollMemory = true,
  enableBookTracking = true
}: UseInfiniteLibraryStateOptions = {}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const { invalidateLibraryStats } = useLibraryCache()

  // Extract state from URL params with defaults
  const searchQuery = searchParams.get('search') || ''
  const sortParam = (searchParams.get('sort') || 'new') as SortParam
  const viewMode = (searchParams.get('view') || 'grid') as ViewMode
  const currentPage = parseInt(searchParams.get('page') || '1', 10)

  // React Query infinite query
  const infiniteQuery = useInfiniteLibraryBooks({ 
    search: searchQuery, 
    sort: sortParam 
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
  
  // Book tracking
  const { bookInView, registerBookRef } = useBookInView(books, enableBookTracking)
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

  // Update the page parameter based on which book is actually in view
  const updateCurrentPage = useCallback(() => {
    if (books.length === 0) {

      return
    }
    
    // const scrollTop = window.scrollY

    
    // If we have a book in view, calculate page based on that (ignore scroll position)
    if (bookInView) {

      const bookIndex = books.findIndex(book => book.id === bookInView)

      
      if (bookIndex === -1) {

        return
      }
      
      const booksPerPage = 20
      const calculatedPage = Math.floor(bookIndex / booksPerPage) + 1
      // const positionInPage = bookIndex % booksPerPage
      

      
      // Simplified logic - just update if page is different
      if (calculatedPage !== currentPage && calculatedPage > 0 && calculatedPage <= totalPages) {

        updateURLParams({ page: calculatedPage })
      } else {

      }
    } else {

    }
  }, [bookInView, books, currentPage, totalPages, updateURLParams])

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
  }, [scrollMemory, bookInView, enableScrollMemory])

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
      const booksPerPage = 20
      const targetBookIndex = (targetPage - 1) * booksPerPage
      const targetBook = books[targetBookIndex]
      
      if (targetBook) {
        // Choose scroll behavior based on navigation type
        const scrollBehavior = isManualNavigation ? 'smooth' : 'auto'
        
        setTimeout(() => {
          scrollToBook(targetBook.id, scrollBehavior, targetPage)
          setHasRestoredScroll(true)
          setPendingPageNavigation(null) // Clear pending navigation
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
  }, [bookInView, updateCurrentPage])

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
    console.log('[handleBookDeleted] Starting delete animation for book:', deletedBookId)
    
    // Add book to deleting set for animation
    setDeletingBooks(prev => {
      const newSet = new Set([...prev, deletedBookId])
      console.log('[handleBookDeleted] Updated deletingBooks:', Array.from(newSet))
      return newSet
    })
    
    // Wait for animation to complete, then refetch and clean up
    setTimeout(() => {
      console.log('[handleBookDeleted] Animation complete, refetching data for book:', deletedBookId)
      
      // Refetch data to get updated list without deleted book
      infiniteQuery.refetch()
      invalidateLibraryStats()
      
      // Clean up deleting state
      setDeletingBooks(prev => {
        const newSet = new Set(prev)
        newSet.delete(deletedBookId)
        console.log('[handleBookDeleted] Cleaned up deletingBooks after animation:', Array.from(newSet))
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

  // Pagination-style navigation for compatibility
  const handlePageChange = useCallback((page: number) => {
    const booksPerPage = 20
    const targetBookIndex = (page - 1) * booksPerPage
    const targetBook = books[targetBookIndex]
    
    // Reset scroll restoration flag to allow new scroll
    setHasRestoredScroll(false)
    
    // Set pending navigation to track this is a manual page click
    setPendingPageNavigation(page)
    
    // Update URL first
    updateURLParams({ page })
    
    if (targetBook) {
      // Book is already loaded, scroll to it immediately
      setTimeout(() => {
        scrollToBook(targetBook.id, 'smooth')
        setPendingPageNavigation(null) // Clear pending navigation
      }, 100)
    } else if (page <= totalPages) {
      // Need to load more pages to reach this page
      // The useEffect that handles loading will trigger, and when it completes,
      // the scroll restoration useEffect will scroll to the right position
      // pendingPageNavigation will be used to determine scroll behavior
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
    bookInView,
    registerBookRef,
    scrollToBook,
    scrollToTop,
    scrollMemory,
    
    // Cache info
    isCached: !infiniteQuery.isLoading && !infiniteQuery.isFetching,
    isStale: infiniteQuery.isStale,
    isFetching: infiniteQuery.isFetching
  }
}
