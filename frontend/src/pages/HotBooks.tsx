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

  // Load hot books from OPDS
  const loadHotBooks = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('🔥 Fetching hot books via OPDS...')
      
      const response = await fetch('/api/opds/hot', {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch hot books: ${response.status} ${response.statusText}`)
      }

      const xmlText = await response.text()
      console.log('📄 OPDS XML response received, parsing...')
      
      // Parse OPDS XML to extract book information
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml')
      
      // Check for XML parsing errors
      const parserError = xmlDoc.querySelector('parsererror')
      if (parserError) {
        throw new Error('Failed to parse OPDS XML response')
      }

      // Extract book entries from OPDS feed
      const entries = xmlDoc.querySelectorAll('entry')
      console.log(`📚 Found ${entries.length} hot books in OPDS feed`)

      const hotBooks: HotBook[] = Array.from(entries).map((entry, index) => {
        // Extract basic book information from OPDS entry
        const titleElement = entry.querySelector('title')
        const authorElement = entry.querySelector('author name')
        const summaryElement = entry.querySelector('summary')
        const idElement = entry.querySelector('id')
        
        // Extract links for covers and downloads
        const coverLink = entry.querySelector('link[type*="image"]')
        const downloadLinks = entry.querySelectorAll('link[type*="application"]')
        
        // Get cover URL from OPDS or construct it from original ID
        let coverUrl: string | null = null
        if (coverLink) {
          const href = coverLink.getAttribute('href')
          if (href) {
            // Use OPDS cover URL - convert to our API proxy endpoint
            if (href.startsWith('/opds/cover/')) {
              coverUrl = `/api${href}` // Convert /opds/cover/1613 to /api/opds/cover/1613
            } else {
              coverUrl = href.startsWith('http') ? href : `${window.location.origin}${href}`
            }
          }
        }
        
        // Extract book ID from the id element or cover link
        let bookId = index + 1 // Fallback ID
        
        // First try to get ID from the cover link (most reliable)
        if (coverLink) {
          const href = coverLink.getAttribute('href') || ''
          const coverIdMatch = href.match(/\/opds\/cover\/(\d+)/)
          if (coverIdMatch) {
            bookId = parseInt(coverIdMatch[1])
          }
        }
        
        // Fallback: try to extract from id element (for numeric IDs)
        if (bookId === index + 1 && idElement) {
          const idText = idElement.textContent || ''
          const idMatch = idText.match(/(\d+)/)
          if (idMatch) {
            bookId = parseInt(idMatch[1])
          }
        }

        // Create a unique ID for React keys by combining title, author, and index
        const title = titleElement?.textContent || 'Unknown Title'
        const author = authorElement?.textContent || 'Unknown Author'
        const uniqueId = `hot-${index}-${title.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10)}-${author.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10)}`

        // Extract available formats
        const formats: string[] = []
        downloadLinks.forEach(link => {
          const href = link.getAttribute('href') || ''
          const formatMatch = href.match(/\.(\w+)$/)
          if (formatMatch) {
            formats.push(formatMatch[1].toUpperCase())
          }
        })

        // Create unified book object
        const book: HotBook = {
          id: uniqueId, // Use unique ID instead of potentially duplicate bookId
          title: title,
          authors: author ? [author] : ['Unknown Author'],
          has_cover: !!coverLink,
          formats: formats.length > 0 ? formats : ['EPUB'], // Default format
          comments: summaryElement?.textContent,
          tags: ['Hot', 'Popular'], // Add hot book tags
          download_count: undefined, // OPDS doesn't provide download count directly
          // Store the original numeric ID for API calls
          originalId: bookId,
          // Use OPDS cover URL or construct from original ID
          preview: coverUrl || (bookId ? `/api/cwa/library/books/${bookId}/cover/md` : undefined),
        }

        // Debug logging for problematic books
        if (title.includes('Tarnished')) {
          console.log(`📚 Debug - Tarnished book:`, {
            title,
            uniqueId,
            originalId: bookId,
            coverUrl,
            preview: book.preview,
            coverLink: coverLink?.getAttribute('href')
          })
        }

        return book
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
  const sendToKindle = async (book: HotBook) => {
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
        showToast({
          type: 'error',
          title: 'Cannot Send to Kindle',
          message: `"${book.title}" does not have an EPUB format available for Kindle delivery.`
        })
        return
      }
      
      // Send to Kindle using EPUB format with no conversion
      const response = await fetch(`/api/cwa/library/books/${apiBookId}/send/epub/0`, {
        method: 'POST',
        credentials: 'include'
      })
      
      if (response.ok) {
        const result = await response.json()
        if (Array.isArray(result) && result.length > 0 && result[0].type === 'success') {
          showToast({
            type: 'success',
            title: 'Book Sent to Kindle!',
            message: `"${book.title}" has been queued for delivery to your Kindle.`
          })
        } else {
          throw new Error(result[0]?.message || 'Unknown error occurred')
        }
      } else {
        throw new Error('Failed to send book to Kindle')
      }
      
    } catch (error) {
      console.error('Error sending book to Kindle:', error)
      showToast({
        type: 'error',
        title: 'Send to Kindle Failed',
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      })
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
