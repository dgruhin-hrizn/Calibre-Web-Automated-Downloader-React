import { useState, useEffect } from 'react'
import { TrendingUp } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/card'
import { UnifiedBookCard, type UnifiedBook } from '../components/UnifiedBookCard'

import { useToast } from '../hooks/useToast'



interface HotBook extends UnifiedBook {
  download_count?: number
  popularity_rank?: number
  originalId?: number // Store the original numeric ID for API calls
}

export function Top10() {
  const { showToast, ToastContainer } = useToast()
  const [books, setBooks] = useState<HotBook[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load hot books from metadata API
  const loadHotBooks = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('🔥 Fetching hot books based on download statistics...')
      
      const response = await fetch('/api/metadata/hot-books?per_page=50', {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch hot books: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log('📄 JSON response received:', data)
      
      if (!data.books || !Array.isArray(data.books)) {
        throw new Error('Invalid response format')
      }

      console.log(`📚 Found ${data.books.length} hot books based on download data`)

      const hotBooks: HotBook[] = data.books.map((book: any, index: number) => {
        // Create unified book object from metadata API response
        // Handle authors - could be array of strings, array of objects, or string
        let authors: string[] = ['Unknown Author']
        if (book.authors) {
          if (Array.isArray(book.authors)) {
            authors = book.authors.map((author: any) => 
              typeof author === 'string' ? author : author.name || author.sort || 'Unknown Author'
            )
          } else if (typeof book.authors === 'string') {
            authors = [book.authors]
          }
        }

        const hotBook: HotBook = {
          id: book.id.toString(), // Use book ID as string
          title: book.title || 'Unknown Title',
          authors: authors,
          has_cover: book.has_cover || false,
          formats: book.formats || ['EPUB'],
          comments: book.comments || undefined,
          tags: book.tags || ['Hot', 'Popular'],
          download_count: book.download_count || 0,
          popularity_rank: book.popularity_rank || (index + 1),
          originalId: book.id,
          // Use metadata API cover endpoint
          preview: book.has_cover ? `/api/metadata/books/${book.id}/cover` : undefined,
          // Additional metadata from the API
          series: book.series || [],
          rating: book.rating || undefined,
          pubdate: book.pubdate || undefined,
        }

        return hotBook
      })

      setBooks(hotBooks)
      console.log(`✅ Successfully loaded ${hotBooks.length} hot books`)

    } catch (error) {
      console.error('❌ Failed to load hot books:', error)
      setError(error instanceof Error ? error.message : 'Failed to load hot books')
    } finally {
      setLoading(false)
    }
  }

  // Send book to Kindle
  const sendToKindle = async (book: HotBook): Promise<{ success: boolean; message: string }> => {
    try {
      // Use the original numeric ID for API calls
      const apiBookId = book.originalId || book.id
      
      // Get actual available formats first
      const detailsResponse = await fetch(`/api/cwa/library/books/${apiBookId}/details`, {
        credentials: 'include'
      })
      
      if (!detailsResponse.ok) {
        throw new Error('Failed to get book details')
      }
      
      const bookDetails = await detailsResponse.json()
      const actualFormats = bookDetails.formats || book.formats || []
      
      // For Kindle, we prefer EPUB format
      const lowerFormats = actualFormats.map((f: string) => f.toLowerCase())
      
      if (!lowerFormats.includes('epub')) {
        const errorMessage = `"${book.title}" does not have an EPUB format available for Kindle delivery.`
        showToast({
          type: 'error',
          title: 'Cannot Send to Kindle',
          message: errorMessage
        })
        return { success: false, message: errorMessage }
      }
      
      // Send to Kindle using EPUB format with no conversion
      const response = await fetch(`/api/cwa/library/books/${apiBookId}/send/epub/0`, {
        method: 'POST',
        credentials: 'include'
      })
      
      if (response.ok) {
        const result = await response.json()
        if (Array.isArray(result) && result.length > 0 && result[0].type === 'success') {
          const successMessage = `"${book.title}" has been queued for delivery to your Kindle.`
          showToast({
            type: 'success',
            title: 'Book Sent to Kindle!',
            message: successMessage
          })
          return { success: true, message: successMessage }
        } else {
          throw new Error(result[0]?.message || 'Unknown error occurred')
        }
      } else {
        throw new Error('Failed to send book to Kindle')
      }
      
    } catch (error) {
      console.error('Error sending book to Kindle:', error)
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      showToast({
        type: 'error',
        title: 'Send to Kindle Failed',
        message: errorMessage
      })
      return { success: false, message: errorMessage }
    }
  }

  // Show book details (placeholder - you might want to implement a modal)
  const showDetails = (book: UnifiedBook) => {
    console.log('Show details for book:', book)
    // TODO: Implement book details modal or navigation
  }

  // Handle book click - same as showDetails for now
  const handleBookClick = (book: HotBook) => {
    showDetails(book)
  }

  // Load hot books on component mount
  useEffect(() => {
    loadHotBooks()
  }, [])

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Top 10 Books</h1>
          <p className="text-muted-foreground mt-1">
            Most downloaded books from your library
          </p>
        </div>
        
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-red-600">
              <p className="font-medium">Failed to Load Top 10 Books</p>
              <p className="text-sm mt-1">{error}</p>
              <Button 
                onClick={loadHotBooks} 
                className="mt-4"
                variant="outline"
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header - matching Series page style */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Top 10 Books</h1>
        <p className="text-muted-foreground mt-1">
          Most downloaded books based on real user activity
        </p>
      </div>

      {/* Hot Books Carousel */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : !books || books.length === 0 ? (
        <div className="text-center py-12">
          <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium">No Top 10 Books Found</p>
          <p className="text-muted-foreground">No books have been downloaded to devices yet. Start downloading books to see what's popular!</p>
        </div>
      ) : (
        /* Grid Layout - Following Library page pattern */
        <div className="flex flex-wrap gap-4 justify-start transition-all duration-500 ease-out">
          {books.map((book) => (
            <div 
              key={book.id}
              className="w-[calc(50%-8px)] sm:w-[225px] sm:min-w-[225px] sm:max-w-[225px] transition-all ease-out opacity-100 scale-100 translate-y-0 hover:scale-[1.02] hover:shadow-lg duration-700"
              style={{
                transform: 'translateZ(0)', // Hardware acceleration
                willChange: 'transform, opacity, box-shadow',
                backfaceVisibility: 'hidden', // Prevent flickering
                perspective: '1000px', // Enable 3D transforms
                transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)' // Smooth repositioning
              }}
            >
              <UnifiedBookCard
                book={book}
                cardType="library"
                viewMode="grid"
                onDetails={handleBookClick}
                onSendToKindle={() => sendToKindle(book)}
                showHotIndicator={true}
              />
            </div>
          ))}
        </div>
      )}

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  )
}

export default Top10
