import { useState, useEffect, useCallback, useMemo } from 'react'
import { ChevronLeft, ChevronRight, BookOpen, Search } from 'lucide-react'
import { UnifiedBookCard, type UnifiedBook } from '../components/UnifiedBookCard'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/input'
import { Card, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { useToast } from '../hooks/useToast'
import { useInfiniteScroll } from './Library/hooks/useInfiniteScroll'

interface SeriesInfo {
  id: number
  name: string
  sort: string
  book_count: number
}

interface SeriesWithBooks extends SeriesInfo {
  books: UnifiedBook[]
  currentIndex: number
  booksLoaded: boolean
}

interface SeriesPage {
  series: SeriesInfo[]
  total: number
  page: number
  per_page: number
  pages: number
}

export function SeriesOptimized() {
  const { showToast, ToastContainer } = useToast()
  
  // Pagination state
  const [seriesPages, setSeriesPages] = useState<SeriesPage[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [hasNextPage, setHasNextPage] = useState(true)
  const [totalSeries, setTotalSeries] = useState(0)
  
  // Series with books state
  const [seriesWithBooks, setSeriesWithBooks] = useState<Map<number, SeriesWithBooks>>(new Map())
  const [loadingSeriesBooks, setLoadingSeriesBooks] = useState<Set<number>>(new Set())
  
  // UI state
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

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

      setTotalSeries(data.total || 0)
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
        currentIndex: Math.floor(Math.max(0, books.length - 1) / 2), // Start with middle book centered
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

  // Handle carousel navigation
  const navigateCarousel = useCallback((seriesId: number, direction: 'left' | 'right') => {
    setSeriesWithBooks(prev => {
      const newMap = new Map(prev)
      const series = newMap.get(seriesId)
      if (series) {
        const newIndex = direction === 'left' 
          ? Math.max(0, series.currentIndex - 1)
          : Math.min(series.books.length - 1, series.currentIndex + 1)
        newMap.set(seriesId, { ...series, currentIndex: newIndex })
      }
      return newMap
    })
  }, [])

  // Handle search
  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term)
    // Reset pagination and reload when searching
    if (term !== searchTerm) {
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
      
      const response = await fetch('/api/send-to-kindle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ book_id: book.id })
      })

      const result = await response.json()
      
      if (response.ok && result.success) {
        showToast({ type: 'success', title: 'Book sent to Kindle!' })
        return { success: true, message: result.message || 'Book sent successfully' }
      } else {
        throw new Error(result.message || 'Failed to send to Kindle')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send to Kindle'
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
          currentIndex: 0,
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
      <>
        <div className="bg-background border-b border-border -mx-6 px-4 py-6">
          <div className="max-w-7xl mx-auto px-6">
            <h1 className="text-3xl font-bold text-foreground">Book Series</h1>
            <p className="text-muted-foreground mt-1">
              Discover multi-book series in your library
            </p>
          </div>
        </div>
        
        <div className="space-y-6">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <BookOpen className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-lg font-medium">Loading series...</p>
            </div>
          </div>
        </div>
        
        <ToastContainer />
      </>
    )
  }

  // Error state
  if (error && seriesPages.length === 0) {
    return (
      <>
        <div className="bg-background border-b border-border -mx-6 px-4 py-6">
          <div className="max-w-7xl mx-auto px-6">
            <h1 className="text-3xl font-bold text-foreground">Book Series</h1>
            <p className="text-muted-foreground mt-1">
              Discover multi-book series in your library
            </p>
          </div>
        </div>
        
        <div className="space-y-6">
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
        </div>
        
        <ToastContainer />
      </>
    )
  }

  return (
    <>
      {/* Header Section */}
      <div className="bg-background border-b border-border -mx-6 px-4 py-6">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Book Series</h1>
              <p className="text-muted-foreground mt-1">
                Discover multi-book series in your library
              </p>
            </div>
            <Badge variant="secondary" className="text-sm">
              {seriesWithBooksArray.length} series loaded
            </Badge>
          </div>
          
          {/* Search */}
          <div className="mt-6 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                type="text"
                placeholder="Search series..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6">
        <div className="max-w-7xl mx-auto">
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
                    onNavigate={(direction) => navigateCarousel(series.id, direction)}
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
      </div>
      
      <ToastContainer />
    </>
  )
}

// Series Carousel Component (unchanged from original)
interface SeriesCarouselProps {
  series: SeriesWithBooks
  onNavigate: (direction: 'left' | 'right') => void
  onBookDetails: (book: UnifiedBook) => void
  onSendToKindle: (book: UnifiedBook) => Promise<{ success: boolean; message: string }>
}

function SeriesCarousel({ series, onNavigate, onBookDetails, onSendToKindle }: SeriesCarouselProps) {
  const { currentIndex, books, booksLoaded } = series
  
  // Show loading state if books aren't loaded yet
  if (!booksLoaded || books.length === 0) {
    return (
      <div className="space-y-4">
        {/* Series Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{series.name}</h2>
            <p className="text-gray-600 dark:text-gray-400">
              {booksLoaded ? 'No books found' : `Loading ${series.book_count} books...`}
            </p>
          </div>
        </div>
        
        {/* Loading placeholder */}
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }
  
  const centerBook = books[currentIndex]
  
  // Calculate visible books (center + 2 on each side)
  const getVisibleBooks = () => {
    const visibleBooks = []
    const totalBooks = books.length
    
    for (let i = -2; i <= 2; i++) {
      const index = currentIndex + i
      if (index >= 0 && index < totalBooks) {
        visibleBooks.push({
          book: books[index],
          position: i,
          index
        })
      }
    }
    
    return visibleBooks
  }

  const visibleBooks = getVisibleBooks()

  return (
    <div className="space-y-4">
      {/* Series Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{series.name}</h2>
          <p className="text-gray-600 dark:text-gray-400">{books.length} books in series</p>
        </div>
        
        {/* Navigation Controls */}
        {books.length > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate('left')}
              disabled={currentIndex === 0}
              className="p-2"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <span className="text-sm text-gray-600 dark:text-gray-400 px-2">
              {currentIndex + 1} of {books.length}
            </span>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate('right')}
              disabled={currentIndex === books.length - 1}
              className="p-2"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Carousel Container */}
      <div className="flex items-center justify-center space-x-4 py-4">
        {visibleBooks.map(({ book, position }) => (
          <div
            key={book.id}
            className={`transition-all duration-300 ${
              position === 0 
                ? 'scale-100 opacity-100 z-10' 
                : 'scale-75 opacity-60 hover:opacity-80'
            }`}
            style={{
              transform: `translateX(${position * 20}px)`,
            }}
          >
            <UnifiedBookCard
              book={book}
              onBookClick={() => onBookDetails(book)}
              onSendToKindle={() => onSendToKindle(book)}
              className={position === 0 ? 'ring-2 ring-blue-500' : ''}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default SeriesOptimized
