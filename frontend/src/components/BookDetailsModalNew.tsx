import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useBookInfo, useDownloadBook } from '../hooks/useDownloads'
import { Button } from './ui/Button'
import { useDownloadStore } from '../stores/downloadStore'
import { useNavigate } from 'react-router-dom'
import { 
  BookCover, 
  BookHeader, 
  QuickStats, 
  BookDescription, 
  CategoryTags, 
  MoreByAuthor,
  ModalFooter
} from './BookDetailsModal'

interface BookDetailsModalProps {
  bookId: string | null
  onClose: () => void
}

export function BookDetailsModal({ bookId, onClose }: BookDetailsModalProps) {
  const { data: book, isLoading, error } = useBookInfo(bookId)
  const downloadBook = useDownloadBook()
  const downloads = useDownloadStore((state) => state.downloads)
  const [isDownloading, setIsDownloading] = useState(false)
  const [googleBooksData, setGoogleBooksData] = useState<any>(null)
  const [isLoadingGoogleBooks, setIsLoadingGoogleBooks] = useState(false)
  const [detailedGoogleBooksData, setDetailedGoogleBooksData] = useState<any>(null)
  const [isLoadingDetailedData, setIsLoadingDetailedData] = useState(false)
  const [authorBooks, setAuthorBooks] = useState<any[]>([])
  const [isLoadingAuthorBooks, setIsLoadingAuthorBooks] = useState(false)
  const navigate = useNavigate()

  // Animation states
  const [isVisible, setIsVisible] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  // Animation and fetch Google Books data after basic book info is loaded
  useEffect(() => {
    const fetchGoogleBooksData = async () => {
      if (!book || !book.title) {
        console.log('BookDetailsModal: No book data available for Google Books search')
        return
      }

      console.log('BookDetailsModal: Fetching Google Books data for:', {
        title: book.title,
        author: book.author,
        bookId
      })

      setIsLoadingGoogleBooks(true)
      setIsVisible(true)
      setIsClosing(false)
      
      try {
        const response = await fetch('/api/google-books/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            title: book.title,
            author: book.author || ''
          })
        })

        if (response.ok) {
          const googleData = await response.json()
          console.log('BookDetailsModal: Google Books data received:', googleData)
          setGoogleBooksData(googleData)
          
          // Fetch detailed volume information using the volume ID
          if (googleData.id) {
            fetchDetailedVolumeInfo(googleData.id)
          }
          
          // Fetch more books by the same author
          const author = googleData?.volumeInfo?.authors?.[0] || book.author
          if (author) {
            fetchAuthorBooks(author)
          }
        } else {
          console.log('BookDetailsModal: Google Books API not available or failed:', response.status)
        }
      } catch (error) {
        console.error('BookDetailsModal: Error fetching Google Books data:', error)
      } finally {
        setIsLoadingGoogleBooks(false)
      }
    }

    fetchGoogleBooksData()
  }, [book, bookId])

  // Fetch detailed volume information
  const fetchDetailedVolumeInfo = async (volumeId: string) => {
    console.log('BookDetailsModal: Fetching detailed volume info for ID:', volumeId)
    setIsLoadingDetailedData(true)
    
    try {
      const response = await fetch(`/api/google-books/volume/${encodeURIComponent(volumeId)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      })

      if (response.ok) {
        const detailedData = await response.json()
        console.log('BookDetailsModal: Detailed volume data received:', detailedData)
        setDetailedGoogleBooksData(detailedData)
      } else {
        console.error('BookDetailsModal: Detailed volume data failed:', response.status, response.statusText)
        const errorText = await response.text()
        console.error('BookDetailsModal: Error response:', errorText)
      }
    } catch (error) {
      console.error('BookDetailsModal: Error fetching detailed volume data:', error)
    } finally {
      setIsLoadingDetailedData(false)
    }
  }

  // Fetch more books by author
  const fetchAuthorBooks = async (authorName: string) => {
    console.log('BookDetailsModal: Fetching more books by author:', authorName)
    setIsLoadingAuthorBooks(true)
    
    try {
      const response = await fetch('/api/google-books/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title: '',
          author: authorName,
          maxResults: 6
        })
      })

      if (response.ok) {
        const searchResponse = await response.json()
        console.log('BookDetailsModal: Author books data received:', searchResponse)
        
        // Google Books API returns search results differently than single book
        if (searchResponse.items) {
          setAuthorBooks(searchResponse.items.slice(0, 6))
        } else if (Array.isArray(searchResponse)) {
          setAuthorBooks(searchResponse.slice(0, 6))
        }
      } else {
        console.log('BookDetailsModal: Author books search failed:', response.status)
      }
    } catch (error) {
      console.error('BookDetailsModal: Error fetching author books:', error)
    } finally {
      setIsLoadingAuthorBooks(false)
    }
  }

  // Handle modal close with animation
  const handleClose = () => {
    setIsClosing(true)
    setTimeout(() => {
      onClose()
      setIsVisible(false)
      setIsClosing(false)
    }, 200)
  }

  const handleSearchByTitle = (title: string) => {
    handleClose()
    navigate(`/search?q=${encodeURIComponent(title)}&fresh=true`)
  }

  const handleDownload = async () => {
    const downloadStatus = downloads[bookId!]
    const hasRealProgress = downloadStatus && (
      downloadStatus.progress > 0 || 
      downloadStatus.status === 'completed' || 
      downloadStatus.status === 'error' ||
      downloadStatus.status === 'processing' ||
      downloadStatus.status === 'waiting'
    )
    const isPending = isDownloading || (downloadStatus && downloadStatus.status === 'downloading' && (downloadStatus.progress || 0) === 0)

    if (downloadStatus?.status === 'completed' || isPending || hasRealProgress) return
    
    setIsDownloading(true)
    try {
      await downloadBook.mutateAsync({ id: bookId!, title: book?.title || '', author: book?.author || '' })
    } catch (error) {
      console.error('Download failed:', error)
    } finally {
      setIsDownloading(false)
    }
  }

  // Helper function to get the best available Google Books data
  const getBestGoogleBooksData = () => {
    // Prefer detailed data when available, fallback to basic data
    return detailedGoogleBooksData || googleBooksData
  }

  if (!bookId) return null

  const downloadStatus = downloads[bookId]

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black transition-opacity duration-200 ${
        isVisible && !isClosing ? 'bg-opacity-50' : 'bg-opacity-0'
      }`}
      onClick={handleClose}
    >
      <div 
        className={`bg-card border border-border rounded-lg shadow-lg max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col transition-all duration-200 ${
          isVisible && !isClosing 
            ? 'opacity-100 scale-100 translate-y-0' 
            : 'opacity-0 scale-95 translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border flex-shrink-0">
          <h2 className="text-xl font-semibold text-foreground">Book Details</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="p-2"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="ml-2 text-foreground">Loading book details...</span>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 text-destructive flex items-center justify-center">
                <X className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">Failed to load details</h3>
              <p className="text-muted-foreground">Unable to fetch book information</p>
            </div>
          )}

          {book && (
            <div className="space-y-6">
              {/* Main Book Layout - Condensed */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Cover */}
                <BookCover preview={book.preview} title={book.title || ''} />

                {/* Book Details - Condensed */}
                <div className="md:col-span-3 space-y-4">
                  {/* Title & Author */}
                  <BookHeader
                    title={book.title || ''}
                    authors={getBestGoogleBooksData()?.volumeInfo?.authors}
                    fallbackAuthor={book.author}
                  />

                  {/* Quick Stats Cards */}
                  <QuickStats
                    publishedDate={book.year || getBestGoogleBooksData()?.volumeInfo?.publishedDate}
                    pageCount={getBestGoogleBooksData()?.volumeInfo?.pageCount}
                    averageRating={getBestGoogleBooksData()?.volumeInfo?.averageRating}
                    ratingsCount={getBestGoogleBooksData()?.volumeInfo?.ratingsCount}
                    format={book.format}
                    size={book.size}
                  />

                  {/* Description */}
                  <BookDescription description={getBestGoogleBooksData()?.volumeInfo?.description} />

                  {/* Categories */}
                  <CategoryTags categories={getBestGoogleBooksData()?.volumeInfo?.categories} />
                </div>
              </div>

              {/* More by Author Section */}
              <MoreByAuthor
                authorName={getBestGoogleBooksData()?.volumeInfo?.authors?.[0] || book.author}
                books={authorBooks}
                isLoading={isLoadingAuthorBooks}
                onSearchByTitle={handleSearchByTitle}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        {book && (
          <ModalFooter
            downloadStatus={downloadStatus}
            isDownloading={isDownloading}
            onDownload={handleDownload}
          />
        )}
      </div>
    </div>
  )
}
