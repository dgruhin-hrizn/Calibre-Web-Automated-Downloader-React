import { useState, useEffect } from 'react'
import { Book, Send, Star, Check, X, Loader2, Calendar, FileText, Tag, ExternalLink, Globe, Trash2, AlertTriangle } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Card, CardContent } from '../../../components/ui/card'
import { formatDate } from '../../../lib/utils'
import { useAdminStatus } from '../hooks/useAdminStatus'
import type { LibraryBook } from '../types'

interface EnhancedBookDetailsModalProps {
  book: LibraryBook
  onClose: () => void
  onSendToKindle: (book: LibraryBook) => Promise<{ success: boolean; message: string }>
  onBookDeleted?: () => void
}

export function EnhancedBookDetailsModal({ book, onClose, onSendToKindle, onBookDeleted }: EnhancedBookDetailsModalProps) {
  const coverUrl = book.has_cover ? `/api/metadata/books/${book.id}/cover` : null
  const [kindleState, setKindleState] = useState<'idle' | 'sending' | 'success' | 'failed'>('idle')
  const [imageError, setImageError] = useState(false)
  const [deleteState, setDeleteState] = useState<'idle' | 'deleting' | 'success' | 'failed'>('idle')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  // Admin status check
  const { isAdmin } = useAdminStatus()
  
  // Google Books integration with granular loading states
  const [googleBooksData, setGoogleBooksData] = useState<any>(null)
  const [isLoadingGoogleBooks, setIsLoadingGoogleBooks] = useState(false)

  const handleSendToKindle = async () => {
    if (kindleState !== 'idle') return
    
    setKindleState('sending')
    
    try {
      const result = await onSendToKindle(book)
      setKindleState(result.success ? 'success' : 'failed')
      
      // Reset button state after 3 seconds
      setTimeout(() => setKindleState('idle'), 3000)
    } catch (error) {
      setKindleState('failed')
      // Reset button state after 3 seconds
      setTimeout(() => setKindleState('idle'), 3000)
    }
  }

  const handleDeleteClick = () => {
    if (deleteState !== 'idle' || !isAdmin) return
    setShowDeleteConfirm(true)
  }

  const handleDeleteConfirm = async () => {
    setShowDeleteConfirm(false)
    setDeleteState('deleting')
    
    try {
      const response = await fetch(`/api/admin/books/${book.id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      
      if (response.ok) {
        setDeleteState('success')
        // Close modal and notify parent
        setTimeout(() => {
          onClose()
          if (onBookDeleted) {
            onBookDeleted()
          }
        }, 1000)
      } else {
        setDeleteState('failed')
        setTimeout(() => setDeleteState('idle'), 3000)
      }
    } catch (error) {
      console.error('Failed to delete book:', error)
      setDeleteState('failed')
      setTimeout(() => setDeleteState('idle'), 3000)
    }
  }

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false)
  }

  // Fetch Google Books data for enhanced information
  useEffect(() => {
    const fetchGoogleBooksData = async () => {
      if (!book || !book.title) return

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
            author: book.authors?.[0] || ''
          })
        })

        if (response.ok) {
          const googleData = await response.json()
          setGoogleBooksData(googleData)
        }
      } catch (error) {
        console.error('Error fetching Google Books data:', error)
      } finally {
        setIsLoadingGoogleBooks(false)
      }
    }

    fetchGoogleBooksData()
  }, [book])

  // Helper function to format published date
  const formatPublishedDate = (dateString: string) => {
    if (!dateString) return ''
    
    try {
      let date: Date
      
      if (dateString.match(/^\d{4}$/)) {
        date = new Date(`${dateString}-01-01`)
      } else if (dateString.match(/^\d{4}-\d{2}$/)) {
        date = new Date(`${dateString}-01`)
      } else if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        date = new Date(dateString)
      } else {
        date = new Date(dateString)
      }
      
      if (isNaN(date.getTime())) {
        return dateString
      }
      
      const month = (date.getMonth() + 1).toString().padStart(2, '0')
      const day = date.getDate().toString().padStart(2, '0')
      const year = date.getFullYear()
      
      return `${month}/${day}/${year}`
    } catch (error) {
      return dateString
    }
  }

  // Helper function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Get enhanced data combining library + Google Books (prioritizing library metadata)
  const getEnhancedData = () => {
    const volumeInfo = googleBooksData?.volumeInfo || {}
    
    return {
      // Primary library metadata (always preferred)
      title: book.title,
      authors: book.authors,
      series: book.series,
      series_index: book.series_index,
      rating: book.rating,
      pubdate: book.pubdate,
      timestamp: book.timestamp,
      tags: book.tags,
      languages: book.languages,
      formats: book.formats,
      comments: book.comments,
      
      // Enhanced data - prefer library metadata, fallback to Google Books
      description: book.comments || volumeInfo.description, // Library comments first
      categories: book.tags?.length > 0 ? [] : (volumeInfo.categories || []), // Use Google categories only if no tags
      averageRating: book.rating ? book.rating / 2 : volumeInfo.averageRating, // Library rating first (convert 10-point to 5-point)
      ratingsCount: volumeInfo.ratingsCount, // Only from Google Books
      pageCount: volumeInfo.pageCount, // Only from Google Books (library doesn't have this)
      publishedDate: book.pubdate ? formatDate(book.pubdate) : formatPublishedDate(volumeInfo.publishedDate), // Library pubdate first
      publisher: book.publishers?.[0] || volumeInfo.publisher, // Library publisher first, fallback to Google Books
      infoLink: volumeInfo.infoLink, // Only from Google Books
      previewLink: volumeInfo.previewLink, // Only from Google Books
      language: book.languages?.[0] || volumeInfo.language, // Library language first
      last_modified: book.last_modified, // Library only
      isbn: book.isbn, // Library only
      uuid: book.uuid // Library only
    }
  }

  const data = getEnhancedData()
  
  // Skeleton component for loading states
  const Skeleton = ({ className = "", width = "w-full" }: { className?: string, width?: string }) => (
    <div className={`animate-pulse bg-muted rounded ${width} h-4 ${className}`} />
  )
  
  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50" style={{ margin: 0 }}>
      <div className="bg-card border border-border rounded-lg shadow-lg max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col" style={{ margin: 0 }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex-1 mr-4">
            <h2 className="text-xl font-semibold text-foreground line-clamp-2">
              {data.title}
            </h2>
            {data.authors && data.authors.length > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                by {data.authors.join(', ')}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="p-2 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Main Book Layout */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Cover */}
              <div className="w-full h-64 md:h-80 bg-muted rounded overflow-hidden flex-shrink-0">
                {coverUrl && !imageError ? (
                  <img 
                    src={coverUrl} 
                    alt={data.title}
                    className="w-full h-full object-cover"
                    onError={() => setImageError(true)}
                    onLoad={() => setImageError(false)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <Book className="h-16 w-16 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Book Details */}
              <div className="md:col-span-3 space-y-6">
                {/* Publication Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column - Publication Info */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-primary" />
                      Publication Details
                    </h3>
                    
                    <div className="space-y-3 text-sm">
                      {/* Publisher - Google Books only */}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Publisher:</span>
                        {data.publisher ? (
                          <span className="text-foreground text-right">{data.publisher}</span>
                        ) : isLoadingGoogleBooks ? (
                          <Skeleton width="w-24" />
                        ) : (
                          <span className="text-muted-foreground text-right">Unknown</span>
                        )}
                      </div>
                      
                      {/* Published Date - Library first, then Google Books */}
                      {(data.publishedDate || isLoadingGoogleBooks) && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Published:</span>
                          {data.publishedDate ? (
                            <span className="text-foreground">{data.publishedDate}</span>
                          ) : isLoadingGoogleBooks ? (
                            <Skeleton width="w-20" />
                          ) : null}
                        </div>
                      )}
                      
                      {/* Language - Library first */}
                      {data.language && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Language:</span>
                          <span className="text-foreground capitalize">{data.language}</span>
                        </div>
                      )}
                      
                      {/* Page Count - Google Books only */}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Pages:</span>
                        {data.pageCount ? (
                          <span className="text-foreground">{data.pageCount}</span>
                        ) : isLoadingGoogleBooks ? (
                          <Skeleton width="w-16" />
                        ) : (
                          <span className="text-muted-foreground">Unknown</span>
                        )}
                      </div>

                      {/* Series - Library only */}
                      {data.series && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Series:</span>
                          <span className="text-foreground text-right">
                            {data.series} {data.series_index && `#${data.series_index}`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column - File Info */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      File Details
                    </h3>
                    
                    <div className="space-y-3 text-sm">
                      {data.formats && data.formats.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Formats:</span>
                            <span className="text-foreground uppercase">{data.formats.join(', ')}</span>
                          </div>
                          {/* File sizes for each format */}
                          {book.file_sizes && Object.keys(book.file_sizes).length > 0 && (
                            <div className="space-y-1 pl-4 border-l-2 border-muted">
                              {Object.entries(book.file_sizes).map(([format, size]) => (
                                <div key={format} className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">{format}:</span>
                                  <span className="text-foreground">{formatFileSize(size)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Rating - Library first, enhanced by Google Books */}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Rating:</span>
                        {data.averageRating ? (
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            <span className="text-foreground">{data.averageRating}</span>
                            {data.ratingsCount && (
                              <span className="text-muted-foreground">({data.ratingsCount} reviews)</span>
                            )}
                          </div>
                        ) : isLoadingGoogleBooks ? (
                          <Skeleton width="w-20" />
                        ) : (
                          <span className="text-muted-foreground">No rating</span>
                        )}
                      </div>

                      {data.timestamp && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Added:</span>
                          <span className="text-foreground">{formatDate(data.timestamp)}</span>
                        </div>
                      )}
                      
                      {/* Last Modified - Library only */}
                      {data.last_modified && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Modified:</span>
                          <span className="text-foreground">{formatDate(data.last_modified)}</span>
                        </div>
                      )}
                      
                      {/* ISBN - Library only */}
                      {data.isbn && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">ISBN:</span>
                          <span className="text-foreground font-mono text-xs">{data.isbn}</span>
                        </div>
                      )}
                      
                      {/* UUID - Library only */}
                      {data.uuid && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">UUID:</span>
                          <span className="text-foreground font-mono text-xs">{data.uuid.slice(0, 8)}...</span>
                        </div>
                      )}
                    </div>

                    {/* Tags (Library) or Categories (Google Books) */}
                    {(data.tags?.length > 0 || data.categories?.length > 0 || isLoadingGoogleBooks) && (
                      <div className="space-y-2 pt-3 border-t border-border/50">
                        <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                          <Tag className="w-4 h-4 text-primary" />
                          {data.tags?.length > 0 ? 'Tags' : 'Categories'}
                        </h4>
                        <div className="flex flex-wrap gap-1">
                          {/* Show library tags first, fallback to Google categories */}
                          {data.tags?.length > 0 || data.categories?.length > 0 ? (
                            (data.tags?.length > 0 ? data.tags : data.categories).map((item: string, index: number) => (
                              <span
                                key={index}
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                              >
                                {item}
                              </span>
                            ))
                          ) : isLoadingGoogleBooks && !data.tags?.length ? (
                            // Show skeleton badges for loading categories
                            <>
                              <Skeleton width="w-16" className="h-6 rounded-full" />
                              <Skeleton width="w-20" className="h-6 rounded-full" />
                              <Skeleton width="w-14" className="h-6 rounded-full" />
                            </>
                          ) : null}
                        </div>
                      </div>
                    )}

                    {/* External Links - Google Books only */}
                    {(data.infoLink || data.previewLink || isLoadingGoogleBooks) && (
                      <div className="space-y-2 pt-3 border-t border-border/50">
                        <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                          <ExternalLink className="w-4 h-4 text-primary" />
                          External Links
                        </h4>
                        <div className="space-y-1">
                          {data.infoLink || data.previewLink ? (
                            <>
                              {data.infoLink && (
                                <a
                                  href={data.infoLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                >
                                  <Globe className="w-3 h-3" />
                                  Google Books Info
                                </a>
                              )}
                              {data.previewLink && (
                                <a
                                  href={data.previewLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline block"
                                >
                                  <Book className="w-3 h-3" />
                                  Google Books Preview
                                </a>
                              )}
                            </>
                          ) : isLoadingGoogleBooks ? (
                            <>
                              <Skeleton width="w-28" className="h-4" />
                              <Skeleton width="w-32" className="h-4" />
                            </>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                </div>


              </div>
            </div>

            {/* Description - Library first, enhanced by Google Books */}
            {(data.description || isLoadingGoogleBooks) && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Book className="w-5 h-5 text-primary" />
                  Description
                </h3>
                <div className="border border-border rounded-lg p-4 bg-muted/20">
                  {data.description ? (
                    <div className="prose prose-sm max-w-none text-muted-foreground leading-relaxed">
                      <div 
                        className="[&>p]:mb-3 [&>p:last-child]:mb-0 [&>br]:block [&>br]:mb-2 [&>b]:font-semibold [&>strong]:font-semibold [&>i]:italic [&>em]:italic [&>u]:underline"
                        dangerouslySetInnerHTML={{ __html: data.description }} 
                      />
                    </div>
                  ) : isLoadingGoogleBooks ? (
                    <div className="space-y-2">
                      <Skeleton width="w-full" />
                      <Skeleton width="w-full" />
                      <Skeleton width="w-3/4" />
                      <Skeleton width="w-full" />
                      <Skeleton width="w-5/6" />
                    </div>
                  ) : null}
                </div>
              </div>
            )}


          </div>
        </div>
        
        {/* Footer */}
        <div className="flex-shrink-0 border-t border-border p-6">
          <div className="flex justify-between">
            {/* Admin Delete Button */}
            {isAdmin && (
              <Button
                onClick={handleDeleteClick}
                disabled={deleteState !== 'idle'}
                variant="destructive"
                size="lg"
                className={`px-6 ${
                  deleteState === 'success' ? 'bg-green-600 hover:bg-green-700' :
                  deleteState === 'failed' ? 'bg-red-700 hover:bg-red-800' :
                  ''
                }`}
              >
                {deleteState === 'deleting' && (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                )}
                {deleteState === 'success' && (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Deleted
                  </>
                )}
                {deleteState === 'failed' && (
                  <>
                    <X className="h-4 w-4 mr-2" />
                    Delete Failed
                  </>
                )}
                {deleteState === 'idle' && (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Book
                  </>
                )}
              </Button>
            )}
            
            {/* Send to e-Reader Button */}
            <Button
              onClick={handleSendToKindle}
              disabled={kindleState !== 'idle'}
              size="lg"
              className={`px-8 ${
                kindleState === 'success' ? 'bg-green-600 hover:bg-green-700 text-white' :
                kindleState === 'failed' ? 'bg-red-600 hover:bg-red-700 text-white' :
                ''
              }`}
            >
              {kindleState === 'sending' && (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              )}
              {kindleState === 'success' && (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Sent to e-Reader
                </>
              )}
              {kindleState === 'failed' && (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Send Failed
                </>
              )}
              {kindleState === 'idle' && (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send to e-Reader
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={handleDeleteCancel} />
          <Card className="relative w-full max-w-md mx-4 z-10">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-shrink-0 w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Delete Book</h3>
                  <p className="text-sm text-muted-foreground">This action cannot be undone</p>
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground mb-6">
                Are you sure you want to delete <strong>"{book.title}"</strong>
                {book.authors && <span> by {book.authors}</span>}? 
                This will permanently remove the book from your library.
              </p>
              
              <div className="flex justify-end gap-3">
                <Button
                  onClick={handleDeleteCancel}
                  variant="outline"
                  size="sm"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDeleteConfirm}
                  variant="destructive"
                  size="sm"
                  className="px-4"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Book
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
