import { useEffect, useRef, useState, useCallback } from 'react'

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
 * Hook for tracking which book is currently in view
 */
export function useBookInView(books: any[], enabled: boolean = true) {
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

        // Only update if we have a reasonable intersection (at least 60% visible for stability)
        if (topBookId && maxRatio > 0.6) {
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
        threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
        rootMargin: '0px 0px -10% 0px' // Less aggressive margin for more stable detection
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
 * Hook for smooth scroll to specific book
 */
export function useScrollToBook() {
  const scrollToBook = useCallback((bookId: number, behavior: 'smooth' | 'auto' = 'smooth', targetPage?: number) => {
    
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
      
      // Dynamic offset based on target page and device:
      // Check if we're on mobile (screen width < 768px, matching Tailwind's md breakpoint)
      const isMobile = window.innerWidth < 768
      
      let toolbarOffset: number
      if (targetPage === 1 || targetPage === undefined) {
        // Page 1: More offset to ensure books aren't hidden under toolbar
        toolbarOffset = isMobile ? 550 : 400
      } else {
        // Page 2+: Less offset to scroll far enough to trigger page detection
        toolbarOffset = isMobile ? -750 : -275
      }
      console.log('scrollToBook:', { bookId, targetPage, toolbarOffset, elementTop, targetScrollTop: elementTop - toolbarOffset })
      const targetScrollTop = elementTop - toolbarOffset
      
      scrollContainer.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: behavior
      })
    } else {
      // If element not found, try again after a short delay
      setTimeout(() => {
        const retryElement = document.querySelector(`[data-book-id="${bookId}"]`)
        if (retryElement && scrollContainer) {
          const containerRect = scrollContainer.getBoundingClientRect()
          const elementRect = retryElement.getBoundingClientRect()
          const elementTop = elementRect.top - containerRect.top + scrollContainer.scrollTop
          // Dynamic offset based on target page and device
          const isMobile = window.innerWidth < 768
          let toolbarOffset: number
          if (targetPage === 1 || targetPage === undefined) {
            toolbarOffset = isMobile ? 200 : 400
          } else {
            toolbarOffset = isMobile ? -100 : -275
          }
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
