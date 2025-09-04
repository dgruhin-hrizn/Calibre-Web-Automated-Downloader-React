import { useEffect, useRef, useState, useCallback } from 'react'
import { SCROLL_OFFSETS, PAGINATION_DETECTION, MOBILE_BREAKPOINT, SELECTORS } from '../constants/pagination'

interface UseInfiniteScrollOptions {
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  threshold?: number
  rootMargin?: string
  enabled?: boolean
}

interface UseInfiniteScrollReturn {
  targetRef: React.RefObject<HTMLDivElement | null>
  isIntersecting: boolean
}

/**
 * Hook for implementing infinite scroll with Intersection Observer
 */
export function useInfiniteScroll(
  fetchNextPage: () => void,
  options: UseInfiniteScrollOptions = {}
): UseInfiniteScrollReturn {
  const {
    hasNextPage = false,
    isFetchingNextPage = false,
    threshold = 0.1,
    rootMargin = '100px',
    enabled = true
  } = options

  const targetRef = useRef<HTMLDivElement>(null)
  const [isIntersecting, setIsIntersecting] = useState(false)

  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    const entry = entries[0]
    setIsIntersecting(entry.isIntersecting)

    if (entry.isIntersecting && hasNextPage && !isFetchingNextPage && enabled) {
      fetchNextPage()
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, enabled])

  useEffect(() => {
    const target = targetRef.current
    if (!target || !enabled) return

    const observer = new IntersectionObserver(handleIntersection, {
      threshold,
      rootMargin
    })

    observer.observe(target)

    return () => {
      observer.unobserve(target)
      observer.disconnect()
    }
  }, [handleIntersection, threshold, rootMargin, enabled])

  return {
    targetRef,
    isIntersecting
  }
}

/**
 * Hook for managing scroll position memory
 */
export function useScrollMemory(key: string) {
  const scrollPositionKey = `scroll-position-${key}`
  const bookInViewKey = `book-in-view-${key}`

  const saveScrollPosition = useCallback((position: number, bookId?: number) => {
    sessionStorage.setItem(scrollPositionKey, position.toString())
    if (bookId) {
      sessionStorage.setItem(bookInViewKey, bookId.toString())
    }
  }, [scrollPositionKey, bookInViewKey])

  const getScrollPosition = useCallback((): { position: number; bookId?: number } => {
    const position = parseInt(sessionStorage.getItem(scrollPositionKey) || '0', 10)
    const bookIdStr = sessionStorage.getItem(bookInViewKey)
    const bookId = bookIdStr ? parseInt(bookIdStr, 10) : undefined

    return { position, bookId }
  }, [scrollPositionKey, bookInViewKey])

  const clearScrollMemory = useCallback(() => {
    sessionStorage.removeItem(scrollPositionKey)
    sessionStorage.removeItem(bookInViewKey)
  }, [scrollPositionKey, bookInViewKey])

  const restoreScrollPosition = useCallback(() => {
    const { position } = getScrollPosition()
    if (position > 0) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        const mainElement = document.querySelector('main')
        if (mainElement) {
          mainElement.scrollTo({ top: position, behavior: 'auto' })
        } else {
          window.scrollTo({ top: position, behavior: 'auto' })
        }
      })
    }
  }, [getScrollPosition])

  return {
    saveScrollPosition,
    getScrollPosition,
    clearScrollMemory,
    restoreScrollPosition
  }
}

/**
 * Simple hook for tracking which page is currently in view using page markers
 */
export function usePageInView(enabled: boolean = true) {
  const [currentPage, setCurrentPage] = useState<number>(1)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const pageRefs = useRef<Map<number, HTMLElement>>(new Map())

  const registerPageRef = useCallback((pageNumber: number, element: HTMLElement | null) => {
    if (element) {
      pageRefs.current.set(pageNumber, element)
      // Start observing immediately if observer exists
      if (observerRef.current) {
        observerRef.current.observe(element)
      }
    } else {
      const oldElement = pageRefs.current.get(pageNumber)
      if (oldElement && observerRef.current) {
        observerRef.current.unobserve(oldElement)
      }
      pageRefs.current.delete(pageNumber)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    // Create new observer optimized for responsive page boundary detection
    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Get all visible page markers with their positions
        const visiblePages: Array<{page: number, top: number, bottom: number, isIntersecting: boolean}> = []
        
        entries.forEach((entry) => {
          const pageNumber = parseInt(entry.target.getAttribute('data-page-number') || '0', 10)
          if (pageNumber) {
            const rect = entry.boundingClientRect
            visiblePages.push({
              page: pageNumber,
              top: rect.top,
              bottom: rect.bottom,
              isIntersecting: entry.isIntersecting
            })
          }
        })

        if (visiblePages.length === 0) return

        // Sort by page number
        visiblePages.sort((a, b) => a.page - b.page)

        let targetPage = 1

        // Simple logic: use the page that's most visible
        if (visiblePages.length > 0) {
          // Sort by page number and find the best candidate
          visiblePages.sort((a, b) => a.page - b.page)
          
          // Find the page marker closest to the top of the viewport
          let bestPage = visiblePages[0]
          let bestDistance = Math.abs(visiblePages[0].top)
          
          for (const pageInfo of visiblePages) {
            const distance = Math.abs(pageInfo.top)
            if (distance < bestDistance || (distance === bestDistance && pageInfo.page > bestPage.page)) {
              bestPage = pageInfo
              bestDistance = distance
            }
          }
          
          targetPage = bestPage.page
        }
        
        // Update immediately for responsive feel
        setCurrentPage(prev => prev !== targetPage ? targetPage : prev)
      },
      {
        threshold: [0, 0.5, 1.0], // Simple thresholds
        rootMargin: '100px 0px 100px 0px' // Moderate margin for detection
      }
    )

    // Observe all current page elements
    pageRefs.current.forEach((element) => {
      observerRef.current?.observe(element)
    })

    return () => {
      observerRef.current?.disconnect()
    }
  }, [enabled])


  return {
    currentPage,
    registerPageRef
  }
}

/**
 * Hook for tracking which book is currently in view
 */
export function useBookInView(
  books: any[], 
  enabled: boolean = true,
  options: {
    visibilityThreshold?: number
    rootMargin?: string
  } = {}
) {
  // Calculate dynamic root margin based on toolbar position
  const calculateRootMargin = () => {
    const header = document.querySelector(SELECTORS.HEADER)
    const toolbar = document.querySelector(SELECTORS.LIBRARY_TOOLBAR)
    
    const headerHeight = header?.getBoundingClientRect().height || 64
    const toolbarHeight = toolbar?.getBoundingClientRect().height || 140
    const totalFixedHeight = headerHeight + toolbarHeight
    
    // Set root margin so detection triggers when books hit the bottom of the toolbar
    return `0px 0px -${totalFixedHeight}px 0px`
  }
  
  const { 
    visibilityThreshold = PAGINATION_DETECTION.VISIBILITY_THRESHOLD, 
    rootMargin = options.rootMargin || calculateRootMargin()
  } = options
  
  const [bookInView, setBookInView] = useState<number | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const bookRefs = useRef<Map<number, HTMLElement>>(new Map())

  const registerBookRef = useCallback((bookId: number, element: HTMLElement | null) => {
    if (element) {
      bookRefs.current.set(bookId, element)
    } else {
      bookRefs.current.delete(bookId)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    // Create new observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Find the entry with the highest intersection ratio that's most visible
        let maxRatio = 0
        let topBookId: number | null = null
        // let topBookElement: Element | null = null

        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const ratio = entry.intersectionRatio
            const bookId = parseInt(entry.target.getAttribute('data-book-id') || '0', 10)
            
            if (bookId && ratio > maxRatio) {
              maxRatio = ratio
              topBookId = bookId
              // topBookElement = entry.target
            }
          }
        })

        // Only update if we have a reasonable intersection
        if (topBookId && maxRatio > visibilityThreshold) {
          // Only update if it's a different book to prevent rapid switching
          setBookInView(prev => {
            if (prev !== topBookId) {
              return topBookId
            }
            return prev
          })
        }
      },
      {
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1.0], // Multiple thresholds for better detection
        rootMargin // Configurable margin for detection
      }
    )

    // Observe all current book elements
    bookRefs.current.forEach((element) => {
      observerRef.current?.observe(element)
    })

    return () => {
      observerRef.current?.disconnect()
    }
  }, [books.length, enabled])

  // Re-observe when books change
  useEffect(() => {
    if (!observerRef.current) return

    // Observe new book elements
    bookRefs.current.forEach((element, bookId) => {
      // Check if this book is in the current books list
      const bookExists = books.some(book => book.id === bookId)
      if (bookExists) {
        observerRef.current?.observe(element)
      } else {
        // Clean up refs for books that no longer exist
        observerRef.current?.unobserve(element)
        bookRefs.current.delete(bookId)
      }
    })
  }, [books])

  return {
    bookInView,
    registerBookRef
  }
}

/**
 * Calculate scroll offset based on device type and toolbar height
 */
function calculateScrollOffset() {
  // Calculate dynamic offset based on actual DOM elements
  const header = document.querySelector(SELECTORS.HEADER)
  const toolbar = document.querySelector(SELECTORS.LIBRARY_TOOLBAR)
  
  const headerHeight = header?.getBoundingClientRect().height || 64 // fallback to 64px
  const toolbarHeight = toolbar?.getBoundingClientRect().height || 140 // fallback to 140px
  const totalFixedHeight = headerHeight + toolbarHeight
  
  // Check if we're on mobile
  const isMobile = window.innerWidth < MOBILE_BREAKPOINT
  
  // Different offsets for desktop vs mobile using constants
  const paddingOffset = isMobile ? SCROLL_OFFSETS.MOBILE : SCROLL_OFFSETS.DESKTOP
  
  const toolbarOffset = totalFixedHeight + paddingOffset
  
  return {
    headerHeight,
    toolbarHeight,
    totalFixedHeight,
    isMobile,
    paddingOffset,
    toolbarOffset
  }
}

/**
 * Hook for smooth scroll to specific book
 */
export function useScrollToBook() {
  const scrollToBook = useCallback((bookId: number, behavior: 'smooth' | 'auto' = 'smooth') => {
    
    // Find all elements with this book ID and pick the one with dimensions
    const allElements = document.querySelectorAll(`[data-book-id="${bookId}"]`)
    let element: Element | null = null
    
    
    for (const el of allElements) {
      const rect = el.getBoundingClientRect()
      const computedStyle = window.getComputedStyle(el)
      
      // Skip elements that are hidden or have no dimensions
      if (rect.width > 0 && rect.height > 0 && computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden') {
        element = el
        break
      }
    }
    
    if (!element) {
      return
    }
    
    const scrollContainer = document.querySelector('main')
    
    if (!scrollContainer) {
      // Fallback to regular scrollIntoView if main container not found
      element?.scrollIntoView({ 
        behavior, 
        block: 'start',
        inline: 'nearest'
      })
      return
    }
    
    if (element) {
      // Calculate scroll position using the element with proper dimensions
      const containerRect = scrollContainer.getBoundingClientRect()
      const elementRect = element.getBoundingClientRect()
      const elementTop = elementRect.top - containerRect.top + scrollContainer.scrollTop
      
      // Calculate scroll offset using centralized function
      const { toolbarOffset } = calculateScrollOffset()
      
      const targetScrollTop = elementTop - toolbarOffset
      
      scrollContainer.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: behavior
      })
      
      // Force immediate intersection check after scroll completes
      if (behavior === 'smooth') {
        // For smooth scrolling, wait a bit for it to complete
        setTimeout(() => {
          // Trigger a scroll event to force intersection observer to re-evaluate
          scrollContainer.dispatchEvent(new Event('scroll'))
        }, 500)
      } else {
        // For auto scrolling, trigger immediately
        setTimeout(() => {
          scrollContainer.dispatchEvent(new Event('scroll'))
        }, 50)
      }
    } else {
      // If element not found, try again after a short delay
      setTimeout(() => {
        const retryElement = document.querySelector(`[data-book-id="${bookId}"]`)
        if (retryElement && scrollContainer) {
          const containerRect = scrollContainer.getBoundingClientRect()
          const elementRect = retryElement.getBoundingClientRect()
          const elementTop = elementRect.top - containerRect.top + scrollContainer.scrollTop
          // Calculate scroll offset using centralized function
          const { toolbarOffset } = calculateScrollOffset()
          const targetScrollTop = elementTop - toolbarOffset
          
          scrollContainer.scrollTo({
            top: Math.max(0, targetScrollTop),
            behavior: 'auto'
          })
        }
      }, 300)
    }
  }, [])

  const scrollToTop = useCallback(() => {
    // The main scrollable container is the <main> element
    const mainElement = document.querySelector('main')
    if (mainElement) {
      mainElement.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      // Fallback to window scroll
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [])

  return {
    scrollToBook,
    scrollToTop
  }
}

