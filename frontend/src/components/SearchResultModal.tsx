import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useDownloadBook } from '../hooks/useDownloads'
import { Button } from './ui/Button'
import { useDownloadStore } from '../stores/downloadStore'
import { useNavigate } from 'react-router-dom'
import { BookCover } from './BookDetailsModal/BookCover'
import { MoreByAuthor } from './BookDetailsModal/MoreByAuthor'
import { ModalFooter } from './BookDetailsModal/ModalFooter'
import { EnhancedBookInfo } from './BookDetailsModal/EnhancedBookInfo'
import { AuthorFormatter } from '../utils/authorFormatter'



interface SearchResultModalProps {
  book: any | null  // Full book data from search results
  onClose: () => void
}

export function SearchResultModal({ book: basicBook, onClose }: SearchResultModalProps) {
  // No need for useBookInfo hook - we already have the book data!
  const downloadBook = useDownloadBook()
  const downloads = useDownloadStore((state) => state.downloads)
  const [isDownloading, setIsDownloading] = useState(false)
  const [googleBooksData, setGoogleBooksData] = useState<any>(null)
  const [detailedGoogleBooksData, setDetailedGoogleBooksData] = useState<any>(null)
  const [enhancedBook, setEnhancedBook] = useState<any>(null)

  const [authorBooks, setAuthorBooks] = useState<any[]>([])
  const [isLoadingAuthorBooks, setIsLoadingAuthorBooks] = useState(false)
  const navigate = useNavigate()

  // Animation states
  const [isVisible, setIsVisible] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  // Helper function to convert text to title case
  const toTitleCase = (str: string) => {
    if (!str) return str
    return str.replace(/\w\S*/g, (txt) => 
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    )
  }



  // Use enhanced book data if available, otherwise fall back to basic book data
  const book = enhancedBook || basicBook

  // Animation and reset enhanced data when book changes
  useEffect(() => {
    if (basicBook) {
      console.log('BookDetailsModal: Book changed, resetting enhanced data')
      setEnhancedBook(null)
      setGoogleBooksData(null)
      setDetailedGoogleBooksData(null)
      setAuthorBooks([])
      setIsVisible(true)
      setIsClosing(false)
    }
  }, [basicBook?.id])

  // Handle modal close with animation
  const handleClose = () => {
    setIsClosing(true)
    setTimeout(() => {
      onClose()
      setIsVisible(false)
      setIsClosing(false)
    }, 200)
  }

  // Fetch enhanced book data (just Google Books) using the book data we already have
  useEffect(() => {
    const fetchEnhancedData = async () => {
      if (!basicBook || !basicBook.title) {
        return
      }

      console.log('BookDetailsModal: Fetching Google Books data for:', basicBook.title, 'by', basicBook.author)

      try {
        // Direct Google Books search using the title and author we already have
        const response = await fetch('/api/google-books/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            title: basicBook.title,
            author: basicBook.author || '',
            maxResults: 1
          })
        })

        if (response.ok) {
          const googleBooksData = await response.json()
          console.log('BookDetailsModal: Google Books data received:', googleBooksData)
          
          // Combine Anna's Archive data with Google Books data
          const combinedData = {
            ...basicBook,  // Anna's Archive data (format, size, preview, etc.)
            googleBooks: googleBooksData  // Google Books enhancement
          }
          
          setEnhancedBook(combinedData)
          setGoogleBooksData(googleBooksData)

          // Fetch more books by author using original author from search results (formatted for better search)
          if (basicBook.author) {
            fetchAuthorBooks(AuthorFormatter.formatForSearch(basicBook.author))
          }
        } else {
          console.log('BookDetailsModal: Enhanced book details not available:', response.status)
          // Fallback to direct Google Books API if enhanced endpoint fails
          await fallbackToDirectGoogleBooks()
        }
      } catch (error) {
        console.error('BookDetailsModal: Error fetching enhanced book details:', error)
        // Fallback to direct Google Books API on error
        await fallbackToDirectGoogleBooks()
      }
    }

    const fallbackToDirectGoogleBooks = async () => {
      if (!basicBook || !basicBook.title) return
      
      console.log('BookDetailsModal: Falling back to direct Google Books API')
      
      try {
        const response = await fetch('/api/google-books/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
                  body: JSON.stringify({
          title: basicBook.title,
          author: basicBook.author || ''
        })
        })

        if (response.ok) {
          const googleData = await response.json()
          console.log('BookDetailsModal: Fallback Google Books data received:', googleData)
          setGoogleBooksData(googleData)
          
          // Fetch detailed volume information using the volume ID
          if (googleData.id) {
            fetchDetailedVolumeInfo(googleData.id)
          }
          
          // Fetch more books by the same author using original author from search results (formatted for better search)
          if (basicBook.author) {
            fetchAuthorBooks(AuthorFormatter.formatForSearch(basicBook.author))
          }
        }
      } catch (error) {
        console.error('BookDetailsModal: Fallback Google Books API also failed:', error)
      }
    }

    fetchEnhancedData()
  }, [basicBook])

  // Fetch detailed volume information
  const fetchDetailedVolumeInfo = async (volumeId: string) => {
    console.log('BookDetailsModal: Fetching detailed volume info for ID:', volumeId)

    
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
    }
  }

  // Fetch more books by author
  const fetchAuthorBooks = async (authorName: string) => {
    console.log('BookDetailsModal: Fetching more books by author:', authorName)
    console.log('BookDetailsModal: Author formats - Original:', basicBook?.author, '-> Display:', AuthorFormatter.formatForDisplay(basicBook?.author || ''), '-> Search:', authorName)
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
          author: authorName, // Properly search by author
          maxResults: 18 // Get more books for carousel pagination
        })
      })

      if (response.ok) {
        const searchResponse = await response.json()
        console.log('BookDetailsModal: Author books data received:', searchResponse)
        
        // Google Books API returns search results differently than single book
        if (searchResponse.items) {
          console.log('BookDetailsModal: Setting all author books:', searchResponse.items.length)
          setAuthorBooks(searchResponse.items) // Use all books, carousel will handle pagination
        } else if (Array.isArray(searchResponse)) {
          console.log('BookDetailsModal: Setting all author books (array format):', searchResponse.length)
          setAuthorBooks(searchResponse) // Use all books, carousel will handle pagination
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

  const handleSearchByTitle = (title: string) => {
    onClose()
    navigate(`/search?q=${encodeURIComponent(title)}&fresh=true`)
  }

  const handleDownload = async () => {
    const downloadStatus = downloads[book?.id!]
    const hasRealProgress = downloadStatus && (
      downloadStatus.progress > 0 || 
      downloadStatus.status === 'completed' || 
      downloadStatus.status === 'error' ||
      downloadStatus.status === 'processing' ||
      downloadStatus.status === 'waiting'
    )
    const isPending = isDownloading || (downloadStatus && downloadStatus.status === 'downloading' && (downloadStatus.progress || 0) === 0)

    if (downloadStatus?.status === 'completed' || isPending || hasRealProgress) return
    
    // Close the modal immediately when download is clicked
    handleClose()
    
    setIsDownloading(true)
    try {
      await downloadBook.mutateAsync({ id: book?.id!, title: book?.title || '', author: book?.author || '' })
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

  if (!basicBook) return null

  const downloadStatus = downloads[basicBook.id]

  return (
    <div 
      className={`fixed top-0 left-0 right-0 bottom-0 z-50 flex items-center justify-center p-4 bg-black transition-opacity duration-200 ${
        isVisible && !isClosing ? 'bg-opacity-50' : 'bg-opacity-0'
      }`} 
      style={{ margin: 0 }}
      onClick={handleClose}
    >
      <div 
        className={`bg-card border border-border rounded-lg shadow-lg max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col transition-all duration-200 ${
          isVisible && !isClosing 
            ? 'opacity-100 scale-100 translate-y-0' 
            : 'opacity-0 scale-95 translate-y-4'
        }`} 
        style={{ margin: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex-1 mr-4">
            <h2 className="text-xl font-semibold text-foreground line-clamp-2">
              {toTitleCase(book?.title || 'Unknown Title')}
            </h2>
            {(getBestGoogleBooksData()?.volumeInfo?.authors?.[0] || book?.author) && (
              <p className="text-sm text-muted-foreground mt-1">
                by {AuthorFormatter.formatForDisplay(getBestGoogleBooksData()?.volumeInfo?.authors?.[0] || book?.author)}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="p-2 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {book && (
            <div className="space-y-6">
              {/* Main Book Layout - Condensed */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Cover */}
                <BookCover preview={book.preview} title={book.title || ''} />

                {/* Book Details - Enhanced with Anna's Archive + Google Books */}
                <div className="md:col-span-3 space-y-4">
                  {/* Enhanced Book Information combining Anna's Archive + Google Books */}
                  <EnhancedBookInfo 
                    book={book}
                    googleBooksData={getBestGoogleBooksData()}
                  />
                </div>
              </div>




              {/* More by Author Section */}
              <MoreByAuthor
                authorName={AuthorFormatter.formatForDisplay(book.author)}
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
