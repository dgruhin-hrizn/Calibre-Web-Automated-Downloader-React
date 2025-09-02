import { useState, useEffect } from 'react'
import { TrendingUp, Grid, List } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { UnifiedBookCard, type UnifiedBook } from '../components/UnifiedBookCard'
import { useToast } from '../hooks/useToast'

interface HotBook extends UnifiedBook {
  download_count?: number
  originalId?: number // Store the original numeric ID for API calls
}

export function HotBooks() {
  const { showToast, ToastContainer } = useToast()
  const [books, setBooks] = useState<HotBook[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Load hot books from metadata API
  const loadHotBooks = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('🔥 Fetching hot books via metadata API...')
      
      const response = await fetch('/api/metadata/hot-books?page=1&per_page=50', {
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

      console.log(`📚 Found ${data.books.length} hot books in metadata response`)

      const hotBooks: HotBook[] = data.books.map((book: any, index: number) => {
        // Create unified book object from metadata API response
        const hotBook: HotBook = {
          id: book.id.toString(), // Use book ID as string
          title: book.title || 'Unknown Title',
          authors: book.authors || ['Unknown Author'],
          has_cover: book.has_cover || false,
          formats: book.formats || ['EPUB'],
          comments: book.comments || undefined,
          tags: book.tags || ['Hot', 'Popular'],
          download_count: book.download_count || 0,
          originalId: book.id,
          // Use metadata API cover endpoint
          preview: book.has_cover ? `/api/metadata/books/${book.id}/cover` : undefined,
          // Additional metadata from the API
          series: book.series || [],
          rating: book.rating || undefined,
          pubdate: book.pubdate || undefined,
          isbn: book.isbn || undefined,
          publishers: book.publishers || [],
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

  // Load hot books on component mount
  useEffect(() => {
    loadHotBooks()
  }, [])

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hot Books</h1>
          <p className="text-muted-foreground">Most downloaded books from your library</p>
        </div>
        
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-red-600">
              <p className="font-medium">Failed to Load Hot Books</p>
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
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <TrendingUp className="h-8 w-8 text-red-500" />
          Hot Books
        </h1>
        <p className="text-muted-foreground">Most downloaded books from your CWA library</p>
      </div>

      {/* Stats Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-red-500" />
            Popular Downloads
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Showing the most downloaded books based on user activity
              </p>
              <p className="text-2xl font-bold mt-1">
                {loading ? '...' : books.length} Hot Books
              </p>
            </div>
            
            {/* View Mode Toggle */}
            <div className="flex rounded-md border border-input">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="rounded-r-none"
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="rounded-l-none"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Books Grid/List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : !books || books.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium">No Hot Books Found</p>
            <p className="text-muted-foreground">No download statistics available yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className={viewMode === 'grid' 
          ? "grid gap-4 grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
          : "space-y-4"
        }>
          {books.map((book) => (
            <UnifiedBookCard
              key={book.id}
              book={book}
              cardType="library"
              viewMode={viewMode}
              onSendToKindle={(_unifiedBook) => sendToKindle(book)}
              onDetails={(_unifiedBook) => showDetails(book)}
              shouldLoadImage={(_bookId) => true} // Always load images for hot books
              onImageLoaded={(_bookId) => {}} // No special handling needed
            />
          ))}
        </div>
      )}

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  )
}

export default HotBooks
