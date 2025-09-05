import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Search } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation, FreeMode } from 'swiper/modules'
import { UnifiedBookCard, type UnifiedBook } from '../components/UnifiedBookCard'
import { Input } from '../components/ui/input'
import { Card, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { useToast } from '../hooks/useToast'
import { useInfiniteScroll } from './Library/hooks/useInfiniteScroll'

// Import Swiper styles
import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/free-mode'

// Custom styles for Swiper
const swiperStyles = `
  .series-swiper {
    overflow: hidden;
    width: 100%;
    position: relative;
    margin: 0;
    padding: 0;
  }
  
  .series-swiper .swiper-wrapper {
    display: flex;
    align-items: stretch;
  }
  
  .series-swiper .swiper-slide {
    flex-shrink: 0;
    height: auto;
  }
  
  /* Force full-width breakout on mobile */
  @media (max-width: 640px) {
    /* Make the entire series card break out on mobile but keep header within margins */
    .series-card-container {
      margin-left: calc(-50vw + 50%) !important;
      margin-right: calc(-50vw + 50%) !important;
      width: 100vw !important;
      max-width: 100vw !important;
      border-radius: 0 !important;
      border: none !important;
      padding: 0 !important;
    }
    
    /* Keep the header section within page margins */
    .series-header-container {
      margin-left: 1rem !important;
      margin-right: 1rem !important;
      padding: 10px !important;
      padding-bottom: 0 !important;
      width: auto !important;
      position: static !important;
      left: auto !important;
      transform: none !important;
      box-sizing: border-box;
    }
    
    .series-carousel-container {
      position: relative;
      width: 100vw;
      margin: 0;
      padding: 0;
    }
    
    .series-swiper {
      overflow: hidden;
      width: 100vw;
      padding-left: 1rem;
      padding-right: 1rem;
    }
    
    .series-swiper .swiper-slide:first-child {
      margin-left: 0;
    }
    
    .series-swiper .swiper-wrapper {
      width: 100vw;
    }
    
    /* Ensure centered slides work properly with edge-to-edge layout */
    .series-swiper.swiper-centered .swiper-slide {
      flex-shrink: 0;
    }
    
    /* Maintain proper spacing for centered slides */
    .series-swiper.swiper-centered .swiper-wrapper {
      justify-content: flex-start;
    }
  }
  
  /* Desktop styles remain normal */
  @media (min-width: 641px) {
    .series-card-container {
      margin-left: 0;
      margin-right: 0;
      width: auto;
      padding: auto;
    }
    
    .series-header-container {
      position: static;
      left: auto;
      transform: none;
      margin: 0;
      width: auto;
      max-width: none;
      padding: 1rem 1.5rem;
    }
    
    .series-carousel-container {
      position: relative;
      width: auto;
      margin-left: 0;
      margin-right: 0;
    }
  }
  
  .swiper-button-prev-custom:hover,
  .swiper-button-next-custom:hover {
    transform: translateY(-50%) scale(1.1);
  }
  
  .swiper-button-prev-custom,
  .swiper-button-next-custom {
    z-index: 20;
  }
  
  /* Alphabet navigation swiper styles */
  .alphabet-swiper {
    overflow: visible;
    width: 100%;
    padding: 2px 0;
  }
  
  .alphabet-swiper .swiper-wrapper {
    display: flex;
    align-items: center;
  }
  
  .alphabet-swiper .swiper-slide {
    flex-shrink: 0;
    height: auto;
    width: auto;
  }
`

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style')
  styleElement.textContent = swiperStyles
  if (!document.head.querySelector('style[data-swiper-custom]')) {
    styleElement.setAttribute('data-swiper-custom', 'true')
    document.head.appendChild(styleElement)
  }
}

interface SeriesInfo {
  id: number
  name: string
  sort: string
  book_count: number
}

interface SeriesWithBooks extends SeriesInfo {
  books: UnifiedBook[]
  booksLoaded: boolean
}

interface SeriesPage {
  series: SeriesInfo[]
  total: number
  page: number
  per_page: number
  pages: number
}

export function Series() {
  const { showToast, ToastContainer } = useToast()
  
  // Pagination state
  const [seriesPages, setSeriesPages] = useState<SeriesPage[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [hasNextPage, setHasNextPage] = useState(true)

  
  // Series with books state
  const [seriesWithBooks, setSeriesWithBooks] = useState<Map<number, SeriesWithBooks>>(new Map())
  const [loadingSeriesBooks, setLoadingSeriesBooks] = useState<Set<number>>(new Set())
  
  // UI state
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [activeLetter, setActiveLetter] = useState<string | null>(null)
  
  // Debounce timer ref
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Alphabet letters for navigation
  const alphabetLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

  // Flatten all series from all pages
  const allSeries = useMemo(() => {
    return seriesPages.flatMap(page => page.series)
  }, [seriesPages])

  // Get series with their loaded books (show all series, even without books loaded)
  // All filtering is handled server-side now
  const seriesWithBooksArray = useMemo(() => {
    // No client-side filtering needed - backend handles all filtering
    return allSeries
      .map(series => seriesWithBooks.get(series.id))
      .filter((series): series is SeriesWithBooks => series !== undefined)
  }, [allSeries, seriesWithBooks])

  // Load a page of series
  const loadSeriesPage = useCallback(async (page: number, isLoadMore: boolean = false, overrideActiveLetter?: string | null) => {
    try {
      if (isLoadMore) {
        setLoadingMore(true)
      } else {
        setLoading(true)
        setError(null)
      }

      
      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: '10'
      })
      
      const currentActiveLetter = overrideActiveLetter !== undefined ? overrideActiveLetter : activeLetter
      
      if (currentActiveLetter && currentActiveLetter !== 'null') {
        // Use starts_with for letter filtering
        params.append('starts_with', currentActiveLetter)
      } else if (searchTerm) {
        // Use search for general text search
        params.append('search', searchTerm)
      }
      
      const url = `/api/metadata/series?${params}`
      
      const response = await fetch(url, {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch series: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      if (!data.series || !Array.isArray(data.series)) {
        throw new Error('Invalid series response format')
      }

      const pageData: SeriesPage = {
        series: data.series,
        total: data.total || 0,
        page: data.page || page,
        per_page: data.per_page || 10,
        pages: data.pages || 1
      }

      if (isLoadMore) {
        setSeriesPages(prev => [...prev, pageData])
      } else {
        setSeriesPages([pageData])
      }

      setHasNextPage(page < (data.pages || 1))
      setCurrentPage(page)

    } catch (error) {
      console.error('❌ Failed to load series page:', error)
      setError(error instanceof Error ? error.message : 'Failed to load series')
    } finally {
      setLoading(false)
      setLoadingMore(false)
      setIsSearching(false)
    }
  }, [searchTerm])

  // Load books for a specific series (lazy loading)
  const loadSeriesBooks = useCallback(async (seriesInfo: SeriesInfo): Promise<void> => {
    // Skip if already loaded or loading
    if (seriesWithBooks.get(seriesInfo.id)?.booksLoaded || loadingSeriesBooks.has(seriesInfo.id)) {
      return
    }

    try {
      setLoadingSeriesBooks(prev => new Set([...prev, seriesInfo.id]))
      
      const response = await fetch(`/api/metadata/series/${seriesInfo.id}/books?page=1&per_page=50`, {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch books for series ${seriesInfo.name}: ${response.status}`)
      }

      const data = await response.json()
      
      if (!data.books || !Array.isArray(data.books)) {
        throw new Error(`Invalid books response for series ${seriesInfo.name}`)
      }

      const books: UnifiedBook[] = data.books.map((book: any) => ({
        id: book.id,
        title: book.title,
        authors: Array.isArray(book.authors) 
          ? book.authors.map((author: any) => typeof author === 'string' ? author : author.name).join(', ')
          : typeof book.authors === 'string' ? book.authors : 'Unknown Author',
        cover_url: book.cover_url || `/api/metadata/books/${book.id}/cover`,
        has_cover: book.has_cover,
        series: book.series,
        series_index: book.series_index,
        rating: book.rating,
        published_date: book.published_date,
        description: book.description,
        tags: book.tags || [],
        formats: book.formats || [],
        file_size: book.file_size,
        added_date: book.added_date,
        modified_date: book.modified_date
      }))

      // Only include series with multiple books
      // Always add the series, even if it has only 1 book (backend should have filtered already)
              const seriesWithBooksData: SeriesWithBooks = {
          ...seriesInfo,
          books,
          booksLoaded: true
        }

      setSeriesWithBooks(prev => new Map([...prev, [seriesInfo.id, seriesWithBooksData]]))
      
      if (books.length === 1) {
        console.log(`⚠️ Note: Series "${seriesInfo.name}" only has 1 book, but backend said it should have ${seriesInfo.book_count}`)
      }

    } catch (error) {
      console.error(`❌ Failed to load books for series ${seriesInfo.name}:`, error)
      showToast({ type: 'error', title: `Failed to load books for ${seriesInfo.name}` })
    } finally {
      setLoadingSeriesBooks(prev => {
        const newSet = new Set(prev)
        newSet.delete(seriesInfo.id)
        return newSet
      })
    }
  }, [seriesWithBooks, loadingSeriesBooks, showToast])

  // Debounced search function
  const debouncedSearch = useCallback((searchValue: string) => {
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    // Set new timeout
    searchTimeoutRef.current = setTimeout(() => {
      if (searchValue !== searchTerm) {
        setIsSearching(true)
        setSearchTerm(searchValue)
        // Reset pagination and reload when searching
        setSeriesPages([])
        setSeriesWithBooks(new Map())
        setCurrentPage(1)
        setHasNextPage(true)
        loadSeriesPage(1, false)
      }
    }, 500) // 500ms debounce delay
  }, [searchTerm, loadSeriesPage])

  // Handle infinite scroll
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !loadingMore && !loading && !isSearching) {
      loadSeriesPage(currentPage + 1, true)
    }
  }, [hasNextPage, loadingMore, loading, isSearching, currentPage, loadSeriesPage])

  // Infinite scroll hook
  const { targetRef: loadMoreRef } = useInfiniteScroll(handleLoadMore, {
    hasNextPage,
    isFetchingNextPage: loadingMore,
    enabled: !loading && !error
  })

  // Swiper handles navigation automatically, so we can remove the complex navigation logic

  // Handle search input change with debouncing
  const handleSearchInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchInput(value)
    
    // Clear active letter when user types in search box
    if (activeLetter && value !== activeLetter) {
      setActiveLetter(null)
    }
    
    debouncedSearch(value.trim())
  }, [debouncedSearch, activeLetter])

  // Handle search button click (immediate search)
  const handleSearch = useCallback(() => {
    const trimmedInput = searchInput.trim()
    // Clear debounce timeout and search immediately
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    if (trimmedInput !== searchTerm) {
      setIsSearching(true)
      setSearchTerm(trimmedInput)
      
      // Clear active letter when doing manual search (unless the search input is exactly the letter)
      if (activeLetter && trimmedInput !== activeLetter) {
        setActiveLetter(null)
      }
      
      // Reset pagination and reload when searching
      setSeriesPages([])
      setSeriesWithBooks(new Map())
      setCurrentPage(1)
      setHasNextPage(true)
      loadSeriesPage(1, false)
    }
  }, [searchInput, searchTerm, activeLetter, loadSeriesPage])

  // Handle Enter key press in search input
  const handleSearchKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }, [handleSearch])

  // Handle clear search
  const handleClearSearch = useCallback(() => {
    // Clear debounce timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    setSearchInput('')
    setSearchTerm('')
    setIsSearching(false)
    
    // If there's an active letter, keep it and reload with letter filter
    // If no active letter, load unfiltered data
    setSeriesPages([])
    setSeriesWithBooks(new Map())
    setCurrentPage(1)
    setHasNextPage(true)
    loadSeriesPage(1, false)
  }, [loadSeriesPage])

  // Handle alphabet letter jump
  const handleLetterJump = useCallback((letter: string) => {
    // Clear debounce timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    // Letter filtering is separate from text search
    // Don't update the search input - keep it independent
    setActiveLetter(letter)
    setIsSearching(true)
    
    // Reset pagination and reload with the specific letter
    setSeriesPages([])
    setSeriesWithBooks(new Map())
    setCurrentPage(1)
    setHasNextPage(true)
    loadSeriesPage(1, false, letter)
  }, [loadSeriesPage])

  // Handle clear alphabet filter
  const handleClearAlphabet = useCallback(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    setSearchInput('')
    setActiveLetter(null)
    setSearchTerm('')
    setIsSearching(false)
    
    // Reset state completely like initial load, then load fresh data
    setSeriesPages([])
    setSeriesWithBooks(new Map())
    setCurrentPage(1)
    setHasNextPage(true)
    loadSeriesPage(1, false)
  }, [loadSeriesPage])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [])

  // Book action handlers
  const handleBookDetails = useCallback((book: UnifiedBook) => {
    console.log('📖 Book details clicked:', book.title)
    // TODO: Implement book details modal
  }, [])

  const handleSendToKindle = useCallback(async (book: UnifiedBook): Promise<{ success: boolean; message: string }> => {
    try {
      console.log('📤 Sending to Kindle:', book.title)
      
      // Get available formats - prioritize Kindle-compatible formats
      const availableFormats = book.formats || []
      
      if (availableFormats.length === 0) {
        throw new Error('No formats available for Kindle')
      }
      
      const kindleFormatPriority = ['MOBI', 'AZW3', 'EPUB', 'PDF']
      const kindleFormat = kindleFormatPriority.find(format => 
        availableFormats.some(f => f.toUpperCase() === format)
      ) || availableFormats[0]
      
      const response = await fetch(`/api/cwa/library/books/${book.id}/send-to-kindle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          format: kindleFormat
        })
      })
      
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          showToast({ type: 'success', title: result.message || 'Book sent to Kindle successfully' })
          return { success: true, message: result.message || 'Book sent to Kindle successfully' }
        } else {
          throw new Error(result.error || 'Failed to send book to Kindle')
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to send book (${response.status})`)
      }
    } catch (error) {
      console.error('Error sending book to Kindle:', error)
      const message = error instanceof Error ? error.message : 'Network error occurred'
      showToast({ type: 'error', title: message })
      return { success: false, message }
    }
  }, [showToast])

  // Load initial data
  useEffect(() => {
    loadSeriesPage(1, false)
  }, []) // Only run on mount

  // Initialize series in seriesWithBooks Map when they're loaded from API
  useEffect(() => {
    allSeries.forEach(series => {
      if (!seriesWithBooks.has(series.id)) {
        setSeriesWithBooks(prev => new Map([...prev, [series.id, {
          ...series,
          books: [],
          booksLoaded: false
        }]]))
      }
    })
  }, [allSeries])

  // Lazy load books for visible series (simple intersection observer)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const seriesId = parseInt(entry.target.getAttribute('data-series-id') || '0', 10)
            const series = allSeries.find(s => s.id === seriesId)
            if (series && !seriesWithBooks.get(seriesId)?.booksLoaded) {
              loadSeriesBooks(series)
            }
          }
        })
      },
      { rootMargin: '200px' } // Load books when series is 200px away from viewport
    )

    // Observe all series containers
    const seriesElements = document.querySelectorAll('[data-series-id]')
    seriesElements.forEach(element => observer.observe(element))

    return () => observer.disconnect()
  }, [allSeries, seriesWithBooks, loadSeriesBooks])

  // Loading state
  if (loading && seriesPages.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Book Series</h1>
            <p className="text-muted-foreground mt-1">
              Discover multi-book series in your library
            </p>
          </div>
          <Badge variant="secondary" className="text-sm">...</Badge>
        </div>
        
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2 text-muted-foreground">Loading series...</span>
        </div>
        
        <ToastContainer />
      </div>
    )
  }

  // Error state
  if (error && seriesPages.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Book Series</h1>
            <p className="text-muted-foreground mt-1">
              Discover multi-book series in your library
            </p>
          </div>
          <Badge variant="secondary" className="text-sm">Error</Badge>
        </div>
        
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-red-600">
              <p className="font-medium">Error loading series</p>
              <p className="text-sm mt-1">{error}</p>
              <Button 
                onClick={() => loadSeriesPage(1, false)} 
                className="mt-4"
                variant="outline"
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
        
        <ToastContainer />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header - matching Hot Books page style */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Book Series</h1>
          <p className="text-muted-foreground mt-1">
            Discover multi-book series in your library
          </p>
        </div>
        <Badge variant="secondary" className="text-sm font-medium px-3 py-1.5 text-center">
          {seriesWithBooksArray.length} Series Found
        </Badge>
      </div>
      
      {/* Search Bar - Compact Mobile Design */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <Input
                type="text"
                placeholder="Search series..."
                value={searchInput}
                onChange={handleSearchInputChange}
                onKeyPress={handleSearchKeyPress}
                className="pl-10 h-9 sm:h-10"
                disabled={loading}
              />
        </div>
        <div className="flex gap-2 sm:gap-3">
          <Button 
            onClick={handleSearch} 
            variant="default" 
            size="sm" 
            className="flex-1 sm:flex-none h-9 sm:h-10"
                          disabled={loading || isSearching}
          >
            {isSearching ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                Searching...
              </>
            ) : (
              'Search'
            )}
          </Button>
          {searchTerm && (
            <Button 
              onClick={handleClearSearch} 
              variant="outline" 
              size="sm" 
              className="flex-1 sm:flex-none h-9 sm:h-10"
              disabled={loading}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-8">
          {seriesWithBooksArray.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-foreground mb-2">
                {searchTerm ? 'No series found' : 'No multi-book series available'}
              </h3>
              <p className="text-muted-foreground">
                {searchTerm 
                  ? `No series match "${searchTerm}". Try a different search term.`
                  : 'No series with multiple books found in your library. Series need at least 2 books to be displayed.'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {seriesWithBooksArray.map((series) => (
                <div key={series.id} data-series-id={series.id}>
                  <SeriesCarousel
                    series={series}
                    onBookDetails={handleBookDetails}
                    onSendToKindle={handleSendToKindle}
                  />
                </div>
              ))}
              
              {/* Infinite scroll trigger */}
              {hasNextPage && !isSearching && (
                <div ref={loadMoreRef} className="flex justify-center py-8">
                  {loadingMore ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      <span>Loading more series...</span>
                    </div>
                  ) : (
                    <Button onClick={handleLoadMore} variant="outline" disabled={isSearching}>
                      Load More Series
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
      </div>
      
      {/* Mobile-only bottom padding to account for fixed alphabet footer */}
      <div className="h-20 md:hidden" />
      
      {/* Mobile Alphabet Navigation Footer */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90 border-t border-border">
        <div className="px-2 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground px-2">Jump to Letter</span>
            {activeLetter && (
              <Button
                onClick={handleClearAlphabet}
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
              >
                Clear ({activeLetter})
              </Button>
            )}
          </div>
          
          {/* Swipeable Alphabet Letters */}
          <Swiper
            modules={[FreeMode]}
            spaceBetween={4}
            slidesPerView="auto"
            freeMode={{
              enabled: true,
              sticky: false,
            }}
            className="alphabet-swiper"
          >
            {alphabetLetters.map((letter) => (
              <SwiperSlide key={letter} className="!w-auto">
                <Button
                  onClick={() => handleLetterJump(letter)}
                  variant={activeLetter === letter ? "default" : "outline"}
                  size="sm"
                  className={`h-8 w-8 p-0 text-xs font-semibold ${
                    activeLetter === letter 
                      ? 'bg-primary text-primary-foreground' 
                      : 'hover:bg-accent hover:text-accent-foreground'
                  }`}
                  disabled={isSearching}
                >
                  {letter}
                </Button>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </div>
      
      <ToastContainer />
    </div>
  )
}

// Series Carousel Component (unchanged from original)
interface SeriesCarouselProps {
  series: SeriesWithBooks
  onBookDetails: (book: UnifiedBook) => void
  onSendToKindle: (book: UnifiedBook) => Promise<{ success: boolean; message: string }>
}

function SeriesCarousel({ series, onBookDetails, onSendToKindle }: SeriesCarouselProps) {
  const { books, booksLoaded } = series
  
  // Check if we're on mobile
  const [isMobile, setIsMobile] = useState(false)
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  
  // Sort books by series index
  const sortedBooks = useMemo(() => {
    if (!books || books.length === 0) return books
    return [...books].sort((a, b) => {
      const indexA = a.series_index || 0
      const indexB = b.series_index || 0
      return indexA - indexB
    })
  }, [books])
  
  // Show loading state if books aren't loaded yet
  if (!booksLoaded || sortedBooks.length === 0) {
    return (
      <div className="series-card-container border-0 sm:border sm:border-border rounded-none sm:rounded-lg bg-card overflow-hidden">
        <div className="series-header-container p-4 sm:p-6">
          {/* Series Header */}
          <div className="mb-4">
            <h2 className="text-xl font-bold text-foreground">{series.name}</h2>
            <p className="text-sm text-muted-foreground">
              {booksLoaded ? 'No books found' : `Loading ${series.book_count} books...`}
            </p>
          </div>
          
          {/* Loading placeholder */}
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="series-card-container border-0 sm:border sm:border-border rounded-none sm:rounded-lg bg-card overflow-hidden">
      <div className="series-header-container p-4 sm:p-6">
        {/* Series Header */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-foreground">{series.name}</h2>
          <p className="text-sm text-muted-foreground">
            {sortedBooks.length} book{sortedBooks.length !== 1 ? 's' : ''} in series
          </p>
        </div>
      </div>

      {/* Swiper Carousel */}
      <div className="series-carousel-container relative px-0 sm:px-2 overflow-hidden">
        <Swiper
          modules={[Navigation, FreeMode]}
          spaceBetween={12}
          slidesPerView="auto"
          loop={sortedBooks.length > 2}
          freeMode={{
            enabled: !isMobile, // Disable on mobile to prevent horizontal scroll
            sticky: false,
            momentumRatio: 0.25,
            momentumVelocityRatio: 0.25,
          }}
          centeredSlides={isMobile}
          centeredSlidesBounds={false}
          initialSlide={0}
          roundLengths={true}
          navigation={{
            nextEl: '.swiper-button-next-custom',
            prevEl: '.swiper-button-prev-custom',
          }}
          slidesPerGroup={1}
          watchOverflow={true}
          className="series-swiper"
        >
          {sortedBooks.map((book) => (
            <SwiperSlide key={book.id} className="!w-[180px] sm:!w-[200px] md:!w-[225px]">
              <UnifiedBookCard
                book={book}
                cardType="library"
                viewMode="grid"
                onDetails={onBookDetails}
                onSendToKindle={onSendToKindle}
                showKindleButton={true}
              />
            </SwiperSlide>
          ))}
        </Swiper>
        
        {/* Custom Navigation Buttons */}
        {sortedBooks.length > 1 && (
          <>
            <div className="swiper-button-prev-custom absolute left-2 sm:-left-6 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full shadow-lg bg-background/80 backdrop-blur-sm hover:bg-background/90 border border-border flex items-center justify-center cursor-pointer transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </div>
            <div className="swiper-button-next-custom absolute right-2 sm:-right-6 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full shadow-lg bg-background/80 backdrop-blur-sm hover:bg-background/90 border border-border flex items-center justify-center cursor-pointer transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default Series
