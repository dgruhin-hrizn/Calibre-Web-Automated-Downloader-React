import { useState, useEffect, useCallback, useMemo } from 'react'
import { Search } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { UnifiedBookCard, type UnifiedBook } from '../../components/UnifiedBookCard'
import { Input } from '../../components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'
import { useToast } from '../../hooks/useToast'
import { useInfiniteScroll } from '../Library/hooks/useInfiniteScroll'

// Import our new optimization hooks
import { useSeriesImageLoading } from './hooks/useSeriesImageLoading'
import { useSeriesIntersection } from './hooks/useSeriesIntersection'
import { SeriesCarousel } from './components/SeriesCarousel'
import { ImageLoadingStats } from './components/ImageLoadingStats'

// Types (same as original)
interface SeriesInfo {
  id: number
  name: string
  book_count: number
  first_book_title?: string
  first_book_cover?: string
}

interface SeriesWithBooks extends SeriesInfo {
  books: UnifiedBook[]
  booksLoaded: boolean
}

export function SeriesPageOptimized() {
  const { showToast, ToastContainer } = useToast()
  
  // State management (same as original)
  const [seriesPages, setSeriesPages] = useState<SeriesInfo[][]>([])
  const [seriesWithBooks, setSeriesWithBooks] = useState<Map<number, SeriesWithBooks>>(new Map())
  const [searchTerm, setSearchTerm] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [hasNextPage, setHasNextPage] = useState(true)
  const [totalSeries, setTotalSeries] = useState(0)
  const [loadingSeriesBooks, setLoadingSeriesBooks] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  // NEW: Performance optimization hooks
  const { shouldLoadImage, markImageLoaded, prioritizeSeriesImages, loadingStats } = useSeriesImageLoading(seriesWithBooks)
  const { visibleSeries, registerSeriesRef } = useSeriesIntersection()
  
  // Show performance stats in development
  const showStats = process.env.NODE_ENV === 'development'

  // Infinite scroll setup
  const { loadMoreRef } = useInfiniteScroll({
    onLoadMore: useCallback(() => {
      if (hasNextPage && !loadingMore && !loading) {
        loadSeriesPage(currentPage + 1, true)
      }
    }, [hasNextPage, loadingMore, loading, currentPage]),
    enabled: !loading && !error
  })

  // Load series page (same logic as original)
  const loadSeriesPage = useCallback(async (page: number, isLoadMore: boolean = false) => {
    try {
      if (isLoadMore) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }

      const searchParam = searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : ''
      const response = await fetch(`/api/metadata/series?page=${page}&per_page=20${searchParam}`, {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch series: ${response.status}`)
      }

      const data = await response.json()
      
      if (!data.series || !Array.isArray(data.series)) {
        throw new Error('Invalid series response format')
      }

      const newSeries: SeriesInfo[] = data.series.filter((series: any) => 
        series && series.book_count && series.book_count >= 2
      )

      if (isLoadMore) {
        setSeriesPages(prev => [...prev, newSeries])
      } else {
        setSeriesPages([newSeries])
        setCurrentPage(1)
      }

      setCurrentPage(page)
      setHasNextPage(data.has_next || false)
      setTotalSeries(data.total || 0)
      setError(null)

    } catch (err) {
      console.error('Error loading series:', err)
      setError(err instanceof Error ? err.message : 'Failed to load series')
      showToast({ 
        type: 'error', 
        title: 'Failed to load series', 
        description: err instanceof Error ? err.message : 'Unknown error' 
      })

    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [searchTerm, showToast])

  // OPTIMIZED: Load books for visible series only
  const loadSeriesBooks = useCallback(async (seriesInfo: SeriesInfo): Promise<void> => {
    // Skip if already loaded or loading
    if (seriesWithBooks.get(seriesInfo.id)?.booksLoaded || loadingSeriesBooks.has(seriesInfo.id)) {
      return
    }

    // Only load if series is visible
    if (!visibleSeries.has(seriesInfo.id)) {
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

      const seriesWithBooksData: SeriesWithBooks = {
        ...seriesInfo,
        books,
        booksLoaded: true
      }

      setSeriesWithBooks(prev => new Map(prev.set(seriesInfo.id, seriesWithBooksData)))
      
      // NEW: Prioritize loading images for this series
      prioritizeSeriesImages(seriesInfo.id)

    } catch (err) {
      console.error(`Error loading books for series ${seriesInfo.name}:`, err)
      showToast({ 
        type: 'error', 
        title: 'Failed to load series books', 
        description: `Could not load books for ${seriesInfo.name}` 
      })
    } finally {
      setLoadingSeriesBooks(prev => {
        const newSet = new Set(prev)
        newSet.delete(seriesInfo.id)
        return newSet
      })
    }
  }, [seriesWithBooks, loadingSeriesBooks, visibleSeries, showToast, prioritizeSeriesImages])

  // Load books when series becomes visible
  useEffect(() => {
    const allSeries = seriesPages.flat()
    visibleSeries.forEach(seriesId => {
      const series = allSeries.find(s => s.id === seriesId)
      if (series) {
        loadSeriesBooks(series)
      }
    })
  }, [visibleSeries, seriesPages, loadSeriesBooks])

  // Initial load and search handling (same as original)
  useEffect(() => {
    loadSeriesPage(1)
  }, [loadSeriesPage])

  // Rest of the component logic remains the same...
  const allSeries = useMemo(() => seriesPages.flat(), [seriesPages])
  const seriesWithBooksArray = useMemo(() => 
    allSeries
      .map(series => seriesWithBooks.get(series.id))
      .filter((series): series is SeriesWithBooks => series !== undefined)
      .filter(series => !searchTerm || series.name.toLowerCase().includes(searchTerm.toLowerCase())),
    [allSeries, seriesWithBooks, searchTerm]
  )

  // Event handlers (same as original)
  const handleSearch = () => {
    setSearchTerm(searchInput)
  }

  const handleClearSearch = () => {
    setSearchInput('')
    setSearchTerm('')
  }

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handleLoadMore = () => {
    if (hasNextPage && !loadingMore && !loading) {
      loadSeriesPage(currentPage + 1, true)
    }
  }

  const handleBookClick = (book: UnifiedBook) => {
    console.log('Book clicked:', book.title)
  }

  const handleDownload = (book: UnifiedBook) => {
    console.log('Download book:', book.title)
  }

  const handleSendToKindle = (book: UnifiedBook) => {
    console.log('Send to Kindle:', book.title)
  }

  // Loading state (same as original but with new spinner)
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

  // Error state (same as original)
  if (error) {
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
            <div className="text-center">
              <p className="font-medium">Error loading series</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
              <Button onClick={() => loadSeriesPage(1)} className="mt-4">
                Retry
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Book Series</h1>
          <p className="text-muted-foreground mt-1">
            Discover multi-book series in your library
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {totalSeries} series
        </Badge>
      </div>
      
      {/* Search Card */}
      <Card>
        <CardHeader>
          <CardTitle>Search Series</CardTitle>
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
              <div 
                key={series.id} 
                data-series-id={series.id}
                ref={(el) => registerSeriesRef(series.id, el)}
              >
                <SeriesCarousel
                  series={series}
                  onBookClick={handleBookClick}
                  onDownload={handleDownload}
                  onSendToKindle={handleSendToKindle}
                  shouldLoadImage={shouldLoadImage}
                  markImageLoaded={markImageLoaded}
                  isVisible={visibleSeries.has(series.id)}
                />
              </div>
            ))}
            
            {/* Infinite scroll trigger */}
            {hasNextPage && (
              <div ref={loadMoreRef} className="flex justify-center py-8">
                {loadingMore ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
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
      
      {/* NEW: Performance monitoring (dev only) */}
      <ImageLoadingStats stats={loadingStats} visible={showStats} />
      
      <ToastContainer />
    </div>
  )
}
