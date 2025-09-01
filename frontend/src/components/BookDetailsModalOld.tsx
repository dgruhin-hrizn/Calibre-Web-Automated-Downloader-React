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

  // Fetch Google Books data after basic book info is loaded
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
          console.log('BookDetailsModal: volumeInfo keys:', Object.keys(googleData.volumeInfo || {}))
          console.log('BookDetailsModal: searchInfo keys:', Object.keys(googleData.searchInfo || {}))
          console.log('BookDetailsModal: Full data structure:', JSON.stringify(googleData, null, 2))
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
        console.log('BookDetailsModal: Detailed volumeInfo keys:', Object.keys(detailedData.volumeInfo || {}))
        console.log('BookDetailsModal: Checking for subjects:', detailedData.volumeInfo?.subjects)
        console.log('BookDetailsModal: Checking for mainCategory:', detailedData.volumeInfo?.mainCategory)
        console.log('BookDetailsModal: Industry Identifiers:', detailedData.volumeInfo?.industryIdentifiers)
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

  const handleSearchByTitle = (title: string) => {
    onClose()
    navigate(`/search?q=${encodeURIComponent(title)}&fresh=true`)
  }

  // Helper function to get the best available Google Books data
  const getBestGoogleBooksData = () => {
    // Prefer detailed data when available, fallback to basic data
    return detailedGoogleBooksData || googleBooksData
  }

  if (!bookId) return null

  const downloadStatus = downloads[bookId]
  const hasRealProgress = downloadStatus && (
    downloadStatus.progress > 0 || 
    downloadStatus.status === 'completed' || 
    downloadStatus.status === 'error' ||
    downloadStatus.status === 'processing' ||
    downloadStatus.status === 'waiting'
  )
  const isPending = isDownloading || (downloadStatus && downloadStatus.status === 'downloading' && (downloadStatus.progress || 0) === 0)

  const handleDownload = async () => {
    if (downloadStatus?.status === 'completed' || isPending || hasRealProgress) return
    
    setIsDownloading(true)
    try {
      await downloadBook.mutateAsync({ id: bookId, title: book?.title || '', author: book?.author || '' })
      // Don't close modal immediately - let user see the progress
    } catch (error) {
      console.error('Download failed:', error)
    } finally {
      setIsDownloading(false)
    }
  }

  const renderDownloadButton = () => {
    if (downloadStatus?.status === 'completed') {
      return (
        <Button disabled className="w-full">
          <div className="mr-2">
            <CircularProgress 
              progress={100} 
              status="completed" 
              size={16} 
              showPercentage={false}
            />
          </div>
          Downloaded
        </Button>
      )
    }

    if (downloadStatus?.status === 'error') {
      return (
        <Button disabled className="w-full">
          <div className="mr-2">
            <CircularProgress 
              progress={0} 
              status="error" 
              size={16} 
              showPercentage={false}
            />
          </div>
          Failed
        </Button>
      )
    }

    if (hasRealProgress) {
      const status = downloadStatus.status === 'processing' ? 'processing' :
                    downloadStatus.status === 'waiting' ? 'waiting' : 'downloading'
      return (
        <Button disabled className="w-full">
          <div className="mr-2">
            <CircularProgress 
              progress={downloadStatus.progress || 0} 
              status={status}
              size={16} 
              showPercentage={downloadStatus.status === 'downloading' && downloadStatus.progress > 0}
            />
          </div>
          {status === 'processing' ? 'Processing...' :
           status === 'waiting' ? 'Waiting...' :
           `${Math.round(downloadStatus.progress || 0)}% Downloading`}
        </Button>
      )
    }

    if (isPending) {
      return (
        <Button disabled className="w-full">
          <div className="mr-2">
            <svg className="animate-spin h-4 w-4 text-primary" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="37.7" strokeDashoffset="37.7">
                <animate attributeName="stroke-dashoffset" dur="1s" values="37.7;0;37.7" repeatCount="indefinite" />
              </circle>
            </svg>
          </div>
          <span className="text-primary">Adding to queue...</span>
        </Button>
      )
    }

    return (
      <Button onClick={handleDownload} className="w-full">
        <Download className="w-4 h-4 mr-2" />
        Download
      </Button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-card border border-border rounded-lg shadow-lg max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">Book Details</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
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
            <div className="space-y-8">
              {/* Main Book Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Cover */}
                <div className="flex justify-center">
                  {book.preview ? (
                    <div className="w-full max-w-[250px]">
                      <img
                        src={book.preview}
                        alt="Book cover"
                        className="w-full h-[400px] rounded-lg shadow-lg object-cover border border-border"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        const parent = target.parentElement
                        if (parent) {
                          parent.innerHTML = `
                            <div class="w-full h-[400px] bg-muted rounded-lg flex items-center justify-center border border-border">
                              <svg class="w-16 h-16 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                              </svg>
                            </div>
                          `
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-full max-w-[250px] h-[400px] bg-muted rounded-lg flex items-center justify-center border border-border">
                    <Book className="w-16 h-16 text-muted-foreground" />
                  </div>
                )}
                </div>

                {/* Book Details */}
                <div className="md:col-span-2 space-y-4">
                <div>
                  <h1 className="text-2xl font-bold text-foreground mb-2">
                    {book.title || 'Untitled'}
                  </h1>
                  <p className="text-lg text-muted-foreground">
                    {book.author || 'Unknown Author'}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Publisher:</span>
                    <span className="text-foreground">{book.publisher || '--'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Year:</span>
                    <span className="text-foreground">{book.year || (googleBooksData?.volumeInfo?.publishedDate) || '--'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Language:</span>
                    <span className="text-foreground">{book.language || '--'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Format:</span>
                    <span className="text-foreground">{book.format || '--'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Size:</span>
                    <span className="text-foreground">{book.size || '--'}</span>
                  </div>
                  {googleBooksData?.volumeInfo?.pageCount && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pages:</span>
                      <span className="text-foreground">{googleBooksData.volumeInfo.pageCount}</span>
                    </div>
                  )}
                  {googleBooksData?.volumeInfo?.averageRating && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Rating:</span>
                      <span className="text-foreground flex items-center">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 mr-1" />
                        {googleBooksData.volumeInfo.averageRating.toFixed(1)}
                        {googleBooksData.volumeInfo.ratingsCount && (
                          <span className="text-muted-foreground ml-1">
                            ({googleBooksData.volumeInfo.ratingsCount} reviews)
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {/* Google Books Description */}
                {googleBooksData?.volumeInfo?.description && (
                  <div className="space-y-2">
                    <h3 className="font-medium text-foreground">Description</h3>
                    <div className="text-sm text-muted-foreground max-h-32 overflow-y-auto">
                      <p>{googleBooksData.volumeInfo.description}</p>
                    </div>
                  </div>
                )}

                {/* Categories */}
                {googleBooksData?.volumeInfo?.categories && googleBooksData.volumeInfo.categories.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-medium text-foreground">Categories</h3>
                    <div className="flex flex-wrap gap-1">
                      {googleBooksData.volumeInfo.categories.map((category: string, index: number) => (
                        <span key={index} className="px-2 py-1 bg-muted text-muted-foreground text-xs rounded">
                          {category}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Links */}
                {(googleBooksData?.volumeInfo?.infoLink || googleBooksData?.volumeInfo?.previewLink) && (
                  <div className="space-y-2">
                    <h3 className="font-medium text-foreground">Links</h3>
                    <div className="flex flex-wrap gap-2">
                      {googleBooksData.volumeInfo.infoLink && (
                        <a
                          href={googleBooksData.volumeInfo.infoLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-sm text-primary hover:underline"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Google Books Info
                        </a>
                      )}
                      {googleBooksData.volumeInfo.previewLink && (
                        <a
                          href={googleBooksData.volumeInfo.previewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-sm text-primary hover:underline"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Preview
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Loading Google Books Data */}
                {isLoadingGoogleBooks && (
                  <div className="text-sm text-muted-foreground">
                    Loading additional book information...
                  </div>
                )}

                {/* Additional Info */}
                {book.info && Object.keys(book.info).length > 0 && (
                  <div className="space-y-2 text-sm">
                    <h3 className="font-medium text-foreground">Additional Information</h3>
                    {Object.entries(book.info).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-muted-foreground">{key}:</span>
                        <span className="text-foreground">
                          {Array.isArray(value) ? value.join(', ') : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

              </div>
              </div>



              {/* Google Books Enhanced Sections */}
              {(googleBooksData || detailedGoogleBooksData) && (
                <div className="space-y-6 border-t border-border pt-6">
                  
                  {/* Loading indicator for detailed data */}
                  {isLoadingDetailedData && (
                    <div className="flex items-center justify-center py-6">
                      <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full mr-3"></div>
                      <div className="text-sm text-muted-foreground">Loading enhanced book information...</div>
                    </div>
                  )}
                  
                  {/* Author Section - Redesigned */}
                  {getBestGoogleBooksData()?.volumeInfo?.authors && (
                    <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl p-6">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center">
                            <User className="w-8 h-8 text-primary" />
                          </div>
                        </div>
                        <div className="flex-grow">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-lg font-semibold text-foreground">
                              {getBestGoogleBooksData()?.volumeInfo?.authors?.join(' & ')}
                            </h3>
                            <span className="px-2 py-1 bg-primary/20 text-primary text-xs rounded-full">
                              Author
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            Explore more works by this author in the "More by Author" section below.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* About the Work Section - Redesigned */}
                  {getBestGoogleBooksData()?.volumeInfo && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-3">
                        <Book className="w-6 h-6 text-primary" />
                        <h3 className="text-xl font-semibold text-foreground">About This Book</h3>
                      </div>
                      
                      <div className="grid gap-6">
                        
                        {/* Publication Info Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {getBestGoogleBooksData()?.volumeInfo?.publishedDate && (
                            <div className="bg-card border border-border rounded-lg p-4 text-center">
                              <div className="text-2xl font-bold text-primary mb-1">
                                {getBestGoogleBooksData()?.volumeInfo?.publishedDate}
                              </div>
                              <div className="text-xs text-muted-foreground">Published</div>
                            </div>
                          )}
                          
                          {getBestGoogleBooksData()?.volumeInfo?.pageCount && (
                            <div className="bg-card border border-border rounded-lg p-4 text-center">
                              <div className="text-2xl font-bold text-primary mb-1">
                                {getBestGoogleBooksData()?.volumeInfo?.pageCount}
                              </div>
                              <div className="text-xs text-muted-foreground">Pages</div>
                            </div>
                          )}

                          {getBestGoogleBooksData()?.volumeInfo?.averageRating && (
                            <div className="bg-card border border-border rounded-lg p-4 text-center">
                              <div className="flex items-center justify-center mb-1">
                                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400 mr-1" />
                                <span className="text-2xl font-bold text-primary">
                                  {getBestGoogleBooksData()?.volumeInfo?.averageRating?.toFixed(1)}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {getBestGoogleBooksData()?.volumeInfo?.ratingsCount ? 
                                  `${getBestGoogleBooksData()?.volumeInfo?.ratingsCount} reviews` : 'Rating'}
                              </div>
                            </div>
                          )}

                          {getBestGoogleBooksData()?.volumeInfo?.language && (
                            <div className="bg-card border border-border rounded-lg p-4 text-center">
                              <div className="text-2xl font-bold text-primary mb-1">
                                {getBestGoogleBooksData()?.volumeInfo?.language?.toUpperCase()}
                              </div>
                              <div className="text-xs text-muted-foreground">Language</div>
                            </div>
                          )}
                        </div>

                        {/* Publisher Info */}
                        {getBestGoogleBooksData()?.volumeInfo?.publisher && (
                          <div className="bg-muted/30 rounded-lg p-4">
                            <div className="text-sm text-muted-foreground mb-1">Published by</div>
                            <div className="font-medium text-foreground">
                              {getBestGoogleBooksData()?.volumeInfo?.publisher}
                            </div>
                          </div>
                        )}

                        {/* Industry Identifiers (ISBN, etc.) - NEW */}
                        {getBestGoogleBooksData()?.volumeInfo?.industryIdentifiers && (
                          <div className="space-y-3">
                            <span className="text-sm font-medium text-muted-foreground">Identifiers</span>
                            <div className="flex flex-wrap gap-2">
                              {getBestGoogleBooksData()?.volumeInfo?.industryIdentifiers?.map((identifier: any, index: number) => (
                                <span key={index} className="px-2 py-1 bg-muted text-muted-foreground text-xs rounded border">
                                  {identifier.type}: {identifier.identifier}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Plot & Description - Beautiful Design */}
                        {(getBestGoogleBooksData()?.searchInfo?.textSnippet || getBestGoogleBooksData()?.volumeInfo?.description) && (
                          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-6">
                            <h4 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                              <span className="w-2 h-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"></span>
                              Plot & Story
                            </h4>
                            <div className="space-y-4">
                              {getBestGoogleBooksData()?.searchInfo?.textSnippet && (
                                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border-l-4 border-emerald-400">
                                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mb-2">KEY CHARACTERS</div>
                                  <p className="text-sm text-foreground leading-relaxed italic">
                                    "{getBestGoogleBooksData()?.searchInfo?.textSnippet}"
                                  </p>
                                </div>
                              )}
                              {getBestGoogleBooksData()?.volumeInfo?.description && (
                                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4">
                                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mb-2">DESCRIPTION</div>
                                  <div 
                                    className="text-sm text-foreground leading-relaxed max-h-40 overflow-y-auto prose prose-sm max-w-none"
                                    dangerouslySetInnerHTML={{ __html: getBestGoogleBooksData()?.volumeInfo?.description || '' }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Genres - Beautiful Design */}
                        {getBestGoogleBooksData()?.volumeInfo?.categories && (
                          <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl p-6">
                            <h4 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                              <span className="w-2 h-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"></span>
                              Genres & Categories
                            </h4>
                            <div className="flex flex-wrap gap-3">
                              {getBestGoogleBooksData()?.volumeInfo?.categories?.map((category: string, index: number) => (
                                <span 
                                  key={index} 
                                  className="px-4 py-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300 text-sm font-medium rounded-full shadow-sm hover:shadow-md transition-shadow"
                                >
                                  {category}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Subjects - New section for detailed categorization */}
                        {getBestGoogleBooksData()?.volumeInfo?.subjects && (
                          <div className="space-y-3">
                            <span className="text-sm font-medium text-muted-foreground">Subjects</span>
                            <div className="text-sm text-foreground leading-relaxed">
                              {getBestGoogleBooksData()?.volumeInfo?.subjects?.join(', ')}
                            </div>
                          </div>
                        )}

                        {/* Main Category - NEW */}
                        {getBestGoogleBooksData()?.volumeInfo?.mainCategory && (
                          <div className="space-y-3">
                            <span className="text-sm font-medium text-muted-foreground">Main Category</span>
                            <div className="text-sm text-foreground">
                              {getBestGoogleBooksData()?.volumeInfo?.mainCategory}
                            </div>
                          </div>
                        )}

                        {/* Additional Details from Google Books */}
                        {(googleBooksData.volumeInfo?.industryIdentifiers || googleBooksData.volumeInfo?.maturityRating) && (
                          <div className="space-y-3">
                            <span className="text-sm font-medium text-muted-foreground">Additional Details</span>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                              {googleBooksData.volumeInfo.industryIdentifiers?.map((identifier: any, index: number) => (
                                <div key={index} className="flex justify-between">
                                  <span className="text-muted-foreground">{identifier.type}:</span>
                                  <span className="text-foreground font-mono">{identifier.identifier}</span>
                                </div>
                              ))}
                              {googleBooksData.volumeInfo.maturityRating && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Maturity:</span>
                                  <span className="text-foreground">{googleBooksData.volumeInfo.maturityRating.replace('_', ' ')}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Rating */}
                        {getBestGoogleBooksData()?.volumeInfo?.averageRating && (
                          <div className="flex items-center gap-2 pt-2 border-t border-border">
                            <div className="flex items-center">
                              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                              <span className="ml-1 text-sm font-medium text-foreground">
                                {getBestGoogleBooksData()?.volumeInfo?.averageRating?.toFixed(1)}
                              </span>
                            </div>
                            {getBestGoogleBooksData()?.volumeInfo?.ratingsCount && (
                              <span className="text-sm text-muted-foreground">
                                ({getBestGoogleBooksData()?.volumeInfo?.ratingsCount} reviews)
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}



                  {/* More by Author Section */}
                  {(authorBooks.length > 0 || isLoadingAuthorBooks) && (
                    <div className="space-y-4">
                      <h3 className="text-xl font-semibold text-foreground">
                        More by {getBestGoogleBooksData()?.volumeInfo?.authors?.[0] || book.author}
                      </h3>
                      
                      {isLoadingAuthorBooks ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="text-muted-foreground">Loading more books...</div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                          {authorBooks.map((authorBook, index) => (
                            <div key={index} className="space-y-2">
                              <div className="aspect-[3/4] bg-muted rounded-lg overflow-hidden">
                                {authorBook.volumeInfo?.imageLinks?.thumbnail ? (
                                  <img
                                    src={authorBook.volumeInfo.imageLinks.thumbnail.replace('http:', 'https:')}
                                    alt={authorBook.volumeInfo?.title || 'Book cover'}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Book className="w-8 h-8 text-muted-foreground" />
                                  </div>
                                )}
                              </div>
                              <div className="space-y-1">
                                <h4 className="text-xs font-medium text-foreground line-clamp-2">
                                  {authorBook.volumeInfo?.title || 'Untitled'}
                                </h4>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full h-7 text-xs"
                                  onClick={() => handleSearchByTitle(authorBook.volumeInfo?.title || '')}
                                >
                                  <Search className="w-3 h-3 mr-1" />
                                  Search
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
