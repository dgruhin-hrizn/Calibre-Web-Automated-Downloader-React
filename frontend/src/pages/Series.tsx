import { useState, useEffect, useCallback, useMemo } from 'react'
import { BookOpen, Search } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation, FreeMode } from 'swiper/modules'
import { UnifiedBookCard, type UnifiedBook } from '../components/UnifiedBookCard'
import { Input } from '../components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
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
  }
  
  .series-swiper .swiper-wrapper {
    width: fit-content;
    max-width: 100%;
  }
  
  .series-swiper .swiper-slide {
    flex-shrink: 0;
  }
  
  .series-swiper::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 40px;
    background: linear-gradient(to right, hsl(var(--card)), transparent);
    z-index: 10;
    pointer-events: none;
  }
  
  .series-swiper::after {
    content: '';
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 40px;
    background: linear-gradient(to left, hsl(var(--card)), transparent);
    z-index: 10;
    pointer-events: none;
  }
  
  .swiper-button-prev-custom:hover,
  .swiper-button-next-custom:hover {
    transform: translateY(-50%) scale(1.1);
  }
  
  .swiper-button-prev-custom,
  .swiper-button-next-custom {
    z-index: 20;
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

  // Flatten all series from all pages
  const allSeries = useMemo(() => {
    return seriesPages.flatMap(page => page.series)
  }, [seriesPages])

  // Filter series based on search
  const filteredSeries = useMemo(() => {
    if (!searchTerm.trim()) return allSeries
    return allSeries.filter(series =>
      series.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [allSeries, searchTerm])

  // Get series with their loaded books (show all series, even without books loaded)
  const seriesWithBooksArray = useMemo(() => {
    return filteredSeries
      .map(series => seriesWithBooks.get(series.id))
      .filter((series): series is SeriesWithBooks => series !== undefined)
  }, [filteredSeries, seriesWithBooks])

  // Load a page of series
  const loadSeriesPage = useCallback(async (page: number, isLoadMore: boolean = false) => {
    try {
      if (isLoadMore) {
        setLoadingMore(true)
      } else {
        setLoading(true)
        setError(null)
      }

      console.log(`📚 Fetching series page ${page}...`)
      
      const response = await fetch(`/api/metadata/series?page=${page}&per_page=10${searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : ''}`, {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch series: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log(`📄 Series page ${page} response received:`, data)
      
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

      console.log(`✅ Successfully loaded series page ${page}: ${data.series.length} series`)

    } catch (error) {
      console.error('❌ Failed to load series page:', error)
      setError(error instanceof Error ? error.message : 'Failed to load series')
    } finally {
      setLoading(false)
      setLoadingMore(false)
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
      
      console.log(`📖 Lazy loading books for series: ${seriesInfo.name}`)
      
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
      console.log(`✅ Loaded ${books.length} books for series: ${seriesInfo.name}`)
      
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

  // Handle infinite scroll
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !loadingMore && !loading) {
      loadSeriesPage(currentPage + 1, true)
    }
  }, [hasNextPage, loadingMore, loading, currentPage, loadSeriesPage])

  // Infinite scroll hook
  const { targetRef: loadMoreRef } = useInfiniteScroll(handleLoadMore, {
    hasNextPage,
    isFetchingNextPage: loadingMore,
    enabled: !loading && !error
  })

  // Swiper handles navigation automatically, so we can remove the complex navigation logic

  // Handle search button click
  const handleSearch = useCallback(() => {
    const trimmedInput = searchInput.trim()
    if (trimmedInput !== searchTerm) {
      setSearchTerm(trimmedInput)
      // Reset pagination and reload when searching
      setSeriesPages([])
      setSeriesWithBooks(new Map())
      setCurrentPage(1)
      setHasNextPage(true)
      loadSeriesPage(1, false)
    }
  }, [searchInput, searchTerm, loadSeriesPage])

  // Handle Enter key press in search input
  const handleSearchKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }, [handleSearch])

  // Handle clear search
  const handleClearSearch = useCallback(() => {
    setSearchInput('')
    if (searchTerm !== '') {
      setSearchTerm('')
      // Reset pagination and reload
      setSeriesPages([])
      setSeriesWithBooks(new Map())
      setCurrentPage(1)
      setHasNextPage(true)
      loadSeriesPage(1, false)
    }
  }, [searchTerm, loadSeriesPage])

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
        
        <Card>
          <CardContent className="p-12">
            <div className="flex items-center justify-center">
              <div className="text-center">
                <BookOpen className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
                <p className="text-lg font-medium">Loading series...</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
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
        <Badge variant="secondary" className="text-sm">
          {seriesWithBooksArray.length} Series Found
        </Badge>
      </div>
      
      {/* Search Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-500" />
            Search Series
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                type="text"
                placeholder="Search series..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyPress={handleSearchKeyPress}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} variant="default">
              Search
            </Button>
            {searchTerm && (
              <Button onClick={handleClearSearch} variant="outline">
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      <div className="space-y-8">
          {seriesWithBooksArray.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {searchTerm ? 'No series found' : 'No multi-book series available'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
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
              {hasNextPage && (
                <div ref={loadMoreRef} className="flex justify-center py-8">
                  {loadingMore ? (
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5 animate-spin" />
                      <span>Loading more series...</span>
                    </div>
                  ) : (
                    <Button onClick={handleLoadMore} variant="outline">
                      Load More Series
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
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
      <div className="border border-border rounded-lg bg-card p-6">
        {/* Series Header */}
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{series.name}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {booksLoaded ? 'No books found' : `Loading ${series.book_count} books...`}
          </p>
        </div>
        
        {/* Loading placeholder */}
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-border rounded-lg bg-card p-6">
      {/* Series Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{series.name}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {sortedBooks.length} book{sortedBooks.length !== 1 ? 's' : ''} in series
        </p>
      </div>

      {/* Swiper Carousel */}
      <div className="relative px-10">
        <Swiper
          modules={[Navigation, FreeMode]}
          spaceBetween={16}
          slidesPerView="auto"
          freeMode={{
            enabled: true,
            sticky: false,
          }}
          navigation={{
            nextEl: '.swiper-button-next-custom',
            prevEl: '.swiper-button-prev-custom',
          }}
          watchOverflow={true}
          className="series-swiper"
        >
          {sortedBooks.map((book) => (
            <SwiperSlide key={book.id} className="!w-[225px]">
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
            <div className="swiper-button-prev-custom absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full shadow-lg bg-background/80 backdrop-blur-sm hover:bg-background/90 border border-border flex items-center justify-center cursor-pointer transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </div>
            <div className="swiper-button-next-custom absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full shadow-lg bg-background/80 backdrop-blur-sm hover:bg-background/90 border border-border flex items-center justify-center cursor-pointer transition-colors">
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
