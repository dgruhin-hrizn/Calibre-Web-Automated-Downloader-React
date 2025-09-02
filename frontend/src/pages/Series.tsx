import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, BookOpen, Search } from 'lucide-react'
import { UnifiedBookCard, type UnifiedBook } from '../components/UnifiedBookCard'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { useToast } from '../hooks/useToast'

interface SeriesInfo {
  id: number
  name: string
  sort: string
  book_count: number
}

interface SeriesWithBooks extends SeriesInfo {
  books: UnifiedBook[]
  currentIndex: number
}

export function Series() {
  const { showToast, ToastContainer } = useToast()
  const [seriesList, setSeriesList] = useState<SeriesInfo[]>([])
  const [seriesWithBooks, setSeriesWithBooks] = useState<SeriesWithBooks[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredSeries, setFilteredSeries] = useState<SeriesWithBooks[]>([])

  // Load series list
  const loadSeriesList = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('📚 Fetching series list...')
      
      const response = await fetch('/api/metadata/series?page=1&per_page=50', {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch series: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log('📄 Series response received:', data)
      
      if (!data.series || !Array.isArray(data.series)) {
        throw new Error('Invalid series response format')
      }

      setSeriesList(data.series)
      console.log(`✅ Successfully loaded ${data.series.length} series`)

    } catch (error) {
      console.error('❌ Failed to load series:', error)
      setError(error instanceof Error ? error.message : 'Failed to load series')
    } finally {
      setLoading(false)
    }
  }

  // Load books for a specific series
  const loadSeriesBooks = async (seriesInfo: SeriesInfo): Promise<UnifiedBook[]> => {
    try {
      console.log(`📖 Fetching books for series: ${seriesInfo.name}`)
      
      const response = await fetch(`/api/metadata/series/${seriesInfo.id}/books?page=1&per_page=20`, {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch books for series ${seriesInfo.name}`)
      }

      const data = await response.json()
      
      if (!data.books || !Array.isArray(data.books)) {
        throw new Error('Invalid series books response format')
      }

      // Convert to UnifiedBook format
      const books: UnifiedBook[] = data.books.map((book: any) => ({
        id: book.id.toString(),
        title: book.title || 'Unknown Title',
        authors: book.authors || ['Unknown Author'],
        has_cover: book.has_cover || false,
        formats: book.formats || ['EPUB'],
        series: book.series?.[0]?.name || seriesInfo.name,
        series_index: book.series_index,
        rating: book.rating,
        tags: book.tags || [],
        comments: book.comments,
        preview: book.has_cover ? `/api/metadata/books/${book.id}/cover` : undefined,
        pubdate: book.pubdate,
        timestamp: book.timestamp,
        languages: book.languages || [],
      }))

      console.log(`✅ Loaded ${books.length} books for series: ${seriesInfo.name}`)
      return books

    } catch (error) {
      console.error(`❌ Failed to load books for series ${seriesInfo.name}:`, error)
      return []
    }
  }

  // Load books for all series
  const loadAllSeriesBooks = async () => {
    try {
      const seriesWithBooksData: SeriesWithBooks[] = []
      
      // Load books for each series (limit to first 20 series for performance)
      const seriesToLoad = seriesList.slice(0, 20)
      
      for (const series of seriesToLoad) {
        const books = await loadSeriesBooks(series)
        if (books.length > 0) {
          seriesWithBooksData.push({
            ...series,
            books,
            currentIndex: Math.floor(books.length / 2) // Start with middle book centered
          })
        }
      }

      setSeriesWithBooks(seriesWithBooksData)
      setFilteredSeries(seriesWithBooksData)
      
    } catch (error) {
      console.error('❌ Failed to load series books:', error)
    }
  }

  // Handle carousel navigation
  const navigateCarousel = (seriesId: number, direction: 'left' | 'right') => {
    setSeriesWithBooks(prev => 
      prev.map(series => {
        if (series.id === seriesId) {
          const newIndex = direction === 'left' 
            ? Math.max(0, series.currentIndex - 1)
            : Math.min(series.books.length - 1, series.currentIndex + 1)
          return { ...series, currentIndex: newIndex }
        }
        return series
      })
    )
    
    // Update filtered series as well
    setFilteredSeries(prev => 
      prev.map(series => {
        if (series.id === seriesId) {
          const newIndex = direction === 'left' 
            ? Math.max(0, series.currentIndex - 1)
            : Math.min(series.books.length - 1, series.currentIndex + 1)
          return { ...series, currentIndex: newIndex }
        }
        return series
      })
    )
  }

  // Handle search
  const handleSearch = (term: string) => {
    setSearchTerm(term)
    if (term.trim() === '') {
      setFilteredSeries(seriesWithBooks)
    } else {
      const filtered = seriesWithBooks.filter(series =>
        series.name.toLowerCase().includes(term.toLowerCase())
      )
      setFilteredSeries(filtered)
    }
  }

  // Handle book actions
  const handleBookDetails = (book: UnifiedBook) => {
    console.log('📖 View book details:', book.title)
    // TODO: Implement book details modal or navigation
  }

  const handleSendToKindle = async (book: UnifiedBook) => {
    try {
      console.log('📧 Sending to Kindle:', book.title)
      // TODO: Implement Kindle sending
      showToast({ type: 'success', title: 'Book sent to Kindle!' })
      return { success: true, message: 'Book sent to Kindle!' }
    } catch (error) {
      showToast({ type: 'error', title: 'Failed to send book to Kindle' })
      return { success: false, message: 'Failed to send book to Kindle' }
    }
  }

  // Load data on component mount
  useEffect(() => {
    loadSeriesList()
  }, [])

  // Load series books when series list is available
  useEffect(() => {
    if (seriesList.length > 0) {
      loadAllSeriesBooks()
    }
  }, [seriesList])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <BookOpen className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-lg font-medium">Loading series...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg font-medium text-red-600 mb-4">Error loading series</p>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={loadSeriesList}>Try Again</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <ToastContainer />
      
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Book Series</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Discover books organized by series
              </p>
            </div>
            <Badge variant="secondary" className="text-sm">
              {filteredSeries.length} series
            </Badge>
          </div>
          
          {/* Search */}
          <div className="mt-6 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
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

      {/* Series Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {filteredSeries.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {searchTerm ? 'No series found' : 'No series available'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {searchTerm 
                ? `No series match "${searchTerm}". Try a different search term.`
                : 'No book series found in your library.'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {filteredSeries.map((series) => (
              <SeriesCarousel
                key={series.id}
                series={series}
                onNavigate={(direction) => navigateCarousel(series.id, direction)}
                onBookDetails={handleBookDetails}
                onSendToKindle={handleSendToKindle}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Series Carousel Component
interface SeriesCarouselProps {
  series: SeriesWithBooks
  onNavigate: (direction: 'left' | 'right') => void
  onBookDetails: (book: UnifiedBook) => void
  onSendToKindle: (book: UnifiedBook) => Promise<{ success: boolean; message: string }>
}

function SeriesCarousel({ series, onNavigate, onBookDetails, onSendToKindle }: SeriesCarouselProps) {
  const { currentIndex, books } = series
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
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold">{series.name}</CardTitle>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {series.book_count} books in series
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate('left')}
              disabled={currentIndex === 0}
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
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="relative">
          {/* Carousel Container */}
          <div className="flex items-center justify-center space-x-4 py-4">
            {visibleBooks.map(({ book, position }) => (
              <div
                key={book.id}
                className={`transition-all duration-300 ${
                  position === 0
                    ? 'scale-100 opacity-100 z-10' // Center book
                    : Math.abs(position) === 1
                    ? 'scale-90 opacity-75 z-5' // Adjacent books
                    : 'scale-75 opacity-50 z-0' // Outer books
                }`}
                style={{
                  transform: `translateX(${position * 20}px)`,
                }}
              >
                <div className={`${position === 0 ? 'w-64' : 'w-48'} transition-all duration-300`}>
                  <UnifiedBookCard
                    book={book}
                    cardType="library"
                    viewMode="grid"
                    onDetails={onBookDetails}
                    onSendToKindle={onSendToKindle}
                    shouldLoadImage={() => true}
                    onImageLoaded={() => {}}
                  />
                </div>
              </div>
            ))}
          </div>
          
          {/* Book Info for Center Book */}
          {centerBook && (
            <div className="mt-6 text-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {centerBook.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                by {centerBook.authors?.join(', ') || 'Unknown Author'}
              </p>
              {centerBook.series_index && (
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  Book #{centerBook.series_index} in {centerBook.series}
                </p>
              )}
              {centerBook.rating && (
                <div className="flex items-center justify-center mt-2">
                  {[...Array(5)].map((_, i) => (
                    <span
                      key={i}
                      className={`text-sm ${
                        i < Math.floor(centerBook.rating || 0)
                          ? 'text-yellow-400'
                          : 'text-gray-300'
                      }`}
                    >
                      ★
                    </span>
                  ))}
                  <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                    {centerBook.rating?.toFixed(1)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default Series
